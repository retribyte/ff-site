// Combines the mod folders that are present into the one view the creator draws from. A
// folder holds only what its own mod contributes, so leaving a folder out here (because it was
// deleted, or switched off) removes that mod's species, clothing, sprites and patches and
// nothing else. The game's rule decides conflicts: mods apply in load order, the last one wins.

import type { ColorOption, ImageEntry, ImageRef, ItemsFile, Manifest, ModFile, ModItemsFile, RawSpecies, WearItem } from './types';

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Adds one mod's images to the merged index. A copy identical to the one before it is not a version. */
function addImages(images: Record<string, ImageEntry>, last: Map<string, string>, mod: string, frameFiles: string[], refs: Record<string, ImageRef>) {
    for (const [path, ref] of Object.entries(refs)) {
        const entry = (images[path] ??= { m: [] });
        if (last.get(path) !== ref[2]) entry.m.push(mod);
        last.set(path, ref[2]);
        if (ref[3] >= 0) entry.f = frameFiles[ref[3]];
    }
}

/** A short fingerprint of the mods present, for cache-busting. */
function fingerprint(parts: string[]): string {
    let h = 0x811c9dc5;
    for (const ch of parts.join(' ')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, '0');
}

/**
 * The mods in the game's load order, worked out from what each folder says about itself,
 * because folders come from different machines (members upload them) and the position one
 * machine gave a mod means nothing next to another's. The game's rule: the base game first;
 * then by priority, lowest first; mods of equal priority by where they are installed (the
 * game's own mods folder before the workshop, and workshop mods in the order of their ids);
 * and a mod always after the mods it names in its metadata (`after`: its includes and requires).
 */
export function loadOrder(files: ModFile[]): ModFile[] {
    const base = files.filter((f) => f.id === 'vanilla');
    // A workshop mod's id is its workshop number (or starts with it); anything else was installed by hand
    const workshop = (f: ModFile) => (/^\d/.test(f.id) ? 1 : 0);
    const rest = files.filter((f) => f.id !== 'vanilla').sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || workshop(a) - workshop(b) || byText(a.id, b.id));
    const byName = new Map(rest.map((f) => [f.modName ?? f.id, f]));
    const placed: ModFile[] = [];
    const seen = new Set<ModFile>();
    const place = (file: ModFile, stack: ModFile[]) => {
        if (seen.has(file) || stack.includes(file)) return;
        for (const name of file.after ?? []) {
            const dep = byName.get(name);
            if (dep) place(dep, [...stack, file]);
        }
        seen.add(file);
        placed.push(file);
    };
    for (const file of rest) place(file, []);
    return [...base, ...placed];
}

export function mergeMods(files: ModFile[]): Manifest {
    const mods = loadOrder(files);
    const manifest: Manifest = { build: fingerprint(mods.map((m) => `${m.id}:${m.build}`)), mods: [], packs: {}, where: {}, species: {}, images: {}, frames: {} };
    const last = new Map<string, string>();
    const patches: Record<string, RawSpecies['patches']> = {};
    for (const mod of mods) {
        manifest.mods.push({
            id: mod.id, name: mod.name,
            ...(mod.priority ? { priority: mod.priority } : {}),
            ...(mod.workshopId ? { workshopId: mod.workshopId } : {}),
        });
        manifest.packs[mod.id] = { build: mod.build, frameFiles: mod.frameFiles };
        manifest.where[mod.id] = mod.images;
        addImages(manifest.images, last, mod.id, mod.frameFiles, mod.images);
        Object.assign(manifest.frames, mod.frames);
        for (const [kind, species] of Object.entries(mod.species)) manifest.species[kind] = { ...species, mod: mod.id, patches: [] };
        for (const [kind, patch] of Object.entries(mod.speciesPatches)) (patches[kind] ??= []).push({ m: mod.id, p: patch });
    }
    // A patch to a species no present mod defines has nothing to apply to.
    for (const [kind, list] of Object.entries(patches)) if (manifest.species[kind]) manifest.species[kind].patches = list;
    return manifest;
}

/** The clothing of the mods in `manifest`; item files of mods it does not have are ignored. */
export function mergeItems(files: ModItemsFile[], manifest: Manifest): ItemsFile {
    const order = new Map(manifest.mods.map((m, i) => [m.id, i]));
    const present = files.filter((f) => order.has(f.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const out: ItemsFile = { items: [], palettes: [], images: {}, where: {} };
    const last = new Map<string, string>();
    const paletteIndex = new Map<string, number>();
    const items = new Map<string, WearItem>();
    for (const file of present) {
        out.where[file.id] = file.images;
        addImages(out.images, last, file.id, manifest.packs[file.id].frameFiles, file.images);
        const palette = (index: number) => {
            const list: ColorOption[] = file.palettes[index] ?? [];
            const key = JSON.stringify(list);
            if (!paletteIndex.has(key)) paletteIndex.set(key, out.palettes.push(list) - 1);
            return paletteIndex.get(key)!;
        };
        for (const { patch, ...item } of file.items) {
            // A patched version replaces the item but leaves it with the mod that defines it.
            const owner = (patch && items.get(item.id)?.mod) || file.id;
            items.set(item.id, { ...item, colors: palette(item.colors), mod: owner });
        }
    }
    out.items = [...items.values()].sort((a, b) => byText(a.mod, b.mod) || byText(a.slot, b.slot) || byText(a.name.toLowerCase(), b.name.toLowerCase()));
    return out;
}

/** One image's place in a mod's pack, wherever it is listed. */
export function locate(mod: string, image: string, manifest: Manifest, items?: ItemsFile | null): ImageRef | undefined {
    return manifest.where[mod]?.[image] ?? items?.where[mod]?.[image];
}
