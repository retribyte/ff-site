import { describe, expect, it } from 'vitest';
import { bookmarkFits, bookmarkPosition, bookmarkSpot } from './storyBookmarks';

describe('story bookmark positions', () => {
    it('orders a long chapter before the next one', () => {
        expect(bookmarkPosition(1, 3293)).toBeLessThan(bookmarkPosition(2, 1));
    });

    it('round-trips chapter and line, chapter 0 included', () => {
        expect(bookmarkSpot(bookmarkPosition(3, 87))).toEqual({ chapter: 3, line: 87 });
        expect(bookmarkSpot(bookmarkPosition(0, 1))).toEqual({ chapter: 0, line: 1 });
    });

    it('fits only an existing chapter and line', () => {
        const chapters = [
            { no: 0, lines: 1 },
            { no: 1, lines: 22 },
        ];
        expect(bookmarkFits(bookmarkPosition(1, 22), chapters)).toBe(true);
        expect(bookmarkFits(bookmarkPosition(1, 23), chapters)).toBe(false);
        expect(bookmarkFits(bookmarkPosition(2, 1), chapters)).toBe(false);
        expect(bookmarkFits(bookmarkPosition(0, 1), chapters)).toBe(true);
    });
});
