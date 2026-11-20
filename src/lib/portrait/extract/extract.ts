// Builds mod folders for the portrait creator from Starbound's own files, in the browser: a
// port of scripts/portrait-extract/extract.py, giving the same mod.json, items.json and
// sprites.pack for the same files (checked against it; only `build`, a fingerprint, is made
// differently). The member's files are read where they are; only what build() returns for
// the mods they choose is uploaded.
//
// A mod's folder holds what that mod's own files contribute, but working that out needs the
// files around it: the base game says how sprites are cut into frames and defines the items
// and species a mod patches. So the base game's packed.pak is always among the sources.

import { applyPatchStrict, type Json } from '../jsonPatch';
import type { ColorOption, FrameRect, ImageRef, ModFile, ModItem, ModItemsFile, Personality, WearSlot } from '../types';
import { isObj, parseJson, type Obj } from './json';
import { AssetStore, dependencies, parseFrames, type Source } from './sources';

export const BUNDLE_VERSION = 2;
const ITEM_SLOTS: Record<string, WearSlot> = { '.head': 'head', '.chest': 'chest', '.legs': 'legs', '.back': 'back' };

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const clone = <T extends Json>(doc: T): T => JSON.parse(JSON.stringify(doc));
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha1 = async (data: Uint8Array) => hex(await crypto.subtle.digest('SHA-1', data as Uint8Array<ArrayBuffer>));

/** Text without Starbound colour codes (^orange;). */
const plain = (text: Json | undefined): string => (typeof text === 'string' ? text.replace(/\^[^;^]*;/g, '').trim() : '');

function deepMerge(base: Json | undefined, over: Json): Json {
    if (isObj(base) && isObj(over)) {
        const out: Obj = { ...base };
        for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
        return out;
    }
    return over;
}

/** An asset reference relative to `directory`, lowercased, without :frame or ?directives. */
function resolve(directory: string, ref: string): string {
    const path = ref.split(/[:?]/, 1)[0];
    return (path.startsWith('/') ? path : directory + path).toLowerCase();
}

/** Each option is a {from: to} hex map (a palette swap) or a raw directive string. */
function colorOptions(raw: Json | undefined): ColorOption[] {
    const out: ColorOption[] = [];
    for (const entry of Array.isArray(raw) ? raw : []) {
        if (isObj(entry)) out.push(Object.fromEntries(Object.entries(entry).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])));
        else if (typeof entry === 'string') out.push(entry);
    }
    return out;
}

type SpeciesEntry = ModFile['species'][string];

/** What one mod contributes to the bundle. */
export class ModOut {
    species: Record<string, SpeciesEntry> = {};
    speciesPatches: Record<string, Json> = {};
    items: (Omit<ModItem, 'colors'> & { colors: ColorOption[] })[] = [];
    frames: Record<string, Record<string, FrameRect>> = {};
    speciesImages = new Set<string>();
    itemImages = new Set<string>();

    constructor(readonly src: Source, readonly order: number) {}

    get id(): string {
        return this.src.id;
    }
    get name(): string {
        return this.src.title;
    }
    empty(): boolean {
        return !(Object.keys(this.species).length || Object.keys(this.speciesPatches).length || this.items.length || Object.keys(this.frames).length || this.speciesImages.size || this.itemImages.size);
    }
    /** Every image the folder will hold. */
    images(): string[] {
        return [...new Set([...this.speciesImages, ...this.itemImages])];
    }
    /** The pack's size, known without reading a sprite. */
    packBytes(): number {
        return this.images().reduce((sum, path) => sum + this.src.size(path), 0);
    }
}

export interface BuiltMod {
    mod: ModFile;
    items: ModItemsFile;
    pack: Uint8Array;
}

export interface ExtractProgress {
    stage: 'species' | 'items';
    done: number;
    total: number;
}

/**
 * Collects, per mod, the images the species and items refer to. Every mod that ships a path
 * keeps its own copy, so the site can choose between them and a mod can be removed without
 * touching another's folder.
 */
export class Extraction {
    readonly mods = new Map<string, ModOut>();
    private framesOf = new Map<string, string | null>();
    private icons = new Set<string>();
    private sheets = new Set<string>();
    private framesDone = new Set<string>();
    species = 0;
    playable = 0;
    itemCount = 0;

    private constructor(readonly store: AssetStore) {
        store.sources.forEach((src, i) => this.mods.set(src.id, new ModOut(src, i)));
    }

