// Reads a sprite bundle straight from disk (Node only): the same FrameSource the browser
// builds from fetched images, for tests and local renders.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cropFrame, pickProvider, type FrameSource } from '../compose';
import type { ItemsFile, Manifest, Pixels, SpriteChoice } from '../types';
import { decodePng } from './png';

export const DEFAULT_BUNDLE_DIR = path.resolve(import.meta.dirname, '../../../../public/portrait-bundle');

export class DiskBundle {
    readonly manifest: Manifest;
    readonly items: ItemsFile;
    private sheets = new Map<string, Pixels | null>();

    constructor(readonly dir = DEFAULT_BUNDLE_DIR) {
        this.manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
        this.items = JSON.parse(readFileSync(path.join(dir, 'items.json'), 'utf8'));
    }

    static exists(dir = DEFAULT_BUNDLE_DIR): boolean {
        return existsSync(path.join(dir, 'manifest.json'));
    }

    entry(image: string) {
        return this.manifest.images[image] ?? this.items.images[image];
    }

    sheet(image: string, mod: string): Pixels | null {
        const key = `${mod}${image}`;
        if (!this.sheets.has(key)) {
            const file = path.join(this.dir, 'sprites', mod, image);
            let sheet: Pixels | null = null;
            try {
                sheet = decodePng(readFileSync(file));
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
