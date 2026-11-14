// The member's side of adding a mod: turns the files they chose into sources, and sends a
// built mod folder to the server in pieces. The files themselves never leave the browser;
// only the folder extract.ts builds for a mod they tick is uploaded.

import type { BuiltMod } from './extract';
import { DirSource, PakSource, type Source, type Warn } from './sources';

export interface ChosenMod {
    source: Source;
    /** The bundle folder name to give it, when where it was found says so (a workshop folder's number). */
    id: string | null;
}

const isPak = (name: string) => name.toLowerCase().endsWith('.pak');
const stem = (name: string) => name.replace(/\.[^.]*$/, '');

/** The path a file has inside the folder the member chose ('' for a file picked on its own). */
const relative = (file: File) => (file.webkitRelativePath || '').split('/').filter(Boolean);

/** The base game's assets among the files chosen, if any: a file named packed.pak. */
export function findBasePak(files: File[]): File | null {
    return files.find((f) => f.name.toLowerCase() === 'packed.pak') ?? null;
}

/**
 * Mods among the files a member chose, as the game would find them:
 * - .pak files picked one by one: a workshop pak carries its workshop number, which becomes
 *   its id; another gets a slug of its name.
 * - a folder: every pak inside it and every unpacked mod (a folder with a metadata file).
 *   Inside the workshop folder each mod sits in a folder named by its workshop number, and
 *   that number is its id, as in the Python extractor.
 * packed.pak is never a mod. Files that cannot be read as a mod are reported and left out.
 */
export async function openChosenMods(files: File[], warn: Warn = () => {}): Promise<ChosenMod[]> {
    const mods: ChosenMod[] = [];
    const add = async (label: string, open: () => Promise<Source>, id: string | null) => {
        try {
            const source = await open();
            // A workshop pak picked without its folder still says which workshop item it is
            const own = String(source.meta.steamContentId || '');
            mods.push({ source, id: id ?? (/^\d+$/.test(own) ? own : null) });
        } catch (e) {
            warn(`${label}: not a mod this page can read (${(e as Error).message})`);
        }
    };

    const loose = files.filter((f) => !relative(f).length && isPak(f.name) && f.name.toLowerCase() !== 'packed.pak');
    for (const file of loose) await add(file.name, () => PakSource.open(file.name, file), null);

    // Files from a chosen folder, grouped by the folder that holds each mod
    const inFolder = files.filter((f) => relative(f).length > 1);
    const groups = new Map<string, File[]>();
    for (const file of inFolder) {
        const parts = relative(file);
        // root/x.pak or root/_metadata: the chosen folder itself; root/<mod>/...: that child
        const key = parts.length === 2 ? parts[0] : `${parts[0]}/${parts[1]}`;
        const list = groups.get(key);
        if (list) list.push(file);
        else groups.set(key, [file]);
    }
    for (const [key, group] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        const depth = key.split('/').length;
        const folderName = key.split('/').pop()!;
        // A workshop item's folder is named by its number
        const workshopId = /^\d+$/.test(folderName) ? folderName : null;
        const paks = group.filter((f) => relative(f).length === depth + 1 && isPak(f.name) && f.name.toLowerCase() !== 'packed.pak').sort((a, b) => (a.name < b.name ? -1 : 1));
        if (paks.length) {
            for (const pak of paks) {
                const id = workshopId ? (paks.length === 1 ? workshopId : `${workshopId}-${stem(pak.name)}`) : null;
                await add(relative(pak).join('/'), () => PakSource.open(relative(pak).join('/'), pak), id);
            }
            continue;
        }
        const entries = group.map((file) => ({ path: relative(file).slice(depth).join('/'), file }));
        if (DirSource.isMod(entries)) await add(key, () => DirSource.open(key, entries, warn), workshopId);
    }
    return mods;
}

// ----- sending a folder

const MAGIC = 'FFPM1\n';
/** One piece. Small enough for any proxy between the browser and the API. */
const PIECE_BYTES = 2 * 1024 * 1024;

/** A mod folder as the one file the server takes: a header, mod.json, items.json, then the pack. */
export function packFolder(built: BuiltMod): Blob {
    const encoder = new TextEncoder();
    const length = (bytes: Uint8Array) => {
        const out = new Uint8Array(4);
        new DataView(out.buffer).setUint32(0, bytes.length);
        return out;
    };
    const mod = encoder.encode(JSON.stringify(built.mod));
    const items = encoder.encode(JSON.stringify(built.items));
    return new Blob([encoder.encode(MAGIC), length(mod), mod, length(items), items, built.pack as Uint8Array<ArrayBuffer>]);
}

function sessionId(): string {
    return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sends a folder; the mod is live when this resolves. `progress` gets the bytes sent so far. */
export async function uploadFolder(id: string, folder: Blob, progress: (sent: number, total: number) => void = () => {}): Promise<void> {
    const session = sessionId();
    for (let offset = 0; offset < folder.size; offset += PIECE_BYTES) {
        const piece = folder.slice(offset, offset + PIECE_BYTES);
        let res: Response;
        try {
            res = await fetch(`/site/portrait-upload/${encodeURIComponent(id)}?session=${session}&offset=${offset}&total=${folder.size}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: piece,
            });
        } catch {
            throw new Error('The connection dropped during the upload');
        }
        const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string } | null;
        if (!res.ok || envelope?.status !== 'success') throw new Error(envelope?.message ?? `The upload failed (HTTP ${res.status})`);
        progress(Math.min(offset + PIECE_BYTES, folder.size), folder.size);
    }
}
