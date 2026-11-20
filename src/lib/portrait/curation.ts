// Applies the creator's curation settings to a loaded bundle: clothing the creator does not
// offer, clothing only one species can wear, and single-pixel repairs to sprites. The settings
// come from ff-server (GET /portrait/settings) and are set once, before a bundle is loaded;
// until then nothing is hidden or repaired. (Which mods are served at all is the server's job.)

import type { ItemsFile, Pixels, WearItem } from './types';

export interface Curation {
    /** Case-insensitive regex tested against an item's id and name; '' for none. */
    hideItemPattern: string;
    /** Item ids hidden outright (clothing that draws nothing). */
    hideItems: string[];
    /** Mod id -> the species kinds (lowercase) that may wear that mod's items. */
    itemsOnlyFor: Record<string, string[]>;
    /** `<mod id><image path>` -> pixels to clear, as [x, y] in the sheet. */
    erase: Record<string, number[][]>;
}

export const NO_CURATION: Curation = { hideItemPattern: '', hideItems: [], itemsOnlyFor: {}, erase: {} };

let hiddenIds = new Set<string>();
let hiddenPattern: RegExp | null = null;
let onlyFor: Record<string, string[]> = {};
let erase: Record<string, number[][]> = {};

/** Sets the curation every function here applies. Call it before loading a bundle. */
export function setCuration(curation: Curation): void {
    hiddenIds = new Set(curation.hideItems);
    try {
        hiddenPattern = curation.hideItemPattern ? new RegExp(curation.hideItemPattern, 'i') : null;
    } catch {
        hiddenPattern = null; // a pattern that does not compile hides nothing
    }
    onlyFor = curation.itemsOnlyFor;
    erase = curation.erase;
}

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
