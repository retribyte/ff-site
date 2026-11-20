// The 14x14 avatar cut from a portrait: where the square starts, and the cut itself with
// the pixels the member erased left out. No DOM.

import type { Pixels } from './types';

export const AVATAR_SIDE = 14;

export interface Box {
    x: number;
    y: number;
}

/** Keeps the square inside the portrait. */
export function clampBox(pixels: Pixels, box: Box): Box {
    return {
        x: Math.max(0, Math.min(pixels.width - AVATAR_SIDE, Math.round(box.x))),
        y: Math.max(0, Math.min(pixels.height - AVATAR_SIDE, Math.round(box.y))),
    };
}

/**
 * Where the square starts: at the top of the figure, centred on what is drawn in its top
 * 14 rows (the head, for a standing figure). An empty portrait gets the middle.
 */
export function defaultBox(pixels: Pixels): Box {
    const { width, height, data } = pixels;
    const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 0;
    let top = -1;
    for (let y = 0; y < height && top < 0; y++) for (let x = 0; x < width; x++) if (opaque(x, y)) { top = y; break; }
    if (top < 0) return clampBox(pixels, { x: (width - AVATAR_SIDE) / 2, y: (height - AVATAR_SIDE) / 2 });
    let left = width, right = -1;
    for (let y = top; y < Math.min(height, top + AVATAR_SIDE); y++)
        for (let x = 0; x < width; x++)
            if (opaque(x, y)) {
                left = Math.min(left, x);
                right = Math.max(right, x);
            }
    return clampBox(pixels, { x: (left + right + 1) / 2 - AVATAR_SIDE / 2, y: top });
}

/** A portrait pixel's key in the erased set. */
export const pixelKey = (x: number, y: number) => `${x},${y}`;

/** The 14x14 square at `box`, with erased pixels (keyed in portrait coordinates) cleared. */
export function cropAvatar(pixels: Pixels, box: Box, erased: ReadonlySet<string> = new Set()): Pixels {
    const out: Pixels = { width: AVATAR_SIDE, height: AVATAR_SIDE, data: new Uint8ClampedArray(AVATAR_SIDE * AVATAR_SIDE * 4) };
    for (let y = 0; y < AVATAR_SIDE; y++)
        for (let x = 0; x < AVATAR_SIDE; x++) {
            const sx = box.x + x, sy = box.y + y;
            if (sx < 0 || sy < 0 || sx >= pixels.width || sy >= pixels.height || erased.has(pixelKey(sx, sy))) continue;
            const from = (sy * pixels.width + sx) * 4;
            out.data.set(pixels.data.subarray(from, from + 4), (y * AVATAR_SIDE + x) * 4);
        }
    return out;
}
