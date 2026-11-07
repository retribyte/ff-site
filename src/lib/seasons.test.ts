import { describe, expect, it } from 'vitest';
import { episodeNumberLabel } from './seasons';

describe('episodeNumberLabel', () => {
    // FF1: four reconstructions stored as -3..0 ahead of the archived 3..10
    const ff1 = [
        { episode_no: 3 },
        { episode_no: -3, reconstructed: true },
        { episode_no: 0, reconstructed: true },
        { episode_no: -1, reconstructed: true },
        { episode_no: -2, reconstructed: true },
        { episode_no: 4 },
    ];

    it('numbers reconstructed episodes R1..Rn in episode order', () => {
        expect(episodeNumberLabel({ episode_no: -3, reconstructed: true }, ff1)).toBe('R1');
        expect(episodeNumberLabel({ episode_no: -2, reconstructed: true }, ff1)).toBe('R2');
        expect(episodeNumberLabel({ episode_no: 0, reconstructed: true }, ff1)).toBe('R4');
    });

    it('shows an archived episode as its own number, including 0', () => {
        expect(episodeNumberLabel({ episode_no: 3 }, ff1)).toBe('3');
        expect(episodeNumberLabel({ episode_no: 0 }, [{ episode_no: 0 }, { episode_no: 1 }])).toBe('0');
    });
});
