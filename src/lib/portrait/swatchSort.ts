// Orders a list of colour options for display. Only the order shown changes: a recipe stores
// an option's index in the species' or item's own list, so callers map back through the result.

import type { ColorOption } from './types';

export const SWATCH_SORTS = ['default', 'hue', 'saturation', 'lightness'] as const;
export type SwatchSort = (typeof SWATCH_SORTS)[number];

interface Tone {
    /** Degrees, 0 to 360, of the most colourful of the option's first colours. */
    hue: number;
    /** 0 to 1: how far that colour is from grey. */
    chroma: number;
    /** 0 to 1: mean brightness of those colours. */
    light: number;
}

/** Below this an option reads as grey, and its hue is noise. */
const GREY = 0.12;
const HUE_BANDS = 12;
/** How many of an option's colours a swatch shows. */
export const SWATCH_COLORS = 4;

function tone(option: ColorOption): Tone | null {
    if (typeof option === 'string') return null; // a raw directive: no colours to read
    let best: Tone | null = null, light = 0, n = 0;
    // Only the colours a swatch shows, so the order matches what is on screen.
    for (const hex of Object.values(option).slice(0, SWATCH_COLORS)) {
        if (!/^[0-9a-f]{6}/i.test(hex)) continue;
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b), chroma = max - Math.min(r, g, b);
        light += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        n++;
        if (best && chroma <= best.chroma) continue;
        const h = chroma === 0 ? 0 : max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
        best = { hue: h * 60, chroma, light: 0 };
    }
    return best && { ...best, light: light / n };
}

/**
 * The options' indices in display order. 'hue' runs round the colour wheel in bands, light to
 * dark within each, with the greys after; 'saturation' goes vivid to dull; 'lightness' light
 * to dark. Options without readable colours keep their place at the end.
 */
export function sortOptions(options: ColorOption[], mode: SwatchSort): number[] {
    const order = options.map((_, i) => i);
    if (mode === 'default') return order;
    const tones = options.map(tone);
    // Half a band of offset keeps the reds either side of 0 degrees together.
    const band = (t: Tone) => (t.chroma < GREY ? HUE_BANDS : Math.floor(((t.hue + 180 / HUE_BANDS) % 360) / (360 / HUE_BANDS)));
    const compare: Record<Exclude<SwatchSort, 'default'>, (a: Tone, b: Tone) => number> = {
        hue: (a, b) => band(a) - band(b) || b.light - a.light,
        saturation: (a, b) => b.chroma - a.chroma || b.light - a.light,
        lightness: (a, b) => b.light - a.light,
    };
    return order.sort((i, j) => {
        const a = tones[i], b = tones[j];
        if (!a || !b) return a ? -1 : b ? 1 : i - j;
        return compare[mode](a, b) || i - j;
    });
}
