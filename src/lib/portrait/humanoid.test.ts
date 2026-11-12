import { describe, expect, it } from 'vitest';
import { compose, pickProvider, type FrameSource } from './compose';
import { buildLayers, createIdentity, defaultRecipe, randomRecipe } from './humanoid';
import { applyPatch } from './jsonPatch';
import { resolveRaces, UNCATEGORISED } from './races';
import { speciesFor } from './species';
import type { ItemsFile, Manifest, Pixels, RawSpecies, Species } from './types';

const species = (over: Partial<Species> = {}): Species => ({
    kind: 'testkin', mod: 'vanilla', title: 'Testkin', subTitle: '', description: '', labels: [], playable: true, order: 0,
    flags: {},
    bodyColor: [{ aaaaaa: '111111' }, { aaaaaa: '222222' }],
    undyColor: [{ bbbbbb: '333333' }],
    hairColor: [{ cccccc: '444444' }],
    personalities: [['idle.1', 'idle.1', [0, 0], [0, 0]], ['idle.2', 'idle.3', [-1, 0], [2, 0]]],
    genders: ['male', 'female'].map((name) => ({
        name,
        sprites: { head: `/humanoid/testkin/${name}head.png`, body: `/humanoid/testkin/${name}body.png`, emote: '/humanoid/testkin/emote.png', backArm: '/humanoid/testkin/backarm.png', frontArm: '/humanoid/testkin/frontarm.png' },
        hairGroup: 'hair', hair: ['1', '2'], facialHairGroup: 'beard', facialHair: ['', 'b1'], facialMaskGroup: 'mask', facialMask: ['m1'],
        shirt: ['shirt'], pants: ['pants'],
    })),
    ...over,
});
const items: ItemsFile = {
    version: 1, build: 't', images: {}, palettes: [[{ dddddd: '555555' }, { dddddd: '666666' }]],
    items: [
        { id: 'shirt', slot: 'chest', name: 'Shirt', mod: 'vanilla', colors: 0, frames: { male: { body: '/i/chestm.png', backSleeve: '/i/bsleeve.png', frontSleeve: '/i/fsleeve.png' }, female: { body: '/i/chestf.png' } } },
        { id: 'pants', slot: 'legs', name: 'Pants', mod: 'vanilla', colors: 0, frames: { male: { body: '/i/pantsm.png' } } },
        { id: 'hat', slot: 'head', name: 'Hat', mod: 'vanilla', colors: 0, mask: '/i/mask.png', frames: { male: { body: '/i/hat.png' } } },
        { id: 'cape', slot: 'back', name: 'Cape', mod: 'vanilla', colors: 0, frames: { male: { body: '/i/cape.png' } } },
    ],
};

describe('createIdentity', () => {
    it('colours hair like the body unless the species says otherwise', () => {
        const id = createIdentity(species(), defaultRecipe(species()));
        expect(id.bodyDirectives).toBe('?replace;aaaaaa=111111');
        expect(id.hairDirectives).toBe('?replace;aaaaaa=111111');
    });

    it('follows the species flags the way the game does', () => {
        const sp = species({ flags: { altOptionAsUndyColor: true, headOptionAsHairColor: true, altOptionAsHairColor: true, hairColorAsBodySubColor: true } });
        const id = createIdentity(sp, defaultRecipe(sp));
        expect(id.hairDirectives).toBe('?replace;cccccc=444444?replace;bbbbbb=333333');
        expect(id.bodyDirectives).toBe('?replace;aaaaaa=111111?replace;cccccc=444444?replace;bbbbbb=333333?replace;bbbbbb=333333');
    });

    it('puts hand edits last', () => {
        const sp = species();
        const id = createIdentity(sp, { ...defaultRecipe(sp), body: { option: 1, tweak: { '222222': 'ff0000' } } });
        expect(id.bodyDirectives).toBe('?replace;aaaaaa=222222?replace;222222=ff0000');
    });
});

