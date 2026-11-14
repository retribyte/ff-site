// Starbound assets as the game reads them, from files the browser was handed: paks and loose
// mod folders, load order, case-insensitive paths, .patch files and .frames lookup. A port of
// scripts/portrait-extract/sbassets.py; reads are asynchronous because a pak is a Blob (a
// File from a file input, or a file opened as a Blob in Node) and only the parts asked for
// are read. Nothing here touches the DOM.

import { applyPatchStrict, type Json } from '../jsonPatch';
import { isObj, parseJson, type Obj } from './json';

export const VANILLA_ID = 'vanilla';

export type Warn = (message: string) => void;

async function bytes(blob: Blob, start: number, end: number): Promise<Uint8Array> {
    return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

// ----- SBON, the binary JSON of a pak's index

class Cursor {
    private view: DataView;
    private text = new TextDecoder('utf-8');
    at = 0;
    constructor(private data: Uint8Array) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }
    byte(): number {
        if (this.at >= this.data.length) throw new Error('pak index cut short');
        return this.data[this.at++];
    }
    take(n: number): Uint8Array {
        if (this.at + n > this.data.length) throw new Error('pak index cut short');
        return this.data.subarray(this.at, (this.at += n));
    }
    vlq(): number {
        let v = 0;
        for (;;) {
            const b = this.byte();
            v = v * 128 + (b & 0x7f);
            if (!(b & 0x80)) return v;
        }
    }
    svlq(): number {
        const v = this.vlq();
        return v % 2 ? -(Math.floor(v / 2) + 1) : v / 2;
    }
    str(): string {
        return this.text.decode(this.take(this.vlq()));
    }
    u64(): number {
        const v = Number(this.view.getBigUint64(this.at));
        this.at += 8;
        return v;
    }
    dynamic(): Json {
        const t = this.byte();
        if (t === 1) return null;
        if (t === 2) {
            const v = this.view.getFloat64(this.at);
            this.at += 8;
            return v;
        }
        if (t === 3) return this.byte() !== 0;
        if (t === 4) return this.svlq();
        if (t === 5) return this.str();
        if (t === 6) return Array.from({ length: this.vlq() }, () => this.dynamic());
        if (t === 7) {
            const out: Obj = {};
            for (let n = this.vlq(); n > 0; n--) {
                const key = this.str();
                out[key] = this.dynamic();
            }
            return out;
        }
        throw new Error(`unknown SBON type ${t}`);
    }
}

// ----- sources

/** One asset source. `files` maps a lowercased asset path to where its bytes are. */
export abstract class Source {
    meta: Obj = {};
    /** Set by AssetStore: the mod's folder name in the bundle. */
    id = '';
    abstract readonly files: ReadonlyMap<string, unknown>;

    /** `path` is where it came from (a file path or the path inside a chosen folder): it orders mods of equal priority, as the game orders them by path. */
    constructor(readonly path: string) {}

    /** The file name without its folders, and without its extension. */
    protected get fileName(): string {
        return this.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? this.path;
    }
    protected get stem(): string {
        const name = this.fileName;
        const dot = name.lastIndexOf('.');
        return dot > 0 ? name.slice(0, dot) : name;
    }
    get name(): string {
        return String(this.meta.name || this.stem);
    }
    get title(): string {
        return String(this.meta.friendlyName || this.meta.name || this.fileName);
    }
    get priority(): number {
        const raw = this.meta.priority ?? 0;
        const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
        return Number.isFinite(value) ? value : 0;
    }
    abstract read(path: string): Promise<Uint8Array>;
    /** The file's length, without reading it. */
    abstract size(path: string): number;
}

export class PakSource extends Source {
    private constructor(path: string, private blob: Blob, readonly files: Map<string, [number, number]>) {
        super(path);
    }

    static async open(path: string, blob: Blob): Promise<PakSource> {
        const head = await bytes(blob, 0, 16);
        if (new TextDecoder('latin1').decode(head.subarray(0, 8)) !== 'SBAsset6') throw new Error('not an SBAsset6 pak');
        const indexAt = Number(new DataView(head.buffer).getBigUint64(8));
        const cursor = new Cursor(await bytes(blob, indexAt, blob.size));
        if (new TextDecoder('latin1').decode(cursor.take(5)) !== 'INDEX') throw new Error('pak index missing');
        const meta: Obj = {};
        for (let n = cursor.vlq(); n > 0; n--) {
            const key = cursor.str();
            meta[key] = cursor.dynamic();
        }
        const files = new Map<string, [number, number]>();
        for (let n = cursor.vlq(); n > 0; n--) {
            const p = cursor.str();
            files.set(p.toLowerCase(), [cursor.u64(), cursor.u64()]);
        }
        const source = new PakSource(path, blob, files);
        source.meta = meta;
        return source;
    }

