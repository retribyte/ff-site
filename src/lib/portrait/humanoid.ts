// Turns a recipe into the ordered sprite layers of a Starbound portrait. Ported from
// OpenStarbound: SpeciesDatabase::createHumanoid (which options colour which part) and
// Humanoid::renderPortrait (layer order, frames and offsets).

import { optionDirective, wrap } from './directives';
import { STYLE_PARTS, type ColorOption, type ColorPick, type FitRule, type ItemsFile, type Personality, type Recipe, type RecipeV1, type Species, type SpeciesGender, type SpriteChoice, type StyleColor, type StylePart, type StyleSlot, type WearItem, type WearSlot } from './types';

export interface Layer {
    part: string;
    image: string;
    frame: string;
    directives: string;
    /** Pixels, y up, applied to the centre of the frame. */
    offset: [number, number];
    /** Helmet mask image: the layer keeps only the pixels the mask covers. */
    mask?: string;
    /** How the helmet the mask belongs to was fitted (its rows, columns and move), so the mask follows it. */
    maskFit?: FitRule;
    /** Take frame rectangles from this image instead of the layer's own (a style sheet laid out like a body part's). */
    framesOf?: string;
    /** Rows and columns added or removed (a clothing fit), before the layer is drawn. */
    resize?: Pick<FitRule, 'rows' | 'columns'>;
    /** Moves with the head (what a head-only view keeps). */
    head?: boolean;
    /** The colour pick whose hand edits this layer takes: 'body', 'hairColor', 'style:<layer id>' or a clothing slot. */
    pick?: string;
}

export const EMOTES = ['idle', 'blabber', 'shout', 'happy', 'sad', 'neutral', 'laugh', 'annoyed', 'oh', 'oooh', 'blink', 'wink', 'eat', 'sleep'];

const DEFAULT_PERSONALITY: Personality = ['idle.1', 'idle.1', [0, 0], [0, 0]];

/**
 * The portrait's layers back to front, as the game draws them (Humanoid::renderPortrait). Style
 * layers are placed among these by their `above`.
 */
const BASE_ORDER = ['backArm', 'backSleeve', 'back', 'head', 'emote', 'body', 'legs', 'chest', 'headwear', 'frontArm', 'frontSleeve'];

function tweakDirective(tweak: Record<string, string> | undefined): string {
    return tweak && Object.keys(tweak).length ? optionDirective(tweak) : '';
}

export function pickDirective(options: ColorOption[], pick: ColorPick): string {
    return optionDirective(wrap(options, pick.option)) + tweakDirective(pick.tweak);
}

export interface Identity {
    bodyDirectives: string;
    hairDirectives: string;
    facialHairDirectives: string;
    facialMaskDirectives: string;
    /** The alt (detail) colour pick on its own, with the body's hand edits: for the site's own style layers. */
    undyDirectives: string;
    personality: Personality;
}

export function createIdentity(species: Species, recipe: Recipe): Identity {
    const f = species.flags;
    // Hand edits apply to the finished colours, so they go after every option directive.
    let bodyColor = optionDirective(wrap(species.bodyColor, recipe.body.option));
    const undy = optionDirective(wrap(species.undyColor, recipe.undy.option));
    const altColor = f.altOptionAsUndyColor ? undy : '';
    let hairColor = bodyColor;
    if (f.headOptionAsHairColor) {
        hairColor = optionDirective(wrap(species.hairColor, recipe.hairColor.option));
        if (f.altOptionAsHairColor) hairColor += undy;
    }
    if (f.hairColorAsBodySubColor) bodyColor += hairColor;
    let facialMask = '';
    if (f.bodyColorAsFacialMaskSubColor) facialMask += bodyColor;
    if (f.altColorAsFacialMaskSubColor) facialMask += altColor;
    const bodyTweak = tweakDirective(recipe.body.tweak) + tweakDirective(recipe.undy.tweak);
    const hairTweak = tweakDirective(recipe.hairColor.tweak);
    return {
        bodyDirectives: bodyColor + altColor + bodyTweak,
        hairDirectives: hairColor + hairTweak,
        facialHairDirectives: hairColor + hairTweak,
        facialMaskDirectives: facialMask + bodyTweak,
        undyDirectives: undy + bodyTweak,
        personality: wrap(species.personalities, recipe.personality) ?? DEFAULT_PERSONALITY,
    };
}

