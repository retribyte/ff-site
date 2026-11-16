'use client';

// The full-screen view of one system: floating panels (bodies, telemetry for the
// selection, travelogue) over a diagram of the whole system, after Space Builder's
// system console.

import { useEffect, useRef, useState } from 'react';
import {
    COMPOSITIONS, STAR_TYPES, ZONES,
    bodyColor, describeSize, fmtNum, gravityG, habAU, habitability, massEarths, regionLabel, sectorOf, starOf, yearDays, zoneOf,
} from './data';
import type { Body, Place } from './data';
import { BodyFields, BodyName, BodyPortrait, BodyTexture, BodyTree, DeleteButton, KIND_LABEL, designation, RenameRow, TextFields, Travelogue, Writeup, placeTitle } from './parts';
import type { PlanetSlot } from './parts';
import type { Store } from './store';
import styles from './galaxy.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// ---------- Diagram ----------
// Not to scale, but sizes and distances keep their order of magnitude: both go
// through a logarithm, as Space Builder's diagram did.
const LOG_SIZE = 1 / Math.log(1.25);
const bodyPx = (b: Body) => Math.max(b.kind === 'planet' ? 4 : 2.2, Math.min(26, Math.log(Math.max(b.radiusKm, 1) / 1000) * LOG_SIZE));
const MOON_GAP = 11;
/** Room an open planet number's ring takes on each side. */
const GAP_REACH = 11;

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
    const boxRef = useRef(box);
    useEffect(() => {
        boxRef.current = box;
    });
    const fit = (c: { k: number; x: number; y: number }, b = boxRef.current) => {
        const k = Math.max(1, Math.min(MAX_ZOOM, c.k));
        return { k, x: Math.min(0, Math.max(b.w * (1 - k), c.x)), y: Math.min(0, Math.max(b.h * (1 - k), c.y)) };
    };
    /** Zooms by `factor`, keeping the point (px, py) of the view where it is, then slides by (dx, dy). */
    const zoomAt = (px: number, py: number, factor: number, dx = 0, dy = 0) =>
        setCam((c) => {
            const k = Math.max(1, Math.min(MAX_ZOOM, c.k * factor));
            const f = k / c.k;
            return fit({ k, x: px - (px - c.x) * f + dx, y: py - (py - c.y) * f + dy });
        });
    useEffect(() => {
        const svg = svgRef.current!;
        // Not passive: the wheel zooms the diagram, it must not scroll the page
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const r = svg.getBoundingClientRect();
            const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
            const [px, py] = [e.clientX - r.left, e.clientY - r.top];
            setCam((c) => {
                const k = Math.max(1, Math.min(MAX_ZOOM, c.k * factor));
                const f = k / c.k;
                const b = boxRef.current;
                return { k, x: Math.min(0, Math.max(b.w * (1 - k), px - (px - c.x) * f)), y: Math.min(0, Math.max(b.h * (1 - k), py - (py - c.y) * f)) };
            });
        };
        svg.addEventListener('wheel', onWheel, { passive: false });
        return () => svg.removeEventListener('wheel', onWheel);
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
        if (!was) return;
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

    // The orbits' clock, in seconds; it only runs while the bodies are moving, so a pause leaves them where they are
    const [time, setTime] = useState(0);
    useEffect(() => {
        if (!moving) return;
        let last = performance.now();
        let raf = requestAnimationFrame(function step(now) {
            setTime((t) => t + Math.min(0.1, (now - last) / 5000));
            last = now;
            raf = requestAnimationFrame(step);
        });
        return () => cancelAnimationFrame(raf);
    }, [moving]);

    const star = starOf(place);
    const planets = place.bodies.filter((b) => b.kind === 'planet').sort((a, b) => a.orbit - b.orbit);
    const { w: W, h: Hh } = box;
    // Fitted again here, in case the window shrank since the last zoom
    const view = fit(cam, box);
    // On a wide screen the panels cover the left edge, so the star sits right of center.
    const inset = W > 900 ? 400 : 0;
    const c = { x: inset + (W - inset) / 2, y: Hh / 2 };
    const starPx = (STAR_TYPES[star?.type ?? '']?.px ?? 24) * 1.25;
    const maxR = Math.min(W - inset, Hh) / 2 - 40;
    const kidsOf = (id: number) => place.bodies.filter((b) => b.parentId === id).sort((x, y) => x.orbit - y.orbit);
    // How much room a planet needs around its own center (its moons' rings included).
    const reach = (p: Body) => bodyPx(p) + kidsOf(p.id).length * MOON_GAP + 6;
    const base = starPx + 14;
    const room = maxR - base - (onAdd ? 34 : 0);
    const farthest = Math.log((planets[planets.length - 1]?.orbit ?? 1) + 1);
    const k = Math.min(150, room / Math.max(farthest, 0.2));
    // Every ring from the star outward: the planets and, for whoever may add, the open
    // numbers inside a planet that is "planet N" (spread evenly, in log distance,
    // between its neighbours).
    const rings: { planet?: Body; index: number; n: number; orbit: number; reach: number; r: number }[] = [];
    planets.forEach((p, i) => {
        const before = planets[i - 1];
        const gaps = onAdd ? p.num - (before?.num ?? 0) - 1 : 0;
        const from = before?.orbit ?? p.orbit / 2 ** (gaps + 1);
        for (let g = 1; g <= gaps; g++) rings.push({ index: i, n: (before?.num ?? 0) + g, orbit: from * (p.orbit / from) ** (g / (gaps + 1)), reach: GAP_REACH, r: 0 });
        rings.push({ planet: p, index: i, n: p.num, orbit: p.orbit, reach: reach(p), r: 0 });
    });
    // Log distance, then pushed outward wherever two rings would overlap.
    rings.forEach((ring, i) => {
        const want = base + Math.log(ring.orbit + 1) * k;
        ring.r = Math.max(want, i === 0 ? base + ring.reach : rings[i - 1].r + rings[i - 1].reach + ring.reach);
    });
    const last = rings[rings.length - 1];
    const over = Math.max(1, last ? (last.r - base) / Math.max(room, 1) : 0);
    for (const ring of rings) ring.r = base + (ring.r - base) / over;
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
    const hab = star && star.type !== 'black_hole' ? [auToPx(habAU(star.type) * 0.9), auToPx(habAU(star.type) * 1.6)] : null;
    const stem = star && !star.unnamed ? star.name : 'Unnamed';
    // Spread around the star by the golden angle, starting somewhere that differs per system.
    const angle = (id: number, index: number) => (((id * 137) % 360) * Math.PI) / 180 + index * 2.39996;
    // Where each is now: counterclockwise, the nearer the faster (Kepler's periods, with the square root taken so the far ones still move)
    const turned = (seconds: number) => (-time * 2 * Math.PI) / seconds;
    const planetAngle = (index: number) => angle(place.id, index) + turned(YEAR_SECONDS * Math.sqrt(yearDays(planets[index].orbit, star?.type ?? 'sunlike') / 365.25));
    const moonAngle = (planet: Body, m: Body, j: number) => angle(planet.id, j + 1) + turned(Math.max(3, Math.min(24, MONTH_SECONDS * Math.sqrt(m.orbit / 384400))));

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
                aria-label={`Diagram of the ${placeTitle(place)}: ${planets.map((p) => p.name).join(', ') || 'no planets yet'}`}
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {hab && <circle cx={c.x} cy={c.y} r={(hab[0] + hab[1]) / 2} strokeWidth={hab[1] - hab[0]} className={styles.habZone} />}
                {star && (
                    <g className={cx(styles.orb, selBodyId === star.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(star.id))} onDoubleClick={() => onEdit(star.id)}>
                        {star.type === 'black_hole' && <circle cx={c.x} cy={c.y} r={starPx + 10} fill='none' stroke='#f0b44c' strokeWidth='5' opacity='.7' />}
                        <circle cx={c.x} cy={c.y} r={starPx} fill={bodyColor(star)} className={styles.starGlow} style={{ color: bodyColor(star) }} />
                        <text x={c.x} y={c.y + starPx + 20} textAnchor='middle' className={styles.starName}>{star.name}</text>
                    </g>
                )}
                {rings.map((ring) => {
                    const { r, index: i } = ring;
                    const p = ring.planet;
                    if (!p) {
                        // Labelled at the top of its ring, where "+ add a planet" is, and holding still
                        return (
                            <g key={`gap${ring.n}`} className={styles.addRing} onClick={(e) => (e.stopPropagation(), onAdd?.({ ordinal: ring.n, orbit: ring.orbit }))}>
                                <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} style={{ strokeWidth: GAP_REACH * 1.6 }} />
                                <circle cx={c.x} cy={c.y} r={r} />
                                <title>Add {stem}-{ring.n}</title>
                                {/* Squeezed rings (a phone) have no room for a label each */}
                                {over <= 1.5 && <text x={c.x} y={c.y - r + 4} textAnchor='middle'>+ add {stem}-{ring.n}</text>}
                            </g>
                        );
                    }
                    const a = planetAngle(i);
                    const bx = c.x + r * Math.cos(a);
                    const by = c.y + r * Math.sin(a);
                    const pr = bodyPx(p);
                    const zone = star ? zoneOf(p.orbit, star.type) : ZONES[2];
                    const kids = kidsOf(p.id);
                    return (
                        <g key={p.id} className={cx(styles.orb, selBodyId === p.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(p.id))} onDoubleClick={() => onEdit(p.id)}>
                            <circle cx={c.x} cy={c.y} r={r} className={styles.orbitLine} style={{ stroke: zone.color }} />
                            <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} />
                            <circle cx={bx} cy={by} r={pr} fill={bodyColor(p)} />
                            <BodyTexture body={p} x={bx} y={by} r={pr} />
                            <circle cx={bx} cy={by} r={pr} className={styles.shade} />
                            <text x={bx} y={by - pr - 8 - kids.length * MOON_GAP} textAnchor='middle'>{p.name}</text>
                            {kids.map((m, j) => {
                                const mr = pr + MOON_GAP * (j + 1);
                                const ma = moonAngle(p, m, j);
                                const mx = bx + mr * Math.cos(ma);
                                const my = by + mr * Math.sin(ma);
                                const on = selBodyId === m.id;
                                return (
                                    <g key={m.id} className={cx(styles.orb, on && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(m.id))} onDoubleClick={(e) => (e.stopPropagation(), onEdit(m.id))}>
                                        <circle cx={bx} cy={by} r={mr} className={styles.orbitLine} />
                                        <circle cx={bx} cy={by} r={mr} className={styles.orbitHit} style={{ strokeWidth: MOON_GAP * 0.8 }} />
                                        {m.kind === 'station' ? (
                                            <rect x={mx - 3} y={my - 3} width='6' height='6' fill={bodyColor(m)} transform={`rotate(45 ${mx} ${my})`} />
                                        ) : (
                                            <>
                                                <circle cx={mx} cy={my} r={Math.min(bodyPx(m), MOON_GAP / 2)} fill={bodyColor(m)} />
                                                <BodyTexture body={m} x={mx} y={my} r={Math.min(bodyPx(m), MOON_GAP / 2)} />
                                            </>
                                        )}
                                        <text x={bx} y={by + pr + MOON_GAP * kids.length + 14 + j * 13} textAnchor='middle' className={cx(styles.moonName, on && styles.moonNameOn)}>{m.name}</text>
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
                {onAdd && (
                    <g className={styles.addRing} onClick={(e) => (e.stopPropagation(), onAdd())}>
                        <circle cx={c.x} cy={c.y} r={addR} className={styles.orbitHit} />
                        <circle cx={c.x} cy={c.y} r={addR} />
                        <text x={c.x} y={c.y - addR - 7} textAnchor='middle'>+ add a planet</text>
                    </g>
                )}
              </g>
            </svg>
            <button type='button' className={cx(styles.iconBtn, styles.sysMotion)} onClick={() => onMoving(!moving)} title={moving ? 'Pause the orbits' : 'Set the orbits moving'} aria-label={moving ? 'Pause the orbits' : 'Set the orbits moving'} aria-pressed={moving}>
                <svg width='14' height='14' viewBox='0 0 14 14' fill='currentColor' aria-hidden>
                    {moving ? <path d='M2 1H6V13H2ZM8 1H12V13H8Z' /> : <path d='M2 1L13 7L2 13Z' />}
                </svg>
            </button>
            {star && star.type !== 'black_hole' && (
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
    const star = starOf(place);
    const parent = place.bodies.find((b) => b.id === body.parentId);
    if (body.kind === 'star') {
        const type = STAR_TYPES[body.type];
        const planets = place.bodies.filter((b) => b.kind === 'planet');
        return (
            <div className={styles.telemetry}>
                <Row label='Kind' value={type?.label ?? 'Star'} />
                {body.type !== 'black_hole' && <Row label='Brightness' value={type.lum >= 0.95 && type.lum <= 1.05 ? 'like the Sun' : `${fmtNum(type.lum)} times the Sun`} />}
                <Row label='Mass' value={`${fmtNum(type?.mass ?? 1)} Suns`} />
                {body.type !== 'black_hole' && <Row label='Temperate orbit' value={`about ${fmtNum(habAU(body.type) * 1.1)} AU out`} />}
                <Row label='Planets' value={planets.length} />
                <Row label='Moons and stations' value={place.bodies.length - planets.length - 1} />
            </div>
        );
    }
    const hab = habitability(place, body);
    return (
        <div className={styles.telemetry}>
            <Row label='Type' value={COMPOSITIONS[body.type]?.label ?? 'Unknown'} />
            <Row label='Size' value={`${describeSize(body.radiusKm)} (${fmtNum(body.radiusKm)} km)`} />
            <Row label='Orbits' value={`${parent?.name ?? 'nothing'}${body.kind === 'planet' ? ` at ${fmtNum(body.orbit)} AU` : `, ${fmtNum(body.orbit)} km out`}`} />
            {body.kind !== 'station' && <Row label='Gravity' value={`about ${fmtNum(gravityG(body))} g`} />}
            {body.kind !== 'station' && <Row label='Mass' value={`${fmtNum(massEarths(body))} Earths`} />}
            {body.kind === 'planet' && star && (
                <>
                    <Row label='Year' value={`${fmtNum(yearDays(body.orbit, star.type))} equinoxes`} />
                    {star.type !== 'black_hole' && <Row label='Climate' value={`${zoneOf(body.orbit, star.type).label} orbit`} />}
                </>
            )}
            {body.kind !== 'planet' && <Row label='Bodies around it' value={place.bodies.filter((b) => b.parentId === body.id).length} />}
            {hab !== null && <Meter score={hab} />}
        </div>
    );
}

// ---------- The view ----------
export default function SystemView({ store, place, onAdd }: { store: Store; place: Place; onAdd: (slot?: PlanetSlot) => void }) {
    const [editing, setEditing] = useState(false);
    const body = store.selBody;
    const star = starOf(place);
    const mine = store.canEdit(place);
    const planets = place.bodies.filter((b) => b.kind === 'planet');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select')) store.closeSystem();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const addPlanet = (slot?: PlanetSlot) => {
        store.select(place.id, null);
        onAdd(slot);
    };

    return (
        <div className={styles.sys}>
            <SystemDiagram place={place} selBodyId={body?.id ?? null} onSelect={(id) => (setEditing(false), store.select(place.id, id))} onEdit={(id) => (store.select(place.id, id), setEditing(mine))} onAdd={mine ? addPlanet : undefined} moving={store.motion} onMoving={store.setMotion} />
            <aside className={styles.sysPanels}>
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
                </nav>

                <section className={styles.sysSection}>
                    <h4 className='pixel-label'>Bodies</h4>
                    <BodyTree place={place} selBodyId={body?.id ?? null} onPick={(id) => (setEditing(false), store.select(place.id, id))} onOpen={(id) => (store.select(place.id, id), setEditing(mine))} />
                    {mine && (
                        <div className={styles.actions}>
                            <button type='button' className={styles.btnQuiet} onClick={() => addPlanet()}>+ Planet</button>
                            {body?.kind === 'planet' && <button type='button' className={styles.btnQuiet} onClick={() => onAdd()}>+ Moon or station at {body.name}</button>}
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
                                <p className='pixel-label'>{KIND_LABEL[body.kind]}{body.kind !== 'star' && ` ${designation(body)}`}</p>
                            </div>
                        </header>
                        {!(editing && mine) && <Writeup of={body} />}
                        {editing && mine ? (
                          <>
                            <TextFields key={body.id} store={store} place={place} body={body} />
                            <BodyFields kind={body.kind} draft={body} starType={star?.type ?? 'sunlike'} system={place} selfId={body.id} planet={place.bodies.find((b) => b.id === body.parentId && b.kind === 'planet')} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
                          </>
                        ) : (
                            <Telemetry place={place} body={body} />
                        )}
                        {mine && (
                            <div className={styles.actions}>
                                <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                                {body.kind !== 'star' && <DeleteButton onDelete={() => store.removeBody(place.id, body.id)} />}
                            </div>
                        )}
                        <Travelogue store={store} place={place} body={body} />
                    </section>
                ) : (
                    <section className={styles.sysSection}>
                        <header className={styles.detailHead}>
                            <i className={styles.bigDot} style={{ background: star ? bodyColor(star) : '#7fd3e8', borderRadius: '50%' }} />
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
                            <Row label='Star' value={STAR_TYPES[star?.type ?? '']?.label ?? 'none'} />
                            <Row label='Planets' value={planets.length} />
                            <Row label='Moons and stations' value={Math.max(0, place.bodies.length - planets.length - 1)} />
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