    /** Reads the species and items of a loaded store. `tick` is called as it goes, and may be awaited on to keep a page responsive. */
    static async run(store: AssetStore, tick: (progress: ExtractProgress) => void | Promise<void> = () => {}): Promise<Extraction> {
        const extraction = new Extraction(store);
        await extraction.buildSpecies(tick);
        await extraction.buildItems(tick);
        return extraction;
    }

    /** The mods with something to offer, in load order. */
    offered(): ModOut[] {
        return [...this.mods.values()].filter((mod) => !mod.empty());
    }

    /** Notes that an image is needed; false if no mod ships it. */
    private async use(path: string, species = false): Promise<boolean> {
        path = path.toLowerCase();
        const providers = this.store.providers.get(path);
        if (!providers) return false;
        for (const src of providers) {
            const out = this.mods.get(src.id)!;
            (species ? out.speciesImages : out.itemImages).add(path);
        }
        if (!this.framesOf.has(path)) {
            const framesPath = this.store.framesFile(path);
            const rects = framesPath ? await this.store.frames(framesPath) : null;
            this.framesOf.set(path, rects !== null ? framesPath : null);
            if (rects !== null && framesPath && !this.framesDone.has(framesPath)) {
                this.framesDone.add(framesPath);
                await this.shareFrames(framesPath);
            }
        }
        return true;
    }

    /**
     * Every mod that ships or patches a frames file gets the rectangles as they stand after
     * its own contribution, so the file survives the removal of whichever mod wins.
     */
    private async shareFrames(framesPath: string): Promise<void> {
        let doc: Json | null = null;
        const steps: [Source, string, boolean][] = [
            ...this.store.providers.get(framesPath)!.map((src): [Source, string, boolean] => [src, framesPath, false]),
            ...(this.store.patches.get(framesPath) ?? []).map(([src, patchPath]): [Source, string, boolean] => [src, patchPath, true]),
        ];
        for (const [src, file, isPatch] of steps) {
            try {
                const parsed = parseJson(await src.read(file));
                doc = isPatch ? applyPatchStrict(clone(doc), parsed) : parsed;
                if (isObj(doc)) this.mods.get(src.id)!.frames[framesPath] = parseFrames(doc);
            } catch {
                // already reported when the merged file was read
            }
        }
    }

    // ----- species

    /**
     * Each mod gets the species files it ships, unpatched, and its patches to species files.
     * The site applies the patches itself, so a race that leaves a mod out also loses that
     * mod's changes to the species, not just its sprites.
     */
    private async buildSpecies(tick: (progress: ExtractProgress) => void | Promise<void>): Promise<void> {
        const store = this.store;
        const creation = await store.json('/interface/windowconfig/charcreation.config');
        const listed = isObj(creation) && Array.isArray(creation.speciesOrdering) ? creation.speciesOrdering : [];
        const ordering = listed.map((s) => String(s).toLowerCase());
        const paths = store.glob('/species/', ['.species']);
        for (const [n, path] of paths.entries()) {
            await tick({ stage: 'species', done: n, total: paths.length });
            const patched = await store.json(path);
            if (!isObj(patched) || !patched.kind) continue;
            const kind = String(patched.kind);
            const imageDir = `/humanoid/${kind.toLowerCase()}/`;
            const sprites = store.glob(imageDir, ['.png']);
            if (!sprites.some((p) => p.endsWith('body.png') && p.split('/').length - 1 === 3)) {
                store.warn(`${kind}: no body sprite found under ${imageDir}, left out`);
                continue;
            }
            for (const sprite of sprites) await this.use(sprite, true); // all of them: unlisted hair and alternate heads included
            const configPath = patched.humanoidConfig === undefined ? '/humanoid.config' : patched.humanoidConfig;
            const humanoid = deepMerge((typeof configPath === 'string' ? await store.json(configPath) : null) || {}, patched.humanoidOverrides || {});
            const at = ordering.indexOf(kind.toLowerCase());
            const personalities = (isObj(humanoid) && humanoid.personalities) || [['idle.1', 'idle.1', [0, 0], [0, 0]]];
            const shared = { kind, playable: at >= 0, order: at >= 0 ? at : null, personalities: personalities as Personality[] };
            for (const src of store.providers.get(path)!) {
                try {
                    this.mods.get(src.id)!.species[kind] = { ...shared, config: parseJson(await src.read(path)) };
                } catch {
                    // already reported by store.json above
                }
            }
            for (const [src, patchPath] of store.patches.get(path) ?? []) {
                try {
                    this.mods.get(src.id)!.speciesPatches[kind] = parseJson(await src.read(patchPath));
                } catch {
                    // unreadable patch: left out
                }
            }
            this.species++;
            if (shared.playable) this.playable++;
        }
    }

