import { describe, expect, it } from 'vitest';
import { MIN_CONTRAST, minContrast, suggestColorFor } from './colorContrast';

// Real character colors: Emmett's green, Seth's red, Sanya's, a dark navy
const SAMPLES = ['#62DE2C', '#F01515', '#E8B23B', '#ED583B', '#F89630', '#1E37B8', '#ffffff', '#000000'];

describe('suggestColorFor', () => {
    it('always reads on every background of the target theme', () => {
        for (const hex of SAMPLES) {
            for (const mode of ['light', 'dark'] as const) {
                expect(minContrast(suggestColorFor(hex, mode), mode)).toBeGreaterThanOrEqual(MIN_CONTRAST);
            }
        }
    });

    it('leaves a color alone when it already reads there', () => {
        expect(suggestColorFor('#1e37b8', 'light')).toBe('#1e37b8');
        expect(suggestColorFor('#62de2c', 'dark')).toBe('#62de2c');
    });

    it('darkens for light mode and lightens for dark mode, keeping the hue family', () => {
        const light = suggestColorFor('#62DE2C', 'light'); // Emmett green
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(light.slice(i, i + 2), 16));
        expect(g).toBeGreaterThan(r);
        expect(g).toBeGreaterThan(b);
        expect(r + g + b).toBeLessThan(0x62 + 0xde + 0x2c);

        const dark = suggestColorFor('#1E37B8', 'dark'); // navy
        expect(parseInt(dark.slice(5, 7), 16)).toBeGreaterThan(parseInt(dark.slice(1, 3), 16));
    });

    it('passes a non-color through', () => {
        expect(suggestColorFor('var(--text)', 'light')).toBe('var(--text)');
    });
});
