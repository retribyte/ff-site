import { describe, expect, it } from 'vitest';
import { wikiFacts, wikiLabel } from './wiki';

describe('wikiLabel', () => {
    it('title-cases and turns underscores into spaces', () => {
        expect(wikiLabel('procreation_method')).toBe('Procreation Method');
        expect(wikiLabel('eyes')).toBe('Eyes');
        expect(wikiLabel('market_value__free')).toBe('Market Value Free');
    });
});

describe('wikiFacts', () => {
    const labels = (facts: ReturnType<typeof wikiFacts>) => facts.map(([label]) => label);

    it('is empty without wiki data', () => {
        expect(wikiFacts(null)).toEqual([]);
        expect(wikiFacts(undefined)).toEqual([]);
    });

    it('shows pinned fields first, in order, then every other field alphabetically', () => {
        const wiki = { zodiac: 'Leo', eyes: 'Blue', fullname: 'Squemfet Tawfeek', new_field: 'x' };
        expect(labels(wikiFacts(wiki, [['fullname', 'Full Name'], 'eyes']))).toEqual([
            'Full Name',
            'Eyes',
            'New Field',
            'Zodiac',
        ]);
    });

    it('hides bookkeeping columns and empty values', () => {
        const wiki = { page_name: 'Emmett Tawfeek', slug: 'emmett_tawfeek', hair: '', aliases: [], sex: 'Male' };
        expect(labels(wikiFacts(wiki))).toEqual(['Sex']);
    });

    it("skips a field whose label the page already shows from its own data", () => {
        const wiki = { species: ['Squoatling'], Type: 'Weapon', sex: 'Male' };
        expect(labels(wikiFacts(wiki, [], ['species', 'type']))).toEqual(['Sex']);
    });

    it('joins repeated fields and decodes entities', () => {
        const facts = wikiFacts({ planet: ['Vortox-56', 'Vortox-48'], season: 't&amp;l' });
        expect(facts).toEqual([
            ['Planet', 'Vortox-56, Vortox-48'],
            ['Season', 't&l'],
        ]);
    });
});
