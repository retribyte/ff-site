'use client';

import { useEffect, useRef, useState } from 'react';

function hexToRgb(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Pixel-art avatar with a 1px outline traced in the character's color —
 * the legacy site's signature effect, redrawn. The canvas stays at native
 * sprite resolution; CSS scales it up with crisp pixels.
 * Falls back to a letter tile when there's no sprite.
 */
export default function PixelAvatar({ src, name, color }: { src: string | null; name: string; color: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Track which src failed so a src change resets automatically
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const failed = failedSrc !== null && failedSrc === src;

    useEffect(() => {
        if (!src) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const image = new Image();
        image.src = src;
        image.onload = () => {
            const w = image.width + 2;
            const h = image.height + 2;
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
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
        };
        image.onerror = () => setFailedSrc(src);
    }, [src, color]);

    if (!src || failed) {
        return (
            <div
                aria-hidden
                style={{
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.4rem',
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
        <span style={{ width: 48, height: 48, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <canvas
                ref={canvasRef}
                width={0}
                height={0}
                role='img'
                aria-label={`${name} avatar`}
                style={{ height: 48, width: 'auto', maxWidth: 48, imageRendering: 'pixelated' }}
            />
        </span>
    );
}
