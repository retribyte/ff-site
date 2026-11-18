import { describe, expect, it } from 'vitest';
import { designate, letters, roman, type Body, type BodyKind } from './data';

let nextId = 1;
function body(kind: BodyKind, parentId: number | null, orbit: number, extra: Partial<Body> = {}): Body {
    return { id: nextId++, kind, parentId, name: '', unnamed: true, ordinal: null, num: 0, gu: '', type: 'rocky', radiusKm: 1000, orbit, travelogue: [], ...extra };
}
const named = (name: string) => ({ name, unnamed: false });
const gu = (bodies: Body[]) => Object.fromEntries(bodies.map((b) => [b.id, b.gu]));

describe('roman and letters', () => {
    it('writes numerals past XX instead of falling back to digits', () => {
        expect([1, 4, 9, 14, 20, 21, 40, 49, 90, 99, 100].map(roman)).toEqual(['I', 'IV', 'IX', 'XIV', 'XX', 'XXI', 'XL', 'XLIX', 'XC', 'XCIX', 'C']);
    });
    it('goes on from z to aa instead of starting over', () => {
        expect([1, 2, 26, 27, 28, 52, 53, 702, 703].map(letters)).toEqual(['a', 'b', 'z', 'aa', 'ab', 'az', 'ba', 'zz', 'aaa']);
    });
});

describe('designate', () => {
    it("numbers a belt by the zone it sits in, not by how many belts came before", () => {
        const star = body('star', null, 0, named('Sol'));
        const planets = [0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30].map((au) => body('planet', star.id, au));
        const asteroids = body('belt', star.id, 2.7);
        const kuiper = body('belt', star.id, 42);
        const out = gu(designate([star, ...planets, asteroids, kuiper]));
        expect(out[planets[4].id]).toBe('Sol-5');
        expect(out[asteroids.id]).toBe('Sol-V');
        expect(out[kuiper.id]).toBe('Sol-IX');
    });

    it('gives the belts sharing a zone a sub-index, outward', () => {
        const star = body('star', null, 0, named('Sol'));
        const neptune = body('planet', star.id, 30, { ordinal: 8 });
        const [kuiper, scattered, oort] = [42, 100, 5000].map((au) => body('belt', star.id, au));
        const out = gu(designate([star, neptune, oort, scattered, kuiper]));
        expect([out[kuiper.id], out[scattered.id], out[oort.id]]).toEqual(['Sol-IX.1', 'Sol-IX.2', 'Sol-IX.3']);
    });

    it('counts a ring against its planet\'s moons, and a station takes no letter', () => {
        const star = body('star', null, 0, named('Sol'));
        const saturn = body('planet', star.id, 9.5, { ordinal: 6 });
        const inner = body('belt', saturn.id, 100000);
        const dock = body('station', saturn.id, 150000, { ...named('Dock'), builtYear: 3016, iteration: 2 });
        const mimas = body('moon', saturn.id, 185000);
        const eRing = body('belt', saturn.id, 300000);
        const enceladus = body('moon', saturn.id, 238000);
        const out = gu(designate([star, saturn, inner, dock, mimas, eRing, enceladus]));
        expect(out[inner.id]).toBe('Sol-6-I');
        expect(out[mimas.id]).toBe('Sol-6a');
        expect(out[enceladus.id]).toBe('Sol-6b');
        expect(out[eRing.id]).toBe('Sol-6-III');
        expect(out[dock.id]).toBe('Sol-6.3016-02');
    });

    it('designates a station round the star or a moon, and leaves one with no build year undesignated', () => {
        const star = body('star', null, 0, named('Sol'));
        const earth = body('planet', star.id, 1, { ordinal: 3 });
        const luna = body('moon', earth.id, 384400);
        const gate = body('station', star.id, 0.5, { ...named('Gate'), builtYear: 2979, iteration: 3 });
        const lunar = body('station', luna.id, 5000, { ...named('Lunar'), builtYear: -120000 });
        const old = body('station', earth.id, 42000, named('Old'));
        const out = gu(designate([star, earth, luna, gate, lunar, old]));
        expect(out[gate.id]).toBe('Sol.2979-03');
        expect(out[lunar.id]).toBe('Sol-3a.-120000-01');
        expect(out[old.id]).toBe('');
        expect(out[luna.id]).toBe('Sol-3a');
    });

    it('letters a 27th moon aa', () => {
        const star = body('star', null, 0, named('Sol'));
        const jupiter = body('planet', star.id, 5.2);
        const moons = Array.from({ length: 28 }, (_, i) => body('moon', jupiter.id, 100000 + i * 1000));
        const out = gu(designate([star, jupiter, ...moons]));
        expect([out[moons[25].id], out[moons[26].id], out[moons[27].id]]).toEqual(['Sol-1z', 'Sol-1aa', 'Sol-1ab']);
    });
});
