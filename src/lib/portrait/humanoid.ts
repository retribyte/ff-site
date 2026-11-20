// Turns a recipe into the ordered sprite layers of a Starbound portrait. Ported from
// OpenStarbound: SpeciesDatabase::createHumanoid (which options colour which part) and
// Humanoid::renderPortrait (layer order, frames and offsets).

import { optionDirective, wrap } from './directives';
import type { ColorOption, ColorPick, ItemsFile, Personality, Recipe, Species, SpriteChoice, WearItem, WearSlot } from './types';

export interface Layer {
    part: string;
    image: string;
    frame: string;
    directives: string;
    /** Pixels, y up, applied to the centre of the frame. */
    offset: [number, number];
    /** Helmet mask image: the layer keeps only the pixels the mask covers. */
    mask?: string;
}

export const EMOTES = ['idle', 'blabber', 'shout', 'happy', 'sad', 'neutral', 'laugh', 'annoyed', 'oh', 'oooh', 'blink', 'wink', 'eat', 'sleep'];

const DEFAULT_PERSONALITY: Personality = ['idle.1', 'idle.1', [0, 0], [0, 0]];

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
    personality: Personality;
}

export function createIdentity(species: Species, recipe: Recipe): Identity {
    const f = species.flags;
    // Hand edits apply to the finished colours, so they go after every option directive.
    let bodyColor = optionDirective(wrap(species.bodyColor, recipe.body.option));
    const altColor = f.altOptionAsUndyColor ? optionDirective(wrap(species.undyColor, recipe.undy.option)) : '';
    let hairColor = bodyColor;
    if (f.headOptionAsHairColor) {
        hairColor = optionDirective(wrap(species.hairColor, recipe.hairColor.option));
        if (f.altOptionAsHairColor) hairColor += optionDirective(wrap(species.undyColor, recipe.undy.option));
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
        personality: wrap(species.personalities, recipe.personality) ?? DEFAULT_PERSONALITY,
    };
}

export function wornDirectives(item: WearItem, worn: ColorPick, palettes: ColorOption[][]): string {
    const base = item.directives ?? optionDirective(wrap(palettes[item.colors] ?? [], worn.option));
    return base + tweakDirective(worn.tweak);
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
    const dir = (gender.sprites.body ?? '').replace(/[^/]*$/, '');
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
    const layers: Layer[] = [];
    const add = (part: string, image: string | undefined, frame: string, directives: string, offset: [number, number], mask?: string) => {
        if (image) layers.push({ part, image, frame, directives, offset, mask });
    };

    // A costume marked hideBody replaces the wearer: the game hides every body part under it.
    const bare = !(head?.item.hideBody || chest?.item.hideBody || legs?.item.hideBody || back?.item.hideBody);

    if (bare) add('backArm', gender.sprites.backArm, armIdle, id.bodyDirectives, armOffset);
    add('backSleeve', chest?.frames.backSleeve, armIdle, chest?.directives ?? '', armOffset);
    add('back', back?.frames.body, idle, back?.directives ?? '', [0, 0]);
    if (bare) add('head', gender.sprites.head, 'normal', id.bodyDirectives, headOffset);
    if (bare) add('emote', gender.sprites.emote, `${recipe.emote || 'idle'}.1`, id.bodyDirectives, headOffset);
    if (bare && recipe.hair) add('hair', `${dir}${gender.hairGroup}/${recipe.hair}.png`.toLowerCase(), 'normal', id.hairDirectives, headOffset, helmetMask);
    if (bare) add('body', gender.sprites.body, idle, id.bodyDirectives, [0, 0]);
    add('legs', legs?.frames.body, idle, legs?.directives ?? '', [0, 0]);
    add('chest', chest?.frames.body, idle, chest?.directives ?? '', [0, 0]);
    if (bare && recipe.facialHair && gender.facialHairGroup)
        add('facialHair', `${dir}${gender.facialHairGroup}/${recipe.facialHair}.png`.toLowerCase(), 'normal', id.facialHairDirectives, headOffset, helmetMask);
    if (bare && recipe.facialMask && gender.facialMaskGroup)
        add('facialMask', `${dir}${gender.facialMaskGroup}/${recipe.facialMask}.png`.toLowerCase(), 'normal', id.facialMaskDirectives, headOffset, helmetMask);
    add('headwear', head?.frames.body, 'normal', head?.directives ?? '', headOffset);
    if (bare) add('frontArm', gender.sprites.frontArm, armIdle, id.bodyDirectives, armOffset);
    add('frontSleeve', chest?.frames.frontSleeve, armIdle, chest?.directives ?? '', armOffset);
    return layers;
}

/** The game's starting point for a species: first options everywhere, its first listed outfit. */
export function defaultRecipe(species: Species, choice: SpriteChoice = { exclude: [] }): Recipe {
    const g = species.genders[0];
    const f = species.flags;
    return {
        v: 1,
        species: species.kind,
        exclude: choice.exclude,
        ...(choice.prefer?.length ? { prefer: choice.prefer } : {}),
        gender: 0,
        personality: 0,
        hair: g?.hair[0] ?? '',
        facialHair: f.headOptionAsFacialhair ? g?.facialHair[0] ?? '' : '',
        facialMask: f.altOptionAsFacialMask ? g?.facialMask[0] ?? '' : '',
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

/** What the original creator's "randomise" does, with facial hair and masks rolled on their own. */
export function randomRecipe(species: Species, choice: SpriteChoice = { exclude: [] }, random: () => number = Math.random): Recipe {
    const roll = (n: number) => Math.floor(random() * Math.max(1, n));
    const any = <T,>(list: T[]) => list[roll(list.length)];
    const gender = roll(species.genders.length);
    const g = species.genders[gender];
    const f = species.flags;
    const shirt = any(g.shirt), pants = any(g.pants);
    return {
        ...defaultRecipe(species, choice),
        gender,
        personality: roll(species.personalities.length),
        hair: any(g.hair) ?? '',
        facialHair: f.headOptionAsFacialhair ? any(g.facialHair) ?? '' : '',
        facialMask: f.altOptionAsFacialMask ? any(g.facialMask) ?? '' : '',
        body: { option: roll(species.bodyColor.length) },
        undy: { option: roll(species.undyColor.length) },
        hairColor: { option: roll(species.hairColor.length) },
        wear: {
            ...(shirt ? { chest: { item: shirt, option: roll(12) } } : {}),
            ...(pants ? { legs: { item: pants, option: roll(12) } } : {}),
        },
    };
}
