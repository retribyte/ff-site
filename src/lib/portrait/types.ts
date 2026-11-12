// Shapes of the sprite bundle written by portrait-extract/extract.py, and of a saved portrait.

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

export interface Manifest {
    version: number;
    build: string;
    mods: BundleMod[];
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
}

export interface ItemsFile {
    version: number;
    build: string;
    items: WearItem[];
    palettes: ColorOption[][];
    images: Record<string, ImageEntry>;
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
