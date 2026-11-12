// Reads a sprite bundle straight from disk (Node only): the same FrameSource the browser
// builds from fetched images, for tests and local renders. It reads the mod folders that are
// actually there, so deleting one shows what the site would do without that mod.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cropFrame, pickProvider, type FrameSource } from '../compose';
import { curateItems, repairSheet } from '../curation';
import { locate, mergeItems, mergeMods } from '../merge';
import type { ItemsFile, Manifest, ModFile, ModItemsFile, Pixels, SpriteChoice } from '../types';
import { decodePng } from './png';

export const DEFAULT_BUNDLE_DIR = path.resolve(import.meta.dirname, '../../../../public/portrait-bundle');
export const PACK_NAME = 'sprites.pack';

export class DiskBundle {
    readonly manifest: Manifest;
    readonly items: ItemsFile;
    private sheets = new Map<string, Pixels | null>();
    private packs = new Map<string, Buffer>();

    constructor(readonly dir = DEFAULT_BUNDLE_DIR) {
        const folders = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, 'mod.json'))).map((e) => e.name);
        const read = <T>(folder: string, file: string): T => JSON.parse(readFileSync(path.join(dir, folder, file), 'utf8'));
        this.manifest = mergeMods(folders.map((f) => read<ModFile>(f, 'mod.json')));
        this.items = curateItems(mergeItems(folders.map((f) => read<ModItemsFile>(f, 'items.json')), this.manifest));
    }

    static exists(dir = DEFAULT_BUNDLE_DIR): boolean {
        return existsSync(path.join(dir, 'vanilla', 'mod.json'));
    }

    entry(image: string) {
        return this.manifest.images[image] ?? this.items.images[image];
    }

    sheet(image: string, mod: string): Pixels | null {
        const key = `${mod}${image}`;
        if (!this.sheets.has(key)) {
            let sheet: Pixels | null = null;
            const ref = locate(mod, image, this.manifest, this.items);
            try {
                if (ref) {
                    if (!this.packs.has(mod)) this.packs.set(mod, readFileSync(path.join(this.dir, mod, PACK_NAME)));
                    sheet = repairSheet(key, decodePng(this.packs.get(mod)!.subarray(ref[0], ref[0] + ref[1])));
                }
            } catch {
                sheet = null;
            }
            this.sheets.set(key, sheet);
        }
        return this.sheets.get(key) ?? null;
    }

    /** Sprites as a recipe sees them. */
    source(choice?: SpriteChoice): FrameSource {
        const image = (name: string) => {
            const mod = pickProvider(this.entry(name), choice);
            return mod ? this.sheet(name, mod) : null;
        };
        return {
            image,
            frame: (name, frame) => {
                const sheet = image(name);
                const frames = this.entry(name)?.f;
                if (!sheet) return null;
                if (!frames) return sheet;
                const rect = this.manifest.frames[frames]?.[frame];
                return rect ? cropFrame(sheet, rect) : null;
            },
        };
    }
}
