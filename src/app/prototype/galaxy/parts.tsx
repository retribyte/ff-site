'use client';

// PROTOTYPE, throwaway. Pieces the three layout variants arrange differently:
// the system diagram, the "no raw numbers" inputs, detail blocks, the create flow.

import { useState } from 'react';
import {
    COMPOSITIONS, MOON_ORBIT_RANGE, MOON_ORBIT_REFS, ORBIT_RANGE, ORBIT_REFS, REGIONS, SIZE_RANGE, SIZE_REFS, STAR_TYPES, ZONES,
    bodyColor, describeSize, epLabel, newId, fmtNum, fromT, fullAddress, gravityG, habAU, randomPointIn, regionAt, regionLabel, sectorOf, starOf, toT, yearDays, zoneOf,
} from './data';
import type { Body, BodyKind, InputStyle, Place, Precision, Ref, RegionKey, Vec3 } from './data';
import type { Store } from './store';
import styles from './proto.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
export const KIND_LABEL: Record<string, string> = { star: 'Star', planet: 'Planet', moon: 'Moon', station: 'Station', system: 'System', landmark: 'Landmark' };

// ---------- System diagram ----------
// Schematic, not to scale: orbits are evenly spaced in order, sizes are compressed.
export function SystemSchematic({ place, selBodyId, onSelect, compact }: { place: Place; selBodyId: string | null; onSelect: (id: string | null) => void; compact?: boolean }) {
    const star = starOf(place);
    const planets = place.bodies.filter((b) => b.kind === 'planet').sort((a, b) => a.orbit - b.orbit);
    const W = compact ? 580 : 1000;
    const Hh = compact ? 360 : 700;
    const c = { x: W / 2, y: Hh / 2 };
    const starPx = STAR_TYPES[star?.type ?? '']?.px ?? 24;
    const maxR = Hh / 2 - (compact ? 24 : 60);
    const step = planets.length ? Math.min(90, (maxR - starPx - 30) / planets.length) : 0;
    const angle = (id: string) => ((Array.from(id).reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 360) * Math.PI) / 180;
    const px = (b: Body) => 5 + 20 * Math.max(0, Math.min(1, toT(b.radiusKm, SIZE_RANGE)));

    return (
        <svg className={styles.schematic} viewBox={`0 0 ${W} ${Hh}`} onClick={() => onSelect(null)} role='img' aria-label={`Diagram of the ${place.name} system`}>
            {star && (
                <g className={cx(styles.orb, selBodyId === star.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(star.id))}>
                    {star.type === 'black_hole' && <circle cx={c.x} cy={c.y} r={starPx + 10} fill='none' stroke='#f0b44c' strokeWidth='5' opacity='.7' />}
                    <circle cx={c.x} cy={c.y} r={starPx} fill={bodyColor(star)} className={styles.starGlow} style={{ color: bodyColor(star) }} />
                    <text x={c.x} y={c.y + starPx + 24} textAnchor='middle'>{star.name}</text>
                </g>
            )}
            {planets.map((p, i) => {
                const r = starPx + 40 + step * (i + 0.5);
                const a = angle(p.id);
                const bx = c.x + r * Math.cos(a);
                const by = c.y + r * Math.sin(a);
                const pr = px(p);
                const zone = star ? zoneOf(p.orbit, star.type) : ZONES[2];
                const kids = place.bodies.filter((b) => b.parentId === p.id).sort((x, y) => x.orbit - y.orbit);
                return (
                    <g key={p.id} className={cx(styles.orb, selBodyId === p.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(p.id))}>
                        <circle cx={c.x} cy={c.y} r={r} className={styles.orbitLine} style={{ stroke: zone.color }} />
                        <circle cx={c.x} cy={c.y} r={r} className={styles.orbitHit} />
                        <circle cx={bx} cy={by} r={pr} fill={bodyColor(p)} />
                        <text x={bx} y={by - pr - 10 - kids.length * 9} textAnchor='middle'>{p.name}</text>
                        {kids.map((m, j) => {
                            const mr = pr + 10 + j * 9;
                            const ma = angle(m.id);
                            return (
                                <g key={m.id} className={cx(styles.orb, selBodyId === m.id && styles.orbSelected)} onClick={(e) => (e.stopPropagation(), onSelect(m.id))}>
                                    <circle cx={bx} cy={by} r={mr} className={styles.orbitLine} />
                                    <circle cx={bx} cy={by} r={mr} className={styles.orbitHit} style={{ strokeWidth: 8 }} />
                                    {m.kind === 'station' ? (
                                        <rect x={bx + mr * Math.cos(ma) - 3.5} y={by + mr * Math.sin(ma) - 3.5} width='7' height='7' fill={bodyColor(m)} />
                                    ) : (
                                        <circle cx={bx + mr * Math.cos(ma)} cy={by + mr * Math.sin(ma)} r={Math.max(2.5, px(m) * 0.45)} fill={bodyColor(m)} />
                                    )}
                                </g>
                            );
                        })}
                    </g>
                );
            })}
            <text x={16} y={compact ? Hh - 10 : Hh - 56} className={styles.schematicNote}>Not to scale. Ring color shows how warm the orbit is.</text>
        </svg>
    );
}

