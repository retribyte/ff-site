// Style layers beyond the game's two (a species' own `ffLayers`, on any body part) and clothing
// fit (`ffClothingFit`). Made-up species only.

import { describe, expect, it } from 'vitest';
import { compose, fitPixels, renderLayer, resizePixels, type FrameSource } from './compose';
import { availableStyles, buildLayers, defaultRecipe, layerOrder, randomRecipe, reconcileStyles, upgradeRecipe } from './humanoid';
import { lockStyles } from './races';
import { deriveSpecies, speciesFor } from './species';
import { builtinSlot, ownSlot } from './testing/slots';
import type { ItemsFile, Manifest, Pixels, RawSpecies, Species } from './types';

const KIND = 'squoat';
const dir = `/humanoid/${KIND}/`;

const sprites = { head: `${dir}malehead.png`, body: `${dir}malebody.png`, emote: `${dir}emote.png`, backArm: `${dir}backarm.png`, frontArm: `${dir}frontarm.png` };

function species(styles = [builtinSlot(KIND, 'hair', 'hair', ['1'], ['hair'], 'emote')], fit?: Species['genders'][0]['fit']): Species {
    return {
        kind: KIND, mod: 'squoatmod', title: 'Squoat', subTitle: '', description: '', labels: [], playable: true, order: 0, flags: {},
        bodyColor: [{ aaaaaa: '111111' }], undyColor: [{ bbbbbb: '333333' }, { bbbbbb: '444444' }], hairColor: [{ cccccc: '555555' }],
        personalities: [['idle.2', 'idle.3', [1, 0], [0, -1]]],
        genders: [{ name: 'male', sprites, styles, shirt: [], pants: [], ...(fit ? { fit } : {}) }],
    };
}

const markings = ownSlot(KIND, 'markings', { stripes: ['head', 'body', 'frontArm', 'backArm'], spots: ['body'] }, { stack: true, color: ['undy'] });

describe('a species\' own style layers', () => {
    it('draws each part just above the body part it covers, with that part\'s frames and offset', () => {
        const sp = species([builtinSlot(KIND, 'hair', 'hair', ['1'], ['hair'], 'emote'), markings]);
        const recipe = { ...defaultRecipe(sp), styles: { hair: ['1'], markings: ['stripes'] } };
        const layers = buildLayers(sp, recipe);
        expect(layers.map((l) => l.part)).toEqual([
            'backArm', 'markings.backArm', 'head', 'markings.head', 'emote', 'hair', 'body', 'markings.body', 'frontArm', 'markings.frontArm',
        ]);
        expect(layers.find((l) => l.part === 'markings.body')).toMatchObject({ image: `${dir}markings/stripes/body.png`, frame: 'idle.2', framesOf: sprites.body, offset: [0, 0] });
        expect(layers.find((l) => l.part === 'markings.frontArm')).toMatchObject({ frame: 'idle.3', framesOf: sprites.frontArm, offset: [0, -1] });
        expect(layers.find((l) => l.part === 'markings.head')).toMatchObject({ frame: 'normal', framesOf: sprites.head, offset: [1, 0], head: true });
        // Coloured by the detail colour; hand edits are the body's
        expect(layers.find((l) => l.part === 'markings.body')).toMatchObject({ directives: '?replace;bbbbbb=333333', pick: 'body' });
    });

    it('stacks several styles in the order picked, and draws only parts a style has', () => {
        const sp = species([markings]);
        const layers = buildLayers(sp, { ...defaultRecipe(sp), styles: { markings: ['spots', 'stripes'] } });
        expect(layers.filter((l) => l.part === 'markings.body').map((l) => l.image)).toEqual([`${dir}markings/spots/body.png`, `${dir}markings/stripes/body.png`]);
        expect(layers.filter((l) => l.part === 'markings.head')).toHaveLength(1);
        // A layer that does not stack draws only its first pick
        const single = species([{ ...markings, stack: false }]);
        expect(buildLayers(single, { ...defaultRecipe(single), styles: { markings: ['spots', 'stripes'] } }).filter((l) => l.part === 'markings.body')).toHaveLength(1);
    });

    it('can be placed above another layer, and use its own palette over a species colour', () => {
        const scars = ownSlot(KIND, 'scars', { long: ['head'] }, { above: { head: 'hair', body: 'body', frontArm: 'frontArm', backArm: 'backArm' }, color: ['body', 'own'], colors: [{ dddddd: '666666' }, { dddddd: '777777' }] });
        const sp = species([builtinSlot(KIND, 'hair', 'hair', ['1'], ['hair'], 'emote'), scars]);
        const layers = buildLayers(sp, { ...defaultRecipe(sp), styles: { hair: ['1'], scars: ['long'] }, styleColors: { scars: { option: 1, tweak: { '777777': 'ff0000' } } } });
        expect(layers.map((l) => l.part)).toEqual(['backArm', 'head', 'emote', 'hair', 'scars.head', 'body', 'frontArm']);
        expect(layers.find((l) => l.part === 'scars.head')).toMatchObject({ directives: '?replace;aaaaaa=111111?replace;dddddd=777777?replace;777777=ff0000', pick: 'style:scars' });
    });

    it('keeps the game\'s layer order for the game\'s own styles', () => {
        const sp = species([
            builtinSlot(KIND, 'hair', 'hair', ['1'], ['hair'], 'emote'),
            builtinSlot(KIND, 'facialHair', 'beard', ['b'], ['hair'], 'chest'),
            builtinSlot(KIND, 'facialMask', 'mask', ['m'], ['facialMask'], 'chest'),
        ]);
        const order = layerOrder(sp.genders[0].styles).filter((n) => !n.includes(':') || n.endsWith(':head'));
        expect(order).toEqual(['backArm', 'backSleeve', 'back', 'head', 'emote', 'hair:head', 'body', 'legs', 'chest', 'facialHair:head', 'facialMask:head', 'headwear', 'frontArm', 'frontSleeve']);
    });

    it('is hidden under a costume, and only masked by a helmet when it asks to be', () => {
        const items: ItemsFile = {
            images: {}, where: {}, palettes: [[{}]],
            items: [
                { id: 'hat', slot: 'head', name: 'Hat', mod: 'vanilla', colors: 0, mask: '/i/mask.png', frames: { male: { body: '/i/hat.png' } } },
                { id: 'suit', slot: 'chest', name: 'Suit', mod: 'vanilla', colors: 0, hideBody: true, frames: { male: { body: '/i/suit.png' } } },
            ],
        };
        const sp = species([markings, ownSlot(KIND, 'horns', { big: ['head'] }, { masked: true })]);
        const hat = buildLayers(sp, { ...defaultRecipe(sp), styles: { markings: ['stripes'], horns: ['big'] }, wear: { head: { item: 'hat', option: 0 } } }, items);
        expect(hat.find((l) => l.part === 'markings.head')?.mask).toBeUndefined();
        expect(hat.find((l) => l.part === 'horns.head')?.mask).toBe('/i/mask.png');
        const suit = buildLayers(sp, { ...defaultRecipe(sp), styles: { markings: ['stripes'] }, wear: { chest: { item: 'suit', option: 0 } } }, items);
        expect(suit.map((l) => l.part)).toEqual(['chest']);
    });
});