describe('buildLayers', () => {
    it('stacks parts in the game\'s portrait order', () => {
        const sp = species({ flags: { headOptionAsFacialhair: true, altOptionAsFacialMask: true } });
        const recipe = { ...defaultRecipe(sp), facialHair: 'b1', wear: { head: { item: 'hat', option: 0 }, chest: { item: 'shirt', option: 1 }, legs: { item: 'pants', option: 0 }, back: { item: 'cape', option: 0 } } };
        const layers = buildLayers(sp, recipe, items);
        expect(layers.map((l) => l.part)).toEqual(['backArm', 'backSleeve', 'back', 'head', 'emote', 'hair', 'body', 'legs', 'chest', 'facialHair', 'facialMask', 'headwear', 'frontArm', 'frontSleeve']);
        expect(layers.find((l) => l.part === 'chest')?.directives).toBe('?replace;dddddd=666666');
        expect(layers.find((l) => l.part === 'hair')).toMatchObject({ image: '/humanoid/testkin/hair/1.png', frame: 'normal', mask: '/i/mask.png' });
    });

    it('uses the pose for frames and offsets, and female sheets for a second gender', () => {
        const sp = species();
        const layers = buildLayers(sp, { ...defaultRecipe(sp), gender: 1, personality: 1 }, items);
        expect(layers.find((l) => l.part === 'body')).toMatchObject({ image: '/humanoid/testkin/femalebody.png', frame: 'idle.2', offset: [0, 0] });
        expect(layers.find((l) => l.part === 'frontArm')).toMatchObject({ frame: 'idle.3', offset: [2, 0] });
        expect(layers.find((l) => l.part === 'head')).toMatchObject({ offset: [-1, 0] });
        expect(layers.find((l) => l.part === 'chest')?.image).toBe('/i/chestf.png');
    });

    it('leaves clothing off when nude', () => {
        const sp = species();
        const layers = buildLayers(sp, { ...defaultRecipe(sp), nude: true }, items);
        expect(layers.map((l) => l.part)).toEqual(['backArm', 'head', 'emote', 'hair', 'body', 'frontArm']);
    });

    it('randomises within the species\' options', () => {
        const sp = species();
        let n = 0;
        const recipe = randomRecipe(sp, { exclude: [] }, () => ((n += 0.37) % 1));
        expect(sp.genders[recipe.gender].hair).toContain(recipe.hair);
        expect(recipe.body.option).toBeLessThan(sp.bodyColor.length);
    });
});

describe('compose', () => {
    const solid = (w: number, h: number, rgba: number[]): Pixels => ({ width: w, height: h, data: new Uint8ClampedArray(Array.from({ length: w * h }, () => rgba).flat()) });
    const source = (frames: Record<string, Pixels>): FrameSource => ({ frame: (image) => frames[image] ?? null, image: (image) => frames[image] ?? null });

    it('draws later layers over earlier ones and moves offsets up and right', () => {
        const out = compose([
            { part: 'a', image: 'red', frame: 'x', directives: '', offset: [0, 0] },
            { part: 'b', image: 'blue', frame: 'x', directives: '', offset: [1, 1] },
        ], source({ red: solid(3, 3, [255, 0, 0, 255]), blue: solid(1, 1, [0, 0, 255, 255]) }), 3);
        const at = (x: number, y: number) => [...out.data.slice((y * 3 + x) * 4, (y * 3 + x) * 4 + 4)];
        expect(at(1, 1)).toEqual([255, 0, 0, 255]);
        expect(at(2, 0)).toEqual([0, 0, 255, 255]);
    });

    it('cuts a masked layer down to the mask', () => {
        const mask = solid(2, 1, [0, 0, 0, 255]);
        mask.data[7] = 0;
        const out = compose([{ part: 'hair', image: 'hair', frame: 'x', directives: '?replace;ffffff=00ff00', offset: [0, 0], mask: 'mask' }], source({ hair: solid(2, 1, [255, 255, 255, 255]), mask }), 2);
        expect([...out.data.slice(0, 8)]).toEqual([0, 255, 0, 255, 0, 0, 0, 0]);
    });

    it('picks the last mod in load order that is not excluded', () => {
        expect(pickProvider({ m: ['vanilla', 'cuter', 'fix'] })).toBe('fix');
        expect(pickProvider({ m: ['vanilla', 'cuter', 'fix'] }, { exclude: ['fix', 'cuter'] })).toBe('vanilla');
        expect(pickProvider({ m: ['cuter'] }, { exclude: ['cuter'] })).toBeNull();
    });

    it('lets a preferred mod win where it has the sprite, and only there', () => {
        const choice = { exclude: [], prefer: ['starface', 'vanilla'] };
        expect(pickProvider({ m: ['vanilla', 'starface', 'cuter'] }, choice)).toBe('starface');
        expect(pickProvider({ m: ['vanilla', 'cuter'] }, choice)).toBe('vanilla');
        expect(pickProvider({ m: ['cuter'] }, choice)).toBe('cuter');
        expect(pickProvider({ m: ['vanilla', 'starface'] }, { exclude: ['starface'], prefer: ['starface'] })).toBe('vanilla');
    });

    it('grows the canvas evenly instead of cutting off a sprite that reaches past it', () => {
        const out = compose([{ part: 'big', image: 'big', frame: 'x', directives: '', offset: [0, 0] }], source({ big: solid(7, 5, [9, 9, 9, 255]) }), 3);
        expect([out.width, out.height]).toEqual([7, 7]);
        expect(out.data.filter((_, i) => i % 4 === 3 && out.data[i] > 0).length).toBe(35);
        const fits = compose([{ part: 'dot', image: 'dot', frame: 'x', directives: '', offset: [1, 0] }], source({ dot: solid(1, 1, [9, 9, 9, 255]) }), 3);
        expect(fits.width).toBe(3);
    });

    it('hides the whole body under a costume marked hideBody', () => {
        const sp = species();
        const costume: ItemsFile = { ...items, items: [{ id: 'suit', slot: 'chest', name: 'Suit', mod: 'vanilla', colors: 0, hideBody: true, frames: { male: { body: '/i/suit.png' } } }] };
        const layers = buildLayers(sp, { ...defaultRecipe(sp), wear: { chest: { item: 'suit', option: 0 } } }, costume);
        expect(layers.map((l) => l.part)).toEqual(['chest']);
    });
});

