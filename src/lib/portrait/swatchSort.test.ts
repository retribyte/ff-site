import { describe, expect, it } from 'vitest';
import { sortOptions } from './swatchSort';
import type { ColorOption } from './types';

const one = (hex: string): ColorOption => ({ ffffff: hex });
// red, grey, a raw directive, blue, pale red, dark grey, a green too dull to count as a hue
const options: ColorOption[] = [one('ff0000'), one('808080'), '?hueshift=40', one('0000ff'), one('ffaaaa'), one('202020'), one('5a705a')];

describe('sortOptions', () => {
    it('leaves the list as it is by default', () => {
        expect(sortOptions(options, 'default')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('groups by hue, light to dark, greys after and directives last', () => {
        expect(sortOptions(options, 'hue')).toEqual([4, 0, 3, 1, 6, 5, 2]);
    });

    it('orders by saturation and by lightness', () => {
        expect(sortOptions(options, 'saturation').slice(0, 2).sort()).toEqual([0, 3]);
        expect(sortOptions(options, 'saturation').at(-1)).toBe(2);
        expect(sortOptions(options, 'lightness')).toEqual([4, 1, 6, 0, 5, 3, 2]);
    });

    it('reads the most colourful colour of a palette and keeps reds either side of 0° together', () => {
        const ramps: ColorOption[] = [{ a: '300010', b: 'ff0030', c: 'ffe0e0' }, { a: '003000', b: '00ff00' }, { a: 'ff1000' }];
        expect(sortOptions(ramps, 'hue')).toEqual([0, 2, 1]);
    });
});
