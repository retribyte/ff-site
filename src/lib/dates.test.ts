import { describe, expect, it } from 'vitest';
import { dateOnly, formatDateOnly } from './dates';

describe('dateOnly', () => {
    it('takes the calendar day from the API string', () => {
        expect(dateOnly('2026-11-03T00:00:00.000Z')).toBe('2026-11-03');
        expect(dateOnly('2018-09-20')).toBe('2018-09-20');
    });
    it('is null for nothing or junk', () => {
        expect(dateOnly(null)).toBeNull();
        expect(dateOnly(undefined)).toBeNull();
        expect(dateOnly('')).toBeNull();
        expect(dateOnly('soon')).toBeNull();
    });
});

describe('formatDateOnly', () => {
    it('shows the stored day, not the previous evening', () => {
        expect(formatDateOnly('2026-11-03T00:00:00.000Z')).toBe('Nov 3, 2026');
        expect(formatDateOnly('2026-10-07T00:00:00.000Z')).toBe('Oct 7, 2026');
        expect(formatDateOnly('2018-09-20T00:00:00.000Z')).toBe('Sep 20, 2018');
    });
    it('does not move with the process timezone', () => {
        const before = process.env.TZ;
        try {
            for (const tz of ['America/Chicago', 'Pacific/Honolulu', 'Asia/Tokyo', 'UTC']) {
                process.env.TZ = tz;
                expect(formatDateOnly('2026-11-03T00:00:00.000Z')).toBe('Nov 3, 2026');
            }
        } finally {
            if (before === undefined) delete process.env.TZ;
            else process.env.TZ = before;
        }
    });
    it('is null for nothing or junk', () => {
        expect(formatDateOnly(null)).toBeNull();
        expect(formatDateOnly('x')).toBeNull();
    });
});