export function wornDirectives(item: WearItem, worn: ColorPick, palettes: ColorOption[][]): string {
    const base = item.directives ?? optionDirective(wrap(palettes[item.colors] ?? [], worn.option));
    return base + tweakDirective(worn.tweak);
}

/** A style layer's colour directives: its colour sources in order. */
export function styleDirectives(slot: StyleSlot, id: Identity, recipe: Recipe): string {
    const one = (c: StyleColor): string => {
        switch (c) {
            case 'body': return id.bodyDirectives;
            case 'hair': return id.hairDirectives;
            case 'undy': return id.undyDirectives;
            case 'facialMask': return id.facialMaskDirectives;
            case 'own': return pickDirective(slot.colors, recipe.styleColors?.[slot.id] ?? { option: 0 });
            default: return '';
        }
    };
    return slot.color.map(one).join('');
}

/** Which colour pick's hand edits a style layer takes (the palette editor's tab for it). */
export function stylePick(slot: StyleSlot): string | undefined {
    if (slot.color.includes('own') && slot.colors.length) return `style:${slot.id}`;
    if (slot.color.includes('hair')) return 'hairColor';
    if (slot.color.some((c) => c === 'body' || c === 'undy' || c === 'facialMask')) return 'body';
    return undefined;
}

/**
 * The draw order with every style layer's parts placed: each just above its anchor, after
 * whatever was placed above that anchor before it. Entries are base layer names and
 * `<slot id>:<part>`.
 */
export function layerOrder(styles: StyleSlot[]): string[] {
    const order = [...BASE_ORDER];
    const last = new Map<string, string>();
    for (const slot of styles)
        for (const part of STYLE_PARTS) {
            const wanted = slot.above[part];
            const anchor = [wanted, `${wanted}:${part}`, `${wanted}:head`].find((a) => order.includes(a)) ?? part;
            const after = last.get(anchor) ?? anchor;
            const name = `${slot.id}:${part}`;
            order.splice(order.indexOf(after) + 1, 0, name);
            last.set(anchor, name);
        }
    return order;
}

/** The picks of a style layer that it can draw, in order. */
function drawnPicks(slot: StyleSlot, recipe: Recipe): string[] {
    const picks = recipe.styles[slot.id] ?? [];
    return (slot.stack ? picks : picks.slice(0, 1)).filter((o) => o !== '' && slot.files[o]);
}

/**
 * Layers back to front, for the species as the recipe's race sees it (speciesFor in species.ts).
 * Images that the bundle lacks are simply absent from the result.
 */