    read(path: string): Promise<Uint8Array> {
        const [offset, length] = this.files.get(path)!;
        return bytes(this.blob, offset, offset + length);
    }
    size(path: string): number {
        return this.files.get(path)![1];
    }
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__']);

/** An unpacked mod: the files of one folder, each with its path inside that folder. */
export class DirSource extends Source {
    private constructor(path: string, readonly files: Map<string, Blob>) {
        super(path);
    }

    static async open(path: string, entries: { path: string; file: Blob }[], warn: Warn = () => {}): Promise<DirSource> {
        const files = new Map<string, Blob>();
        for (const entry of entries) {
            const parts = entry.path.split('/').filter(Boolean);
            if (parts.slice(0, -1).some((dir) => SKIP_DIRS.has(dir))) continue;
            files.set(`/${parts.join('/')}`.toLowerCase(), entry.file);
        }
        const source = new DirSource(path, files);
        for (const name of ['/_metadata', '/.metadata']) {
            const file = files.get(name);
            if (!file) continue;
            try {
                const meta = parseJson(new Uint8Array(await file.arrayBuffer()));
                if (isObj(meta)) source.meta = meta;
            } catch (e) {
                warn(`${path}${name}: unreadable metadata (${(e as Error).message})`);
            }
            break;
        }
        return source;
    }

    /** Whether a folder's entries make it a mod (it has a metadata file at its top). */
    static isMod(entries: { path: string }[]): boolean {
        return entries.some((e) => /^\/?[_.]metadata$/i.test(e.path));
    }

