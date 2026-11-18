'use client';

// The full-screen view of one system: floating panels (bodies, telemetry for the
// selection, travelogue) over a diagram of the whole system, after Space Builder's
// system console.

import { useEffect, useRef, useState } from 'react';
import {
    COMPOSITIONS, STAR_TYPES, ZONES,
    bodyColor, componentsOf, describeSize, fmtNum, gravityG, habAU, habitability, hostOf, isSlot, isStarry, lumOf, massEarths, massOf, orbitAU, primaryOf, regionLabel, sectorOf, unitOf, yearDays, zoneOf,
} from './data';
import type { Body, Place } from './data';
import { BodyFields, BodyIcon, BodyName, SystemDot, BodyPortrait, BodyTexture, BodyTree, DeleteButton, designation, kindLabel, pairOf, RenameRow, TextFields, Travelogue, Writeup, placeTitle } from './parts';
import type { CreateKind, PlanetSlot } from './parts';
import type { Store } from './store';
import styles from './galaxy.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// ---------- Diagram ----------
// Not to scale, but sizes and distances keep their order of magnitude: both go
// through a logarithm, as Space Builder's diagram did.
const LOG_SIZE = 1 / Math.log(1.25);
const bodyPx = (b: Body) => Math.max(b.kind === 'planet' ? 4 : 2.2, Math.min(26, Math.log(Math.max(b.radiusKm, 1) / 1000) * LOG_SIZE));
const MOON_GAP = 11;
/** Spacing of the rings drawn round one planet of a pair (its own moons, rings and stations), which travel with it. */
const PART_GAP = 4;
/** Spacing of the orbits drawn round a companion star (its planets, belts and stations). */
const SAT_GAP = 13;
/** A companion star is drawn this much smaller than the primary would be. */
const COMPANION_SCALE = 0.75;
/** Seconds the stars of a pair take to go round each other in the drawing (a pair of planets: half). */
const PAIR_SECONDS = 24;
/** The most of the gap to the nearest neighbouring ring that a planet's disc may take up. */
const PLANET_FILL = 0.85;
/** Room an open planet number's ring takes on each side. */
const GAP_REACH = 11;
/** Room a belt round the star takes on each side; its band is drawn no wider than twice this. */
const BELT_REACH = 14;
/** The lanes of dots a belt is drawn as: where across the band and how far apart the dots. They hold still (the user's ruling, 2026-11-16): only planets, moons and stations travel. */
const BELT_LANES = [
    { at: -0.3, gap: 9 },
    { at: 0, gap: 13 },
    { at: 0.3, gap: 7 },
];

/** How far the temperate band's edges fade, and how far the star's glow reaches past its disc. */
const HAB_SOFT = 10;
const HAB_COLOR = '#6fd18a';
const STAR_GLOW = 30;

/** How many times a second the bodies step along their orbits. */
const ORBIT_FPS = 15;

/** How long after the last zoom step the orbits start moving again, in milliseconds. */
const ZOOM_REST_MS = 300;

/** At this width or under (a phone, the same breakpoint as the stylesheet's) the diagram is drawn in line: see `inline` in `SystemDiagram`. */
const INLINE_MAX_W = 760;

const MAX_ZOOM = 6;
/** Seconds the drawing takes over one year of a planet a year of 365 days out; other years go by the square root. */
const YEAR_SECONDS = 40;
/** Seconds a moon as far out as Luna takes to go round. */
const MONTH_SECONDS = 8;

