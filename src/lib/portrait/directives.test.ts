import { describe, expect, it } from 'vitest';
import { applyOperations, distinctColors, hexToRgba, optionDirective, parseDirectives, wrap } from './directives';

const px = (...colors: number[][]) => new Uint8ClampedArray(colors.flat());

describe('hexToRgba', () => {
    it('reads 3, 4, 6 and 8 digit colours', () => {
        expect(hexToRgba('fff')).toEqual([255, 255, 255, 255]);
        expect(hexToRgba('f008')).toEqual([255, 0, 0, 136]);
        expect(hexToRgba('ffca8a')).toEqual([255, 202, 138, 255]);
        expect(hexToRgba('ffca8a80')).toEqual([255, 202, 138, 128]);
        expect(hexToRgba('nothex')).toBeNull();
    });
});

describe('replace', () => {
    it('swaps exact colours only, both separator styles', () => {
        for (const d of ['?replace;ffca8a=d0d4e9;e0975c=90a0cc', '?replace=ffca8a=d0d4e9=e0975c=90a0cc']) {
            const data = px([255, 202, 138, 255], [224, 151, 92, 255], [255, 202, 138, 128], [1, 2, 3, 255]);
            applyOperations(data, parseDirectives(d));
            expect([...data]).toEqual([208, 212, 233, 255, 144, 160, 204, 255, 255, 202, 138, 128, 1, 2, 3, 255]);
        }
    });

    it('applies chained directives in order', () => {
        const data = px([255, 0, 0, 255]);
        applyOperations(data, parseDirectives('?replace;ff0000=00ff00?replace;00ff00=0000ff'));
        expect([...data]).toEqual([0, 0, 255, 255]);
    });

    it('builds the directive for a palette option', () => {
        expect(optionDirective({ ffca8a: 'd0d4e9', e0975c: '90a0cc' })).toBe('?replace;ffca8a=d0d4e9;e0975c=90a0cc');
        expect(optionDirective('?hueshift=40')).toBe('?hueshift=40');
        expect(optionDirective(undefined)).toBe('');
    });
});

describe('hue, saturation, brightness, multiply', () => {
    it('shifts hue around the wheel and leaves greys and clear pixels alone', () => {
        const data = px([255, 0, 0, 255], [128, 128, 128, 255], [255, 0, 0, 0]);
        applyOperations(data, parseDirectives('?hueshift=120'));
        expect([...data]).toEqual([0, 255, 0, 255, 128, 128, 128, 255, 255, 0, 0, 0]);
    });

    it('drains saturation and scales brightness', () => {
        const grey = px([200, 100, 100, 255]);
        applyOperations(grey, parseDirectives('?saturation=-100'));
        expect([...grey]).toEqual([200, 200, 200, 255]);
        const dim = px([200, 100, 50, 255]);
        applyOperations(dim, parseDirectives('?brightness=-50'));
        expect([...dim]).toEqual([100, 50, 25, 255]);
    });

    it('multiplies every channel, alpha included', () => {
        const data = px([200, 100, 50, 255]);
        applyOperations(data, parseDirectives('?multiply=80808080'));
        expect([...data]).toEqual([100, 50, 25, 128]);
    });

    it('skips operations it does not know', () => {
        const data = px([9, 9, 9, 255]);
        applyOperations(data, parseDirectives('?scalenearest=2?border=1;fff;000'));
        expect([...data]).toEqual([9, 9, 9, 255]);
    });
});

describe('helpers', () => {
    it('wraps indices like the game', () => {
        expect(wrap(['a', 'b', 'c'], 4)).toBe('b');
        expect(wrap(['a', 'b', 'c'], -1)).toBe('c');
        expect(wrap([], 2)).toBeUndefined();
    });

    it('lists the colours in use, most common first', () => {
        const data = px([1, 2, 3, 255], [1, 2, 3, 255], [9, 9, 9, 128], [0, 0, 0, 0]);
        expect(distinctColors({ width: 4, height: 1, data })).toEqual(['010203', '09090980']);
    });
});
