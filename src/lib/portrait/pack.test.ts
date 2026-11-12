import { describe, expect, it } from 'vitest';
import { planRuns, slice } from './pack';

describe('planRuns', () => {
    it('joins ranges that are close together and keeps distant ones apart', () => {
        const want = (offset: number, length: number) => ({ offset, length, for: offset });
        const runs = planRuns([want(5000, 100), want(0, 100), want(150, 50), want(90_000, 10)], 1000);
        expect(runs.map((r) => [r.start, r.end, r.items.map((i) => i.for)])).toEqual([
            [0, 200, [0, 150]],
            [5000, 5100, [5000]],
            [90_000, 90_010, [90_000]],
        ]);
    });

    it('asks once for an image wanted twice', () => {
        const runs = planRuns([{ offset: 10, length: 5, for: 'a' }, { offset: 10, length: 5, for: 'b' }]);
        expect(runs).toHaveLength(1);
        expect([runs[0].start, runs[0].end]).toEqual([10, 15]);
    });
});

describe('slice', () => {
    const body = Uint8Array.from([10, 11, 12, 13, 14, 15]);

    it('reads an item from a partial response, which starts at the run', () => {
        expect([...slice(body, 100, { offset: 102, length: 3 })!]).toEqual([12, 13, 14]);
    });

    it('reads an item from a whole-file response, which starts at zero', () => {
        expect([...slice(body, 0, { offset: 4, length: 2 })!]).toEqual([14, 15]);
    });

    it('refuses an item the response does not cover', () => {
        expect(slice(body, 100, { offset: 104, length: 5 })).toBeNull();
        expect(slice(body, 100, { offset: 50, length: 2 })).toBeNull();
    });
});