describe('reading ffLayers and ffClothingFit from a species file', () => {
    const files = [
        'malebody.png', 'malehead.png',
        'markings/stripes/body.png', 'markings/stripes/frontarm.png', 'markings/stripes/head.png', 'markings/stripes/femalebody.png',
        'markings/spots/body.png', 'markings/empty/readme.txt',
        'fur/tufts/head.png',
    ].map((f) => dir + f);
    const raw = (config: Record<string, unknown>): RawSpecies => ({
        kind: KIND, mod: 'squoatmod', playable: true, order: null, personalities: [['idle.1', 'idle.1', [0, 0], [0, 0]]],
        config: { kind: KIND, genders: [{ name: 'male' }, { name: 'female' }], ...config } as RawSpecies['config'], patches: [],
    });
    const lookup = { has: (p: string) => files.includes(p), under: (prefix: string) => files.filter((p) => p.startsWith(prefix)) };

    it('lists a layer\'s styles from its folders when it names none, and finds each part\'s sheet', () => {
        const sp = deriveSpecies(raw({ ffLayers: [{ id: 'markings', label: 'Markings', color: ['undy'], stack: true }] }), [], lookup);
        const [, slot] = sp.genders[0].styles;
        expect(slot).toMatchObject({ id: 'markings', label: 'Markings', group: 'markings', options: ['', 'spots', 'stripes'], color: ['undy'], stack: true, builtin: false });
        expect(slot.files.stripes).toEqual({ head: `${dir}markings/stripes/head.png`, body: `${dir}markings/stripes/body.png`, frontArm: `${dir}markings/stripes/frontarm.png` });
        // A gender's own sheet wins over the shared one
        expect(sp.genders[1].styles[1].files.stripes.body).toBe(`${dir}markings/stripes/femalebody.png`);
    });

    it('keeps the listed order, drops styles with no sheet, and lets a gender change a layer', () => {
        const sp = deriveSpecies(raw({
            ffLayers: [{ id: 'markings', options: ['stripes', 'nope', 'spots'] }, { id: 'tufts', group: 'fur', color: 'hair' }, { id: 'hair', options: ['x'] }],
            genders: [{ name: 'male', ffLayers: [{ id: 'markings', options: ['', 'spots'] }] }, { name: 'female' }],
        }), [], lookup);
        expect(sp.genders[0].styles.map((s) => [s.id, s.options])).toEqual([['hair', ['']], ['markings', ['', 'spots']], ['tufts', ['', 'tufts']]]);
        expect(sp.genders[1].styles[1].options).toEqual(['stripes', 'spots']);
        expect(sp.genders[0].styles[2]).toMatchObject({ group: 'fur', color: ['hair'] });
    });

    it('reads the clothing fit, a gender\'s rules over the species\' part by part', () => {
        const sp = deriveSpecies(raw({
            ffClothingFit: { chest: { offset: [0, -2], columns: { at: 21, add: 2 } }, legs: { rows: { at: 30, add: -1 } }, bogus: { offset: [1, 1] }, back: { offset: 'no' } },
            genders: [{ name: 'male' }, { name: 'female', ffClothingFit: { chest: { offset: [0, -3] } } }],
        }), [], lookup);
        expect(sp.genders[0].fit).toEqual({ chest: { offset: [0, -2], columns: { at: 21, add: 2 } }, legs: { rows: { at: 30, add: -1 } } });
        expect(sp.genders[1].fit?.chest).toEqual({ offset: [0, -3] });
    });

    it('takes layers another mod patches in (the guide\'s patch), and drops them with that mod', () => {
        const patch = [
            [{ op: 'test', path: '/ffLayers', inverse: true }, { op: 'add', path: '/ffLayers', value: [] }],
            [{ op: 'add', path: '/ffLayers/-', value: { id: 'tufts', group: 'fur', color: 'own', colors: [{ ff0000: 'c02020' }] } }],
        ];
        const withList = { ...raw({ ffLayers: [{ id: 'markings' }] }), patches: [{ m: 'paintmod', p: patch }] } as RawSpecies;
        const without = { ...raw({}), patches: [{ m: 'paintmod', p: patch }] } as RawSpecies;
        expect(deriveSpecies(withList, [], lookup).genders[0].styles.map((x) => x.id)).toEqual(['hair', 'markings', 'tufts']);
        expect(deriveSpecies(without, [], lookup).genders[0].styles.map((x) => x.id)).toEqual(['hair', 'tufts']);
        expect(deriveSpecies(withList, ['paintmod'], lookup).genders[0].styles.map((x) => x.id)).toEqual(['hair', 'markings']);
    });

    it('reaches speciesFor through the manifest, folders included', () => {
        const m: Manifest = {
            build: 't', mods: [], packs: {}, where: {}, frames: {},
            species: { [KIND]: raw({ ffLayers: [{ id: 'markings' }] }) },
            images: Object.fromEntries(files.map((f) => [f, { m: ['squoatmod'] }])),
        };
        expect(speciesFor(m, KIND)?.genders[0].styles[1].options).toEqual(['', 'spots', 'stripes']);
    });
});

