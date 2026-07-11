'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { starColor } from '@/lib/space';
import type { CelestialBody } from '@/lib/types';
import { compositionColor } from './compositionColors';
import styles from './space.module.scss';

// Client port of the legacy space-builder SystemCanvas geometry (reference:
// space-builder/src/components/Canvas/SystemCanvas.jsx — never imported,
// only the layout math is ported): star at top center, log-scaled orbit
// rings downward, planets on the vertical axis, moons spread horizontally
// from their planet at fixed 10px steps with alternating label sides.
// Colors are resolved from CSS custom properties at draw time so both themes
// work; canvas labels are mono (star label is pixel font) per the mockup.

const STAR_KM_PER_PX = 20000; // star radius: 20 000 km = 1px
const AU_PX = 150; // Math.log(distanceAu + 1) * 150
const STAR_OFFSET_PX = 20;
const BODY_LOG_BASE_MULTIPLIER = 1 / Math.log(1.25); // planet/moon radius scale

interface LayoutPos {
    id: number;
    x: number;
    y: number;
    r: number;
}

interface Props {
    star: CelestialBody | null;
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}

function ariaSummary(star: CelestialBody): string {
    const planets = star.children ?? [];
    if (planets.length === 0) return `System diagram: star ${star.name}, no planets charted`;
    return `System diagram: star ${star.name} with planets ${planets.map((p) => p.name).join(', ')}`;
}

export default function SystemDiagram({ star, selectedId, onSelect }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const positionsRef = useRef<LayoutPos[]>([]);
    const { colorMode } = useTheme();

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !star) return;
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
        const orbitColor = cs.getPropertyValue('--space-orbit').trim() || 'rgba(147,147,219,0.45)';
        const starLabelColor = cs.getPropertyValue('--space-star').trim() || '#ffcc73';
        const selectColor = cs.getPropertyValue('--accent-2').trim() || '#f39e3b';
        const monoFont = cs.getPropertyValue('--font-mono').trim() || 'monospace';
        const pixelFont = cs.getPropertyValue('--font-pixel').trim() || 'monospace';
        const labelColor = '#dfe3f7';

        const positions: LayoutPos[] = [];
        const cx = w / 2;

        const selectionRing = (x: number, y: number, r: number) => {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = selectColor;
            ctx.shadowColor = selectColor;
            ctx.shadowBlur = 4;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        };

        // ---------- Star ----------
        const starRadius = Math.max(10, star.radiusKm / STAR_KM_PER_PX);
        const starPivotY = starRadius * 2 + 50;
        const starFill = star.color || (star.temperatureK != null ? starColor(star.temperatureK) : starLabelColor);

        ctx.beginPath();
        ctx.arc(cx, starPivotY, starRadius, 0, Math.PI * 2);
        ctx.shadowColor = starFill;
        ctx.shadowBlur = 24;
        ctx.fillStyle = starFill;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = `bold 14px ${pixelFont}`;
        ctx.fillStyle = starLabelColor;
        ctx.textAlign = 'center';
        ctx.fillText(star.name.toUpperCase(), cx, starPivotY + starRadius + 22);

        positions.push({ id: star.id, x: cx, y: starPivotY, r: starRadius });
        if (selectedId === star.id) selectionRing(cx, starPivotY, starRadius);

        // ---------- Planets ----------
        const planets = [...(star.children ?? [])].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

        for (const planet of planets) {
            const distanceAu = planet.distance ?? 0;
            let drawDistance = Math.log(distanceAu + 1) * AU_PX + STAR_OFFSET_PX;
            if (drawDistance <= starRadius + 50) {
                drawDistance = starRadius + 50 + drawDistance * 0.1;
            }

            // orbit ring
            ctx.save();
            ctx.setLineDash([5, 6]);
            ctx.strokeStyle = orbitColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, starPivotY, drawDistance, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            const px = cx;
            const py = starPivotY + drawDistance;
            const planetRadius = Math.max(5, Math.log(planet.radiusKm / 1000) * BODY_LOG_BASE_MULTIPLIER);
            const planetFill = compositionColor(planet.composition, planet.color);

            ctx.beginPath();
            ctx.arc(px, py, planetRadius, 0, Math.PI * 2);
            ctx.fillStyle = planetFill;
            ctx.fill();

            ctx.font = `12px ${monoFont}`;
            ctx.fillStyle = labelColor;
            ctx.textAlign = 'center';
            ctx.fillText(planet.name, px, py + planetRadius + 16);

            positions.push({ id: planet.id, x: px, y: py, r: planetRadius });
            if (selectedId === planet.id) selectionRing(px, py, planetRadius);

            // ---------- Moons ----------
            const moons = [...(planet.children ?? [])].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
            let moonOffset = planetRadius;
            let isTopLabel = false;
            for (const moon of moons) {
                isTopLabel = !isTopLabel;
                moonOffset += 10;

                ctx.save();
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = orbitColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(px, py, moonOffset, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                const mx = px + moonOffset;
                const my = py;
                const rawMoonRadius = Math.log(moon.radiusKm / 1000) * BODY_LOG_BASE_MULTIPLIER;
                const moonRadius = rawMoonRadius < 0 ? 1 : rawMoonRadius;
                const moonFill = compositionColor(moon.composition, moon.color);

                ctx.beginPath();
                ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
                ctx.fillStyle = moonFill;
                ctx.fill();

                ctx.font = `10px ${monoFont}`;
                ctx.fillStyle = labelColor;
                ctx.textAlign = 'center';
                ctx.fillText(moon.name, mx, my + (isTopLabel ? -(moonRadius + 8) : moonRadius + 14));

                positions.push({ id: moon.id, x: mx, y: my, r: moonRadius });
                if (selectedId === moon.id) selectionRing(mx, my, moonRadius);
            }
        }

        positionsRef.current = positions;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [star, selectedId, colorMode]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => draw());
        observer.observe(container);
        return () => observer.disconnect();
    }, [draw]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        let best: { id: number; dist: number } | null = null;
        for (const p of positionsRef.current) {
            const dist = Math.hypot(p.x - px, p.y - py);
            const hitR = Math.max(p.r, 8) + 6;
            if (dist <= hitR && (!best || dist < best.dist)) best = { id: p.id, dist };
        }
        onSelect(best ? best.id : null);
    };

    if (!star) {
        return (
            <div className={styles.viewport} style={{ width: '100%', height: '100%', minHeight: '30rem' }}>
                <p className={styles.viewportEmpty}>NO BODIES CHARTED — this system is empty.</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={styles.viewport}
            style={{ width: '100%', height: '100%', minHeight: '30rem' }}
            onClick={handleClick}
        >
            <canvas ref={canvasRef} className={styles.canvas} role='img' aria-label={ariaSummary(star)} />
        </div>
    );
}