// ---------- Inputs that never ask for a raw number ----------
interface ScaleProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    refs: Ref[];
    range: [number, number];
    style: InputStyle;
    readout: string;
    /** Planet orbits only: draws warm-to-cold bands and offers zone chips. */
    starType?: string;
    sizes?: boolean;
}

function ScaleInput({ label, value, onChange, refs, range, style, readout, starType, sizes }: ScaleProps) {
    const t = Math.max(0, Math.min(1, toT(value, range)));
    const nearest = refs.reduce((best, r) => (Math.abs(Math.log(value / r.value)) < Math.abs(Math.log(value / best.value)) ? r : best), refs[0]);
    const hab = starType ? habAU(starType) : 1;
    const bands = starType
        ? `linear-gradient(90deg, ${ZONES.map((z, i) => {
              const edges = [0, 0.5, 0.9, 1.6, 6, 1e6];
              const a = Math.max(0, Math.min(1, toT(Math.max(edges[i] * hab, range[0]), range))) * 100;
              const b = Math.max(0, Math.min(1, toT(Math.min(edges[i + 1] * hab, range[1]), range))) * 100;
              return `${z.color} ${a}%, ${z.color} ${b}%`;
          }).join(', ')})`
        : undefined;

    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>{label}</span>
                <span className={styles.fieldReadout}>{readout}</span>
            </div>
            {style === 'slider' && (
                <div className={styles.slider}>
                    {bands && <div className={styles.sliderBands} style={{ background: bands }} />}
                    <input type='range' min={0} max={1000} value={Math.round(t * 1000)} onChange={(e) => onChange(fromT(Number(e.target.value) / 1000, range))} aria-label={label} />
                    <div className={styles.ticks}>
                        {refs.map((r) => (
                            <button key={r.key} type='button' style={{ left: `${toT(r.value, range) * 100}%` }} onClick={() => onChange(r.value)}>
                                {r.label.replace('the ', '')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {style === 'chips' && (
                <div className={styles.chips}>
                    {starType
                        ? ZONES.map((z) => (
                              <button key={z.key} type='button' className={cx(styles.chip, zoneOf(value, starType).key === z.key && styles.chipOn)} style={{ '--chip': z.color } as React.CSSProperties} onClick={() => onChange(z.factor * hab)}>
                                  {z.label}
                              </button>
                          ))
                        : refs.map((r) => (
                              <button key={r.key} type='button' className={cx(styles.chip, nearest.key === r.key && styles.chipOn)} onClick={() => onChange(r.value)}>
                                  {sizes ? `Like ${r.label}` : `As far as ${r.label}`}
                              </button>
                          ))}
                </div>
            )}
            {style === 'lineup' && sizes && (
                <div className={styles.lineup}>
                    {refs.map((r) => (
                        <button key={r.key} type='button' className={cx(nearest.key === r.key && styles.lineupOn)} onClick={() => onChange(r.value)} title={`Like ${r.label}`}>
                            <i style={{ width: 6 + 40 * toT(r.value, range), height: 6 + 40 * toT(r.value, range) }} />
                            <span>{r.label.replace('the ', '')}</span>
                        </button>
                    ))}
                </div>
            )}
            {style === 'lineup' && !sizes && (
                <div
                    className={styles.ruler}
                    style={{ background: bands }}
                    onClick={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        onChange(fromT(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)), range));
                    }}
                    role='slider'
                    aria-label={label}
                    aria-valuenow={Math.round(t * 100)}
                    tabIndex={0}
                >
                    {refs.map((r) => (
                        <span key={r.key} className={styles.rulerRef} style={{ left: `${toT(r.value, range) * 100}%` }}>{r.label.replace('the ', '')}</span>
                    ))}
                    <b style={{ left: `${t * 100}%` }} />
                </div>
            )}
        </div>
    );
}

export interface BodyDraft {
    type: string;
    radiusKm: number;
    orbit: number;
}

export function BodyFields({ kind, draft, onChange, starType, style }: { kind: BodyKind; draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; starType: string; style: InputStyle }) {
    if (kind === 'star') {
        return (
            <div className={styles.field}>
                <div className={styles.fieldHead}><span className='pixel-label'>Kind of star</span></div>
                <div className={styles.chips}>
                    {Object.entries(STAR_TYPES).map(([key, s]) => (
                        <button key={key} type='button' className={cx(styles.chip, draft.type === key && styles.chipOn)} style={{ '--chip': s.color } as React.CSSProperties} onClick={() => onChange({ type: key })}>
                            <i className={styles.chipDot} />{s.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    const orbitsStar = kind === 'planet';
    const zone = zoneOf(draft.orbit, starType);
    return (
        <>
            {kind !== 'station' && (
                <div className={styles.field}>
                    <div className={styles.fieldHead}><span className='pixel-label'>Type</span></div>
                    <div className={styles.chips}>
                        {Object.entries(COMPOSITIONS).filter(([key]) => key !== 'artificial').map(([key, comp]) => (
                            <button key={key} type='button' className={cx(styles.chip, draft.type === key && styles.chipOn)} style={{ '--chip': comp.color } as React.CSSProperties} onClick={() => onChange({ type: key })}>
                                <i className={styles.chipDot} />{comp.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <ScaleInput
                label='Size'
                sizes
                value={draft.radiusKm}
                onChange={(v) => onChange({ radiusKm: v })}
                refs={kind === 'planet' ? SIZE_REFS.slice(1) : SIZE_REFS.slice(0, 4)}
                range={SIZE_RANGE}
                style={style}
                readout={`${describeSize(draft.radiusKm)}, ${fmtNum(draft.radiusKm)} km`}
            />
            {orbitsStar ? (
                <ScaleInput
                    label='Distance from its star'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={ORBIT_REFS}
                    range={ORBIT_RANGE}
                    style={style}
                    starType={starType}
                    readout={`${zone.label}, ${fmtNum(draft.orbit)} AU, a year of ${fmtNum(yearDays(draft.orbit, starType))} days`}
                />
            ) : (
                <ScaleInput
                    label='Distance from what it orbits'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={MOON_ORBIT_REFS}
                    range={MOON_ORBIT_RANGE}
                    style={style}
                    readout={`${fmtNum(draft.orbit)} km`}
                />
            )}
        </>
    );
}

// ---------- Detail blocks ----------
export function Travelogue({ store, place, body }: { store: Store; place: Place; body: Body | null }) {
    const own = body ? body.travelogue.map((e) => ({ e, via: '' })) : place.travelogue.map((e) => ({ e, via: '' }));
    const fromBodies = body ? [] : place.bodies.flatMap((b) => b.travelogue.map((e) => ({ e, via: b.name })));
    const rows = [...own, ...fromBodies].sort((a, b) => a.e.season.localeCompare(b.e.season) || a.e.no - b.e.no);
    return (
        <section className={styles.travelogue}>
            <h4 className='pixel-label'>Travelogue</h4>
            {rows.length === 0 && <p className={styles.muted}>No episodes tagged here yet.</p>}
            <ol>
                {rows.map(({ e, via }, i) => (
                    <li key={i}>
                        <a href='#' onClick={(ev) => ev.preventDefault()}>{epLabel(e)}</a>
                        {via && <span className={styles.muted}> on {via}</span>}
                    </li>
                ))}
            </ol>
            <button type='button' className={styles.linkBtn} onClick={() => store.tagEpisode(place.id, body?.id ?? null, { season: 'FF4', no: 9 + rows.length, title: 'Sample tag' })}>
                + tag an episode
            </button>
        </section>
    );
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

/** Planets count outward from the star as I, II, III; whatever orbits a planet is a, b, c. */
export function designation(place: Place, b: Body): string {
    if (b.kind === 'star') return '';
    const sibs = place.bodies.filter((x) => x.parentId === b.parentId && x.kind !== 'star').sort((x, y) => x.orbit - y.orbit);
    const i = sibs.findIndex((x) => x.id === b.id);
    return b.kind === 'planet' ? (ROMAN[i] ?? String(i + 1)) : String.fromCharCode(97 + (i % 26));
}

/** Sun, planet, moon or station, in the body's own color. */
export function BodyIcon({ body, size = 16 }: { body: Body; size?: number }) {
    const c = bodyColor(body);
    const hole = body.kind === 'star' && body.type === 'black_hole';
    return (
        <svg className={styles.bodyIcon} width={size} height={size} viewBox='0 0 16 16' aria-hidden>
            {body.kind === 'star' && (
                <>
                    {[0, 45, 90, 135].map((a) => (
                        <line key={a} x1='8' y1='0.5' x2='8' y2='15.5' stroke={hole ? '#f0b44c' : c} strokeWidth='1.4' transform={`rotate(${a} 8 8)`} />
                    ))}
                    <circle cx='8' cy='8' r='4.2' fill={c} stroke={hole ? '#f0b44c' : 'none'} />
                </>
            )}
            {body.kind === 'planet' && (
                <>
                    <circle cx='8' cy='8' r='4.6' fill={c} />
                    <ellipse cx='8' cy='8' rx='7.4' ry='2.2' fill='none' stroke={c} strokeWidth='1.2' transform='rotate(-20 8 8)' />
                </>
            )}
            {body.kind === 'moon' && <path d='M10.5 1.8a6.4 6.4 0 1 0 0 12.4a5 5 0 1 1 0-12.4z' fill={c} />}
            {body.kind === 'station' && <path d='M8 1.5l6.5 6.5L8 14.5 1.5 8z M8 5.5L5.5 8 8 10.5 10.5 8z' fill={c} fillRule='evenodd' />}
        </svg>
    );
}

export function BodyTree({ place, selBodyId, onPick, onOpen }: { place: Place; selBodyId: string | null; onPick: (bodyId: string) => void; onOpen?: (bodyId: string) => void }) {
    const kids = (parentId: string | null) => place.bodies.filter((b) => b.parentId === parentId).sort((a, b) => a.orbit - b.orbit);
    const row = (b: Body, depth: number): React.ReactNode => (
        <li key={b.id}>
            <button type='button' className={cx(styles.treeRow, selBodyId === b.id && styles.treeRowOn)} style={{ paddingLeft: 8 + depth * 16 }} onClick={() => onPick(b.id)} onDoubleClick={() => onOpen?.(b.id)}>
                <BodyIcon body={b} />
                {b.kind !== 'star' && <span className={styles.desig}>{designation(place, b)}</span>}
                {b.name}
                <span className={styles.muted}>{KIND_LABEL[b.kind]}</span>
            </button>
            {kids(b.id).length > 0 && <ul>{kids(b.id).map((k) => row(k, depth + 1))}</ul>}
        </li>
    );
    return <ul className={styles.tree}>{kids(null).map((b) => row(b, 0))}</ul>;
}

export function PlaceHeader({ place }: { place: Place }) {
    const star = starOf(place);
    const firstPlanet = place.bodies.find((b) => b.kind === 'planet');
    return (
        <header className={styles.detailHead}>
            <i className={styles.bigDot} style={{ background: place.kind === 'system' && star ? bodyColor(star) : '#7fd3e8', borderRadius: place.kind === 'landmark' ? 0 : '50%' }} />
            <div>
                <h3>{place.placeholder && firstPlanet ? `${firstPlanet.name}'s system` : place.name}</h3>
                <p className='pixel-label'>
                    {place.kind === 'landmark' ? (place.category ?? 'Landmark') : place.placeholder ? 'System, star not named yet' : 'System'}
                </p>
            </div>
        </header>
    );
}

export function PlaceFacts({ place }: { place: Place }) {
    return (
        <dl className={styles.facts}>
            <dt>Region</dt>
            <dd>{regionLabel(place)}</dd>
            <dt>Position</dt>
            <dd>{place.precision === 'region' ? `Somewhere in ${regionLabel(place)} (not pinned down)` : sectorOf(place.pos)}</dd>
            {place.precision === 'exact' && (
                <>
                    <dt>Address</dt>
                    <dd className={styles.mono}>{fullAddress(place.pos)}</dd>
                </>
            )}
            <dt>Added by</dt>
            <dd>{place.owner}</dd>
        </dl>
    );
}

export function BodyFacts({ place, body }: { place: Place; body: Body }) {
    const star = starOf(place);
    const parent = place.bodies.find((b) => b.id === body.parentId);
    if (body.kind === 'star') {
        return (
            <dl className={styles.facts}>
                <dt>Kind</dt>
                <dd>{STAR_TYPES[body.type]?.label}</dd>
                <dt>Planets</dt>
                <dd>{place.bodies.filter((b) => b.kind === 'planet').length}</dd>
            </dl>
        );
    }
    return (
        <dl className={styles.facts}>
            <dt>Type</dt>
            <dd>{COMPOSITIONS[body.type]?.label}</dd>
            <dt>Size</dt>
            <dd>{describeSize(body.radiusKm)} ({fmtNum(body.radiusKm)} km)</dd>
            {body.kind !== 'station' && (
                <>
                    <dt>Gravity</dt>
                    <dd>about {fmtNum(gravityG(body))} g</dd>
                </>
            )}
            <dt>Orbits</dt>
            <dd>{parent?.name ?? 'nothing'}{body.kind === 'planet' ? ` at ${fmtNum(body.orbit)} AU` : `, ${fmtNum(body.orbit)} km out`}</dd>
            {body.kind === 'planet' && star && (
                <>
                    <dt>Climate</dt>
                    <dd>{zoneOf(body.orbit, star.type).label} orbit</dd>
                    <dt>Year</dt>
                    <dd>{fmtNum(yearDays(body.orbit, star.type))} equinoxes</dd>
                </>
            )}
        </dl>
    );
}

/** Everything about the current selection, as one stack the variants can drop anywhere. */
export function SelectionDetail({ store, style, showTree = true, noOpen }: { store: Store; style: InputStyle; showTree?: boolean; noOpen?: boolean }) {
    const [editing, setEditing] = useState(false);
    const place = store.selPlace;
    if (!place) return null;
    const body = store.selBody;
    const star = starOf(place);
    const mine = place.owner === store.me;

    return (
        <div className={styles.detail}>
            {body ? (
                <>
                    <header className={styles.detailHead}>
                        <i className={styles.bigDot} style={{ background: bodyColor(body), borderRadius: body.kind === 'station' ? 0 : '50%' }} />
                        <div>
                            <h3>{body.name}</h3>
                            <p className='pixel-label'>{KIND_LABEL[body.kind]} in {place.placeholder ? 'an unnamed system' : place.name}</p>
                        </div>
                    </header>
                    {body.note && <p>{body.note}</p>}
                    {body.wikiSlug && <p className={styles.muted}>Description and picture come from the wiki page <span className={styles.mono}>{body.wikiSlug}</span>.</p>}
                    {editing && mine ? (
                        <BodyFields kind={body.kind} draft={body} starType={star?.type ?? 'sunlike'} style={style} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
                    ) : (
                        <BodyFacts place={place} body={body} />
                    )}
                    {mine ? (
                        <div className={styles.actions}>
                            <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                            {body.kind !== 'star' && <button type='button' className={styles.btnQuiet} onClick={() => store.removeBody(place.id, body.id)}>Delete</button>}
                        </div>
                    ) : (
                        <p className={styles.muted}>Added by {place.owner}. Only {place.owner} or an admin can change it.</p>
                    )}
                    <Travelogue store={store} place={place} body={body} />
                </>
            ) : (
                <>
                    <PlaceHeader place={place} />
                    {place.note && <p>{place.note}</p>}
                    <PlaceFacts place={place} />
                    {place.placeholder && mine && <RenameRow store={store} place={place} />}
                    {showTree && place.kind === 'system' && <BodyTree place={place} selBodyId={null} onPick={(id) => store.openSystem(place.id, id)} />}
                    <div className={styles.actions}>
                        {place.kind === 'system' && store.level === 'galaxy' && !noOpen && <button type='button' className={styles.btn} onClick={() => store.openSystem(place.id)}>Open system</button>}
                        {mine && (
                            <button type='button' className={styles.btnQuiet} onClick={() => store.requestPlace((pos) => store.movePlace(place.id, { pos, precision: 'exact', regionHint: undefined }))}>
                                {place.precision === 'region' ? 'Pin it down' : 'Move'}
                            </button>
                        )}
                        {mine && <button type='button' className={styles.btnQuiet} onClick={() => store.removePlace(place.id)}>Delete</button>}
                    </div>
                    <Travelogue store={store} place={place} body={null} />
                </>
            )}
        </div>
    );
}

export function RenameRow({ store, place }: { store: Store; place: Place }) {
    const [name, setName] = useState('');
    return (
        <form className={styles.inlineForm} onSubmit={(e) => (e.preventDefault(), name.trim() && store.renamePlace(place.id, name.trim()))}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Name this star system' aria-label='System name' />
            <button type='submit' className={styles.btn}>Name it</button>
        </form>
    );
}

// ---------- Where does it go? ----------
export interface Where {
    pos: Vec3;
    precision: Precision;
    regionHint?: RegionKey;
}

export function WherePicker({ store, where, onChange }: { store: Store; where: Where | null; onChange: (w: Where) => void }) {
    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>Where is it?</span>
                <span className={styles.fieldReadout}>
                    {where ? (where.precision === 'region' && where.regionHint ? `Somewhere in ${REGIONS[where.regionHint].short}, ${sectorOf(where.pos)}` : `${sectorOf(where.pos)}, ${regionAt(where.pos) ? REGIONS[regionAt(where.pos)!].short : 'unclaimed space'}`) : 'Not placed yet'}
                </span>
            </div>
            <div className={styles.chips}>
                {(Object.keys(REGIONS) as RegionKey[]).map((key) => (
                    <button
                        key={key}
                        type='button'
                        className={cx(styles.chip, where?.regionHint === key && styles.chipOn)}
                        style={{ '--chip': REGIONS[key].color } as React.CSSProperties}
                        onClick={() => onChange({ pos: randomPointIn(key), precision: 'region', regionHint: key })}
                        title={where?.regionHint === key ? 'Click again for a different spot' : undefined}
                    >
                        <i className={styles.chipDot} />{where?.regionHint === key ? `${REGIONS[key].short} (re-roll)` : REGIONS[key].short}
                    </button>
                ))}
                <button type='button' className={cx(styles.chip, where?.precision === 'exact' && styles.chipOn)} onClick={() => store.requestPlace((pos) => onChange({ pos, precision: 'exact' }))}>
                    Pick the spot on the map
                </button>
            </div>
        </div>
    );
}

// ---------- Create flow ----------
type CreateKind = 'system' | 'planet' | 'moon' | 'station' | 'landmark';
const CREATE_KINDS: { key: CreateKind; label: string; glyph: string }[] = [
    { key: 'system', label: 'Star system', glyph: '☀' },
    { key: 'planet', label: 'Planet', glyph: '◐' },
    { key: 'moon', label: 'Moon', glyph: '☾' },
    { key: 'station', label: 'Station', glyph: '▣' },
    { key: 'landmark', label: 'Landmark', glyph: '✦' },
];

/**
 * One create flow for everything. `stepped` shows one question at a time (the
 * wizard); otherwise it is a single form. `tabs` puts the kind picker on a
 * vertical strip, as in the paper sketch.
 */
export function CreateFlow({ store, style, stepped, tabs, onDone }: { store: Store; style: InputStyle; stepped?: boolean; tabs?: boolean; onDone: () => void }) {
    const ctxPlanet = store.selBody?.kind === 'planet' ? store.selBody : null;
    const ctxSystem = store.level === 'system' && store.selPlace?.kind === 'system' ? store.selPlace : null;
    const [kind, setKind] = useState<CreateKind>(ctxPlanet ? 'moon' : ctxSystem ? 'planet' : 'system');
    const [name, setName] = useState('');
    const [parent, setParent] = useState<string>(ctxPlanet?.id ?? ctxSystem?.id ?? 'new');
    const [where, setWhere] = useState<Where | null>(null);
    const [starType, setStarType] = useState('sunlike');
    const [draft, setDraft] = useState<BodyDraft>(ctxPlanet ? { type: 'rocky', radiusKm: 1737, orbit: 384400 } : { type: 'rocky', radiusKm: 6371, orbit: 1 });
    const [step, setStep] = useState(0);

    const systems = store.places.filter((p) => p.kind === 'system');
    const planets = systems.flatMap((p) => p.bodies.filter((b) => b.kind === 'planet').map((b) => ({ b, p })));
    const isSatellite = kind === 'moon' || kind === 'station';
    const parentPlanet = isSatellite ? (planets.find((x) => x.b.id === parent) ?? planets[0]) : null;
    const parentSystem = kind === 'planet' ? systems.find((p) => p.id === parent) : null;
    const needsWhere = kind === 'system' || kind === 'landmark' || (kind === 'planet' && !parentSystem);
    const hostStarType = kind === 'planet' ? (parentSystem ? (starOf(parentSystem)?.type ?? 'sunlike') : starType) : 'sunlike';
    const canSave = name.trim() !== '' && (!needsWhere || where !== null) && (!isSatellite || parentPlanet);

    const pickKind = (k: CreateKind) => {
        setKind(k);
        if (k === 'moon') setDraft({ type: 'rocky', radiusKm: 1737, orbit: 384400 });
        else if (k === 'station') setDraft({ type: 'artificial', radiusKm: 473, orbit: 42000 });
        else setDraft({ type: 'rocky', radiusKm: 6371, orbit: habAU(hostStarType) * 1.1 });
        if (k === 'planet' && !systems.some((p) => p.id === parent)) setParent(ctxSystem?.id ?? 'new');
        if ((k === 'moon' || k === 'station') && !planets.some((x) => x.b.id === parent)) setParent(planets[0]?.b.id ?? '');
    };

    const save = () => {
        if (!canSave) return;
        const base = { owner: store.me, travelogue: [], note: '' };
        const mkStar = (starName: string, type: string): Body => ({ id: newId('b'), kind: 'star', name: starName, parentId: null, type, radiusKm: 696000, orbit: 0, travelogue: [] });
        if (kind === 'landmark') {
            const p = store.addPlace({ ...base, kind: 'landmark', name: name.trim(), category: 'Landmark', bodies: [], ...where! });
            store.select(p.id);
        } else if (kind === 'system') {
            const p = store.addPlace({ ...base, kind: 'system', name: name.trim(), bodies: [mkStar(name.trim(), starType)], ...where! });
            store.openSystem(p.id);
        } else if (kind === 'planet' && !parentSystem) {
            const star = mkStar('Unnamed star', starType);
            const planet: Body = { id: newId('b'), kind: 'planet', name: name.trim(), parentId: star.id, travelogue: [], ...draft };
            const p = store.addPlace({ ...base, kind: 'system', name: 'Unnamed system', placeholder: true, bodies: [star, planet], ...where! });
            store.openSystem(p.id, planet.id);
        } else if (kind === 'planet' && parentSystem) {
            const b = store.addBody(parentSystem.id, { kind: 'planet', name: name.trim(), parentId: starOf(parentSystem)?.id ?? null, travelogue: [], ...draft });
            store.openSystem(parentSystem.id, b.id);
        } else if (parentPlanet) {
            const b = store.addBody(parentPlanet.p.id, { kind: kind as BodyKind, name: name.trim(), parentId: parentPlanet.b.id, travelogue: [], ...draft, type: kind === 'station' ? 'artificial' : draft.type });
            store.openSystem(parentPlanet.p.id, b.id);
        }
        onDone();
    };

    const kindPicker = (
        <div className={tabs ? styles.kindTabs : styles.chips} role='tablist' aria-label='What are you adding?'>
            {CREATE_KINDS.map((k) => (
                <button key={k.key} type='button' role='tab' aria-selected={kind === k.key} title={k.label} className={cx(tabs ? styles.kindTab : styles.chip, kind === k.key && (tabs ? styles.kindTabOn : styles.chipOn))} onClick={() => pickKind(k.key)}>
                    <span aria-hidden>{k.glyph}</span>{!tabs && ` ${k.label}`}
                </button>
            ))}
        </div>
    );

    const nameField = (
        <div className={styles.field}>
            <input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${CREATE_KINDS.find((k) => k.key === kind)!.label.toLowerCase()}`} aria-label='Name' autoFocus />
        </div>
    );

    const parentField = (kind === 'planet' || isSatellite) && (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>{kind === 'planet' ? 'Star system' : 'Orbits'}</span></div>
            <select value={isSatellite ? (parentPlanet?.b.id ?? '') : parent} onChange={(e) => setParent(e.target.value)}>
                {kind === 'planet' && <option value='new'>I don&apos;t know its star yet</option>}
                {kind === 'planet'
                    ? systems.map((p) => <option key={p.id} value={p.id}>{p.placeholder ? `${p.bodies.find((b) => b.kind === 'planet')?.name ?? '?'}'s system` : p.name}</option>)
                    : planets.map(({ b, p }) => <option key={b.id} value={b.id}>{b.name} ({p.placeholder ? 'unnamed system' : p.name})</option>)}
            </select>
        </div>
    );

    const whereField = needsWhere && <WherePicker store={store} where={where} onChange={setWhere} />;
    const starField = (kind === 'system' || (kind === 'planet' && !parentSystem)) && (
        <BodyFields kind='star' draft={{ ...draft, type: starType }} onChange={(p) => p.type && setStarType(p.type)} starType={starType} style={style} />
    );
    const bodyFields = kind !== 'system' && kind !== 'landmark' && (
        <BodyFields kind={kind as BodyKind} draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} starType={hostStarType} style={style} />
    );

    const footer = (
        <div className={styles.actions}>
            <button type='button' className={styles.btn} disabled={!canSave} onClick={save}>Done</button>
            <button type='button' className={styles.btnQuiet} onClick={onDone}>Cancel</button>
            {!canSave && <span className={styles.muted}>{name.trim() === '' ? 'Needs a name.' : 'Needs a place on the map.'}</span>}
        </div>
    );

    if (stepped) {
        // Started from inside a system (or on a planet): where it goes is already known.
        const whereKnown = (kind === 'planet' && !!ctxSystem && parentSystem?.id === ctxSystem.id) || (isSatellite && !!ctxPlanet && parentPlanet?.b.id === ctxPlanet.id);
        const pages = [
            { title: 'What are you adding?', body: <>{kindPicker}{nameField}</> },
            ...(!whereKnown && (parentField || whereField) ? [{ title: 'Where does it go?', body: <>{parentField}{whereField}</> }] : []),
            ...(starField || bodyFields ? [{ title: 'What is it like?', body: <>{kind === 'system' ? starField : bodyFields}</> }] : []),
        ];
        const at = Math.min(step, pages.length - 1);
        return (
            <div className={styles.create}>
                <p className='pixel-label'>Step {at + 1} of {pages.length}</p>
                <h3>{pages[at].title}</h3>
                {pages[at].body}
                <div className={styles.actions}>
                    {at > 0 && <button type='button' className={styles.btnQuiet} onClick={() => setStep(at - 1)}>Back</button>}
                    {at < pages.length - 1 ? (
                        <button type='button' className={styles.btn} disabled={at === 0 && name.trim() === ''} onClick={() => setStep(at + 1)}>Next</button>
                    ) : (
                        <button type='button' className={styles.btn} disabled={!canSave} onClick={save}>Done</button>
                    )}
                    <button type='button' className={styles.btnQuiet} onClick={onDone}>Cancel</button>
                </div>
            </div>
        );
    }

    return (
        <div className={cx(styles.create, tabs && styles.createTabbed)}>
            {tabs && kindPicker}
            <div className={styles.createBody}>
                {!tabs && kindPicker}
                {nameField}
                {parentField}
                {whereField}
                {starField}
                {bodyFields}
                {footer}
            </div>
        </div>
    );
}

// ---------- Small shared controls ----------
export function ViewButtons({ store }: { store: Store }) {
    return (
        <div className={styles.seg} role='group' aria-label='Camera'>
            <button type='button' aria-pressed={store.view === 'tilt'} onClick={() => store.setView('tilt')}>Rotate</button>
            <button type='button' aria-pressed={store.view === 'top'} onClick={() => store.setView('top')}>Top-down</button>
        </div>
    );
}

export function LayerToggles({ store }: { store: Store }) {
    const toggle = (key: 'grid' | 'territories' | 'labels') => store.setLayers({ ...store.layers, [key]: !store.layers[key] });
    return (
        <div className={styles.seg} role='group' aria-label='Layers'>
            <button type='button' aria-pressed={store.layers.territories} onClick={() => toggle('territories')}>Regions</button>
            <button type='button' aria-pressed={store.layers.grid} onClick={() => toggle('grid')}>Sectors</button>
            <button type='button' aria-pressed={store.layers.labels} onClick={() => toggle('labels')}>Names</button>
        </div>
    );
}

export function placeTitle(place: Place): string {
    const planet = place.bodies.find((b) => b.kind === 'planet');
    return place.placeholder && planet ? `${planet.name}'s system` : place.name;
}
