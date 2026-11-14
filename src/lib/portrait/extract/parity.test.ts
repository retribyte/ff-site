import { existsSync, openAsBlob, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Extraction } from './extract';
import { AssetStore, DirSource, PakSource, type Source } from './sources';

// Runs the browser extractor over a real Starbound install and compares every mod folder
// with the one scripts/portrait-extract/extract.py wrote from the same files. Only on a
// machine that has the game: set STARBOUND_DIR (the folder holding assets/packed.pak) and
// build .portrait-bundle with the Python extractor first. PORTRAIT_EXTRA_MODS lists the
// --mod paths that run was given (path-separator separated).
//
//   STARBOUND_DIR=... PORTRAIT_EXTRA_MODS=../squoatling-mod npx vitest run src/lib/portrait/extract/parity

const starbound = process.env.STARBOUND_DIR;
const bundleDir = path.resolve(import.meta.dirname, '../../../../.portrait-bundle');
const curation = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data/portrait/curation.json'), 'utf8'));

async function dirEntries(root: string): Promise<{ path: string; file: Blob }[]> {
    const out: { path: string; file: Blob }[] = [];
    const walk = async (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.isFile()) out.push({ path: path.relative(root, full).split(path.sep).join('/'), file: await openAsBlob(full) });
        }
    };
    await walk(root);
    return out;
}

const open = async (file: string): Promise<Source> => (statSync(file).isDirectory() ? DirSource.open(file, await dirEntries(file)) : PakSource.open(file, await openAsBlob(file)));
const isMod = (dir: string) => ['_metadata', '.metadata'].some((m) => existsSync(path.join(dir, m)));

/** The same search extract.py makes: <Starbound>/mods, the workshop folder, then the extra paths. */
function discover(root: string): { file: string; id: string | null }[] {
    const mods: { file: string; id: string | null }[] = [];
    const modsDir = path.join(root, 'mods');
    if (existsSync(modsDir)) {
        for (const name of readdirSync(modsDir).sort()) {
            const full = path.join(modsDir, name);
            if (name.toLowerCase().endsWith('.pak') || (statSync(full).isDirectory() && isMod(full))) mods.push({ file: full, id: null });
        }
    }
    const workshop = path.resolve(root, '../../workshop/content/211820');
    if (existsSync(workshop)) {
        for (const item of readdirSync(workshop).sort()) {
            const folder = path.join(workshop, item);
            if (!statSync(folder).isDirectory()) continue;
            const paks = readdirSync(folder).filter((f) => f.endsWith('.pak')).sort();
            if (paks.length) for (const pak of paks) mods.push({ file: path.join(folder, pak), id: paks.length === 1 ? item : `${item}-${pak.slice(0, -4)}` });
            else mods.push({ file: folder, id: item });
        }
    }
    for (const extra of (process.env.PORTRAIT_EXTRA_MODS ?? '').split(path.delimiter).filter(Boolean)) mods.push({ file: path.resolve(extra), id: null });
    const skip = Object.keys(curation.skipMods ?? {});
    return mods.filter(({ file, id }) => {
        const ident = id ?? path.basename(file, path.extname(file));
        return !skip.some((s) => ident === s || ident.startsWith(`${s}-`));
    });
}

describe.skipIf(!starbound || !existsSync(path.join(bundleDir, 'vanilla', 'mod.json')))('browser extractor against extract.py', () => {
    it('writes the same folder for every mod', async () => {
        const warnings: string[] = [];
        const store = new AssetStore((m) => warnings.push(m));
        const vanilla = await open(path.join(starbound!, 'assets/packed.pak'));
        const sources: { source: Source; id: string | null }[] = [];
        for (const { file, id } of discover(starbound!)) sources.push({ source: await open(file), id });
        store.load(vanilla, sources);
        const extraction = await Extraction.run(store);

        const expected = readdirSync(bundleDir).filter((d) => existsSync(path.join(bundleDir, d, 'mod.json'))).sort();
        expect(extraction.offered().map((m) => m.id).sort()).toEqual(expected);
        const differing: string[] = [];
        for (const mod of extraction.offered()) {
            const built = await extraction.build(mod);
            const read = (file: string) => JSON.parse(readFileSync(path.join(bundleDir, mod.id, file), 'utf8'));
            const strip = (file: object) => JSON.parse(JSON.stringify({ ...file, build: '' }));
            const pack = readFileSync(path.join(bundleDir, mod.id, 'sprites.pack'));
            const same = Buffer.compare(pack, Buffer.from(built.pack)) === 0;
            if (!same) differing.push(`${mod.id}: pack`);
            try {
                expect(strip(built.mod)).toEqual(strip(read('mod.json')));
            } catch (e) {
                differing.push(`${mod.id}: mod.json ${String((e as Error).message).slice(0, 600)}`);
            }
            try {
                expect(strip(built.items)).toEqual(strip(read('items.json')));
            } catch (e) {
                differing.push(`${mod.id}: items.json ${String((e as Error).message).slice(0, 600)}`);
            }
            expect(mod.packBytes()).toBe(built.pack.length);
        }
        expect(differing).toEqual([]);
        expect([extraction.species, extraction.itemCount]).toEqual([Number(process.env.PORTRAIT_SPECIES ?? extraction.species), Number(process.env.PORTRAIT_ITEMS ?? extraction.itemCount)]);
    }, 600_000);
});
