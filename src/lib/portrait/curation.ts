// Applies src/data/portrait/curation.json to a loaded bundle: clothing the creator does not
// offer, clothing only one species can wear, and single-pixel repairs to sprites. (The same
// file's skipMods are handled earlier, by portrait-extract/extract.py.)

import curation from '../../data/portrait/curation.json';
import type { ItemsFile, Pixels, WearItem } from './types';

const hiddenIds = new Set(curation.hideItems);
const hiddenPattern = curation.hideItemPattern ? new RegExp(curation.hideItemPattern, 'i') : null;
const onlyFor: Record<string, string[]> = curation.itemsOnlyFor;
const erase: Record<string, number[][]> = curation.erase;

/** Whether an item is left out of the creator. Pass the name when it is known. */
export function isHiddenItem(id: string, name = ''): boolean {
    return hiddenIds.has(id) || (hiddenPattern !== null && (hiddenPattern.test(id) || hiddenPattern.test(name)));
}

/** The clothing index without hidden items, and with each item's `only` filled in. */
export function curateItems(file: ItemsFile): ItemsFile {
    const items = file.items
        .filter((item) => !isHiddenItem(item.id, item.name))
        .map((item) => (onlyFor[item.mod] ? { ...item, only: onlyFor[item.mod] } : item));
    return { ...file, items };
}

/** Whether a species (by kind) is offered this item. */
export function wearableBy(item: WearItem, kind: string): boolean {
    return !item.only || item.only.includes(kind.toLowerCase());
}

/** Clears the stray pixels listed for a sheet; `key` is `<mod id><image path>`. Changes `sheet`. */
export function repairSheet(key: string, sheet: Pixels): Pixels {
    for (const [x, y] of erase[key] ?? [])
        if (x >= 0 && y >= 0 && x < sheet.width && y < sheet.height) sheet.data.fill(0, (y * sheet.width + x) * 4, (y * sheet.width + x) * 4 + 4);
    return sheet;
}