function SystemDiagram({ place, selBodyId, onSelect, onEdit, onAdd, moving, onMoving }: { place: Place; selBodyId: number | null; onSelect: (id: number | null) => void; onEdit: (id: number) => void; onAdd?: (slot?: PlanetSlot) => void; /** Bodies travel round their orbits. */ moving: boolean; onMoving: (on: boolean) => void }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [box, setBox] = useState({ w: 1000, h: 700 });
    useEffect(() => {
        const host = hostRef.current!;
        const ro = new ResizeObserver(() => setBox({ w: Math.max(320, host.clientWidth), h: Math.max(320, host.clientHeight) }));
        ro.observe(host);
        return () => ro.disconnect();
    }, []);

    // Zoom and slide: the drawing scaled by `k` with its corner at (x, y); never smaller than the view nor off it
    const [cam, setCam] = useState({ k: 1, x: 0, y: 0 });
    // When the zoom last changed: the orbits hold still during a zoom and for a moment after (`ZOOM_REST_MS`),
    // so the browser has only the zoom's own redraws to do
    const zoomedAt = useRef(0);
    const boxRef = useRef(box);
    // Phones: the star sits at the top edge and only the half of the system under it is drawn, the planets in one line
    // straight down from it and their moons in a line beside them. Nothing travels and nothing zooms: with the whole
    // height for the orbits, the drawing is already several times the size the full circles would get.
    const inline = box.w <= INLINE_MAX_W;
    const inlineRef = useRef(inline);
    useEffect(() => {
        boxRef.current = box;
        inlineRef.current = inline;
    });
    const fit = (c: { k: number; x: number; y: number }, b = boxRef.current) => {
        const k = Math.max(1, Math.min(MAX_ZOOM, c.k));
        return { k, x: Math.min(0, Math.max(b.w * (1 - k), c.x)), y: Math.min(0, Math.max(b.h * (1 - k), c.y)) };
    };
    /** Zooms by `factor`, keeping the point (px, py) of the view where it is, then slides by (dx, dy). */
    const zoomAt = (px: number, py: number, factor: number, dx = 0, dy = 0) => {
        if (factor !== 1) zoomedAt.current = performance.now();
        setCam((c) => {
            const k = Math.max(1, Math.min(MAX_ZOOM, c.k * factor));
            const f = k / c.k;
            return fit({ k, x: px - (px - c.x) * f + dx, y: py - (py - c.y) * f + dy });
        });
    };
    useEffect(() => {
        const svg = svgRef.current!;
        // Not passive: the wheel zooms the diagram, it must not scroll the page. A fast wheel or a touchpad sends
        // many events between two frames; they are gathered into one zoom step per frame, because every step
        // makes the browser draw the whole diagram again at a new size.
        let pending: { px: number; py: number; factor: number } | null = null;
        let raf = 0;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (inlineRef.current) return;
            zoomedAt.current = performance.now();
            const r = svg.getBoundingClientRect();
            const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
            const [px, py] = [e.clientX - r.left, e.clientY - r.top];
            if (pending) {
                pending = { px, py, factor: pending.factor * factor };
                return;
            }
            pending = { px, py, factor };
            raf = requestAnimationFrame(() => {
                const step = pending!;
                pending = null;
                setCam((c) => {
                    const k = Math.max(1, Math.min(MAX_ZOOM, c.k * step.factor));
                    const f = k / c.k;
                    const b = boxRef.current;
                    return { k, x: Math.min(0, Math.max(b.w * (1 - k), step.px - (step.px - c.x) * f)), y: Math.min(0, Math.max(b.h * (1 - k), step.py - (step.py - c.y) * f)) };
                });
            });
        };
        svg.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            cancelAnimationFrame(raf);
            svg.removeEventListener('wheel', onWheel);
        };
    }, []);
    // A drag slides the zoomed drawing; two fingers pinch it
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const dragged = useRef(false);
    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (pointers.current.size === 0) dragged.current = false;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const was = pointers.current.get(e.pointerId);
        if (!was || inline) return;
        const r = e.currentTarget.getBoundingClientRect();
        const others = [...pointers.current.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
        const [dx, dy] = [e.clientX - was.x, e.clientY - was.y];
        if (!dragged.current && others.length === 0 && Math.hypot(dx, dy) < 5) return;
        if (!dragged.current) e.currentTarget.setPointerCapture(e.pointerId);
        dragged.current = true;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (others.length === 0) return setCam((c) => fit({ ...c, x: c.x + dx, y: c.y + dy }));
        const o = others[0];
        const before = Math.hypot(was.x - o.x, was.y - o.y);
        const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        zoomAt((e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top, before > 0 ? after / before : 1, dx / 2, dy / 2);
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => void pointers.current.delete(e.pointerId);
    // A click that ends a slide selects nothing
    const onClickCapture = (e: React.MouseEvent) => {
        if (!dragged.current) return;
        dragged.current = false;
        e.stopPropagation();
    };

    // The orbits' clock, in seconds; it only runs while the bodies are moving, so a pause leaves them where they are.
    // It is not state: each tick writes the moving parts' `transform` attribute straight to the page (`movers`), so
    // React does not draw the diagram again sixty times a second. Plain SVG attributes on purpose: with CSS
    // transforms and `will-change` the browser makes each moving part a layer, as large as what it holds times the
    // zoom and drawn again at every zoom step; that ran LibreWolf to 28 GB and froze the machine (2026-11-16).
    const clock = useRef(0);
    const movers = useRef(new Map<string, { node: SVGGElement | SVGCircleElement; at: (time: number) => string }>());
    /** Marks a part that travels: `at` gives its `transform` at a time on the clock. Spread onto the element. */
    const mover = (key: string, at: (time: number) => string) => ({
        ref: (node: SVGGElement | SVGCircleElement | null) => {
            if (node) movers.current.set(key, { node, at });
            else movers.current.delete(key);
        },
        transform: at(clock.current),
    });
    useEffect(() => {
        if (!moving || inline) return;
        let last = performance.now();
        let raf = requestAnimationFrame(function step(now) {
            raf = requestAnimationFrame(step);
            // Every move paints the diagram again, so the bodies step a few times a second, not at the screen's rate (the user's ruling, 2026-11-16: the orbits need no high frame rate)
            if (now - last < 1000 / ORBIT_FPS) return;
            if (now - zoomedAt.current < ZOOM_REST_MS) {
                last = now;
                return;
            }
            clock.current += Math.min(0.1, (now - last) / 5000);
            last = now;
            for (const { node, at } of movers.current.values()) node.setAttribute('transform', at(clock.current));
        });
        return () => cancelAnimationFrame(raf);
    }, [moving, inline]);

    // The primary at the center: a star, or a pair of stars going round their barycenter (`core`)
    const root = primaryOf(place);
    const star = root?.kind === 'star' ? root : undefined;
    const host = hostOf(place.bodies, root);
    const core = root?.kind === 'barycenter' ? componentsOf(place.bodies, root) : [];
    const kidsOf = (id: number) => place.bodies.filter((b) => b.parentId === id).sort((x, y) => x.orbit - y.orbit);
    const rootKids = root ? kidsOf(root.id) : [];
    // What circles the primary, drawn as rings: its planets and pairs of planets (numbered), its belts, and its companion stars (or pairs of them)
    const planets = rootKids.filter(isSlot);
    const starBelts = rootKids.filter((b) => b.kind === 'belt');
    const companions = rootKids.filter((b) => isStarry(b) && !core.includes(b));
    const { w: W, h: Hh } = box;
    // Fitted again here, in case the window shrank since the last zoom
    const view = inline ? { k: 1, x: 0, y: 0 } : fit(cam, box);
    // On a wide screen the panels cover the left edge, so the star sits right of center.
    const inset = W > 900 ? 400 : 0;
    const c = { x: inset + (W - inset) / 2, y: inline ? 0 : Hh / 2 };
    const typePx = (b: Body | undefined) => (STAR_TYPES[b?.type ?? '']?.px ?? 24) * 1.25;
    // A pair at the center: its stars a little smaller, going round on a circle as wide as the larger of them
    const coreR = core.length ? Math.max(...core.map((k) => (k.kind === 'star' ? typePx(k) * 0.8 : 12))) + 4 : 0;
    const starPx = core.length ? coreR + Math.max(...core.map((k) => (k.kind === 'star' ? typePx(k) * 0.8 : 12))) : typePx(star);
    // In line, the orbits have the height down to the legend and the folded sheet
    const maxR = inline ? Hh - 120 : Math.min(W - inset, Hh) / 2 - 40;
    /**
     * A planet's, or a pair of planets', drawing. A pair's planets go round its center on `pairR`, each carrying its
     * own moons, rings and stations in small rings round its disc; only what circles both is ringed round the center.
     */
    const slotParts = (p: Body, pr?: number) => {
        const pair = p.kind === 'barycenter' ? componentsOf(place.bodies, p).sort((a, b) => b.radiusKm - a.radiusKm) : [];
        const kids = pair.length ? kidsOf(p.id).filter((k) => !pair.includes(k)) : kidsOf(p.id);
        const discPx = pair.length ? Math.max(...pair.map(bodyPx)) : bodyPx(p);
        const partPx = (k: Body) => Math.max(2.5, Math.min(bodyPx(k), pr ?? discPx));
        // How far out one planet of the pair reaches with its own rings
        const extent = (k: Body) => partPx(k) + kidsOf(k.id).length * PART_GAP;
        const widest = pair.length ? Math.max(...pair.map(extent)) : 0;
        // The two never overlap, rings and all; the pair's own rings start outside both
        const pairR = pair.length ? widest + 1.5 : 0;
        const inner = pair.length ? pairR + widest : (pr ?? discPx);
        return { pair, kids, discPx, partPx, pairR, inner };
    };
    // How much room a planet needs around its own center (its moons' rings included); a pair, both planets with their rings.
    const reach = (p: Body) => {
        const { kids, inner } = slotParts(p);
        return inner + kids.length * MOON_GAP + 6;
    };
    /** A companion star's drawing: how big, and the orbits drawn round it (a pair of stars: its stars are drawn, not ringed). */
    const companionParts = (b: Body) => {
        const pair = componentsOf(place.bodies, b);
        const px = b.kind === 'star' ? typePx(b) * COMPANION_SCALE : Math.max(...pair.map((k) => typePx(k) * COMPANION_SCALE * 0.7), 8) * 1.8;
        return { pair, px, sats: kidsOf(b.id).filter((k) => !pair.includes(k)) };
    };
    const companionReach = (b: Body) => {
        const { px, sats } = companionParts(b);
        return px + sats.length * SAT_GAP + 8;
    };
    const base = starPx + 14;
    const room = maxR - base - (onAdd ? 34 : 0);
    const farthest = Math.log(Math.max(1, ...planets.map((p) => p.orbit), ...starBelts.map((b) => b.orbit), ...companions.map((b) => b.orbit)) + 1);
    const k = Math.min(150, room / Math.max(farthest, 0.2));
    // Every ring from the star outward: the planets, the star's belts and, for whoever
    // may add, the open numbers inside a planet that is "planet N" (spread evenly, in
    // log distance, between its neighbours).
    const rings: { planet?: Body; belt?: Body; companion?: Body; index: number; n: number; orbit: number; reach: number; r: number; px: number }[] = [];
    planets.forEach((p, i) => {
        const before = planets[i - 1];
        const gaps = onAdd ? p.num - (before?.num ?? 0) - 1 : 0;
        const from = before?.orbit ?? p.orbit / 2 ** (gaps + 1);
        for (let g = 1; g <= gaps; g++) rings.push({ index: i, n: (before?.num ?? 0) + g, orbit: from * (p.orbit / from) ** (g / (gaps + 1)), reach: GAP_REACH, r: 0, px: 0 });
        rings.push({ planet: p, index: i, n: p.num, orbit: p.orbit, reach: reach(p), r: 0, px: slotParts(p).discPx });
    });
    for (const b of starBelts) rings.push({ belt: b, index: -1, n: b.num, orbit: b.orbit, reach: BELT_REACH, r: 0, px: 0 });
    companions.forEach((b, i) => rings.push({ companion: b, index: i, n: 0, orbit: b.orbit, reach: companionReach(b), r: 0, px: companionParts(b).px }));
    rings.sort((a, b) => a.orbit - b.orbit);
    // Log distance, then pushed outward wherever two rings would overlap.
    rings.forEach((ring, i) => {
        const want = base + Math.log(ring.orbit + 1) * k;
        ring.r = Math.max(want, i === 0 ? base + ring.reach : rings[i - 1].r + rings[i - 1].reach + ring.reach);
    });
    const last = rings[rings.length - 1];
    const over = Math.max(1, last ? (last.r - base) / Math.max(room, 1) : 0);
    for (const ring of rings) ring.r = base + (ring.r - base) / over;
    // Squeezed rings (a small screen) sit closer than a big planet is wide: no planet's disc may reach the ring on either side of its own (or the star); a companion star keeps its size
    rings.forEach((ring, i) => {
        if (ring.companion) return;
        const gap = Math.min(ring.r - (rings[i - 1]?.r ?? starPx), (rings[i + 1]?.r ?? Infinity) - ring.r);
        ring.px = Math.max(2.5, Math.min(ring.px, gap * PLANET_FILL));
    });
    const addR = last ? Math.min(maxR, last.r + last.reach / over + 28) : base + 60;
    // Where a distance from the star falls in the drawing: along the rings' own spacing, then on outward.
    const auToPx = (au: number) => {
        const at = Math.log(au + 1);
        let [l0, r0] = [0, base];
        for (const ring of rings) {
            const l1 = Math.log(ring.orbit + 1);
            if (at <= l1) return l1 > l0 ? r0 + ((at - l0) / (l1 - l0)) * (ring.r - r0) : ring.r;
            [l0, r0] = [l1, ring.r];
        }
        return r0 + ((at - l0) * k) / over;
    };
    // The temperate band (the same bounds as zoneOf)
    const hab = host && !host.hole ? [auToPx(habAU(host) * 0.9), auToPx(habAU(host) * 1.6)] : null;
    // What the open planet numbers are called: the primary's designation (Vortox-A, Vortox-AB) or name
    const stem = root?.gu || (root && !root.unnamed ? root.name : 'Unnamed');
    // Spread around the star by the golden angle, starting somewhere that differs per system.
    const angle = (id: number, index: number) => (((id * 137) % 360) * Math.PI) / 180 + index * 2.39996;
    // Where each is now: counterclockwise, the nearer the faster (Kepler's periods, with the square root taken so the far ones still move)
    const turned = (time: number, seconds: number) => (-time * 2 * Math.PI) / seconds;
    /** The `transform` that carries a part round (cx, cy) at radius r, once in `seconds`, starting from `from`. */
    const round = (cx: number, cy: number, r: number, from: number, seconds: number) => (time: number) => {
        const a = from + turned(time, seconds);
        return `translate(${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)})`;
    };
    /** In line: where a part at radius r from (cx, cy) holds still, along the angle `a` (straight down for planets, sideways for moons). */
    const held = (cx: number, cy: number, r: number, a: number) => () => `translate(${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)})`;
    const planetYear = (index: number) => YEAR_SECONDS * Math.sqrt(yearDays(planets[index].orbit, host ?? 'sunlike') / 365.25);
    const companionYear = (b: Body) => YEAR_SECONDS * Math.sqrt(yearDays(b.orbit, host ?? 'sunlike') / 365.25);
    /** Something round a companion star (`at`, in AU, round a star of light `lum`): a few seconds for the nearest, the far ones slower. */
    const satYear = (b: Body, j: number) => Math.max(6, Math.min(40, 6 + j * 4 + Math.sqrt(b.orbit) * 4));
    /** A star's disc and glow at (x, y): `glowId` is an objectBoundingBox gradient, so it fits wherever the disc is carried. */
    const starDisc = (b: Body, x: number, y: number, px: number, glowId: string) => (
        <>
            {b.type === 'black_hole' && <circle cx={x} cy={y} r={px + 6} fill='none' stroke='#f0b44c' strokeWidth='3' opacity='.7' className={styles.starGlow} />}
            <circle cx={x} cy={y} r={px + STAR_GLOW * 0.6} fill={`url(#${glowId})`} className={styles.starGlow} />
            <circle cx={x} cy={y} r={px} fill={bodyColor(b)} className={styles.partDisc} />
        </>
    );
    /** One partner of a pair, carried round the pair's center: selectable on its own, ringed only when it is the one pointed at or picked. */
    const partner = (k: Body, carry: { ref: (node: SVGGElement | SVGCircleElement | null) => void; transform: string }, drawn: React.ReactNode) => (
        <g key={k.id} className={styles.mover} {...carry}>
            <g className={cx(styles.part, selBodyId === k.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(k.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(k.id))}>
                {drawn}
            </g>
        </g>
    );
    // Every star drawn away from the center gets a glow of its own color
    const glowStars = [...core, ...companions].flatMap((b) => (b.kind === 'star' ? [b] : componentsOf(place.bodies, b).filter((k) => k.kind === 'star')));
    const moonMonth = (m: Body) => Math.max(3, Math.min(24, MONTH_SECONDS * Math.sqrt(m.orbit / 384400)));

    return (
        <div ref={hostRef} className={styles.sysDiagram}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${Hh}`}
                width={W}
                height={Hh}
                className={styles.schematic}
                onClick={() => onSelect(null)}
                onClickCapture={onClickCapture}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                role='img'
                aria-label={`Diagram of the ${placeTitle(place)}: ${[...companions, ...planets].map((p) => p.name).join(', ') || 'no planets yet'}`}
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                <defs>
                    {/* Soft edges by gradient, not by a blur filter: a filter is worked out again on every frame the orbits move, over an area that grows with the zoom */}
                    {hab && (
                        <radialGradient id='galaxy-hab-zone' gradientUnits='userSpaceOnUse' cx={c.x} cy={c.y} r={hab[1] + HAB_SOFT}>
                            <stop offset={Math.max(0, hab[0] - HAB_SOFT) / (hab[1] + HAB_SOFT)} stopColor={HAB_COLOR} stopOpacity='0' />
                            <stop offset={(hab[0] + HAB_SOFT) / (hab[1] + HAB_SOFT)} stopColor={HAB_COLOR} stopOpacity='1' />
                            <stop offset={Math.max(hab[0] + HAB_SOFT, hab[1] - HAB_SOFT) / (hab[1] + HAB_SOFT)} stopColor={HAB_COLOR} stopOpacity='1' />
                            <stop offset='1' stopColor={HAB_COLOR} stopOpacity='0' />
                        </radialGradient>
                    )}
                    {star && (
                        <radialGradient id='galaxy-star-glow' gradientUnits='userSpaceOnUse' cx={c.x} cy={c.y} r={starPx + STAR_GLOW}>
                            <stop offset={(starPx - 2) / (starPx + STAR_GLOW)} stopColor={bodyColor(star)} stopOpacity='0.75' />
                            <stop offset={(starPx + STAR_GLOW * 0.4) / (starPx + STAR_GLOW)} stopColor={bodyColor(star)} stopOpacity='0.22' />
                            <stop offset='1' stopColor={bodyColor(star)} stopOpacity='0' />
                        </radialGradient>
                    )}
                    {glowStars.map((b) => (
                        <radialGradient key={b.id} id={`galaxy-glow-${b.id}`}>
                            <stop offset='0.45' stopColor={bodyColor(b)} stopOpacity='0.7' />
                            <stop offset='0.65' stopColor={bodyColor(b)} stopOpacity='0.2' />
                            <stop offset='1' stopColor={bodyColor(b)} stopOpacity='0' />
                        </radialGradient>
                    ))}
                </defs>
                {hab && <circle cx={c.x} cy={c.y} r={hab[1] + HAB_SOFT} fill='url(#galaxy-hab-zone)' className={styles.habZone} />}
                {star && (
                    <g className={cx(styles.orb, selBodyId === star.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(star.id))} onDoubleClick={() => onEdit(star.id)}>
                        {star.type === 'black_hole' && <circle cx={c.x} cy={c.y} r={starPx + 10} fill='none' stroke='#f0b44c' strokeWidth='5' opacity='.7' />}
                        <circle cx={c.x} cy={c.y} r={starPx + STAR_GLOW} fill='url(#galaxy-star-glow)' className={styles.starGlow} />
                        <circle cx={c.x} cy={c.y} r={starPx} fill={bodyColor(star)} />
                        {inline ? (
                            <text x={c.x - starPx - 12} y={c.y + 22} textAnchor='end' className={styles.starName}>{star.name}</text>
                        ) : (
                            <text x={c.x} y={c.y + starPx + 20} textAnchor='middle' className={styles.starName}>{star.name}</text>
                        )}
                    </g>
                )}
                {root && core.length > 0 && (
                    // A pair of stars at the center: the barycenter's mark, and its stars going round it opposite each other
                    <g className={cx(styles.orb, selBodyId === root.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(root.id))} onDoubleClick={() => onEdit(root.id)}>
                        {/* One ring round the whole pair (and the pair's hit area), then the path the stars share and the barycenter's mark */}
                        <circle cx={c.x} cy={c.y} r={starPx + 6} className={styles.pairRing} />
                        <circle cx={c.x} cy={c.y} r={coreR} className={styles.orbitLine} style={{ pointerEvents: 'none' }} />
                        <path d={`M${c.x - 4} ${c.y}h8M${c.x} ${c.y - 4}v8`} stroke='currentColor' strokeWidth='1.2' opacity='0.6' pointerEvents='none' />
                        {core.map((k, j) => {
                            const at = j * ((2 * Math.PI) / core.length) + angle(place.id, 0);
                            const px = k.kind === 'star' ? typePx(k) * 0.8 : 10;
                            return partner(
                                k,
                                mover(`core${k.id}`, inline ? held(c.x, c.y, coreR, Math.PI + at) : round(c.x, c.y, coreR, at, PAIR_SECONDS)),
                                k.kind === 'star' ? starDisc(k, 0, 0, px, `galaxy-glow-${k.id}`) : <g transform='translate(-8 -8)'><BodyIcon body={k} size={16} /></g>,
                            );
                        })}
                        {inline ? (
                            <text x={c.x - starPx - 12} y={c.y + 22} textAnchor='end' className={styles.starName}>{root.name}</text>
                        ) : (
                            <text x={c.x} y={c.y + starPx + 20} textAnchor='middle' className={styles.starName}>{root.name}</text>
                        )}
                    </g>
                )}
                {rings.map((ring) => {
                    const { r, index: i } = ring;
                    const p = ring.planet;
                    if (ring.companion) {
                        // A companion star on its orbit, carrying what circles it in rings of its own
                        const b = ring.companion;
                        const { pair, px, sats } = companionParts(b);
                        return (
                            <g key={b.id} className={cx(styles.orb, selBodyId === b.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(b.id))} onDoubleClick={() => onEdit(b.id)}>
                                <circle cx={c.x} cy={c.y} r={r} className={styles.orbitLine} style={{ stroke: bodyColor(pair[0] ?? b), strokeDasharray: '2 4' }} />
                                <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} />
                              <g className={styles.mover} {...mover(`companion${b.id}`, inline ? held(c.x, c.y, r, Math.PI / 2) : round(c.x, c.y, r, angle(place.id, i + 50), companionYear(b)))}>
                                {b.kind === 'star' ? (
                                    starDisc(b, 0, 0, px, `galaxy-glow-${b.id}`)
                                ) : (
                                    <>
                                        <circle cx={0} cy={0} r={px + 4} className={styles.pairRing} />
                                        {pair.map((k, j) =>
                                            partner(
                                                k,
                                                mover(`pair${k.id}`, inline ? held(0, 0, px / 2, j * Math.PI) : round(0, 0, px / 2, j * ((2 * Math.PI) / pair.length), PAIR_SECONDS)),
                                                k.kind === 'star' ? starDisc(k, 0, 0, Math.max(3, typePx(k) * COMPANION_SCALE * 0.6), `galaxy-glow-${k.id}`) : <g transform='translate(-6 -6)'><BodyIcon body={k} size={12} /></g>,
                                            ),
                                        )}
                                    </>
                                )}
                                {sats.map((m, j) => {
                                    const sr = px + SAT_GAP * (j + 1);
                                    const on = selBodyId === m.id;
                                    if (m.kind === 'belt') {
                                        return (
                                            <g key={m.id} className={cx(styles.orb, on && styles.orbSelected)} style={{ color: bodyColor(m) }} onClick={(e) => (e.stopPropagation(), onSelect(m.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(m.id))}>
                                                <circle cx={0} cy={0} r={sr} className={styles.ringBand} strokeDasharray='1 3' />
                                                <circle cx={0} cy={0} r={sr} className={styles.orbitHit} style={{ strokeWidth: SAT_GAP * 0.8 }} />
                                            </g>
                                        );
                                    }
                                    const dot = Math.min(m.kind === 'barycenter' ? 6 : bodyPx(m), SAT_GAP / 2);
                                    return (
                                        <g key={m.id} className={cx(styles.orb, on && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(m.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(m.id))}>
                                            <circle cx={0} cy={0} r={sr} className={styles.orbitLine} style={m.kind === 'planet' ? { stroke: zoneOf(m.orbit, hostOf(place.bodies, b) ?? 'sunlike').color } : undefined} />
                                            <circle cx={0} cy={0} r={sr} className={styles.orbitHit} style={{ strokeWidth: SAT_GAP * 0.8 }} />
                                          <g className={styles.mover} {...mover(`sat${m.id}`, inline ? held(0, 0, sr, 0) : round(0, 0, sr, angle(b.id, j + 1), satYear(m, j)))}>
                                            {m.kind === 'station' ? (
                                                <rect x={-3} y={-3} width='6' height='6' fill={bodyColor(m)} transform='rotate(45)' />
                                            ) : m.kind === 'barycenter' ? (
                                                <g transform='translate(-6 -6)'><BodyIcon body={m} size={12} /></g>
                                            ) : (
                                                <>
                                                    <circle cx={0} cy={0} r={dot} fill={bodyColor(m)} />
                                                    <BodyTexture body={m} x={0} y={0} r={dot} />
                                                </>
                                            )}
                                          </g>
                                        </g>
                                    );
                                })}
                                {inline ? (
                                    <text x={-px - sats.length * SAT_GAP - 10} y={5} textAnchor='end' className={styles.starName}>{b.name}</text>
                                ) : (
                                    <text x={0} y={-px - 8 - sats.length * SAT_GAP} textAnchor='middle' className={styles.starName}>{b.name}</text>
                                )}
                              </g>
                            </g>
                        );
                    }
                    if (ring.belt) {
                        // A band as wide as the belt is (within the room it was given), with lanes of dots in it
                        const b = ring.belt;
                        const band = Math.max(8, Math.min(BELT_REACH * 2 - 2, auToPx(b.orbit + (b.width ?? 0) / 2) - auToPx(b.orbit - (b.width ?? 0) / 2)));
                        return (
                            <g key={b.id} className={cx(styles.orb, styles.belt, selBodyId === b.id && styles.orbSelected)} style={{ color: bodyColor(b) }} onClick={(e) => (e.stopPropagation(), onSelect(b.id))} onDoubleClick={() => onEdit(b.id)}>
                                <circle cx={c.x} cy={c.y} r={r} className={styles.beltBand} style={{ strokeWidth: band }} />
                                {BELT_LANES.map((lane) => (
                                    <circle key={lane.at} cx={c.x} cy={c.y} r={r + lane.at * band} className={styles.beltDots} strokeDasharray={`0.1 ${lane.gap}`} transform={`rotate(${lane.gap * 20} ${c.x} ${c.y})`} />
                                ))}
                                <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} style={{ strokeWidth: band + 4 }} />
                                <text x={c.x} y={c.y + r + 4} textAnchor='middle' className={styles.beltName}>{b.name}</text>
                            </g>
                        );
                    }
                    if (!p) {
                        // Labelled at the top of its ring, where "+ add a planet" is, and holding still
                        return (
                            <g key={`gap${ring.n}`} className={styles.addRing} onClick={(e) => (e.stopPropagation(), onAdd?.({ ordinal: ring.n, orbit: ring.orbit }))}>
                                <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} style={{ strokeWidth: GAP_REACH * 1.6 }} />
                                <circle cx={c.x} cy={c.y} r={r} />
                                <title>Add {stem}-{ring.n}</title>
                                {/* Squeezed rings (a phone) have no room for a label each */}
                                {over <= 1.5 && <text x={c.x} y={inline ? c.y + r + 4 : c.y - r + 4} textAnchor='middle'>+ add {stem}-{ring.n}</text>}
                            </g>
                        );
                    }
                    // The planet and all that goes round it are drawn about (0, 0) and carried along its orbit
                    const [bx, by] = [0, 0];
                    const pr = ring.px;
                    const zone = host ? zoneOf(p.orbit, host) : ZONES[2];
                    // A pair of planets: its two discs go round the slot's center, each with its own rings; what circles both is ringed round the center
                    const { pair, kids, partPx, pairR, inner } = slotParts(p, pr);
                    return (
                        <g key={p.id} className={cx(styles.orb, selBodyId === p.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(p.id))} onDoubleClick={() => onEdit(p.id)}>
                            <circle cx={c.x} cy={c.y} r={r} className={styles.orbitLine} style={{ stroke: zone.color }} />
                            <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} />
                          <g className={styles.mover} {...mover(`planet${p.id}`, inline ? held(c.x, c.y, r, Math.PI / 2) : round(c.x, c.y, r, angle(place.id, i), planetYear(i)))}>
                            {pair.length === 0 ? (
                                <>
                                    <circle cx={bx} cy={by} r={pr} fill={bodyColor(p)} />
                                    <BodyTexture body={p} x={bx} y={by} r={pr} />
                                    <circle cx={bx} cy={by} r={pr} className={styles.shade} />
                                </>
                            ) : (
                                <>
                                    <circle cx={0} cy={0} r={inner + 3} className={styles.pairRing} />
                                    {pair.map((k, j) => {
                                        const kr = partPx(k);
                                        return partner(
                                            k,
                                            mover(`pair${k.id}`, inline ? held(0, 0, pairR, j * Math.PI) : round(0, 0, pairR, j * ((2 * Math.PI) / pair.length), PAIR_SECONDS / 2)),
                                            <>
                                                <circle cx={0} cy={0} r={kr} fill={bodyColor(k)} className={styles.partDisc} />
                                                <BodyTexture body={k} x={0} y={0} r={kr} />
                                                <circle cx={0} cy={0} r={kr} className={styles.shade} />
                                                {/* This planet's own moons, rings and stations, close round its disc and travelling with it */}
                                                {kidsOf(k.id).map((m, mi) => {
                                                    const sr = kr + PART_GAP * (mi + 1);
                                                    const pick = (e: React.MouseEvent) => (e.stopPropagation(), onSelect(m.id));
                                                    const open = (e: React.MouseEvent) => (e.stopPropagation(), onEdit(m.id));
                                                    if (m.kind === 'belt') {
                                                        return (
                                                            <g key={m.id} className={cx(styles.orb, selBodyId === m.id && styles.orbSelected)} style={{ color: bodyColor(m) }} onClick={pick} onDoubleClick={open}>
                                                                <circle cx={0} cy={0} r={sr} className={styles.ringBand} style={{ strokeWidth: 1.5 }} />
                                                                <circle cx={0} cy={0} r={sr} className={styles.orbitHit} style={{ strokeWidth: PART_GAP }} />
                                                            </g>
                                                        );
                                                    }
                                                    return (
                                                        <g key={m.id} className={cx(styles.orb, selBodyId === m.id && styles.orbSelected)} onClick={pick} onDoubleClick={open}>
                                                            <circle cx={0} cy={0} r={sr} className={styles.orbitLine} />
                                                            <circle cx={0} cy={0} r={sr} className={styles.orbitHit} style={{ strokeWidth: PART_GAP }} />
                                                          <g className={styles.mover} {...mover(`partsat${m.id}`, inline ? held(0, 0, sr, 0) : round(0, 0, sr, angle(k.id, mi + 1), moonMonth(m)))}>
                                                            {m.kind === 'station' ? <rect x={-1.6} y={-1.6} width='3.2' height='3.2' fill={bodyColor(m)} transform='rotate(45)' /> : <circle cx={0} cy={0} r={1.8} fill={bodyColor(m)} />}
                                                          </g>
                                                        </g>
                                                    );
                                                })}
                                            </>,
                                        );
                                    })}
                                </>
                            )}
                            {/* In line the names go beside the bodies, not over and under them, where the next orbits are: the planet's on the left, its moons' on the right */}
                            {inline ? (
                                <text x={bx - inner - kids.length * MOON_GAP - 10} y={by + 5} textAnchor='end'>{pair.length ? pair.map((k) => k.name).join(' & ') : p.name}</text>
                            ) : (
                                <text x={bx} y={by - inner - 8 - kids.length * MOON_GAP} textAnchor='middle'>{pair.length ? pair.map((k) => k.name).join(' & ') : p.name}</text>
                            )}
                            {kids.map((m, j) => {
                                const mr = inner + MOON_GAP * (j + 1);
                                const [mx, my] = [0, 0];
                                const on = selBodyId === m.id;
                                const moonPx = Math.min(bodyPx(m), MOON_GAP / 2);
                                if (m.kind === 'belt') {
                                    // A ring: a band round the planet in place of an orbit and a dot
                                    return (
                                        <g key={m.id} className={cx(styles.orb, on && styles.orbSelected)} style={{ color: bodyColor(m) }} onClick={(e) => (e.stopPropagation(), onSelect(m.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(m.id))}>
                                            <circle cx={bx} cy={by} r={mr} className={styles.ringBand} />
                                            <circle cx={bx} cy={by} r={mr} className={styles.orbitHit} style={{ strokeWidth: MOON_GAP * 0.8 }} />
                                        </g>
                                    );
                                }
                                // Rings carry no name in the drawing, so the names below skip them
                                const row = kids.slice(0, j).filter((kid) => kid.kind !== 'belt').length;
                                const rows = kids.filter((kid) => kid.kind !== 'belt').length;
                                return (
                                    <g key={m.id} className={cx(styles.orb, on && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(m.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(m.id))}>
                                        <circle cx={bx} cy={by} r={mr} className={styles.orbitLine} />
                                        <circle cx={bx} cy={by} r={mr} className={styles.orbitHit} style={{ strokeWidth: MOON_GAP * 0.8 }} />
                                      <g className={styles.mover} {...mover(`moon${m.id}`, inline ? held(0, 0, mr, 0) : round(0, 0, mr, angle(p.id, j + 1), moonMonth(m)))}>
                                        {m.kind === 'station' ? (
                                            <rect x={mx - 3} y={my - 3} width='6' height='6' fill={bodyColor(m)} transform={`rotate(45 ${mx} ${my})`} />
                                        ) : (
                                            <>
                                                <circle cx={mx} cy={my} r={moonPx} fill={bodyColor(m)} />
                                                <BodyTexture body={m} x={mx} y={my} r={moonPx} />
                                                {/* A moon's own rings: a thin band round its dot */}
                                                {place.bodies.filter((b) => b.kind === 'belt' && b.parentId === m.id).slice(0, 1).map((b) => (
                                                    <circle key={b.id} cx={mx} cy={my} r={moonPx + 2.5} className={styles.ringBand} style={{ color: bodyColor(b), strokeWidth: 1.5 }} />
                                                ))}
                                            </>
                                        )}
                                      </g>
                                        {inline ? (
                                            <text x={bx + inner + MOON_GAP * kids.length + 10} y={by + 4 + (row - (rows - 1) / 2) * 13} textAnchor='start' className={cx(styles.moonName, on && styles.moonNameOn)}>{m.name}</text>
                                        ) : (
                                            <text x={bx} y={by + inner + MOON_GAP * kids.length + 14 + row * 13} textAnchor='middle' className={cx(styles.moonName, on && styles.moonNameOn)}>{m.name}</text>
                                        )}
                                    </g>
                                );
                            })}
                          </g>
                        </g>
                    );
                })}
                {onAdd && (
                    <g className={styles.addRing} onClick={(e) => (e.stopPropagation(), onAdd())}>
                        <circle cx={c.x} cy={c.y} r={addR} className={styles.orbitHit} />
                        <circle cx={c.x} cy={c.y} r={addR} />
                        <text x={c.x} y={inline ? c.y + addR + 16 : c.y - addR - 7} textAnchor='middle'>+ add a planet</text>
                    </g>
                )}
              </g>
            </svg>
            {!inline && <button type='button' className={cx(styles.iconBtn, styles.sysMotion)} onClick={() => onMoving(!moving)} title={moving ? 'Pause the orbits' : 'Set the orbits moving'} aria-label={moving ? 'Pause the orbits' : 'Set the orbits moving'} aria-pressed={moving}>
                <svg width='14' height='14' viewBox='0 0 14 14' fill='currentColor' aria-hidden>
                    {moving ? <path d='M2 1H6V13H2ZM8 1H12V13H8Z' /> : <path d='M2 1L13 7L2 13Z' />}
                </svg>
            </button>}
            {host && !host.hole && (
                <div className={styles.sysLegend}>
                    {ZONES.map((z) => (
                        <span key={z.key}><i style={{ background: z.color }} />{z.label}</span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------- Telemetry ----------
function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className={styles.trow}>
            <span className={styles.tk}>{label}</span>
            <span className={styles.tleader} aria-hidden />
            <span className={styles.tv}>{value}</span>
        </div>
    );
}

function Meter({ score }: { score: number }) {
    const lit = Math.round((score / 100) * 8);
    return (
        <div className={styles.trow}>
            <span className={styles.tk}>Habitability</span>
            <span className={styles.meter} role='img' aria-label={`Habitability ${score} percent`}>
                {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} className={cx(i < lit && (i === 0 ? styles.meterLow : i < 4 ? styles.meterMid : styles.meterHigh))} />
                ))}
            </span>
            <span className={styles.tv}>{score}%</span>
        </div>
    );
}

function Telemetry({ place, body }: { place: Place; body: Body }) {
    const host = hostOf(place.bodies, body);
    const parent = place.bodies.find((b) => b.id === body.parentId);
    const unit = unitOf(place.bodies, body);
    const around = place.bodies.filter((b) => b.parentId === body.id);
    if (body.kind === 'star' || (body.kind === 'barycenter' && body.type === 'stars')) {
        const type = STAR_TYPES[body.type];
        const lum = lumOf(place.bodies, body);
        return (
            <div className={styles.telemetry}>
                <Row label='Kind' value={body.kind === 'star' ? (type?.label ?? 'Star') : 'Pair of stars'} />
                {body.kind === 'barycenter' && <Row label='The pair' value={pairOf(place, body)} />}
                {lum > 0 && <Row label='Brightness' value={lum >= 0.95 && lum <= 1.05 ? 'like the Sun' : `${fmtNum(lum)} times the Sun`} />}
                <Row label='Mass' value={`${fmtNum(massOf(place.bodies, body))} Suns`} />
                {parent && <Row label='Orbits' value={`${parent.name} at ${fmtNum(body.orbit)} AU`} />}
                {host && !host.hole && <Row label='Temperate orbit' value={`about ${fmtNum(habAU(host) * 1.1)} AU out`} />}
                <Row label='Planets' value={around.filter(isSlot).length} />
                {around.some(isStarry) && <Row label='Companion stars' value={around.filter((b) => isStarry(b) && !componentsOf(place.bodies, body).includes(b)).length} />}
                <Row label='Belts' value={around.filter((b) => b.kind === 'belt').length} />
            </div>
        );
    }
    if (body.kind === 'barycenter') {
        return (
            <div className={styles.telemetry}>
                <Row label='Kind' value='Pair of planets' />
                <Row label='The pair' value={pairOf(place, body)} />
                <Row label='Mass' value={`${fmtNum(massOf(place.bodies, body))} Earths`} />
                <Row label='Orbits' value={`${parent?.name ?? 'nothing'} at ${fmtNum(body.orbit)} AU`} />
                {host && (
                    <>
                        <Row label='Year' value={`${fmtNum(yearDays(body.orbit, host))} equinoxes`} />
                        {!host.hole && <Row label='Climate' value={`${zoneOf(body.orbit, host).label} orbit`} />}
                    </>
                )}
                <Row label='Moons and stations' value={around.filter((b) => b.kind === 'moon' || b.kind === 'station').length} />
            </div>
        );
    }
    if (body.kind === 'belt') {
        const width = body.width ?? 0;
        return (
            <div className={styles.telemetry}>
                <Row label='Made of' value={body.type === 'rocky' ? 'Rock' : (COMPOSITIONS[body.type]?.label ?? 'Unknown')} />
                <Row label='Circles' value={`${parent?.name ?? 'nothing'} at ${fmtNum(body.orbit)} ${unit}`} />
                <Row label='Width' value={`${fmtNum(width)} ${unit}`} />
                <Row label='Reaches' value={`${fmtNum(body.orbit - width / 2)} to ${fmtNum(body.orbit + width / 2)} ${unit}`} />
                {!body.ring && host && (
                    <>
                        <Row label='Year' value={`${fmtNum(yearDays(body.orbit, host))} equinoxes`} />
                        {!host.hole && <Row label='Climate' value={`${zoneOf(body.orbit, host).label} orbit`} />}
                    </>
                )}
            </div>
        );
    }
    const hab = habitability(place, body);
    const au = orbitAU(place.bodies, body);
    return (
        <div className={styles.telemetry}>
            <Row label='Type' value={COMPOSITIONS[body.type]?.label ?? 'Unknown'} />
            <Row label='Size' value={`${describeSize(body.radiusKm)} (${fmtNum(body.radiusKm)} km)`} />
            <Row label='Orbits' value={`${parent?.name ?? 'nothing'}${unit === 'AU' ? ` at ${fmtNum(body.orbit)} AU` : `, ${fmtNum(body.orbit)} km out`}`} />
            {body.kind !== 'station' && <Row label='Gravity' value={`about ${fmtNum(gravityG(body))} g`} />}
            {body.kind !== 'station' && <Row label='Mass' value={`${fmtNum(massEarths(body))} Earths`} />}
            {body.kind === 'planet' && host && (
                <>
                    <Row label='Year' value={`${fmtNum(yearDays(au, host))} equinoxes`} />
                    {!host.hole && <Row label='Climate' value={`${zoneOf(au, host).label} orbit`} />}
                </>
            )}
            {body.kind !== 'planet' && <Row label='Bodies around it' value={around.length} />}
            {hab !== null && <Meter score={hab} />}
        </div>
    );
}

// ---------- The view ----------
export default function SystemView({ store, place, onAdd }: { store: Store; place: Place; onAdd: (slot?: PlanetSlot, kind?: CreateKind) => void }) {
    const [editing, setEditing] = useState(false);
    // Phones: the panels are one sheet over the foot of the diagram, folded down to its crumbs until asked for
    const [sheet, setSheet] = useState(false);
    const body = store.selBody;
    const root = primaryOf(place);
    const mine = store.canEdit(place);
    const planets = place.bodies.filter((b) => b.kind === 'planet');
    // One of a pair already, or the kind that cannot be one
    const pairable = body && (body.kind === 'star' || body.kind === 'planet') && !place.bodies.some((b) => b.id === body.parentId && b.kind === 'barycenter' && (body.kind === 'star' ? b.type === 'stars' : b.type === 'planets'));

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select')) store.closeSystem();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // The add buttons for what is picked; none (nothing picked, a belt or a station) leaves just "+ Add"
    const shortcuts: { label: string; kind: CreateKind }[] = !body
        ? []
        : isStarry(body)
          ? [{ label: '+ Planet', kind: 'planet' }, ...(pairable ? [{ label: 'Make it a pair', kind: 'pair' as const }] : [])]
          : isSlot(body)
            ? [{ label: '+ Moon', kind: 'moon' }, ...(pairable ? [{ label: 'Make it a pair', kind: 'pair' as const }] : [])]
            : body.kind === 'moon'
              ? [{ label: '+ Ring', kind: 'belt' }]
              : [];
    // A planet goes round the star (or pair of stars) that is picked, else round the primary
    const addPlanet = (slot?: PlanetSlot) => {
        store.select(place.id, !slot && body && isStarry(body) ? body.id : null);
        onAdd(slot);
    };

    return (
        <div className={styles.sys}>
            <SystemDiagram place={place} selBodyId={body?.id ?? null} onSelect={(id) => (setEditing(false), store.select(place.id, id))} onEdit={(id) => (store.select(place.id, id), setEditing(mine), setSheet(true))} onAdd={mine ? addPlanet : undefined} moving={store.motion} onMoving={store.setMotion} />
            <aside className={cx(styles.sysPanels, !sheet && styles.sysShut)}>
              <div className={cx('pixel-panel', styles.sysCard)}>
                <nav className={styles.crumbs} aria-label='Where you are'>
                    <button type='button' onClick={store.closeSystem}>Galaxy</button>
                    <span aria-hidden>&gt;</span>
                    {body ? <button type='button' onClick={() => store.select(place.id)}>{placeTitle(place)}</button> : <b>{placeTitle(place)}</b>}
                    {body && (
                        <>
                            <span aria-hidden>&gt;</span>
                            <b>{body.name}</b>
                        </>
                    )}
                    <button type='button' className={styles.sysToggle} onClick={() => setSheet(!sheet)} aria-expanded={sheet} aria-label={sheet ? 'Fold the details away' : 'Show the details'}>
                        <svg viewBox='0 0 24 12' width='24' height='12' aria-hidden><path d={sheet ? 'M2 2l10 8 10-8' : 'M2 10l10-8 10 8'} fill='none' stroke='currentColor' strokeWidth='2.5' /></svg>
                    </button>
                </nav>

                <section className={styles.sysSection}>
                    <h4 className='pixel-label'>Bodies</h4>
                    <BodyTree place={place} selBodyId={body?.id ?? null} onPick={(id) => (setEditing(false), store.select(place.id, id))} onOpen={(id) => (store.select(place.id, id), setEditing(mine))} />
                    {mine && (
                        <div className={cx(styles.actions, styles.sysAdd)}>
                            {/* Only what fits the selection: nothing picked (or a belt or station) opens the add modal with no kind chosen */}
                            {shortcuts.length === 0 && <button type='button' className={styles.btnQuiet} onClick={() => (store.select(place.id, null), onAdd())}>+ Add</button>}
                            {shortcuts.map(({ label, kind }) => (
                                <button key={label} type='button' className={styles.btnQuiet} onClick={() => onAdd(undefined, kind)}>{label}</button>
                            ))}
                        </div>
                    )}
                </section>
              </div>

              <div className={cx('pixel-panel', styles.sysCard)}>
                {body ? (
                    <section className={styles.sysSection}>
                        <header className={styles.detailHead}>
                            <BodyPortrait body={body} />
                            <div>
                                <h3><BodyName body={body} paren /></h3>
                                <p className='pixel-label'>{`${kindLabel(body)} ${designation(body)}`.trim()}</p>
                            </div>
                        </header>
                        {!(editing && mine) && <Writeup of={body} />}
                        {editing && mine ? (
                          <>
                            <TextFields key={body.id} store={store} place={place} body={body} />
                            <BodyFields kind={body.kind} draft={body} starType={hostOf(place.bodies, body) ?? 'sunlike'} system={place} selfId={body.id} planet={place.bodies.find((b) => b.id === body.parentId && isSlot(b))} primary={place.bodies.find((b) => b.id === body.parentId)} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
                          </>
                        ) : (
                            <Telemetry place={place} body={body} />
                        )}
                        {mine && (
                            <div className={styles.actions}>
                                <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                                {body.parentId !== null && <DeleteButton onDelete={() => store.removeBody(place.id, body.id)} />}
                            </div>
                        )}
                        <Travelogue store={store} place={place} body={body} />
                    </section>
                ) : (
                    <section className={styles.sysSection}>
                        <header className={styles.detailHead}>
                            <SystemDot place={place} />
                            <div>
                                <h3>{placeTitle(place)}</h3>
                                <p className='pixel-label'>{place.placeholder ? 'System, star not named yet' : 'System'}</p>
                            </div>
                        </header>
                        {editing && mine ? <TextFields key={place.id} store={store} place={place} body={null} /> : <Writeup of={place} />}
                        {place.placeholder && mine && !editing && <RenameRow store={store} place={place} />}
                        <div className={styles.telemetry}>
                            <Row label='Region' value={regionLabel(place)} />
                            <Row label='Position' value={place.precision === 'region' ? 'not pinned down' : sectorOf(place.pos)} />
                            <Row label={root?.kind === 'barycenter' ? 'Stars' : 'Star'} value={root?.kind === 'barycenter' ? pairOf(place, root) : (STAR_TYPES[root?.type ?? '']?.label ?? 'none')} />
                            {place.bodies.filter((b) => b.kind === 'star').length > 1 && <Row label='Stars in all' value={place.bodies.filter((b) => b.kind === 'star').length} />}
                            <Row label='Planets' value={planets.length} />
                            <Row label='Moons and stations' value={place.bodies.filter((b) => b.kind === 'moon' || b.kind === 'station').length} />
                            <Row label='Belts and rings' value={place.bodies.filter((b) => b.kind === 'belt').length} />
                            <Row label='Added by' value={place.owner.username} />
                        </div>
                        {mine && (
                            <div className={styles.actions}>
                                <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                            </div>
                        )}
                        <Travelogue store={store} place={place} body={null} />
                    </section>
                )}
              </div>
            </aside>
        </div>
    );
}
