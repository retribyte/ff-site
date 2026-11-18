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

describe('designate with several stars', () => {
    it('letters a companion star and counts its planets apart from the primary\'s', () => {
        const a = body('star', null, 0, { ...named('Gemella'), type: 'sunlike' });
        const a1 = body('planet', a.id, 1);
        const pair = body('barycenter', a.id, 3, { type: 'planets' });
        const big = body('planet', pair.id, 150000, { radiusKm: 60000, type: 'gas' });
        const small = body('planet', pair.id, 300000, { radiusKm: 30000, type: 'ice' });
        const pairMoon = body('moon', pair.id, 900000);
        const b = body('star', a.id, 40, { type: 'red_dwarf' });
        const b1 = body('planet', b.id, 0.5);
        const b2 = body('planet', b.id, 2);
        const belt = body('belt', b.id, 1.2, { width: 0.4 });
        const dock = body('station', b.id, 0.3, { ...named('Dock'), builtYear: 3016, iteration: 2 });
        const out = designate([a, a1, pair, big, small, pairMoon, b, b1, b2, belt, dock], 'Gemella');
        const byId = Object.fromEntries(out.map((x) => [x.id, x]));
        expect(byId[a.id].gu).toBe('Gemella-A');
        expect(byId[b.id].gu).toBe('Gemella-B');
        expect(byId[b.id].name).toBe('Gemella-B');
        expect(byId[a1.id].gu).toBe('Gemella-A-1');
        expect(byId[pair.id].gu).toBe('Gemella-A-2-AB');
        expect([byId[big.id].gu, byId[small.id].gu]).toEqual(['Gemella-A-2-A', 'Gemella-A-2-B']);
        expect(byId[pairMoon.id].gu).toBe('Gemella-A-2-ABa');
        expect([byId[b1.id].gu, byId[b2.id].gu]).toEqual(['Gemella-B-1', 'Gemella-B-2']);
        expect(byId[belt.id].gu).toBe('Gemella-B-II');
        expect(byId[dock.id].gu).toBe('Gemella-B.3016-02');
        // Each pair's reach and colors, for drawing it
        expect(byId[pair.id].radiusKm).toBe(330000);
        expect(byId[pair.id].pairColors).toHaveLength(2);
    });

    it('names a pair of stars by both letters, the heavier A, and counts the planets round both', () => {
        const duo = body('barycenter', null, 0, { type: 'stars' });
        const red = body('star', duo.id, 0.12, { type: 'red_dwarf' });
        const orange = body('star', duo.id, 0.05, { type: 'orange' });
        const p1 = body('planet', duo.id, 2);
        const out = designate([duo, red, orange, p1], 'Duo');
        const byId = Object.fromEntries(out.map((x) => [x.id, x]));
        expect([byId[orange.id].gu, byId[red.id].gu]).toEqual(['Duo-A', 'Duo-B']);
        expect(byId[duo.id].gu).toBe('Duo-AB');
        expect(byId[duo.id].name).toBe('Duo-AB');
        expect(byId[p1.id].gu).toBe('Duo-AB-1');
    });

    it('designates a hierarchical triple', () => {
        const all = body('barycenter', null, 0, { type: 'stars' });
        const sun = body('star', all.id, 1, { type: 'sunlike' });
        const inner = body('barycenter', all.id, 1.5, { type: 'stars' });
        const c1 = body('star', inner.id, 0.01, { type: 'red_dwarf' });
        const c2 = body('star', inner.id, 0.01, { type: 'red_dwarf' });
        const out = gu(designate([all, sun, inner, c1, c2], 'Tri'));
        expect([out[sun.id], out[c1.id], out[c2.id]]).toEqual(['Tri-A', 'Tri-B', 'Tri-C']);
        expect(out[inner.id]).toBe('Tri-BC');
        expect(out[all.id]).toBe('Tri-ABC');
    });

    it('leaves a single star unlettered', () => {
        const sol = body('star', null, 0, named('Sol'));
        const earth = body('planet', sol.id, 1, { ordinal: 3 });
        const out = gu(designate([sol, earth]));
        expect([out[sol.id], out[earth.id]]).toEqual(['', 'Sol-3']);
    });
});
