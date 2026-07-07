'use client';

import { useEffect, useState } from 'react';

function hexToRgb(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// The outlined sprite depends only on (src, color), never on display size — the
// bitmap stays at native resolution and CSS scales it. The same handful of
// characters recur across hundreds of transcript blocks, so we build each
// sprite once and reuse the resulting data URL everywhere (including after a
// virtualized row unmounts and re-mounts on scroll).
const spriteCache = new Map<string, string>();
const spriteBuilds = new Map<string, Promise<string>>();

const spriteKey = (src: string, color: string) => `${src}|${color}`;

/**
 * Trace a 1px outline in `color` around the sprite's opaque pixels and return
 * it as a PNG data URL. Same-origin sprites only (canvas would taint otherwise,
 * just as the pixel read does). Deduped by key and memoized for the session.
 */
function buildOutlinedSprite(src: string, color: string): Promise<string> {
    const key = spriteKey(src, color);
    const cached = spriteCache.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = spriteBuilds.get(key);
    if (inFlight) return inFlight;

    const build = new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.src = src;
        image.onload = () => {
            const w = image.width + 2;
            const h = image.height + 2;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('no 2d context'));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, 1, 1);

            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            const [r, g, b] = hexToRgb(color);

            const alphaAt = (x: number, y: number) =>
                x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3];

            // Any transparent pixel touching an opaque neighbor becomes outline
            const outline: number[] = [];
            for (let y = 0; y < h; y += 1) {
                for (let x = 0; x < w; x += 1) {
                    const i = (y * w + x) * 4;
                    if (data[i + 3] !== 0) continue;
                    if (alphaAt(x - 1, y) || alphaAt(x + 1, y) || alphaAt(x, y - 1) || alphaAt(x, y + 1)) {
                        outline.push(i);
                    }
                }
            }
            for (const i of outline) {
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);

            const url = canvas.toDataURL();
            spriteCache.set(key, url);
            spriteBuilds.delete(key);
            resolve(url);
        };
        image.onerror = () => {
            spriteBuilds.delete(key);
            reject(new Error(`failed to load ${src}`));
        };
    });
    spriteBuilds.set(key, build);
    return build;
}

/**
 * Pixel-art avatar with a 1px outline traced in the character's color — the
 * legacy site's signature effect, redrawn. Renders the cached outlined sprite
 * as a crisp-scaled <img>; falls back to a letter tile when there's no sprite.
 */
interface Props {
    src: string | null;
    name: string;
    color: string;
    size?: number;
}

export default function PixelAvatar({ src, name, color, size = 48 }: Props) {
    // Seed synchronously from the cache so recurring avatars render outlined on
    // first paint with no work (this runs empty on the server and first client
    // render, so hydration matches, then the effect fills it in).
    const [dataUrl, setDataUrl] = useState<string | null>(() =>
        src ? spriteCache.get(spriteKey(src, color)) ?? null : null
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!src) return;
        let active = true;
        // Cache hits resolve synchronously-ish via a microtask (Promise.resolve),
        // so the only setState happens in the async callback — no flash, because
        // recurring avatars already seeded dataUrl from the cache above.
        buildOutlinedSprite(src, color)
            .then((url) => active && setDataUrl(url))
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, [src, color]);

    if (!src || failed) {
        return (
            <div
                aria-hidden
                style={{
                    width: size,
                    height: size,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: size / 34 + 'rem',
                    color,
                    background: `color-mix(in srgb, ${color} 18%, transparent)`,
                    border: `2px solid ${color}`,
                    borderRadius: '50%',
                    flexShrink: 0,
                }}
            >
                {name.charAt(0).toUpperCase()}
            </div>
        );
    }

    return (
        <span style={{ width: size, height: size, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            {/* Outlined sprite once built; raw sprite as a placeholder until then.
                next/image can't optimize a data-URL pixel sprite rendered with
                image-rendering: pixelated, so a plain <img> is correct here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={dataUrl ?? src}
                alt={`${name} avatar`}
                onError={() => setFailed(true)}
                style={{ height: size, width: 'auto', maxWidth: size, imageRendering: 'pixelated' }}
            />
        </span>
    );
}