describe('style picks', () => {
    const sp = species([builtinSlot(KIND, 'hair', 'hair', ['1', '2'], ['hair'], 'emote'), markings]);

    it('start on each layer\'s first option and follow a change of gender or mods', () => {
        expect(defaultRecipe(sp).styles).toEqual({ hair: ['1'], markings: [] });
        const g = sp.genders[0];
        expect(reconcileStyles(g, { hair: ['9'], markings: ['spots', 'gone'], old: ['x'] })).toEqual({ hair: ['1'], markings: ['spots'] });
        expect(reconcileStyles(g, { hair: ['2'], markings: [] }, (img) => !img.includes('/2.png'))).toEqual({ hair: ['1'], markings: [] });
        expect(availableStyles(g.styles[1], (img) => !img.includes('spots'))).toEqual(['', 'stripes']);
    });

    it('randomise within each layer, and lock to one style per race', () => {
        let n = 0;
        const r = randomRecipe(sp, { exclude: [] }, () => ((n += 0.31) % 1));
        expect(sp.genders[0].styles[0].options).toContain(r.styles.hair[0]);
        expect(r.styles.markings.length).toBeLessThanOrEqual(1);
        const locked = lockStyles(sp, { markings: 'spots' });
        expect(locked.genders[0].styles[1]).toMatchObject({ options: ['spots'], stack: false });
        expect(defaultRecipe(locked).styles.markings).toEqual(['spots']);
    });

    it('read a version 1 recipe as the three layers it had', () => {
        const v1 = { v: 1, species: KIND, exclude: [], gender: 0, personality: 0, hair: '2', facialHair: '', facialMask: 'm1', body: { option: 0 }, undy: { option: 0 }, hairColor: { option: 0 }, wear: {}, emote: 'idle', nude: false };
        const up = upgradeRecipe(v1)!;
        expect(up.v).toBe(2);
        expect(up.styles).toEqual({ hair: ['2'], facialHair: [], facialMask: ['m1'] });
        expect('hair' in up).toBe(false);
        expect(upgradeRecipe({ ...up, styles: { hair: ['1', '', 3] } })?.styles).toEqual({ hair: ['1'] });
        expect(upgradeRecipe({ v: 3, species: KIND, exclude: [], wear: {} })).toBeNull();
        expect(upgradeRecipe('nope')).toBeNull();
    });
});

