import { describe, expect, it } from 'vitest';
import { loadOrder, locate, mergeItems, mergeMods } from './merge';
import type { ImageRef, ModFile, ModItem, ModItemsFile } from './types';

// Made-up mods: a base game, a mod that redraws and patches it ("cute"), and a clothing mod.
const ref = (offset: number, hash: string, frames = -1): ImageRef => [offset, 10, hash, frames];
// The second argument is the mod's priority: the site orders mods by what they say of themselves
const mod = (id: string, priority: number, over: Partial<ModFile> = {}): ModFile => ({
    version: 2, id, name: id, order: 99, priority, build: `${id}-build`, frameFiles: [], images: {}, species: {}, speciesPatches: {}, frames: {}, ...over,
});
const species = (kind: string) => ({ kind, playable: true, order: 0, personalities: [], config: { kind } });
const item = (id: string, body: string, over: Partial<ModItem> = {}): ModItem => ({ id, slot: 'chest', name: id, colors: 0, frames: { male: { body } }, ...over });
const itemsOf = (id: string, items: ModItem[], images: Record<string, ImageRef> = {}): ModItemsFile => ({ version: 2, id, build: '', items, palettes: [[{ aa: 'bb' }], [{ cc: 'dd' }]], images });

const base = mod('base', 0, {
    frameFiles: ['/humanoid/head.frames'],
    images: { '/humanoid/elf/head.png': ref(0, 'h1', 0), '/humanoid/elf/body.png': ref(10, 'b1') },
    species: { elf: species('elf') },
    frames: { '/humanoid/head.frames': { normal: [0, 0, 43, 43] } },
});
const cute = mod('cute', 2, {
    images: { '/humanoid/elf/head.png': ref(0, 'h2'), '/humanoid/elf/body.png': ref(10, 'b1') },
    speciesPatches: { elf: [{ op: 'add', path: '/cute', value: true }], ghost: [] },
});
const hats = mod('hats', 1);

describe('loadOrder', () => {
    const ids = (files: ModFile[]) => loadOrder(files).map((f) => f.id);

    it('puts the base game first, then lower priority first, whatever position a machine gave', () => {
        expect(ids([mod('200', 5), mod('100', 0, { order: 7 }), mod('vanilla', 9999, { order: 3 }), mod('300', -5, { order: 1 })])).toEqual(['vanilla', '300', '100', '200']);
    });

    it('orders equal priority as the game finds mods: its mods folder, then the workshop by id', () => {
        expect(ids([mod('729', 0), mod('1099', 0), mod('my-mod', 0), mod('vanilla', 0)])).toEqual(['vanilla', 'my-mod', '1099', '729']);
    });

    it('loads a mod after the mods it names, by their own names, and survives a loop', () => {
        const race = mod('900', 0, { modName: 'TheRace' });
        const addon = mod('100', 0, { modName: 'RaceAddon', after: ['TheRace', 'NotInstalled'] });
        expect(ids([addon, race])).toEqual(['900', '100']);
        const a = mod('1', 0, { modName: 'A', after: ['B'] });
        const b = mod('2', 0, { modName: 'B', after: ['A'] });
        expect(ids([a, b]).sort()).toEqual(['1', '2']);
    });
});

describe('mergeMods', () => {
    it('lists each image’s mods in load order, whatever order the files arrive in', () => {
        const m = mergeMods([cute, hats, base]);
        expect(m.mods.map((x) => x.id)).toEqual(['base', 'hats', 'cute']);
        expect(m.images['/humanoid/elf/head.png']).toEqual({ m: ['base', 'cute'], f: '/humanoid/head.frames' });
        expect(locate('cute', '/humanoid/elf/head.png', m)).toEqual(ref(0, 'h2'));
    });

    it('does not count a byte-identical copy as another version', () => {
        expect(mergeMods([base, cute]).images['/humanoid/elf/body.png'].m).toEqual(['base']);
    });

    it('gives a species its patches, and drops patches to a species nobody defines', () => {
        const m = mergeMods([base, cute]);
        expect(m.species.elf.mod).toBe('base');
        expect(m.species.elf.patches).toEqual([{ m: 'cute', p: [{ op: 'add', path: '/cute', value: true }] }]);
        expect(m.species.ghost).toBeUndefined();
    });

    it('forgets a mod completely when its file is left out', () => {
        const m = mergeMods([base, hats]);
        expect(m.images['/humanoid/elf/head.png'].m).toEqual(['base']);
        expect(m.species.elf.patches).toEqual([]);
        expect(m.where.cute).toBeUndefined();
    });
});

describe('mergeItems', () => {
    const files = [
        itemsOf('cute', [item('shirt', '/i/shirt-cute.png', { patch: true, colors: 1 })], { '/i/shirt-cute.png': ref(20, 's2') }),
        itemsOf('base', [item('shirt', '/i/shirt.png')], { '/i/shirt.png': ref(20, 's1') }),
        itemsOf('hats', [item('cap', '/i/cap.png', { slot: 'head', colors: 1 })], { '/i/cap.png': ref(0, 'c1') }),
    ];

    it('uses a patching mod’s version of an item but leaves it with the mod that defines it', () => {
        const merged = mergeItems(files, mergeMods([base, hats, cute]));
        const shirt = merged.items.find((i) => i.id === 'shirt')!;
        expect(shirt.mod).toBe('base');
        expect(shirt.frames.male?.body).toBe('/i/shirt-cute.png');
        expect(merged.palettes[shirt.colors]).toEqual([{ cc: 'dd' }]);
        expect('patch' in shirt).toBe(false);
    });

    it('goes back to the original item when the patching mod is gone', () => {
        const merged = mergeItems(files, mergeMods([base, hats]));
        expect(merged.items.map((i) => [i.id, i.mod])).toEqual([['shirt', 'base'], ['cap', 'hats']]);
        expect(merged.items[0].frames.male?.body).toBe('/i/shirt.png');
        expect(merged.images['/i/shirt-cute.png']).toBeUndefined();
    });

    it('stores a colour list shared by several mods once', () => {
        const merged = mergeItems(files, mergeMods([base, hats, cute]));
        expect(merged.palettes).toHaveLength(2);
        expect(merged.items.find((i) => i.id === 'cap')!.colors).toBe(merged.items.find((i) => i.id === 'shirt')!.colors);
    });
});
