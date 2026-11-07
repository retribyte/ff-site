import { describe, expect, it } from 'vitest';
import { compareAppearances, firstAppearance } from './characterSort';

const at = (season: string | null, episodeNo: number | null = null, messageNo: number | null = null) => ({
    season,
    episodeNo,
    messageNo,
});

describe('compareAppearances', () => {
    it('orders campaigns FF1 < FF2 < FF10, then side campaigns, then no campaign', () => {
        const sorted = [at(null), at('VM'), at('FF10', 1, 1), at('T&L'), at('FF2', 5, 1), at('FF1', 9, 9)].sort(
            compareAppearances
        );
        expect(sorted.map((a) => a.season)).toEqual(['FF1', 'FF2', 'FF10', 'T&L', 'VM', null]);
    });

    it('orders by episode then message within a campaign, a story-only appearance last', () => {
        const sorted = [at('FF2'), at('FF2', 3, 1), at('FF2', 1, 40), at('FF2', 1, 7)].sort(compareAppearances);
        expect(sorted).toEqual([at('FF2', 1, 7), at('FF2', 1, 40), at('FF2', 3, 1), at('FF2')]);
    });
});

describe('firstAppearance', () => {
    it('picks the earliest appearance, or null with none on record', () => {
        expect(firstAppearance([at('FF4', 0, 2), at(null), at('FF2', 11, 362)])).toEqual(at('FF2', 11, 362));
        expect(firstAppearance([])).toBeNull();
        expect(firstAppearance(undefined)).toBeNull();
    });
});
