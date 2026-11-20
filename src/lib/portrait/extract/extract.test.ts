import { describe, expect, it } from 'vitest';
import { mergeItems, mergeMods } from '../merge';
import { openChosenMods, packFolder } from './browser';
import { Extraction } from './extract';
import { parseJson } from './json';
import { AssetStore, DirSource, PakSource, parseFrames, type Source } from './sources';

// Made-up mods only (no game file is ever used in tests): a base game as a pak, a mod that
// redraws and patches it, and one that changes nothing the creator reads. The same cases as
// scripts/portrait-extract/test_extract.py; parity.test.ts compares the two extractors on a
// real install.

const text = (s: string) => new TextEncoder().encode(s);
const png = (shade: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, shade]); // opaque to the extractor: any bytes
type Files = Record<string, object | Uint8Array>;
const body = (content: object | Uint8Array) => (content instanceof Uint8Array ? content : text(JSON.stringify(content)));

/** An SBAsset6 pak holding `files`, with `meta` in its index. */
function pak(files: Files, meta: Record<string, string | number>): Blob {
    const vlq = (n: number): number[] => (n < 128 ? [n] : [...vlq(Math.floor(n / 128)).map((b, i, all) => (i < all.length ? b | 0x80 : b)), n % 128]);
    const str = (s: string) => [...vlq(text(s).length), ...text(s)];
    const u64 = (n: number) => [0, 0, 0, 0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const parts: number[] = [];
    const index: number[] = [...text('INDEX'), ...vlq(Object.keys(meta).length)];
    for (const [key, value] of Object.entries(meta)) {
        index.push(...str(key));
        if (typeof value === 'string') index.push(5, ...str(value));
        else {
            const double = new Uint8Array(8);
            new DataView(double.buffer).setFloat64(0, value);
            index.push(2, ...double);
        }
    }
    index.push(...vlq(Object.keys(files).length));
    for (const [name, content] of Object.entries(files)) {
        const bytes = body(content);
        index.push(...str(`/${name}`), ...u64(16 + parts.length), ...u64(bytes.length));
        parts.push(...bytes);
    }
    return new Blob([new Uint8Array([...text('SBAsset6'), ...u64(16 + parts.length), ...parts, ...index])]);
}
const folder = (name: string, files: Files, meta: object) =>
    DirSource.open(name, Object.entries({ _metadata: { name, ...meta }, ...files }).map(([path, content]) => ({ path, file: new Blob([body(content) as Uint8Array<ArrayBuffer>]) })));

const SHIRT = { itemName: 'shirt', shortdescription: '^orange;Shirt', inventoryIcon: 'icons.png:chest', maleFrames: { body: 'chestm.png' }, femaleFrames: { body: 'chestm.png' }, colorOptions: [{ AA: 'BB' }] };
const BASE: Files = {
    'species/elf.species': { kind: 'elf', genders: [{ name: 'male', hair: ['1'] }] },
    'interface/windowconfig/charcreation.config': { speciesOrdering: ['elf'] },
    'humanoid/elf/malebody.png': png(1),
    'humanoid/elf/malehead.png': png(2),
    'humanoid/elf/hair/1.png': png(3),
    'humanoid/default.frames': { frameGrid: { size: [1, 1], dimensions: [1, 1], names: [['normal']] } },
    'items/armors/shirt/shirt.chest': SHIRT,
    'items/armors/shirt/chestm.png': png(4),
    'items/armors/shirt/icons.png': png(5),
};
const CUTE: Files = {
    'species/elf.species.patch': [{ op: 'add', path: '/genders/0/hair/-', value: '2' }],
    'humanoid/elf/malehead.png': png(9),
    'humanoid/elf/hair/2.png': png(8),
    'items/armors/shirt/shirt.chest.patch': [{ op: 'replace', path: '/femaleFrames/body', value: 'chestf.png' }],
    'items/armors/shirt/chestf.png': png(7),
};
const QUIET: Files = { 'items/armors/shirt/shirt.chest.patch': [{ op: 'add', path: '/learnBlueprintsOnPickup', value: ['x'] }] };

async function extract(mods: { source: Source; id?: string | null }[]) {
    const warnings: string[] = [];
    const store = new AssetStore((m) => warnings.push(m));
    store.load(await PakSource.open('packed.pak', pak(BASE, { name: 'base' })), mods);
    return { extraction: await Extraction.run(store), warnings };
}

describe('browser extractor', () => {
    it('reads a pak: its metadata, and files by lowercased path', async () => {
        const source = await PakSource.open('x/contents.pak', pak({ 'Humanoid/Elf/Body.PNG': png(1) }, { name: 'TheMod', friendlyName: 'The Mod', priority: 5, steamContentId: '123' }));
        expect([source.name, source.title, source.priority, source.meta.steamContentId]).toEqual(['TheMod', 'The Mod', 5, '123']);
        expect([...source.files.keys()]).toEqual(['/humanoid/elf/body.png']);
        expect([...(await source.read('/humanoid/elf/body.png'))]).toEqual([...png(1)]);
        await expect(PakSource.open('junk.pak', new Blob(['not a pak at all, just text']))).rejects.toThrow('not an SBAsset6 pak');
    });

    it('gives each mod only its own contribution', async () => {
        const { extraction } = await extract([{ source: await folder('cute', CUTE, { priority: 5 }) }, { source: await folder('quiet', QUIET, {}) }]);
        expect(extraction.offered().map((m) => m.id)).toEqual(['vanilla', 'cute']); // quiet changes nothing the creator reads
        const base = await extraction.build(extraction.mods.get('vanilla')!);
        const cute = await extraction.build(extraction.mods.get('cute')!);

        expect(Object.keys(base.mod.images).sort()).toEqual(['/humanoid/elf/hair/1.png', '/humanoid/elf/malebody.png', '/humanoid/elf/malehead.png']);
        expect(Object.keys(cute.mod.images).sort()).toEqual(['/humanoid/elf/hair/2.png', '/humanoid/elf/malehead.png']);
        expect(base.mod.species.elf).toMatchObject({ kind: 'elf', playable: true, order: 0, config: { kind: 'elf' } });
        expect(cute.mod.species).toEqual({});
        expect(cute.mod.speciesPatches.elf).toEqual(CUTE['species/elf.species.patch']);
        expect(base.mod.frames['/humanoid/default.frames']).toEqual({ normal: [0, 0, 1, 1] });
        expect(base.mod.frameFiles).toEqual(['/humanoid/default.frames']);
        expect([base.mod.modName, cute.mod.modName, cute.mod.priority]).toEqual(['base', 'cute', 5]);

        // the base defines the shirt; cute's patch gives it another sheet, so cute lists its version
        expect(base.items.items).toEqual([{ id: 'shirt', slot: 'chest', name: 'Shirt', frames: { male: { body: '/items/armors/shirt/chestm.png' }, female: { body: '/items/armors/shirt/chestm.png' } }, colors: 0, icon: '/items/armors/shirt/icons.png:chest' }]);
        expect(base.items.palettes).toEqual([[{ aa: 'bb' }]]);
        expect(cute.items.items).toMatchObject([{ id: 'shirt', patch: true, frames: { female: { body: '/items/armors/shirt/chestf.png' } } }]);
        expect(Object.keys(cute.items.images)).toEqual(['/items/armors/shirt/chestf.png']);

        // every image sits where its entry says, the icon first
        for (const built of [base, cute]) {
            for (const [path, [offset, length]] of Object.entries({ ...built.mod.images, ...built.items.images })) {
                const source = extraction.mods.get(built.mod.id)!.src;
                expect([...built.pack.subarray(offset, offset + length)], path).toEqual([...(await source.read(path))]);
            }
        }
        expect(base.items.images['/items/armors/shirt/icons.png'][0]).toBe(0);
        expect(extraction.mods.get('vanilla')!.packBytes()).toBe(base.pack.length);

        // what the site makes of the two folders
        const manifest = mergeMods([cute.mod, base.mod]);
        expect(manifest.images['/humanoid/elf/malehead.png'].m).toEqual(['vanilla', 'cute']);
        expect(mergeItems([base.items, cute.items], manifest).items[0]).toMatchObject({ id: 'shirt', mod: 'vanilla', frames: { female: { body: '/items/armors/shirt/chestf.png' } } });
    });

    it('builds the same folder for a mod whether or not other mods are beside it', async () => {
        const alone = await extract([{ source: await folder('cute', CUTE, {}) }]);
        const beside = await extract([{ source: await folder('cute', CUTE, {}) }, { source: await folder('quiet', QUIET, {}) }]);
        const a = await alone.extraction.build(alone.extraction.mods.get('cute')!);
        const b = await beside.extraction.build(beside.extraction.mods.get('cute')!);
        expect(b.mod.build).toBe(a.mod.build);
        expect([...b.pack]).toEqual([...a.pack]);
    });

    it('finds mods among chosen files: workshop folders by number, a pak by the id it carries', async () => {
        const file = (name: string, relative: string, content: Blob) => Object.defineProperty(new File([content], name), 'webkitRelativePath', { value: relative });
        const modPak = (name: string, id?: string) => pak(CUTE, { name, ...(id ? { steamContentId: id } : {}) });
        const meta = new Blob([JSON.stringify({ name: 'loose' })]);
        const chosen = [
            file('contents.pak', '211820/111/contents.pak', modPak('One')),
            file('a.pak', '211820/222/a.pak', modPak('TwoA')),
            file('b.pak', '211820/222/b.pak', modPak('TwoB')),
            file('_metadata', '211820/333/_metadata', meta),
            file('malehead.png', '211820/333/humanoid/elf/malehead.png', new Blob([png(6) as Uint8Array<ArrayBuffer>])),
            file('readme.txt', '211820/444/readme.txt', new Blob(['not a mod'])),
            file('packed.pak', '', pak(BASE, { name: 'base' })),
            file('picked.pak', '', modPak('Picked', '555')),
            file('homemade.pak', '', modPak('Home Made')),
            file('broken.pak', '', new Blob(['nope'])),
        ];
        const warnings: string[] = [];
        const mods = await openChosenMods(chosen, (m) => warnings.push(m));
        expect(mods.map((m) => [m.source.name, m.id]).sort()).toEqual([['Home Made', null], ['One', '111'], ['Picked', '555'], ['TwoA', '222-a'], ['TwoB', '222-b'], ['loose', '333']]);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('broken.pak');
        const { extraction } = await extract(mods);
        expect(extraction.mods.has('home-made')).toBe(true); // no number: a slug of its name
        expect(extraction.mods.get('333')!.speciesImages.has('/humanoid/elf/malehead.png')).toBe(true);
    });

    it('packs a folder as the one file the server takes', async () => {
        const { extraction } = await extract([]);
        const built = await extraction.build(extraction.mods.get('vanilla')!);
        const bytes = new Uint8Array(await packFolder(built).arrayBuffer());
        const view = new DataView(bytes.buffer);
        expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('FFPM1\n');
        const modLength = view.getUint32(6);
        expect(parseJson(bytes.subarray(10, 10 + modLength))).toEqual(JSON.parse(JSON.stringify(built.mod)));
        const itemsLength = view.getUint32(10 + modLength);
        expect([...bytes.subarray(14 + modLength + itemsLength)]).toEqual([...built.pack]);
    });
});

describe('Starbound JSON and frames', () => {
    it('reads comments, raw control characters in strings and a trailing comma', () => {
        expect(parseJson('{ // note\n "a": "x\ty", /* more */ "b": [1, 2,], }')).toEqual({ a: 'x\ty', b: [1, 2] });
        expect(parseJson('{"url": "http://x//y"}')).toEqual({ url: 'http://x//y' });
        expect(() => parseJson('{nope')).toThrow();
    });

    it('turns a frames file into rectangles, with grids, lists and aliases', () => {
        expect(parseFrames({ frameGrid: { size: [2, 3], dimensions: [2, 2], names: [['a', null], ['c', 'd']] }, aliases: { e: 'd', f: 'e' } })).toEqual({ a: [0, 0, 2, 3], c: [0, 3, 2, 3], d: [2, 3, 2, 3], e: [2, 3, 2, 3], f: [2, 3, 2, 3] });
        expect(parseFrames({ frameGrid: { begin: [1, 1], size: [4, 4], dimensions: [2, 1] } })).toEqual({ '0': [1, 1, 4, 4], '1': [5, 1, 4, 4] });
        expect(parseFrames({ frameList: { x: [1, 2, 5, 8] } })).toEqual({ x: [1, 2, 4, 6] });
        expect(() => parseFrames({ frameGrid: { dimensions: [1, 1] } })).toThrow();
    });
});
