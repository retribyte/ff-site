'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { starColor } from '@/lib/space';
import type { GalaxyLandmarkSummary, GalaxySelection, GalaxySystemSummary } from './types';
import styles from './space.module.scss';

// The galaxy map as a plotting chart, not a picture: the map image, a faint
// graticule, system/landmark markers, and a pointer-tracking crosshair whose
// position updates via direct DOM refs (not React state) so it never forces
// a re-render. Canvas hit-testing selects a marker; selection also drives
// (and is driven by) the rail list in the parent.

interface Props {
    mapImage: string | null;
    systems: GalaxySystemSummary[];
    landmarks: GalaxyLandmarkSummary[];
    selected: GalaxySelection | null;
    onSelect: (sel: GalaxySelection | null) => void;
    /** Live pointer coordinates (normalized 0..1), or null on pointer-leave. The
     *  parent owns the toolbar's grid-ref DOM node and mutates it itself — a
     *  callback (not a ref prop) keeps that mutation local to its owner, which
     *  the React Compiler's immutability check requires. */
    onCoordsChange: (coords: { x: number; y: number } | null) => void;
}

const HIT_RADIUS_PX = 14;

export default function GalaxyMap({ mapImage, systems, landmarks, selected, onSelect, onCoordsChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const xhVRef = useRef<HTMLDivElement>(null);
    const xhHRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const { colorMode } = useTheme();

    const placed = systems.filter((s): s is GalaxySystemSummary & { xPos: number; yPos: number } => s.xPos !== null && s.yPos !== null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const cs = getComputedStyle(container);
        const gridColor = cs.getPropertyValue('--space-grid').trim() || 'rgba(149,130,238,0.14)';
        const landmarkColor = cs.getPropertyValue('--space-landmark').trim() || '#6fb7ff';
        const starFallback = cs.getPropertyValue('--space-star').trim() || '#ffcc73';
        const selectColor = cs.getPropertyValue('--accent-2').trim() || '#f39e3b';
        const monoFont = cs.getPropertyValue('--font-mono').trim() || 'monospace';

        // Background map image (cover-fit)
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
            const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        }

        // Graticule
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const step = 60;
        ctx.beginPath();
        for (let x = 0; x <= w; x += step) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += step) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        ctx.font = `12px ${monoFont}`;
        ctx.textAlign = 'center';

        // Landmarks — diamond markers
        for (const lm of landmarks) {
            const x = lm.xPos * w;
            const y = lm.yPos * h;
            const isSel = selected?.kind === 'landmark' && selected.id === lm.id;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            const size = 7.5;
            ctx.rect(-size / 2, -size / 2, size, size);
            ctx.shadowColor = landmarkColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = landmarkColor;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#1a4a7a';
            ctx.stroke();
            ctx.restore();

            if (isSel) {
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = selectColor;
                ctx.shadowColor = selectColor;
                ctx.shadowBlur = 4;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#dfe3f7';
            ctx.fillText(lm.name, x, y + 20);
        }

        // Systems — star markers
        for (const sys of placed) {
            const x = sys.xPos * w;
            const y = sys.yPos * h;
            const color = sys.star?.color || (sys.star?.temperatureK != null ? starColor(sys.star.temperatureK) : starFallback);
            const isSel = selected?.kind === 'system' && selected.id === sys.id;

            ctx.beginPath();
            ctx.arc(x, y, 5.5, 0, Math.PI * 2);
            ctx.shadowColor = color;
            ctx.shadowBlur = 9;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#7a5a1a';
            ctx.stroke();

            if (isSel) {
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = selectColor;
                ctx.shadowColor = selectColor;
                ctx.shadowBlur = 4;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#dfe3f7';
            ctx.fillText(sys.name, x, y + 20);
        }

        if (placed.length === 0 && landmarks.length === 0) {
            ctx.font = `13px ${monoFont}`;
            ctx.fillStyle = '#7a80ab';
            ctx.textAlign = 'center';
            ctx.fillText('NO CHARTED SYSTEMS', w / 2, h / 2 - 6);
            ctx.font = `11px ${monoFont}`;
            ctx.fillText('nothing plotted yet', w / 2, h / 2 + 12);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [landmarks, placed, selected, colorMode]);

    // Load the background map image once.
    useEffect(() => {
        if (!mapImage) return;
        const img = new Image();
        img.src = mapImage;
        img.onload = () => draw();
        imgRef.current = img;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapImage]);

    // Redraw on data change / selection / theme.
    useEffect(() => {
        draw();
    }, [draw]);

    // Redraw on resize.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => draw());
        observer.observe(container);
        return () => observer.disconnect();
    }, [draw]);

    const hitTest = useCallback(
        (px: number, py: number, w: number, h: number): GalaxySelection | null => {
            let best: { sel: GalaxySelection; dist: number } | null = null;
            for (const sys of placed) {
                const x = sys.xPos * w;
                const y = sys.yPos * h;
                const dist = Math.hypot(x - px, y - py);
                if (dist <= HIT_RADIUS_PX && (!best || dist < best.dist)) {
                    best = { sel: { kind: 'system', id: sys.id }, dist };
                }
            }
            for (const lm of landmarks) {
                const x = lm.xPos * w;
                const y = lm.yPos * h;
                const dist = Math.hypot(x - px, y - py);
                if (dist <= HIT_RADIUS_PX && (!best || dist < best.dist)) {
                    best = { sel: { kind: 'landmark', id: lm.id }, dist };
                }
            }
            return best?.sel ?? null;
        },
        [placed, landmarks]
    );

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        if (xhVRef.current) xhVRef.current.style.left = `${x * 100}%`;
        if (xhHRef.current) xhHRef.current.style.top = `${y * 100}%`;
        onCoordsChange({ x, y });
    };

    const handlePointerLeave = () => {
        onCoordsChange(null);
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const hit = hitTest(px, py, rect.width, rect.height);
        onSelect(hit);
    };

    return (
        <div
            ref={containerRef}
            className={styles.viewport}
            style={{ width: '100%', height: '100%', minHeight: '26rem' }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
        >
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                role='img'
                aria-label={`Galaxy chart: ${placed.length} system${placed.length === 1 ? '' : 's'} and ${landmarks.length} landmark${landmarks.length === 1 ? '' : 's'} plotted`}
            />
            <div ref={xhVRef} className={`${styles.xh} ${styles.xhV}`} aria-hidden />
            <div ref={xhHRef} className={`${styles.xh} ${styles.xhH}`} aria-hidden />
        </div>
    );
}
