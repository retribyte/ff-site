import { describe, expect, it } from 'vitest';
import { AVATAR_SIDE, clampBox, cropAvatar, defaultBox, pixelKey } from './avatar';
import type { Pixels } from './types';

function blank(width = 43, height = 43): Pixels {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
function fill(px: Pixels, x0: number, y0: number, w: number, h: number, value = 255) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px.data.set([value, value, value, 255], (y * px.width + x) * 4);
}

describe('avatar crop', () => {
    it('starts on the head: top of the figure, centred on its top rows', () => {
        const px = blank();
        fill(px, 16, 6, 10, 10); // head, x 16..25
        fill(px, 10, 20, 24, 20); // wider body below
        expect(defaultBox(px)).toEqual({ x: 14, y: 6 });
        expect(defaultBox(blank())).toEqual({ x: 15, y: 15 });
    });

    it('keeps the square inside the portrait', () => {
        const px = blank();
        expect(clampBox(px, { x: -5, y: 100 })).toEqual({ x: 0, y: 43 - AVATAR_SIDE });
        const hat = blank();
        fill(hat, 40, 0, 3, 3); // drawn against the right edge
        expect(defaultBox(hat)).toEqual({ x: 43 - AVATAR_SIDE, y: 0 });
    });

    it('cuts 14x14 and leaves out erased pixels', () => {
        const px = blank();
        fill(px, 0, 0, 43, 43, 200);
        const cut = cropAvatar(px, { x: 10, y: 5 }, new Set([pixelKey(10, 5), pixelKey(23, 18), pixelKey(0, 0)]));
        expect([cut.width, cut.height]).toEqual([14, 14]);
        const alpha = (x: number, y: number) => cut.data[(y * 14 + x) * 4 + 3];
        expect(alpha(0, 0)).toBe(0);
        expect(alpha(13, 13)).toBe(0);
        expect(alpha(1, 0)).toBe(255);
        expect(cut.data.filter((_, i) => i % 4 === 3 && true).filter((a) => a === 255).length).toBe(14 * 14 - 2);
    });
});