export function buildLayers(species: Species | undefined, recipe: Recipe, items?: ItemsFile): Layer[] {
    if (!species) return [];
    const gender = wrap(species.genders, recipe.gender);
    if (!gender) return [];
    const id = createIdentity(species, recipe);
    const [idle, armIdle, headOffset, armOffset] = id.personality;
    const fit = gender.fit ?? {};
    // The game treats a species' first gender as male and the rest as female when dressing them.
    const itemGender = species.genders.indexOf(gender) === 0 ? 'male' : 'female';
    const worn = (slot: WearSlot) => {
        const w = recipe.nude ? undefined : recipe.wear[slot];
        const item = w && items?.items.find((i) => i.id === w.item && i.slot === slot);
        if (!w || !item || !items) return null;
        return { frames: item.frames[itemGender] ?? item.frames.male ?? item.frames.female ?? {}, item, directives: wornDirectives(item, w, items.palettes) };
    };
    const head = worn('head'), chest = worn('chest'), legs = worn('legs'), back = worn('back');
    const helmetMask = head?.item.mask;
    const order = layerOrder(gender.styles);
    const placed: { at: number; layer: Layer }[] = [];
    const add = (key: string, layer: Omit<Layer, 'image'> & { image: string | undefined }) => {
        if (!layer.image) return;
        const clean = Object.fromEntries(Object.entries(layer).filter(([, v]) => v !== undefined)) as unknown as Layer;
        placed.push({ at: order.indexOf(key), layer: clean });
    };
    const plus = (a: [number, number], b?: [number, number]): [number, number] => (b ? [a[0] + b[0], a[1] + b[1]] : a);
    const resizeOf = (rule?: FitRule) => (rule && (rule.rows || rule.columns) ? { rows: rule.rows, columns: rule.columns } : undefined);
    const clothing = (part: keyof typeof fit, image: string | undefined, frame: string, directives: string, offset: [number, number], pick: string, isHead = false) =>
        add(part, { part, image, frame, directives, offset: plus(offset, fit[part]?.offset), resize: resizeOf(fit[part]), pick, head: isHead || undefined });

    // A costume marked hideBody replaces the wearer: the game hides every body part under it.
    const bare = !(head?.item.hideBody || chest?.item.hideBody || legs?.item.hideBody || back?.item.hideBody);

    if (bare) {
        add('backArm', { part: 'backArm', image: gender.sprites.backArm, frame: armIdle, directives: id.bodyDirectives, offset: armOffset, pick: 'body' });
        add('head', { part: 'head', image: gender.sprites.head, frame: 'normal', directives: id.bodyDirectives, offset: headOffset, pick: 'body', head: true });
        add('emote', { part: 'emote', image: gender.sprites.emote, frame: `${recipe.emote || 'idle'}.1`, directives: id.bodyDirectives, offset: headOffset, pick: 'body', head: true });
        add('body', { part: 'body', image: gender.sprites.body, frame: idle, directives: id.bodyDirectives, offset: [0, 0], pick: 'body' });
        add('frontArm', { part: 'frontArm', image: gender.sprites.frontArm, frame: armIdle, directives: id.bodyDirectives, offset: armOffset, pick: 'body' });
        const where: Record<StylePart, { frame: string; offset: [number, number]; base?: string }> = {
            head: { frame: 'normal', offset: headOffset, base: gender.sprites.head },
            body: { frame: idle, offset: [0, 0], base: gender.sprites.body },
            frontArm: { frame: armIdle, offset: armOffset, base: gender.sprites.frontArm },
            backArm: { frame: armIdle, offset: armOffset, base: gender.sprites.backArm },
        };
        for (const slot of gender.styles) {
            const directives = styleDirectives(slot, id, recipe);
            const pick = stylePick(slot);
            for (const option of drawnPicks(slot, recipe))
                for (const part of STYLE_PARTS) {
                    const image = slot.files[option]?.[part];
                    const masked = part === 'head' && slot.masked && helmetMask;
                    add(`${slot.id}:${part}`, {
                        part: slot.builtin ? slot.id : `${slot.id}.${part}`,
                        image,
                        frame: where[part].frame,
                        directives,
                        offset: where[part].offset,
                        mask: masked ? helmetMask : undefined,
                        maskFit: masked ? fit.headwear : undefined,
                        framesOf: slot.builtin ? undefined : where[part].base,
                        head: part === 'head' || undefined,
                        pick,
                    });
                }
        }
    }
    clothing('backSleeve', chest?.frames.backSleeve, armIdle, chest?.directives ?? '', armOffset, 'chest');
    clothing('back', back?.frames.body, idle, back?.directives ?? '', [0, 0], 'back');
    clothing('legs', legs?.frames.body, idle, legs?.directives ?? '', [0, 0], 'legs');
    clothing('chest', chest?.frames.body, idle, chest?.directives ?? '', [0, 0], 'chest');
    clothing('headwear', head?.frames.body, 'normal', head?.directives ?? '', headOffset, 'head', true);
    clothing('frontSleeve', chest?.frames.frontSleeve, armIdle, chest?.directives ?? '', armOffset, 'chest');
    // Stable: a stacked layer's picks keep the order they were picked in.
    return placed.sort((a, b) => a.at - b.at).map((p) => p.layer);
}

// ---------------------------------------------------------------------------- style picks

/** Whether a style can be drawn, given which images the recipe's choice of mods has ('' always can). */
export function styleAvailable(slot: StyleSlot, option: string, has: (image: string) => boolean = () => true): boolean {
    return option === '' || Object.values(slot.files[option] ?? {}).some((image) => !!image && has(image));
}

/** The styles of a layer the recipe's choice of mods can draw, without repeats. */
export function availableStyles(slot: StyleSlot, has?: (image: string) => boolean): string[] {
    return [...new Set(slot.options)].filter((o) => styleAvailable(slot, o, has));
}

/** A pick list for one style: [] for none. */
const asPicks = (option: string | undefined) => (option ? [option] : []);

