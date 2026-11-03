import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify } from './slug';

// Same cases as ff-server's test/slug.test.ts — keep the two tables in step.
const CASES: [string, string][] = [
    // Accented letters are transliterated, not dropped
    ['Volentinà Constantini', 'volentina_constantini'],
    ['Touché', 'touche'],
    ['Straße', 'strasse'],
    ['Søren Ærø', 'soren_aero'],
    ['Łukasz', 'lukasz'],
    ['Œuvre', 'oeuvre'],
    ['Þórr Đorđe', 'thorr_dorde'],
    ['ﬁnal ﬂight', 'final_flight'],
    ['İstanbul', 'istanbul'],
    // Unchanged ASCII behavior
    ["Don't", 'dont'],
    ['Mickey Mouse’s Ghost', 'mickey_mouses_ghost'],
    ['-- a  b --', 'a_b'],
    ['Shady Business', 'shady_business'],
    ["Dr. Ka'lel", 'dr_kalel'],
    ['Mr. T-1000', 'mr_t_1000'],
    ['a__b', 'a_b'],
    ['Truth & Lies', 'truth_lies'],
    // No Latin form: still dropped (callers fall back when empty)
    ['日本', ''],
    ['Zion 🚀 Daybreaker', 'zion_daybreaker'],
];

describe('slugify', () => {
    it.each(CASES)('%j → %j', (input, expected) => {
        const slug = slugify(input);
        expect(slug).toBe(expected);
        if (slug) expect(isValidSlug(slug)).toBe(true);
    });
});