describe('resolveRaces and speciesFor', () => {
    const raw = (kind: string, title: string, playable = true): RawSpecies => ({
        kind, mod: 'vanilla', playable, order: null, personalities: [['idle.1', 'idle.1', [0, 0], [0, 0]]],
        config: { kind, charCreationTooltip: { title }, altOptionAsFacialMask: true, genders: [{ name: 'male', hair: ['1'], facialMaskGroup: 'beaks', facialMask: ['b1'] }] },
        patches: [
            { m: 'hairmod', p: [{ op: 'add', path: '/genders/0/hair/-', value: '2' }] },
            { m: 'cuter', p: [{ op: 'replace', path: '/altOptionAsFacialMask', value: false }, { op: 'replace', path: '/genders/0/facialMask', value: [] }] },
        ],
    });
    const images = Object.fromEntries(['malebody.png', 'hair/1.png', 'hair/2.png', 'beaks/b1.png'].map((f) => [`/humanoid/novakid/${f}`, { m: ['vanilla'] }]));
    const m: Manifest = { version: 1, build: 't', mods: [], species: { novakid: raw('novakid', 'NOVAKID'), newcomer: raw('newcomer', 'Newcomer', false) }, images, frames: {} };

    it('applies only the patches of the mods a race keeps', () => {
        const all = speciesFor(m, 'novakid')!;
        expect(all.genders[0].hair).toEqual(['1', '2']);
        expect(all.flags.altOptionAsFacialMask).toBeUndefined();
        expect(all.genders[0].facialMask).toEqual([]);
        const without = speciesFor(m, 'novakid', ['cuter', 'unrelated'])!;
        expect(without.genders[0].hair).toEqual(['1', '2']);
        expect(without.flags.altOptionAsFacialMask).toBe(true);
        expect(without.genders[0].facialMask).toEqual(['b1']);
        expect(without.genders[0].sprites.body).toBe('/humanoid/novakid/malebody.png');
        expect(speciesFor(m, 'novakid', ['cuter'])).toBe(without);
    });

    it('lets one species be two races and keeps unlisted species', () => {
        const races = resolveRaces(m, [
            { id: 'novakid', name: 'Novakid', descriptor: 'Star', category: 'fantasy', exclude: ['cuter'] },
            { id: 'blazekid', species: 'novakid', name: 'Blazekid', descriptor: 'Star', category: 'fantasy' },
            { id: 'gone', descriptor: 'Ghost', category: 'fantasy' },
        ]);
        expect(races.map((r) => [r.id, r.name, r.modName, r.category, r.exclude, r.npc, r.species.genders[0].facialMask.length])).toEqual([
            ['novakid', 'Novakid', null, 'fantasy', ['cuter'], false, 1],
            ['blazekid', 'Blazekid', 'Novakid', 'fantasy', [], false, 0],
            ['newcomer', 'Newcomer', null, UNCATEGORISED, [], true, 0],
        ]);
    });
});

describe('applyPatch', () => {
    it('skips a batch whose test fails and leaves a failed flat patch unapplied', () => {
        expect(applyPatch({ a: 1 }, [
            [{ op: 'test', path: '/missing' }, { op: 'add', path: '/b', value: 1 }],
            [{ op: 'test', path: '/missing', inverse: true }, { op: 'add', path: '/c', value: 1 }],
        ])).toEqual({ a: 1, c: 1 });
        expect(applyPatch({ a: [1] }, [{ op: 'add', path: '/a/-', value: 2 }, { op: 'remove', path: '/nope' }])).toEqual({ a: [1] });
        expect(applyPatch({ a: [1] }, [{ op: 'add', path: '/a/0', value: 0 }, { op: 'move', from: '/a/1', path: '/b' }])).toEqual({ a: [0], b: 1 });
    });
});