describe('clothing fit', () => {
    const solid = (w: number, h: number, fill: (x: number, y: number) => number[]): Pixels => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
        return { width: w, height: h, data };
    };
    const alpha = (px: Pixels) => Array.from({ length: px.height }, (_, y) => Array.from({ length: px.width }, (_, x) => (px.data[(y * px.width + x) * 4 + 3] ? '#' : '.')).join(''));

    it('repeats or drops rows and columns', () => {
        const px = solid(3, 3, (x, y) => [x * 10, y * 10, 0, 255]);
        const wide = resizePixels(px, { columns: { at: 1, add: 2 } });
        expect([wide.width, wide.height]).toEqual([5, 3]);
        expect([...wide.data.slice(4, 8)]).toEqual([10, 0, 0, 255]);
        expect([...wide.data.slice(12, 16)]).toEqual([10, 0, 0, 255]);
        expect(resizePixels(px, { rows: { at: 0, add: -2 } }).height).toBe(1);
        expect(resizePixels(px, { rows: { at: 2, add: -5 } }).height).toBe(2);
    });

    it('keeps what is below a changed row where it was', () => {
        const px = solid(1, 4, (_, y) => (y === 3 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
        // Shrunk: padded back to 4 rows at the top, so the bottom row stays the bottom row
        expect(alpha(fitPixels(px, { rows: { at: 1, add: -1 } }))).toEqual(['.', '.', '.', '#']);
        // Grown by 1: 5 rows plus 1 more at the bottom, so the centre (and the old bottom row) stays put
        expect(alpha(fitPixels(px, { rows: { at: 1, add: 1 } }))).toEqual(['.', '.', '.', '.', '#', '.']);
    });

    it('moves and resizes clothing, and the helmet mask with the helmet', () => {
        const items: ItemsFile = {
            images: {}, where: {}, palettes: [[{}]],
            items: [
                { id: 'hat', slot: 'head', name: 'Hat', mod: 'vanilla', colors: 0, mask: '/i/mask.png', frames: { male: { body: '/i/hat.png' } } },
                { id: 'shirt', slot: 'chest', name: 'Shirt', mod: 'vanilla', colors: 0, frames: { male: { body: '/i/shirt.png', frontSleeve: '/i/fs.png' } } },
            ],
        };
        const sp = species(undefined, { chest: { offset: [0, -2], columns: { at: 21, add: 2 } }, headwear: { offset: [0, -3] } });
        const layers = buildLayers(sp, { ...defaultRecipe(sp), wear: { head: { item: 'hat', option: 0 }, chest: { item: 'shirt', option: 0 } } }, items);
        expect(layers.find((l) => l.part === 'chest')).toMatchObject({ offset: [0, -2], resize: { columns: { at: 21, add: 2 } } });
        expect(layers.find((l) => l.part === 'frontSleeve')).toMatchObject({ offset: [0, -1] });
        expect(layers.find((l) => l.part === 'frontSleeve')?.resize).toBeUndefined();
        expect(layers.find((l) => l.part === 'headwear')).toMatchObject({ offset: [1, -3] });
        expect(layers.find((l) => l.part === 'hair')).toMatchObject({ offset: [1, 0], mask: '/i/mask.png', maskFit: { offset: [0, -3] } });

        // The mask, moved down with the helmet, now uncovers the hair's top rows
        const hair = solid(1, 4, () => [255, 255, 255, 255]);
        const mask = solid(1, 4, (_, y) => [0, 0, 0, y < 2 ? 255 : 0]);
        const source: FrameSource = { frame: (i) => (i === 'hair' ? hair : null), image: (i) => (i === 'mask' ? mask : null) };
        const base = { part: 'hair', image: 'hair', frame: 'normal', directives: '', offset: [0, 0] as [number, number], mask: 'mask' };
        expect(alpha(renderLayer(base, source)!)).toEqual(['#', '#', '.', '.']);
        expect(alpha(renderLayer({ ...base, maskFit: { offset: [0, -1] } }, source)!)).toEqual(['.', '#', '#', '.']);
    });

    it('borrows another image\'s frames for a style sheet', () => {
        const seen: unknown[] = [];
        const source: FrameSource = { frame: (...args) => (seen.push(args), solid(1, 1, () => [1, 2, 3, 255])), image: () => null };
        compose([{ part: 'markings.body', image: 'm.png', frame: 'idle.2', directives: '', offset: [0, 0], framesOf: 'body.png' }], source, 3);
        expect(seen).toEqual([['m.png', 'idle.2', 'body.png']]);
    });
});