/** Every layer's starting style: its first option. */
export function defaultStyles(gender: SpeciesGender | undefined): Record<string, string[]> {
    return Object.fromEntries((gender?.styles ?? []).map((slot) => [slot.id, asPicks(slot.options[0])]));
}

/**
 * The picks carried over to another gender or choice of mods: those still offered are kept; a
 * layer left with nothing it can draw falls back to its first available style (which may be
 * none), unless "none" is itself an option or the layer stacks. Layers the gender lacks go.
 */
export function reconcileStyles(gender: SpeciesGender | undefined, styles: Record<string, string[]>, has?: (image: string) => boolean): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const slot of gender?.styles ?? []) {
        const offered = availableStyles(slot, has);
        const picks = styles[slot.id] ?? [];
        const kept = picks.filter((o) => o !== '' && offered.includes(o));
        const noneOk = slot.stack || offered.includes('');
        out[slot.id] = kept.length || (picks.length === 0 && noneOk) ? (slot.stack ? kept : kept.slice(0, 1)) : asPicks(offered[0]);
    }
    return out;
}

/**
 * A recipe as this version reads it, from any saved version; null if it is not a recipe. Version
 * 1 had three fixed style fields; they become the `hair`, `facialHair` and `facialMask` layers.
 */
export function upgradeRecipe(raw: unknown): Recipe | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Partial<Recipe> & Partial<RecipeV1> & { v?: unknown };
    if (typeof r.species !== 'string' || !Array.isArray(r.exclude) || !r.wear || typeof r.wear !== 'object') return null;
    if (r.v === 1) {
        const { hair, facialHair, facialMask, ...rest } = r as RecipeV1;
        return { ...rest, v: 2, styles: { hair: asPicks(hair), facialHair: asPicks(facialHair), facialMask: asPicks(facialMask) } };
    }
    if (r.v !== 2 || !r.styles || typeof r.styles !== 'object') return null;
    const styles = Object.fromEntries(Object.entries(r.styles).map(([k, v]) => [k, Array.isArray(v) ? v.filter((o): o is string => typeof o === 'string' && o !== '') : []]));
    return { ...(r as Recipe), styles };
}

/** The game's starting point for a species: first options everywhere, its first listed outfit. */
export function defaultRecipe(species: Species, choice: SpriteChoice = { exclude: [] }): Recipe {
    const g = species.genders[0];
    return {
        v: 2,
        species: species.kind,
        exclude: choice.exclude,
        ...(choice.prefer?.length ? { prefer: choice.prefer } : {}),
        gender: 0,
        personality: 0,
        styles: defaultStyles(g),
        body: { option: 0 },
        undy: { option: 0 },
        hairColor: { option: 0 },
        wear: {
            ...(g?.shirt[0] ? { chest: { item: g.shirt[0], option: 0 } } : {}),
            ...(g?.pants[0] ? { legs: { item: g.pants[0], option: 0 } } : {}),
        },
        emote: 'idle',
        nude: false,
    };
}

/** What the original creator's "randomise" does, with every style layer (and its own colours) rolled on its own. */
export function randomRecipe(species: Species, choice: SpriteChoice = { exclude: [] }, random: () => number = Math.random): Recipe {
    const roll = (n: number) => Math.floor(random() * Math.max(1, n));
    const any = <T,>(list: T[]) => list[roll(list.length)];
    const gender = roll(species.genders.length);
    const g = species.genders[gender];
    const shirt = any(g.shirt), pants = any(g.pants);
    const styleColors = Object.fromEntries(g.styles.filter((s) => s.colors.length > 1).map((s) => [s.id, { option: roll(s.colors.length) }]));
    return {
        ...defaultRecipe(species, choice),
        gender,
        personality: roll(species.personalities.length),
        // A stacking layer gets one style or none; the rest one of their options.
        styles: Object.fromEntries(g.styles.map((s) => [s.id, asPicks(s.stack ? any(['', ...s.options]) : any(s.options))])),
        ...(Object.keys(styleColors).length ? { styleColors } : {}),
        body: { option: roll(species.bodyColor.length) },
        undy: { option: roll(species.undyColor.length) },
        hairColor: { option: roll(species.hairColor.length) },
        wear: {
            ...(shirt ? { chest: { item: shirt, option: roll(12) } } : {}),
            ...(pants ? { legs: { item: pants, option: roll(12) } } : {}),
        },
    };
}
