// Shapes of the sprite bundle written by portrait-extract/extract.py (one folder per mod), of
// the merged view the site builds from the folders present (merge.ts), and of a saved portrait.

import type { Json } from './jsonPatch';

/** A colour option: a palette swap ({from hex: to hex}) or a raw Starbound directive string. */
export type ColorOption = Record<string, string> | string;

/** [body idle frame, arm idle frame, head offset, arm offset] (offsets in pixels, y up). */
export type Personality = [string, string, [number, number], [number, number]];

/** x, y, width, height in the PNG (top-left origin). */
export type FrameRect = [number, number, number, number];

export interface ImageEntry {
    /** Ids of the mods that ship this path, in load order (the game shows the last). */
    m: string[];
    /** Key into `frames`; absent when the image is a single frame. */
    f?: string;
}

export interface BundleMod {
    id: string;
    name: string;
    priority?: number;
    workshopId?: string;
}

/**
 * Where one mod's copy of an image sits in that mod's sprites.pack: byte offset, byte length,
 * content hash, index into the mod's `frameFiles` (-1 for none).
 */
export type ImageRef = [offset: number, length: number, hash: string, frames: number];

/** A mod folder's mod.json: only what that mod's own files contribute, nothing merged. */
export interface ModFile {
    version: number;
    id: string;
    name: string;
    /** Position in the game's load order when it was extracted. */
    order: number;
    priority?: number;
    workshopId?: string;
    /** Changes whenever anything in the folder does; part of the pack's URL. */
    build: string;
    frameFiles: string[];
    /** Its species sprites (item sprites are listed in its items.json). */
    images: Record<string, ImageRef>;
    /** Species files it ships, unpatched. */
    species: Record<string, Omit<RawSpecies, 'mod' | 'patches'>>;
    /** Its patches to species files, by species kind. */
    speciesPatches: Record<string, Json>;
    /** Frame rectangles of the .frames files it ships. */
    frames: Record<string, Record<string, FrameRect>>;
}

/** An item as a mod folder lists it. `patch`: this mod's version of an item another mod defines. */
export type ModItem = Omit<WearItem, 'mod' | 'only'> & { patch?: true };

/** A mod folder's items.json. `colors` index its own `palettes`. */
export interface ModItemsFile {
    version: number;
    id: string;
    build: string;
    items: ModItem[];
    palettes: ColorOption[][];
    images: Record<string, ImageRef>;
}

/** What is needed to read a mod's pack. */
export interface PackInfo {
    build: string;
    frameFiles: string[];
}

/** For each mod, where each of its images sits in its pack. */
export type ImageIndex = Record<string, Record<string, ImageRef>>;

export interface SpeciesGender {
    name: string;
    sprites: Partial<Record<'head' | 'body' | 'emote' | 'backArm' | 'frontArm', string>>;
    hairGroup: string;
    hair: string[];
    facialHairGroup: string;
    facialHair: string[];
    facialMaskGroup: string;
    facialMask: string[];
    shirt: string[];
    pants: string[];
}

export type SpeciesFlag =
    | 'altOptionAsUndyColor'
    | 'headOptionAsHairColor'
    | 'altOptionAsHairColor'
    | 'hairColorAsBodySubColor'
    | 'headOptionAsFacialhair'
    | 'altOptionAsFacialMask'
    | 'bodyColorAsFacialMaskSubColor'
    | 'altColorAsFacialMaskSubColor';

export interface Species {
    kind: string;
    mod: string;
    title: string;
    subTitle: string;
    description: string;
    /** The game's ten creator labels: body colour, hair, shirt, pants, alt, head, shirt colour, pants colour, name, personality. */
    labels: string[];
    playable: boolean;
    order: number | null;
    flags: Partial<Record<SpeciesFlag, true>>;
    bodyColor: ColorOption[];
    undyColor: ColorOption[];
    hairColor: ColorOption[];
    personalities: Personality[];
    genders: SpeciesGender[];
}

/** A species as the bundle stores it: the unpatched file and each mod's patch, in load order. */
export interface RawSpecies {
    kind: string;
    mod: string;
    playable: boolean;
    order: number | null;
    personalities: Personality[];
    config: Json;
    patches: { m: string; p: Json }[];
}

/** The mods present, merged in load order (merge.ts). */
export interface Manifest {
    build: string;
    mods: BundleMod[];
    packs: Record<string, PackInfo>;
    where: ImageIndex;
    /** Read through speciesFor() in species.ts, which applies the patches a race keeps. */
    species: Record<string, RawSpecies>;
    images: Record<string, ImageEntry>;
    frames: Record<string, Record<string, FrameRect>>;
}

export type WearSlot = 'head' | 'chest' | 'legs' | 'back';

export interface WearItem {
    id: string;
    slot: WearSlot;
    name: string;
    mod: string;
    frames: Partial<Record<'male' | 'female', Partial<Record<'body' | 'backSleeve' | 'frontSleeve', string>>>>;
    /** Index into ItemsFile.palettes. */
    colors: number;
    icon?: string;
    mask?: string;
    directives?: string;
    hideBody?: true;
    /** Species kinds (lowercase) that may wear it; absent means any. Set by curation.ts. */
    only?: string[];
}

/** Every present mod's items, merged (merge.ts). */
export interface ItemsFile {
    items: WearItem[];
    palettes: ColorOption[][];
    images: Record<string, ImageEntry>;
    where: ImageIndex;
}

/** A pick from a colour list, plus hand edits: output colour -> replacement, applied last. */
export interface ColorPick {
    option: number;
    tweak?: Record<string, string>;
}

export interface Worn extends ColorPick {
    item: string;
}

/** Everything needed to redraw a portrait. Stored with it so it can be reopened and edited. */
export interface Recipe {
    v: 1;
    species: string;
    /** Mod ids whose sprites are not used (how one species becomes two races). */
    exclude: string[];
    /** Mod ids whose sprites win over load order, most preferred first. */
    prefer?: string[];
    gender: number;
    personality: number;
    hair: string;
    facialHair: string;
    facialMask: string;
    body: ColorPick;
    undy: ColorPick;
    hairColor: ColorPick;
    wear: Partial<Record<WearSlot, Worn>>;
    emote: string;
    nude: boolean;
}

/** Which mods' sprites to draw from; a Recipe is one. */
export interface SpriteChoice {
    exclude: string[];
    prefer?: string[];
}

export interface Pixels {
    width: number;
    height: number;
    /** RGBA, row-major from the top-left. */
    data: Uint8ClampedArray;
}
