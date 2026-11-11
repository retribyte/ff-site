'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { imageSrc } from '@/lib/images';

// ── Outlined sprite cache ─────────────────────────────────────────────────
// The outlined sprite depends only on the image and the outline color, never
// on display size (the bitmap stays at native resolution and CSS scales it).
// A transcript repeats the same dozen avatars across hundreds of blocks, so
// each one is built once per session and every block shows the same PNG.

/** A built sprite's URL, or false when the image couldn't load */
type Sprite = string | false;

const sprites = new Map<string, Sprite>();
const building = new Set<string>();
const listeners = new Set<() => void>();
const rgbCache = new Map<string, string>();
let probe: HTMLElement | null = null;

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * The outline color as the browser resolves it in the current theme, as
 * "r,g,b" -- works for a hex value and for a theme token like
 * `var(--text-muted)` alike. Resolved once per color and theme. Keyed on the
 * page's live theme, not useTheme's: during hydration that still says "dark"
 * on a light page, and would cache a light value under the dark key.
 */
function resolvedRgb(color: string): string {
    const cacheKey = `${document.documentElement.dataset.theme ?? 'dark'}|${color}`;
    let rgb = rgbCache.get(cacheKey);
    if (rgb === undefined) {
        if (!probe) {
            probe = document.createElement('span');
            probe.hidden = true;
            document.body.appendChild(probe);
        }
        probe.style.color = color;
        const match = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
        rgb = (match ?? ['0', '0', '0']).slice(0, 3).map(Number).join(',');
        rgbCache.set(cacheKey, rgb);
    }
    return rgb;
}

function spriteKey(src: string, color: string) {
    return `${resolvedRgb(color)}|${src}`;
}

function finish(key: string, sprite: Sprite) {
    sprites.set(key, sprite);
    building.delete(key);
    for (const listener of listeners) listener();
}

/** Trace a 1px outline around the sprite's opaque pixels, once per key. */
function buildSprite(key: string, src: string, rgb: string) {
    if (sprites.has(key) || building.has(key)) return;
    building.add(key);

    const url = imageSrc(src);
    const image = new Image();
    image.src = url;
    image.onload = () => {
        const w = image.width + 2;
        const h = image.height + 2;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(key, url);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 1, 1);

        let imageData: ImageData;
        try {
            imageData = ctx.getImageData(0, 0, w, h);
        } catch {
            // A cross-origin image taints the canvas: show it without an outline
            return finish(key, url);
        }
        const data = imageData.data;
        const [r, g, b] = rgb.split(',').map(Number);

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
        finish(key, canvas.toDataURL());
    };
    image.onerror = () => finish(key, false);
}

/**
 * Pixel-art avatar with a 1px outline traced in the character's color —
 * the legacy site's signature effect, redrawn. The sprite stays at native
 * resolution; CSS scales it up with crisp pixels.
 * Falls back to a letter tile when there's no sprite.
 */
interface Props {
    src: string | null;
    name: string;
    color: string;
    size?: number;
}

export default function PixelAvatar({ src, name, color, size = 48 }: Props) {
    // Theme tokens resolve differently per theme, so a switch re-renders to pick
    // that theme's sprite (resolvedRgb reads the theme from the page itself)
    const { colorMode } = useTheme();
    // Nothing during SSR and hydration (the server can't build sprites), so the
    // markup matches; then the cached sprite, if this one's been built before.
    const sprite = useSyncExternalStore(
        subscribe,
        () => (src ? sprites.get(spriteKey(src, color)) : undefined),
        () => undefined
    );

    useEffect(() => {
        if (src) buildSprite(spriteKey(src, color), src, resolvedRgb(color));
    }, [src, color, colorMode]);

    if (!src || sprite === false) {
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
        <span
            role='img'
            aria-label={`${name} avatar`}
            style={{ width: size, height: size, display: 'flex', justifyContent: 'center', flexShrink: 0 }}
        >
            {/* A plain <img>: next/image has nothing to optimize in a pixel sprite */}
            {sprite && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={sprite}
                    alt=''
                    // contain: a sprite wider than it is tall would otherwise stretch at maxWidth
                    style={{ height: size, width: 'auto', maxWidth: size, objectFit: 'contain', imageRendering: 'pixelated' }}
                />
            )}
        </span>
    );
}