    // ----- items

    /** What the creator needs from one item file, or null if it has no sprite sheets. */
    private async itemRecord(cfg: Json, path: string): Promise<ModOut['items'][number] | null> {
        if (!isObj(cfg) || !cfg.itemName) return null;
        const slot = ITEM_SLOTS[path.slice(path.lastIndexOf('.'))];
        const directory = `${path.slice(0, path.lastIndexOf('/'))}/`;
        const want = async (ref: Json | undefined, icon = false): Promise<string | null> => {
            if (typeof ref !== 'string' || !ref) return null;
            const image = resolve(directory, ref);
            if (!(await this.use(image))) return null;
            (icon ? this.icons : this.sheets).add(image);
            return image;
        };

        const frames: Record<string, Record<string, string>> = {};
        for (const gender of ['male', 'female']) {
            const raw = cfg[`${gender}Frames`];
            if (isObj(raw)) {
                const parts: Record<string, string> = {};
                for (const [k, v] of Object.entries(raw)) {
                    if (k !== 'body' && k !== 'backSleeve' && k !== 'frontSleeve') continue;
                    const image = await want(v);
                    if (image) parts[k] = image;
                }
                frames[gender] = parts;
            } else {
                const image = await want(raw);
                if (image) frames[gender] = { body: image };
            }
        }
        if (!Object.keys(frames).length) return null;
        const item: ModOut['items'][number] = {
            id: String(cfg.itemName),
            slot,
            name: plain(cfg.shortdescription) || String(cfg.itemName),
            frames,
            colors: colorOptions(cfg.colorOptions),
        };
        const icon = cfg.inventoryIcon;
        if (typeof icon === 'string') {
            const image = await want(icon, true);
            if (image) item.icon = image + (icon.includes(':') ? `:${icon.slice(icon.indexOf(':') + 1).split('?')[0]}` : '');
        }
        if (slot === 'head') {
            const mask = await want(cfg.mask);
            if (mask) item.mask = mask;
        }
        if (typeof cfg.directives === 'string' && cfg.directives) item.directives = cfg.directives;
        if (cfg.hideBody) item.hideBody = true;
        return item;
    }

    /**
     * Each mod gets the items its own files define. A mod that patches another mod's item in
     * a way the creator can see gets its version of that item too, marked `patch`: the site
     * uses it while that mod is present and the item still belongs to the mod that defines it.
     */
    private async buildItems(tick: (progress: ExtractProgress) => void | Promise<void>): Promise<void> {
        const store = this.store;
        let skipped = 0;
        const paths = store.glob('/', Object.keys(ITEM_SLOTS));
        for (const [n, path] of paths.entries()) {
            if (n % 50 === 0) await tick({ stage: 'items', done: n, total: paths.length });
            let doc: Json | null = null;
            let record: ModOut['items'][number] | null = null;
            for (const src of store.providers.get(path)!) {
                // normally one; each ships its own whole file
                try {
                    doc = parseJson(await src.read(path));
                } catch (e) {
                    store.warn(`${path} (${src.title}): bad JSON, skipped (${(e as Error).message})`);
                    continue;
                }
                record = await this.itemRecord(doc, path);
                if (record) this.mods.get(src.id)!.items.push(record);
            }
            for (const [src, patchPath] of store.patches.get(path) ?? []) {
                if (doc === null) break;
                try {
                    doc = applyPatchStrict(clone(doc), parseJson(await src.read(patchPath)));
                } catch (e) {
                    store.warn(`${patchPath} (${src.title}): patch not applied (${(e as Error).message})`);
                    continue;
                }
                const patched = await this.itemRecord(doc, path);
                if (patched && !sameRecord(patched, record)) {
                    record = patched;
                    this.mods.get(src.id)!.items.push({ ...patched, patch: true });
                }
            }
            if (record) this.itemCount++;
            else skipped++;
        }
        if (skipped) store.warn(`${skipped} wearable item(s) have no sprite sheets, left out`);
    }

