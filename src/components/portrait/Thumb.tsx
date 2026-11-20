'use client';

import { useEffect, useRef, useState } from 'react';
import { paint, type BrowserBundle } from '@/lib/portrait/browserBundle';
import { compose } from '@/lib/portrait/compose';
import { buildLayers } from '@/lib/portrait/humanoid';
import { speciesFor } from '@/lib/portrait/species';
import type { Pixels, Recipe } from '@/lib/portrait/types';

const HEAD_PARTS = new Set(['head', 'emote', 'hair', 'facialHair', 'facialMask', 'headwear']);

/** The smallest square around the opaque pixels, with a pixel of margin. */
function cropToContent(px: Pixels): Pixels {
    let x0 = px.width, y0 = px.height, x1 = -1, y1 = -1;
    for (let y = 0; y < px.height; y++)
        for (let x = 0; x < px.width; x++)
            if (px.data[(y * px.width + x) * 4 + 3]) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
            }
    if (x1 < 0) return px;
    const size = Math.max(x1 - x0, y1 - y0) + 3;
    const left = Math.round((x0 + x1 + 1 - size) / 2), top = Math.round((y0 + y1 + 1 - size) / 2);
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const sx = left + x, sy = top + y;
            if (sx < 0 || sy < 0 || sx >= px.width || sy >= px.height) continue;
            const s = (sy * px.width + sx) * 4;
            data.set(px.data.subarray(s, s + 4), (y * size + x) * 4);
        }
    return { width: size, height: size, data };
}

/** A small live render of a recipe: the whole figure, or just the head. Drawn once it scrolls into view. */
export default function Thumb({ bundle, recipe, view = 'full', size = 56 }: { bundle: BrowserBundle; recipe: Recipe; view?: 'full' | 'head'; size?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(false);
    const key = JSON.stringify(recipe);

    useEffect(() => {
        const el = ref.current;
        if (!el || visible) return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) setVisible(true);
        }, { rootMargin: '200px' });
        io.observe(el);
        return () => io.disconnect();
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        let stale = false;
        (async () => {
            const r: Recipe = JSON.parse(key);
            const dressed = !r.nude && Object.keys(r.wear).length > 0;
            const items = dressed ? await bundle.loadItems() : bundle.items ?? undefined;
            let layers = buildLayers(speciesFor(bundle.manifest, r.species, r.exclude), r, items);
            if (view === 'head') layers = layers.filter((l) => HEAD_PARTS.has(l.part));
            await bundle.preload(layers, r);
            if (stale || !ref.current) return;
            const px = compose(layers, bundle.source(r));
            paint(ref.current, view === 'head' ? cropToContent(px) : px);
        })();
        return () => {
            stale = true;
        };
    }, [bundle, key, view, visible]);

    return <canvas ref={ref} width={1} height={1} style={{ width: size, height: size, imageRendering: 'pixelated' }} aria-hidden />;
}
