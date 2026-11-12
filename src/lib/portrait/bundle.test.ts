import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compose, FRAME_SIZE } from './compose';
import { buildLayers, defaultRecipe } from './humanoid';
import { speciesFor } from './species';
import { DiskBundle } from './testing/diskBundle';
import { encodePng } from './testing/png';
import type { Pixels } from './types';

// Runs against a real bundle (portrait-extract/extract.py) when one is on disk; CI has none.
// PORTRAIT_SHEET=<dir> also writes contact sheets there for a look by eye.
const hasBundle = DiskBundle.exists();

function sheet(cells: Pixels[], columns: number, scale: number): Pixels {
    const widest = Math.max(FRAME_SIZE, ...cells.map((c) => c.width));
    const cell = widest * scale;
    const rows = Math.ceil(cells.length / columns);
    const out: Pixels = { width: columns * cell, height: rows * cell, data: new Uint8ClampedArray(columns * cell * rows * cell * 4) };
    for (let i = 0; i < out.data.length; i += 4) out.data.set([34, 36, 48, 255], i);
    cells.forEach((px, n) => {
        const left = (n % columns) * cell, top = Math.floor(n / columns) * cell;
        const pad = Math.floor((widest - px.width) / 2);
        for (let y = 0; y < cell; y++)
            for (let x = 0; x < cell; x++) {
                const sx = Math.floor(x / scale) - pad, sy = Math.floor(y / scale) - pad;
                if (sx < 0 || sy < 0 || sx >= px.width || sy >= px.height) continue;
                const s = (sy * px.width + sx) * 4;
                if (px.data[s + 3] === 0) continue;
                out.data.set(px.data.subarray(s, s + 4), ((top + y) * out.width + left + x) * 4);
            }
    });
    return out;
}

describe.skipIf(!hasBundle)('real bundle', () => {
    const bundle = hasBundle ? new DiskBundle() : (null as unknown as DiskBundle);
    const opaque = (px: Pixels) => px.data.filter((_, i) => i % 4 === 3 && px.data[i] > 0).length;

    it('draws every species with a body, a head and its starting outfit', () => {
        const cells: Pixels[] = [];
        const names: string[] = [];
        for (const kind of Object.keys(bundle.manifest.species).sort((a, b) => a.localeCompare(b))) {
            const species = speciesFor(bundle.manifest, kind)!;
            const recipe = defaultRecipe(species);
            const layers = buildLayers(species, recipe, bundle.items);
            const px = compose(layers, bundle.source());
            expect(opaque(px), species.kind).toBeGreaterThan(60);
            expect(layers.map((l) => l.part), species.kind).toContain('body');
            cells.push(px);
            names.push(`${species.kind}${px.width === FRAME_SIZE ? '' : ` (${px.width}px)`}`);
        }
        const dir = process.env.PORTRAIT_SHEET;
        if (dir) {
            mkdirSync(dir, { recursive: true });
            writeFileSync(path.join(dir, 'species.png'), encodePng(sheet(cells, 10, 4)));
            writeFileSync(path.join(dir, 'species.txt'), names.map((n, i) => `${Math.floor(i / 10)},${i % 10} ${n}`).join('\n'));
        }
    }, 30_000); // decodes a few hundred sprite sheets

    it('draws a different sprite when a mod is excluded or another is preferred', () => {
        const species = speciesFor(bundle.manifest, 'novakid')!;
        const layers = buildLayers(species, defaultRecipe(species), bundle.items);
        const all = compose(layers, bundle.source());
        const vanilla = compose(layers, bundle.source({ exclude: bundle.manifest.mods.map((m) => m.id).filter((id) => id !== 'vanilla') }));
        const preferred = compose(layers, bundle.source({ exclude: [], prefer: ['vanilla'] }));
        expect(Buffer.from(preferred.data).equals(Buffer.from(vanilla.data))).toBe(true);
        expect(Buffer.from(all.data).equals(Buffer.from(vanilla.data))).toBe(false);
        expect(opaque(vanilla)).toBeGreaterThan(150);
    });
});
