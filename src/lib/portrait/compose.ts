// Draws layers into one RGBA buffer. No canvas or DOM, so it runs in the browser, in a
// worker and under vitest alike; callers supply the decoded sprite sheets.

import { applyOperations, parseDirectives } from './directives';
import type { Layer } from './humanoid';
import type { FrameRect, ImageEntry, Pixels, SpriteChoice } from './types';

/** Starbound's humanoid frames are 43x43; the portrait canvas matches so offsets stay exact. */
export const FRAME_SIZE = 43;

export const NO_CHOICE: SpriteChoice = { exclude: [] };

/**
 * The mod whose copy of an image to use. Excluded mods are out; among the rest the first
 * preferred mod that ships the image wins, else the last in load order, as in the game.
 */
export function pickProvider(entry: ImageEntry | undefined, choice: SpriteChoice = NO_CHOICE): string | null {
    if (!entry) return null;
    const mods = entry.m.filter((m) => !choice.exclude.includes(m));
    for (const mod of choice.prefer ?? []) if (mods.includes(mod)) return mod;
    return mods.length ? mods[mods.length - 1] : null;
}

/** Bundle-relative URL of one mod's copy of an image. */
export function spritePath(mod: string, image: string): string {
    return `sprites/${mod}${image.split('/').map(encodeURIComponent).join('/')}`;
}

export function cropFrame(sheet: Pixels, rect: FrameRect | undefined): Pixels | null {
    const [x, y, w, h] = rect ?? [0, 0, sheet.width, sheet.height];
    if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > sheet.width || y + h > sheet.height) return null;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
        const start = ((y + row) * sheet.width + x) * 4;
        data.set(sheet.data.subarray(start, start + w * 4), row * w * 4);
    }
    return { width: w, height: h, data };
}

/** Starbound's addmask: alpha becomes min(alpha, mask alpha); both images are aligned at the bottom-left. */
function applyMask(frame: Pixels, mask: Pixels): void {
    for (let y = 0; y < frame.height; y++) {
        const my = y - (frame.height - mask.height);
        for (let x = 0; x < frame.width; x++) {
            const inside = my >= 0 && my < mask.height && x < mask.width;
            const alpha = inside ? mask.data[(my * mask.width + x) * 4 + 3] : 0;
            const i = (y * frame.width + x) * 4 + 3;
            if (alpha < frame.data[i]) frame.data[i] = alpha;
        }
    }
}

export interface FrameSource {
    /** One frame of a sheet (a fresh copy is not required; compose never mutates it), or null. */
    frame(image: string, frame: string): Pixels | null;
    /** A whole image, for masks. */
    image(image: string): Pixels | null;
}

/** One layer with its directives and mask applied, uncomposited. */
export function renderLayer(layer: Layer, source: FrameSource): Pixels | null {
    const frame = source.frame(layer.image, layer.frame);
    if (!frame) return null;
    const out: Pixels = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) };
    applyOperations(out.data, parseDirectives(layer.directives));
    const mask = layer.mask ? source.image(layer.mask) : null;
    if (mask) applyMask(out, mask);
    return out;
}

/**
 * Draws the layers centred on a square canvas. The canvas is `minSize` unless a sprite reaches
 * past it (an oversized frame, a pose that shifts the head), in which case it grows evenly just
 * enough to hold every opaque pixel, so nothing is ever cut off.
 */
export function compose(layers: Layer[], source: FrameSource, minSize = FRAME_SIZE): Pixels {
    const frames = layers.map((layer) => ({ layer, frame: renderLayer(layer, source) }));
    let reach = minSize;
    for (const { layer, frame } of frames) {
        if (!frame) continue;
        reach = Math.max(reach, frame.width + 2 * Math.abs(Math.round(layer.offset[0])) + 1, frame.height + 2 * Math.abs(Math.round(layer.offset[1])) + 1);
    }
    // Same parity as minSize so a frame of that size stays centred on whole pixels.
    const size = reach + ((reach - minSize) % 2);
    const out: Pixels = { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
    for (const { layer, frame } of frames) {
        if (!frame) continue;
        const left = Math.floor((size - frame.width) / 2) + Math.round(layer.offset[0]);
        const top = Math.floor((size - frame.height) / 2) - Math.round(layer.offset[1]);
        for (let y = 0; y < frame.height; y++) {
            const oy = top + y;
            if (oy < 0 || oy >= size) continue;
            for (let x = 0; x < frame.width; x++) {
                const ox = left + x;
                if (ox < 0 || ox >= size) continue;
                const s = (y * frame.width + x) * 4;
                const sa = frame.data[s + 3] / 255;
                if (sa === 0) continue;
                const d = (oy * size + ox) * 4;
                const da = out.data[d + 3] / 255;
                const a = sa + da * (1 - sa);
                for (let c = 0; c < 3; c++)
                    out.data[d + c] = Math.round((frame.data[s + c] * sa + out.data[d + c] * da * (1 - sa)) / a);
                out.data[d + 3] = Math.round(a * 255);
            }
        }
    }
    return size === minSize ? out : trimTo(out, minSize);
}

/** Shrinks a centred square canvas as far as its opaque pixels allow, never below `minSize`. */
function trimTo(px: Pixels, minSize: number): Pixels {
    const size = px.width;
    let margin = (size - minSize) / 2;
    for (let y = 0; y < size && margin > 0; y++)
        for (let x = 0; x < size; x++)
            if (px.data[(y * size + x) * 4 + 3]) margin = Math.min(margin, x, y, size - 1 - x, size - 1 - y);
    if (margin <= 0) return px;
    const side = size - 2 * margin;
    const data = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++) {
        const start = ((y + margin) * size + margin) * 4;
        data.set(px.data.subarray(start, start + side * 4), y * side * 4);
    }
    return { width: side, height: side, data };
}

/** The images a set of layers needs, masks included. */
export function layerImages(layers: Layer[]): string[] {
    return [...new Set(layers.flatMap((l) => (l.mask ? [l.image, l.mask] : [l.image])))];
}