    async read(path: string): Promise<Uint8Array> {
        return new Uint8Array(await this.files.get(path)!.arrayBuffer());
    }
    size(path: string): number {
        return this.files.get(path)!.size;
    }
}

export function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mod';
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const strings = (v: Json | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Mods a source names as loading before it (`includes`, then `requires`). */
export const dependencies = (meta: Obj): string[] => [...strings(meta.includes), ...strings(meta.requires)];

export type FrameRects = Record<string, [number, number, number, number]>;

// ----- the merged store

/**
 * Sources in load order. Later sources override earlier ones, as in the game, but every
 * provider of a path is kept so a caller can pick a different one.
 */
export class AssetStore {
    sources: Source[] = [];
    providers = new Map<string, Source[]>();
    patches = new Map<string, [Source, string][]>();
    private jsonCache = new Map<string, Promise<Json | null>>();
    private framesCache = new Map<string, Promise<FrameRects | null>>();

    constructor(readonly warn: Warn = () => {}) {}

    /**
     * `vanilla` is the game's packed.pak; `mods` are the other sources in the order found,
     * each with the id to give it (a workshop folder's name) or none. Of two mods with one
     * name the later wins, unless the earlier has the higher priority.
     */
    load(vanilla: Source, mods: { source: Source; id?: string | null }[]): void {
        vanilla.id = VANILLA_ID;
        const byName = new Map<string, Source>();
        for (const { source, id } of mods) {
            source.id = id || slugify(source.name);
            const old = byName.get(source.name);
            if (old && old.priority > source.priority) continue;
            byName.set(source.name, source);
        }
        const ordered = [...byName.values()].map((s, i) => ({ s, i })).sort((a, b) => a.s.priority - b.s.priority || byText(a.s.path, b.s.path) || a.i - b.i).map((x) => x.s);
        const placed: Source[] = [];
        const seen = new Set<string>();
        const place = (src: Source, stack: string[]) => {
            if (seen.has(src.name) || stack.includes(src.name)) return;
            for (const dep of dependencies(src.meta)) {
                const found = byName.get(dep);
                if (found) place(found, [...stack, src.name]);
            }
            seen.add(src.name);
            placed.push(src);
        };
        for (const src of ordered) place(src, []);
        const used = new Map<string, number>();
        for (const src of placed) {
            // ids must be unique: they are bundle directory names
            const n = used.get(src.id) ?? 0;
            used.set(src.id, n + 1);
            if (n) src.id = `${src.id}-${n + 1}`;
        }
        this.sources = [vanilla, ...placed];
        for (const src of this.sources) {
            for (const p of src.files.keys()) {
                const list = this.providers.get(p);
                if (list) list.push(src);
                else this.providers.set(p, [src]);
            }
        }
        for (const src of this.sources) {
            for (const p of src.files.keys()) {
                if (!p.endsWith('.patch')) continue;
                const target = p.slice(0, -6);
                if (!this.providers.has(target)) continue;
                const list = this.patches.get(target);
                if (list) list.push([src, p]);
                else this.patches.set(target, [[src, p]]);
            }
        }
    }

    winner(path: string): Source {
        const list = this.providers.get(path.toLowerCase())!;
        return list[list.length - 1];
    }

    /** The winning file with every source's .patch applied in load order; null if missing or unreadable (reported). */
    json(path: string): Promise<Json | null> {
        path = path.toLowerCase();
        let known = this.jsonCache.get(path);
        if (!known) this.jsonCache.set(path, (known = this.readJson(path)));
        return known;
    }

    private async readJson(path: string): Promise<Json | null> {
        if (!this.providers.has(path)) return null;
        let doc: Json;
        try {
            doc = parseJson(await this.winner(path).read(path));
        } catch (e) {
            this.warn(`${path} (${this.winner(path).title}): bad JSON, skipped (${(e as Error).message})`);
            return null;
        }
        for (const [src, patchPath] of this.patches.get(path) ?? []) {
            try {
                doc = applyPatchStrict(doc, parseJson(await src.read(patchPath)));
            } catch (e) {
                this.warn(`${patchPath} (${src.title}): patch not applied (${(e as Error).message})`);
            }
        }
        return doc;
    }

    /** Every path under `prefix` with one of the endings, sorted. */
    glob(prefix: string, suffixes: string[]): string[] {
        prefix = prefix.toLowerCase();
        const out: string[] = [];
        for (const p of this.providers.keys()) if (p.startsWith(prefix) && suffixes.some((s) => p.endsWith(s))) out.push(p);
        return out.sort(byText);
    }

    /** <image>.frames, else default.frames, walking up to the root (StarAssets.cpp). */
    framesFile(imagePath: string): string | null {
        imagePath = imagePath.toLowerCase();
        const slash = imagePath.lastIndexOf('/');
        const filename = imagePath.slice(slash + 1);
        const dot = filename.lastIndexOf('.');
        const stem = dot >= 0 ? filename.slice(0, dot) : filename;
        let directory = `${imagePath.slice(0, Math.max(slash, 0))}/`;
        for (;;) {
            for (const candidate of [`${directory}${stem}.frames`, `${directory}default.frames`]) if (this.providers.has(candidate)) return candidate;
            if (directory === '/') return null;
            const trimmed = directory.slice(0, -1);
            directory = `${trimmed.slice(0, Math.max(trimmed.lastIndexOf('/'), 0))}/`;
        }
    }

    /** {name: [x, y, w, h]} in PNG (top-left) coordinates, aliases resolved in; null if there is no usable file. */
    frames(framesPath: string): Promise<FrameRects | null> {
        let known = this.framesCache.get(framesPath);
        if (!known) {
            known = this.json(framesPath).then((cfg) => {
                if (!isObj(cfg)) return null;
                try {
                    return parseFrames(cfg);
                } catch (e) {
                    this.warn(`${framesPath}: bad frames file (${(e as Error).message})`);
                    return null;
                }
            });
            this.framesCache.set(framesPath, known);
        }
        return known;
    }
}

const num = (v: unknown): number => {
    if (typeof v !== 'number') throw new Error('not a number');
    return v;
};
const pair = (v: unknown): [number, number] => {
    if (!Array.isArray(v) || v.length !== 2) throw new Error('not a pair');
    return [num(v[0]), num(v[1])];
};

/** Throws on a malformed file. */
export function parseFrames(cfg: Obj): FrameRects {
    const frames: FrameRects = {};
    const list = cfg.frameList;
    if (list) {
        if (!isObj(list)) throw new Error('frameList is not an object');
        for (const [name, r] of Object.entries(list)) {
            if (!Array.isArray(r)) throw new Error('frameList entry is not a list');
            frames[name] = [num(r[0]), num(r[1]), num(r[2]) - num(r[0]), num(r[3]) - num(r[1])];
        }
    }
    const grid = cfg.frameGrid;
    if (grid) {
        if (!isObj(grid)) throw new Error('frameGrid is not an object');
        const [bx, by] = grid.begin === undefined ? [0, 0] : pair(grid.begin);
        const [w, h] = pair(grid.size);
        const [cols, rows] = pair(grid.dimensions);
        const names = grid.names;
        if (Array.isArray(names) ? names.length : names) {
            if (!Array.isArray(names)) throw new Error('names is not a list');
            names.slice(0, rows).forEach((row, y) => {
                if (!row) return;
                if (!Array.isArray(row)) {
                    if (typeof row === 'string') return void [...row].slice(0, cols).forEach((name, x) => (frames[name] = [bx + x * w, by + y * h, w, h]));
                    throw new Error('names row is not a list');
                }
                if (!row.length) return;
                row.slice(0, cols).forEach((name, x) => {
                    if (name) frames[String(name)] = [bx + x * w, by + y * h, w, h];
                });
            });
        } else {
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) frames[String(y * cols + x)] = [bx + x * w, by + y * h, w, h];
        }
    }
    const aliases = isObj(cfg.aliases) ? cfg.aliases : {};
    const count = Object.keys(aliases).length;
    for (const [key, first] of Object.entries(aliases)) {
        let value = first;
        for (let i = 0; i <= count; i++) if (typeof value === 'string' && Object.hasOwn(aliases, value)) value = aliases[value];
        if (typeof value === 'string' && Object.hasOwn(frames, value)) frames[key] = frames[value];
    }
    return frames;
}