    // ----- one mod's folder

    /**
     * Images the site asks for together sit together in the pack, so it can fetch them as
     * one byte range: a mod's item icons first, then everything folder by folder.
     */
    private packOrder(a: string, b: string): number {
        const iconOnly = (p: string) => this.icons.has(p) && !this.sheets.has(p);
        const [ia, ib] = [iconOnly(a), iconOnly(b)];
        if (ia !== ib) return ia ? -1 : 1;
        if (ia) return byText(a, b);
        const dir = (p: string) => `${p.slice(0, p.lastIndexOf('/'))}/`;
        return byText(dir(a), dir(b)) || byText(a, b);
    }

    /** mod.json, items.json and sprites.pack for one mod: this is where its sprites are read. */
    async build(mod: ModOut): Promise<BuiltMod> {
        const src = mod.src;
        const itemImages = new Set([...mod.itemImages].filter((p) => !mod.speciesImages.has(p)));
        const frameFiles: string[] = [];
        const frameIndex = new Map<string, number>();
        const refs = new Map<string, ImageRef>();
        const chunks: Uint8Array[] = [];
        let length = 0;
        for (const path of [...mod.speciesImages, ...itemImages].sort((a, b) => this.packOrder(a, b))) {
            const data = await src.read(path);
            const framesPath = this.framesOf.get(path) ?? null;
            if (framesPath !== null && !frameIndex.has(framesPath)) frameIndex.set(framesPath, frameFiles.push(framesPath) - 1);
            // offset, length, content hash (two mods shipping the same bytes are one version), frames file or -1
            refs.set(path, [length, data.length, (await sha1(data)).slice(0, 10), framesPath === null ? -1 : frameIndex.get(framesPath)!]);
            chunks.push(data);
            length += data.length;
        }
        const pack = new Uint8Array(length);
        let at = 0;
        for (const chunk of chunks) {
            pack.set(chunk, at);
            at += chunk.length;
        }

        // Most items share a handful of colour lists: store each list once, items point at it.
        const palettes: ColorOption[][] = [];
        const paletteIndex = new Map<string, number>();
        const lower = (s: string) => s.toLowerCase();
        const items: ModItem[] = [...mod.items]
            .map((item, i) => ({ item, i }))
            .sort((a, b) => byText(a.item.slot, b.item.slot) || byText(lower(a.item.name), lower(b.item.name)) || byText(a.item.id, b.item.id) || a.i - b.i)
            .map(({ item }) => {
                const key = sortedJson(item.colors as Json);
                if (!paletteIndex.has(key)) paletteIndex.set(key, palettes.push(item.colors) - 1);
                return { ...item, colors: paletteIndex.get(key)! };
            });

        const pick = (wanted: (path: string) => boolean) => Object.fromEntries([...refs].filter(([path]) => wanted(path)));
        const content = {
            frameFiles,
            images: pick((p) => mod.speciesImages.has(p)),
            species: mod.species,
            speciesPatches: mod.speciesPatches,
            frames: mod.frames,
        };
        const itemContent = { items, palettes, images: pick((p) => itemImages.has(p)) };
        const stamp = new TextEncoder().encode(sortedJson([content, itemContent] as unknown as Json));
        const both = new Uint8Array(pack.length + stamp.length);
        both.set(pack);
        both.set(stamp, pack.length);
        const build = (await sha1(both)).slice(0, 12);
        const deps = dependencies(src.meta);
        const workshop = String(src.meta.steamContentId || '');
        return {
            mod: {
                version: BUNDLE_VERSION,
                id: src.id,
                name: src.title,
                order: mod.order,
                ...(src.priority ? { priority: src.priority } : {}),
                ...(/^\d+$/.test(workshop) ? { workshopId: workshop } : {}),
                modName: src.name,
                ...(deps.length ? { after: deps } : {}),
                build,
                ...content,
            },
            items: { version: BUNDLE_VERSION, id: src.id, build, ...itemContent },
            pack,
        };
    }
}

/** JSON with every object's keys sorted, so equal values give equal text. */
function sortedJson(value: Json): string {
    if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
    if (isObj(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${sortedJson(value[k])}`).join(',')}}`;
    return JSON.stringify(value);
}

function sameRecord(a: object, b: object | null): boolean {
    return b !== null && sortedJson(a as Json) === sortedJson(b as Json);
}
