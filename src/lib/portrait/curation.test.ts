import { describe, expect, it } from 'vitest';
import { beforeAll } from 'vitest';
import { curateItems, isHiddenItem, NO_CURATION, repairSheet, setCuration, wearableBy } from './curation';
import type { ItemsFile, WearItem } from './types';

const item = (id: string, name: string, mod = 'vanilla'): WearItem => ({ id, slot: 'chest', name, mod, frames: {}, colors: 0 });

const SETTINGS = {
    hideItemPattern: 'invisi|inviso',
    hideItems: ['saturnnullchest'],
    itemsOnlyFor: { '1099066352': ['alpaca'] },
    erase: { '3667354412/humanoid/mobian race/hair/male1.png': [[72, 40]] },
};

describe('curation', () => {
    beforeAll(() => setCuration(SETTINGS));

    it('hides and repairs nothing until settings are given', () => {
        setCuration(NO_CURATION);
        expect(isHiddenItem('invisiblefabricchest')).toBe(false);
        setCuration({ ...NO_CURATION, hideItemPattern: '(' }); // does not compile
        expect(isHiddenItem('invisiblefabricchest')).toBe(false);
        setCuration(SETTINGS);
    });

    it('hides invisible clothing by name, by id and by list', () => {
        expect(isHiddenItem('toonoutfit4chest', 'Inviso-Shirt')).toBe(true);
        expect(isHiddenItem('invisiblefabricchest')).toBe(true);
        expect(isHiddenItem('saturnnullchest')).toBe(true); // listed: its id says nothing
        expect(isHiddenItem('humantier1chest', 'Iron Chestplate')).toBe(false);
    });

    it('drops hidden items and keeps a mod’s items to its own species', () => {
        const file: ItemsFile = { palettes: [], images: {}, where: {}, items: [item('a', 'Invisible Shirt'), item('b', 'Shirt'), item('c', 'Sleeves', '1099066352')] };
        const out = curateItems(file).items;
        expect(out.map((i) => i.id)).toEqual(['b', 'c']);
        expect(wearableBy(out[0], 'human')).toBe(true);
        expect(wearableBy(out[1], 'human')).toBe(false);
        expect(wearableBy(out[1], 'Alpaca')).toBe(true);
    });

    it('erases the pixels listed for a sheet and leaves other sheets alone', () => {
        const sheet = () => ({ width: 86, height: 215, data: new Uint8ClampedArray(86 * 215 * 4).fill(255) });
        const fixed = repairSheet('3667354412/humanoid/mobian race/hair/male1.png', sheet());
        const at = (40 * 86 + 72) * 4;
        expect([...fixed.data.subarray(at, at + 4)]).toEqual([0, 0, 0, 0]);
        expect(fixed.data[at + 4]).toBe(255);
        expect(repairSheet('vanilla/humanoid/human/malehead.png', sheet()).data[at + 3]).toBe(255);
    });
});
