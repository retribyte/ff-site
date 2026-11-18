'use client';

// Pieces of the galaxy map shared by the galaxy level and the system view: the "no
// raw numbers" inputs, the detail blocks for a selection, and the add wizard.

import { useId, useState } from 'react';
import Link from 'next/link';
import RichText from '@/components/RichText';
import WikiLink from '@/components/WikiLink';
import { decodeEntities } from '@/lib/html';
import { isValidSlug } from '@/lib/slug';
import {
    BELT_TYPES, BELT_WIDTH_RANGE, PAIR_PLANET_RANGE, PAIR_PLANET_REFS, PAIR_STAR_RANGE, PAIR_STAR_REFS, BELT_WIDTH_REFS, COMPOSITIONS, LANDMARK_CATEGORIES, MOON_ORBIT_REFS, ORBIT_RANGE, ORBIT_REFS, REGIONS, RING_WIDTH_RANGE, RING_WIDTH_REFS, SIZE_RANGE, SIZE_REFS, STAR_TYPES, ZONES,
    beltDraft, beltWidthMax, bodyColor, describeSize, fmtNum, fromT, fullAddress, gravityG, habAU, lifted, planetNumber, randomPointIn, regionAt, regionLabel, letters, ringRange, roman, satelliteRange, stationMark, wouldBe, wouldPair, hostOf, isSlot, isStarry, massOf, massEarths, orbitAU, primaryOf, unitOf, sectorOf, toT, yearDays, zoneOf,
} from './data';
import type { Body, BodyKind, Draft, Host, Place, Ref, RegionKey, Vec3 } from './data';
import type { Store, TextPatch, Where } from './store';
import styles from './galaxy.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
export const KIND_LABEL: Record<string, string> = { star: 'Star', planet: 'Planet', moon: 'Moon', station: 'Station', belt: 'Belt', barycenter: 'Pair', system: 'System', landmark: 'Landmark' };
/** What a body is called: a planet with its number (Planet 3, Planet 3-A for one of a pair), a star of several with its letter, a belt round a planet or moon a ring. */
export function kindLabel(b: Body): string {
    if (b.kind === 'planet') return `Planet ${b.num}${b.letter ? `-${b.letter}` : ''}`;
    if (b.kind === 'star' && b.letter) return `Star ${b.letter}`;
    if (b.kind === 'barycenter') return b.type === 'stars' ? 'Pair of stars' : 'Pair of planets';
    if (b.kind === 'belt' && b.ring) return 'Ring';
    return KIND_LABEL[b.kind];
}

// ---------- Inputs that never ask for a raw number ----------
interface ScaleProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    refs: Ref[];
    range: [number, number];
    readout: string;
    /** Planet orbits only: draws warm-to-cold bands for this star (its type) or pair. */
    starType?: string | Host;
    /** A lineup of reference bodies to pick from; otherwise a ruler to click along. */
    sizes?: boolean;
    /** What the value is counted in, shown beside the box a known value is typed into. */
    unit: string;
    /** The least and most a typed value may be. */
    bounds: [number, number];
}

/** The readout of a scale; a click turns it into a box for whoever does know the number. */
function Readout({ text, value, unit, bounds, onChange }: { text: string; value: number; unit: string; bounds: [number, number]; onChange: (v: number) => void }) {
    const [typed, setTyped] = useState<string | null>(null);
    if (typed === null) {
        return (
            <button type='button' className={styles.fieldReadout} onClick={() => setTyped(String(Number(value.toPrecision(6))))} title={`Type a value in ${unit}`}>
                {text}
            </button>
        );
    }
    const commit = () => {
        const v = Number(typed);
        if (typed.trim() !== '' && Number.isFinite(v) && v > 0) onChange(Math.max(bounds[0], Math.min(bounds[1], v)));
        setTyped(null);
    };
    return (
        <span className={styles.fieldTyped}>
            <input
                type='number'
                autoFocus
                min={bounds[0]}
                max={bounds[1]}
                step='any'
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        setTyped(null);
                    }
                }}
                aria-label={`${unit}`}
            />
            {unit}
        </span>
    );
}

function ScaleInput({ label, value, onChange, refs, range, readout, starType, sizes, unit, bounds }: ScaleProps) {
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
    const nudge = (by: number) => onChange(fromT(Math.max(0, Math.min(1, t + by)), range));

    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>{label}</span>
                <Readout text={readout} value={value} unit={unit} bounds={bounds} onChange={onChange} />
            </div>
            {sizes ? (
                <div className={styles.lineup}>
                    {refs.map((r) => (
                        <button key={r.key} type='button' className={cx(nearest.key === r.key && styles.lineupOn)} onClick={() => onChange(r.value)} title={`Like ${r.label}`}>
                            <i style={{ width: 6 + 40 * toT(r.value, range), height: 6 + 40 * toT(r.value, range) }} />
                            <span>{r.label.replace('the ', '')}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div
                    className={styles.ruler}
                    style={{ background: bands }}
                    onClick={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        onChange(fromT(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)), range));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-0.02);
                        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(0.02);
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
    /** Belts: how wide the band is. */
    width?: number;
    /** Planets: "this is planet N". */
    ordinal?: number | null;
    /** Stations: the GUY year it was built, and its iteration. */
    builtYear?: number | null;
    iteration?: number | null;
}

/** The planet a gap ring of the system diagram stands for. */
export interface PlanetSlot {
    ordinal: number;
    orbit: number;
}

/** "This is planet N": steps up from the number the planet's orbit gives it, for one whose inner neighbours are not on the map. */
function PlanetNumber({ draft, onChange, system, selfId, host }: { draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; system?: Place; selfId?: number; /** The star or pair of stars it circles. */ host?: Body }) {
    const star = host ?? (system && primaryOf(system));
    const { n, min } = planetNumber((system?.bodies ?? []).filter((b) => b.id !== selfId), star?.id ?? null, draft.orbit, draft.ordinal ?? null);
    const prefix = star && (star.gu || (!star.unnamed ? star.name : ''));
    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>Planet number</span>
                <span className={styles.fieldReadout}>{prefix ? `${prefix}-${n}` : `Planet ${n} of its star`}</span>
            </div>
            <div className={styles.stepper}>
                <button type='button' className={styles.chip} disabled={n <= min} onClick={() => onChange({ ordinal: n - 1 > min ? n - 1 : null })} aria-label='One planet closer to the star'>-</button>
                <b>{n}</b>
                <button type='button' className={styles.chip} disabled={n >= 99} onClick={() => onChange({ ordinal: n + 1 })} aria-label='One planet farther from the star'>+</button>
            </div>
        </div>
    );
}

/**
 * A station's build year (GUY) and iteration, which make its designation (Sol-3.3016-02).
 * The member enters both: the map never makes them up. `prefix`: what it orbits, as designated.
 */
function StationBuilt({ draft, onChange, prefix }: { draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; prefix?: string }) {
    const [text, setText] = useState(draft.builtYear == null ? '' : String(draft.builtYear));
    const iteration = draft.iteration ?? 1;
    const known = draft.builtYear != null;
    const mark = stationMark(draft);
    const typed = (value: string) => {
        setText(value);
        const t = value.trim();
        if (t === '') onChange({ builtYear: null, iteration: null });
        else if (/^-?\d{1,9}$/.test(t)) onChange({ builtYear: Number(t), iteration });
    };
    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>Built</span>
                <span className={styles.fieldReadout}>{known ? (prefix ? `${prefix}.${mark}` : mark) : 'No designation until the year is known'}</span>
            </div>
            <input inputMode='numeric' value={text} onChange={(e) => typed(e.target.value)} placeholder='GUY year it was built, e.g. 3016' aria-label='The GUY year it was built' />
            <div className={styles.stepper}>
                <span className='pixel-label'>Iteration</span>
                <button type='button' className={styles.chip} disabled={!known || iteration <= 1} onClick={() => onChange({ iteration: iteration - 1 })} aria-label='An earlier iteration'>-</button>
                <b>{iteration}</b>
                <button type='button' className={styles.chip} disabled={!known || iteration >= 99} onClick={() => onChange({ iteration: iteration + 1 })} aria-label='A later iteration'>+</button>
            </div>
        </div>
    );
}

/** How far a star or pair is from what it orbits, AU. */
function StarDistance({ draft, onChange, primary }: { draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; primary: Body }) {
    const pair = primary.kind === 'barycenter';
    return (
        <ScaleInput
            label={pair ? "Distance from the pair's center" : `Distance from ${primary.name}`}
            value={draft.orbit}
            onChange={(v) => onChange({ orbit: v })}
            refs={pair ? PAIR_STAR_REFS : ORBIT_REFS}
            range={pair ? PAIR_STAR_RANGE : ORBIT_RANGE}
            unit='AU'
            bounds={[0.001, 1e5]}
            readout={`${fmtNum(draft.orbit)} AU`}
        />
    );
}

export function BodyFields({ kind, draft, onChange, starType, system, selfId, planet, primary }: { kind: BodyKind; draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; /** What lights its orbit: a star's type, or a star or pair as a Host. */ starType: string | Host; /** Planets: the system it is in, and its own id once it exists. */ system?: Place; selfId?: number; /** Moons and stations: the planet it orbits. */ planet?: Body; /** What it orbits (none for the system's primary). */ primary?: Body }) {
    if (kind === 'star') {
        return (
            <>
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
                {/* A companion, or one of a pair: the primary itself has no orbit */}
                {primary && <StarDistance draft={draft} onChange={onChange} primary={primary} />}
            </>
        );
    }
    if (kind === 'barycenter') {
        if (!primary) return null;
        if (draft.type === 'stars') return <StarDistance draft={draft} onChange={onChange} primary={primary} />;
        return (
            <>
                <ScaleInput
                    label='Distance from its star'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={ORBIT_REFS}
                    range={ORBIT_RANGE}
                    starType={starType}
                    unit='AU'
                    bounds={[0.001, 1e5]}
                    readout={`${zoneOf(draft.orbit, starType).label}, ${fmtNum(draft.orbit)} AU, year of ${fmtNum(yearDays(draft.orbit, starType))} eqx`}
                />
                <PlanetNumber draft={draft} onChange={onChange} system={system} selfId={selfId} host={primary} />
            </>
        );
    }
    if (kind === 'belt') {
        // Round a star (or pair of stars) a belt is measured in AU; round anything else it is a ring, in km, clear of the surface
        const ring = primary && !isStarry(primary) ? primary : null;
        const unit = ring ? 'km' : 'AU';
        const range: [number, number] = ring ? ringRange(ring) : ORBIT_RANGE;
        const orbit = Math.max(draft.orbit, range[0]);
        const widest = (at: number) => beltWidthMax(at, ring ? ring.radiusKm : 0);
        const width = Math.min(draft.width ?? 1, widest(orbit));
        return (
            <>
                <div className={styles.field}>
                    <div className={styles.fieldHead}><span className='pixel-label'>Made of</span></div>
                    <div className={styles.chips}>
                        {BELT_TYPES.map((key) => (
                            <button key={key} type='button' className={cx(styles.chip, draft.type === key && styles.chipOn)} style={{ '--chip': COMPOSITIONS[key].color } as React.CSSProperties} onClick={() => onChange({ type: key })}>
                                <i className={styles.chipDot} />{key === 'rocky' ? 'Rock' : COMPOSITIONS[key].label}
                            </button>
                        ))}
                    </div>
                </div>
                <ScaleInput
                    label={ring ? 'Distance from what it circles' : 'Distance from its star'}
                    value={orbit}
                    onChange={(v) => onChange({ orbit: v, width: Math.min(width, widest(v)) })}
                    refs={ring ? MOON_ORBIT_REFS.filter((r) => r.value > range[0] * 1.15 && r.value <= range[1]) : ORBIT_REFS}
                    range={range}
                    starType={ring ? undefined : starType}
                    unit={unit}
                    bounds={ring ? [range[0], 1e9] : [0.001, 1e5]}
                    readout={ring ? `${fmtNum(orbit)} km, ${fmtNum(orbit / ring.radiusKm)} radii out` : `${zoneOf(orbit, starType).label}, ${fmtNum(orbit)} AU`}
                />
                <ScaleInput
                    label='Width'
                    value={width}
                    onChange={(v) => onChange({ width: Math.min(v, widest(orbit)) })}
                    refs={ring ? RING_WIDTH_REFS : BELT_WIDTH_REFS}
                    range={ring ? RING_WIDTH_RANGE : BELT_WIDTH_RANGE}
                    unit={unit}
                    bounds={[ring ? 1 : 0.001, widest(orbit)]}
                    readout={`${fmtNum(width)} ${unit}, from ${fmtNum(orbit - width / 2)} to ${fmtNum(orbit + width / 2)}`}
                />
            </>
        );
    }
    // One of a pair of planets is measured in km from the pair's center, like a moon
    const orbitsStar = kind === 'planet' && (!primary || isStarry(primary));
    const zone = zoneOf(draft.orbit, starType);
    // A moon cannot orbit inside its planet's Roche limit, nor a station inside the planet
    const satRange = satelliteRange(kind, planet, draft.type);
    const satRefs = [
        ...(planet && kind === 'moon' ? [{ key: 'roche', label: 'Roche limit', value: satRange[0] }] : []),
        ...MOON_ORBIT_REFS.filter((r) => r.value > satRange[0] * 1.15 && r.value <= satRange[1]),
    ];
    const satOrbit = Math.max(draft.orbit, satRange[0]);
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
                readout={`${describeSize(draft.radiusKm)}, ${fmtNum(draft.radiusKm)} km`}
                unit='km'
                bounds={[1, 1e7]}
            />
            {orbitsStar ? (
                <ScaleInput
                    label='Distance from its star'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={ORBIT_REFS}
                    range={ORBIT_RANGE}
                    starType={starType}
                    unit='AU'
                    bounds={[0.001, 1e5]}
                    readout={`${zone.label}, ${fmtNum(draft.orbit)} AU, year of ${fmtNum(yearDays(draft.orbit, starType))} eqx`}
                />
            ) : (
                <ScaleInput
                    label='Distance from what it orbits'
                    value={satOrbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={satRefs}
                    range={satRange}
                    unit='km'
                    bounds={[satRange[0], 1e9]}
                    readout={`${fmtNum(satOrbit)} km`}
                />
            )}
            {orbitsStar && <PlanetNumber draft={draft} onChange={onChange} system={system} selfId={selfId} host={primary} />}
            {kind === 'station' && <StationBuilt key={selfId ?? 'new'} draft={draft} onChange={onChange} prefix={primary?.gu || (primary && isStarry(primary) && !primary.unnamed ? primary.name : undefined) || planet?.gu || undefined} />}
        </>
    );
}

// ---------- Detail blocks ----------
/** A place's or body's description, then what the wiki has on it: picture, opening paragraph and the link to the article. */
export function Writeup({ of }: { of: Place | Body }) {
    const wiki = of.wiki;
    return (
        <>
            {of.note && <RichText html={of.note} />}
            {wiki && (
                <div className={styles.wiki}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {wiki.image && <img src={wiki.image} alt='' loading='lazy' />}
                    {wiki.intro && <p>{wiki.intro}</p>}
                    {wiki.faction && <p><span className='pixel-label'>Faction</span> {wiki.faction}</p>}
                    <WikiLink slug={of.slug ?? ''} page={wiki.page} />
                </div>
            )}
        </>
    );
}

/** Name, description and wiki slug of a place (`body` null) or of one body. Each field is saved when it is left. */
export function TextFields({ store, place, body }: { store: Store; place: Place; body: Body | null }) {
    const of = body ?? place;
    const saved = {
        name: (body ? body.unnamed : place.placeholder) ? '' : of.name,
        description: decodeEntities(of.note ?? ''),
        slug: of.slug ?? '',
    };
    const [draft, setDraft] = useState(saved);
    const [slugError, setSlugError] = useState(false);
    // A name may be empty where the map allows it: a system and its star ("not named
    // yet"), and a planet or moon, which then goes by its designation
    const nameless = body ? body.kind !== 'station' : place.kind === 'system';

    const send = (fields: TextPatch & { category?: string }) => (body ? store.editBody(place.id, body.id, fields) : store.editPlace(place.id, fields));
    async function commit(key: 'name' | 'description' | 'slug') {
        const value = key === 'description' ? draft[key] : draft[key].trim();
        setSlugError(false);
        if (value === saved[key]) return setDraft({ ...draft, [key]: value });
        if (key === 'slug' && value && !isValidSlug(value)) return setSlugError(true);
        if ((key === 'name' && !value && !nameless) || !(await send({ [key]: value }))) setDraft({ ...draft, [key]: saved[key] });
    }
    const field = (key: 'name' | 'slug') => ({
        value: draft[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value }),
        onBlur: () => void commit(key),
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur(),
        maxLength: 100,
    });

    return (
        <div className={styles.textFields}>
            <label className={styles.field}>
                <span className='pixel-label'>Name</span>
                <input {...field('name')} placeholder={!nameless ? undefined : body?.gu || 'Not named yet'} />
            </label>
            {!body && place.kind === 'landmark' && (
                <label className={styles.field}>
                    <span className='pixel-label'>Kind</span>
                    <select value={place.category ?? 'landmark'} onChange={(e) => void send({ category: e.target.value })}>
                        {Object.entries(LANDMARK_CATEGORIES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </label>
            )}
            <label className={styles.field}>
                <span className='pixel-label'>Description</span>
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => void commit('description')} rows={4} maxLength={5000} />
            </label>
            <label className={styles.field}>
                <span className='pixel-label'>Wiki slug</span>
                <input {...field('slug')} placeholder='lowercase_with_underscores' spellCheck={false} aria-invalid={slugError} />
                {slugError && <span className={styles.fieldError}>Lowercase letters and digits, joined by underscores</span>}
            </label>
        </div>
    );
}

/** The episodes tagged on a place (with those on its bodies) or on one body, in episode order. Members tag more. */
export function Travelogue({ store, place, body }: { store: Store; place: Place; body: Body | null }) {
    const [adding, setAdding] = useState(false);
    const rows = body ? body.travelogue.map((tag) => ({ tag, via: '' })) : [...place.travelogue.map((tag) => ({ tag, via: '' })), ...place.bodies.flatMap((b) => b.travelogue.map((tag) => ({ tag, via: b.name })))];
    rows.sort((a, b) => (a.tag.episode?.seasonTitle ?? '').localeCompare(b.tag.episode?.seasonTitle ?? '') || (a.tag.episode?.episode_no ?? 0) - (b.tag.episode?.episode_no ?? 0));
    const user = store.user;
    if (rows.length === 0 && !user) return null;
    const here = body ? body.travelogue : place.travelogue;
    return (
        <section className={styles.travelogue}>
            <h4 className='pixel-label'>Travelogue</h4>
            {rows.length > 0 && (
                <ol>
                    {rows.map(({ tag, via }) => (
                        <li key={tag.id}>
                            <div className={styles.tagRow}>
                                <span>
                                    {tag.episode ? (
                                        <Link href={`/archives/${tag.episode.seasonSlug}/${tag.episode.slug}`}>
                                            {tag.episode.seasonTitle} episode {tag.episode.episode_no}, {tag.episode.title}
                                        </Link>
                                    ) : (
                                        <span className={styles.muted}>{tag.episodeSlug}</span>
                                    )}
                                    {via && <span className={styles.muted}> on {via}</span>}
                                </span>
                                {user && (user.id === tag.creatorId || store.canEdit(place)) && (
                                    <button type='button' className={styles.untag} title='Remove from the travelogue' aria-label={`Remove ${tag.episode?.title ?? tag.episodeSlug} from the travelogue`} onClick={() => store.untagEpisode(place.id, tag.id)}>
                                        ×
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            {user &&
                (adding ? (
                    <EpisodePicker store={store} taken={here.map((tag) => tag.episodeSlug)} onPick={(slug) => store.tagEpisode(place.id, body?.id ?? null, slug)} onClose={() => setAdding(false)} />
                ) : (
                    <button type='button' className={styles.linkBtn} onClick={() => (store.loadEpisodes(), setAdding(true))}>
                        Tag an episode
                    </button>
                ))}
        </section>
    );
}

/** Type to find an episode; picking one tags it and leaves the box open for the next. */
function EpisodePicker({ store, taken, onPick, onClose }: { store: Store; taken: string[]; onPick: (slug: string) => void; onClose: () => void }) {
    const [q, setQ] = useState('');
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (store.episodes ?? []).filter((e) => !taken.includes(e.slug) && words.every((w) => e.label.toLowerCase().includes(w)));
    const shown = matches.slice(0, 8);
    return (
        <div className={styles.episodePicker}>
            <div className={styles.inlineForm}>
                <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') onClose();
                        if (e.key === 'Enter' && words.length > 0 && shown.length === 1) onPick(shown[0].slug);
                    }}
                    placeholder='Episode title or season'
                    aria-label='Find an episode'
                />
                <button type='button' className={styles.btnQuiet} onClick={onClose}>Done</button>
            </div>
            {store.episodes === null ? (
                <p className={styles.muted}>Loading episodes</p>
            ) : shown.length === 0 ? (
                <p className={styles.muted}>No episode matches</p>
            ) : (
                <ul>
                    {shown.map((e) => (
                        <li key={e.slug}>
                            <button type='button' onClick={() => onPick(e.slug)}>{e.label}</button>
                        </li>
                    ))}
                    {matches.length > shown.length && <li className={styles.muted}>and {matches.length - shown.length} more</li>}
                </ul>
            )}
        </div>
    );
}


/** The mark beside a body's kind: I, II, III for a belt among the belts round the same body; a, b, c for a moon or station; none for a planet, whose number is in its kind ("Planet 3") (`designate` in data.ts does the counting). */
export function designation(b: Body): string {
    if (b.kind === 'star') return b.letter ?? '';
    // A pair of stars by its stars' letters (AB); a pair of planets says its number in its kind
    if (b.kind === 'barycenter') return b.type === 'stars' && b.gu ? b.gu.slice(b.gu.lastIndexOf('-') + 1) : '';
    if (b.kind === 'belt') return `${roman(b.num)}${b.sub ? `.${b.sub}` : ''}`;
    if (b.kind === 'moon') return letters(b.num);
    // Only when the station is designated: its year and iteration mean nothing without its primary's part
    if (b.kind === 'station') return b.gu ? stationMark(b) : '';
    return '';
}

/** A body's name, with its GU designation after it when it has a name of its own. */
export function BodyName({ body, paren }: { body: Body; paren?: boolean }) {
    return (
        <>
            {body.name}
            {!body.unnamed && body.gu && <span className={styles.gu}>{paren ? `(${body.gu})` : body.gu}</span>}
        </>
    );
}

const DARK = 'rgba(0, 0, 0, 0.2)';
const LIGHT = 'rgba(255, 255, 255, 0.26)';

/**
 * What a planet or moon is made of, drawn over its disc at (x, y) in a darker and a
 * lighter shade of whatever color it has. Shapes are laid out on a disc of radius 1
 * and turned by an angle that differs per body, so no two look stamped.
 */
export function BodyTexture({ body, x, y, r, scope = 'map' }: { body: Body; x: number; y: number; r: number; /** Keeps the clip's id apart where the same body is drawn twice on a page. */ scope?: string }) {
    const banded = body.type === 'gas' || body.type === 'ice' || body.type === 'desert';
    const turn = banded ? ((body.id * 47) % 50) - 25 : (body.id * 47) % 360;
    return (
        <g transform={`translate(${x} ${y}) scale(${r})`} pointerEvents='none'>
            <clipPath id={`galaxy-disc-${scope}-${body.id}`}><circle r='1' /></clipPath>
            <g clipPath={`url(#galaxy-disc-${scope}-${body.id})`}>
                <g transform={`rotate(${turn})`}>
                    {body.type === 'rocky' && (
                        <>
                            <path d='M-1.1 0.25C-0.6 0 -0.2 0.3 0.1 0.55S0.7 0.9 1.1 0.7V1.2H-1.1Z' fill={DARK} />
                            <circle cx='-0.35' cy='-0.3' r='0.27' fill={DARK} />
                            <circle cx='0.42' cy='-0.02' r='0.18' fill={DARK} />
                            <circle cx='0.2' cy='-0.58' r='0.11' fill={DARK} />
                            <circle cx='-0.41' cy='-0.36' r='0.13' fill={LIGHT} />
                        </>
                    )}
                    {body.type === 'ocean' && (
                        <>
                            <path d='M-0.75 -0.2C-0.6 -0.62 -0.1 -0.6 0.02 -0.25C0.12 0.05 -0.2 0.12 -0.3 0.3C-0.4 0.5 -0.62 0.4 -0.7 0.15Z' fill={LIGHT} />
                            <path d='M0.25 0.15C0.5 -0.05 0.85 0.2 0.7 0.5C0.6 0.75 0.3 0.8 0.2 0.55Z' fill={LIGHT} />
                            <path d='M0.3 -0.7C0.5 -0.75 0.7 -0.55 0.6 -0.42C0.5 -0.32 0.3 -0.45 0.3 -0.7Z' fill={LIGHT} />
                            <path d='M-1.1 0.5C-0.5 0.75 0.3 0.95 1.1 0.6V1.2H-1.1Z' fill={DARK} />
                        </>
                    )}
                    {body.type === 'desert' && (
                        <>
                            <path d='M-1 -0.5Q-0.5 -0.7 0 -0.5T1 -0.5V-0.3Q0.5 -0.5 0 -0.3T-1 -0.3Z' fill={DARK} />
                            <path d='M-1 0.05Q-0.5 -0.15 0 0.05T1 0.05V0.3Q0.5 0.1 0 0.3T-1 0.3Z' fill={DARK} />
                            <path d='M-1 -0.2Q-0.5 -0.4 0 -0.2T1 -0.2V-0.1Q0.5 -0.3 0 -0.1T-1 -0.1Z' fill={LIGHT} />
                            <path d='M-1 0.6Q-0.5 0.4 0 0.6T1 0.6V0.72Q0.5 0.52 0 0.72T-1 0.72Z' fill={LIGHT} />
                        </>
                    )}
                    {body.type === 'ice' && (
                        <>
                            <ellipse cx='0' cy='-1' rx='0.85' ry='0.45' fill={LIGHT} />
                            <ellipse cx='0' cy='1' rx='0.7' ry='0.36' fill={LIGHT} />
                            <path d='M-0.8 0.1L-0.35 -0.1L0 0.15L0.4 -0.05L0.85 0.2M-0.35 -0.1L-0.2 -0.4M0.4 -0.05L0.3 0.4' fill='none' stroke={DARK} strokeWidth='0.07' />
                        </>
                    )}
                    {body.type === 'gas' && (
                        <>
                            <rect x='-1' y='-0.68' width='2' height='0.2' fill={DARK} />
                            <rect x='-1' y='-0.36' width='2' height='0.1' fill={LIGHT} />
                            <rect x='-1' y='-0.12' width='2' height='0.26' fill={DARK} />
                            <rect x='-1' y='0.3' width='2' height='0.09' fill={LIGHT} />
                            <rect x='-1' y='0.52' width='2' height='0.16' fill={DARK} />
                            <ellipse cx='0.36' cy='0.24' rx='0.22' ry='0.1' fill={LIGHT} />
                        </>
                    )}
                    {body.type === 'artificial' && (
                        <>
                            <path d='M-1 -0.34H1M-1 0.34H1M-0.34 -1V1M0.34 -1V1' fill='none' stroke={DARK} strokeWidth='0.08' />
                            <circle r='0.66' fill='none' stroke={LIGHT} strokeWidth='0.08' />
                        </>
                    )}
                </g>
            </g>
        </g>
    );
}

/** The head of a body's details: a planet or moon as the diagram draws it, texture and all; a star or station as its icon. */
export function BodyPortrait({ body, size = 40 }: { body: Body; size?: number }) {
    if (body.kind !== 'planet' && body.kind !== 'moon') return <BodyIcon body={body} size={size} />;
    return (
        <svg className={styles.bodyIcon} width={size} height={size} viewBox='0 0 40 40' aria-hidden>
            <circle cx='20' cy='20' r='19' fill={bodyColor(body)} />
            <BodyTexture body={body} x={20} y={20} r={19} scope='portrait' />
            <circle cx='20' cy='20' r='18' className={styles.shade} />
        </svg>
    );
}

/** Sun, planet, moon, station, belt or pair, in the body's own colors. */
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
            {body.kind === 'belt' && (
                <>
                    <circle cx='8' cy='8' r='6.2' fill='none' stroke={c} strokeWidth='2.2' strokeDasharray='1.7 1.55' />
                    {body.ring && <circle cx='8' cy='8' r='2.6' fill={c} opacity='0.55' />}
                </>
            )}
            {/* A pair: two bodies chasing each other round their barycenter, each trailing an arc (like the sign of Cancer), in the pair's own colors */}
            {body.kind === 'barycenter' && (
                <>
                    <path d='M4.46 4.46A5 5 0 0 1 12.83 6.71' fill='none' stroke={body.pairColors?.[0] ?? c} strokeWidth='1.3' strokeLinecap='round' opacity='0.75' />
                    <path d='M11.54 11.54A5 5 0 0 1 3.17 9.29' fill='none' stroke={body.pairColors?.[1] ?? c} strokeWidth='1.3' strokeLinecap='round' opacity='0.75' />
                    <circle cx='4.46' cy='4.46' r='2.4' fill={body.pairColors?.[0] ?? c} />
                    <circle cx='11.54' cy='11.54' r='2.4' fill={body.pairColors?.[1] ?? c} />
                </>
            )}
        </svg>
    );
}

/** A landmark by its category: station, star cluster, nebula, or a plain marker. */
export function LandmarkIcon({ category, size = 16 }: { category?: string; size?: number }) {
    const c = '#7fd3e8';
    return (
        <svg className={styles.bodyIcon} width={size} height={size} viewBox='0 0 16 16' aria-hidden>
            {category === 'station' && <path d='M8 1.5l6.5 6.5L8 14.5 1.5 8z M8 5.5L5.5 8 8 10.5 10.5 8z' fill={c} fillRule='evenodd' />}
            {category === 'cluster' && [[8, 8, 2.4], [3.6, 5.2, 1.5], [12.2, 4.6, 1.3], [4.6, 11.8, 1.3], [12, 11.6, 1.6], [8, 2.6, 1]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} />)}
            {category === 'nebula' && (
                <>
                    <circle cx='6' cy='9' r='4.4' fill={c} opacity='0.55' />
                    <circle cx='10.4' cy='6.6' r='3.8' fill={c} opacity='0.55' />
                    <circle cx='10' cy='10.6' r='2.8' fill={c} opacity='0.55' />
                </>
            )}
            {category !== 'station' && category !== 'cluster' && category !== 'nebula' && <path d='M8 2l6 6-6 6-6-6z' fill={c} />}
        </svg>
    );
}

export function BodyTree({ place, selBodyId, onPick, onOpen }: { place: Place; selBodyId: number | null; onPick: (bodyId: number) => void; onOpen?: (bodyId: number) => void }) {
    const kids = (parentId: number | null) => place.bodies.filter((b) => b.parentId === parentId).sort((a, b) => a.orbit - b.orbit);
    const row = (b: Body, depth: number): React.ReactNode => (
        <li key={b.id}>
            <button type='button' className={cx(styles.treeRow, selBodyId === b.id && styles.treeRowOn)} style={{ paddingLeft: 8 + depth * 16 }} onClick={() => onPick(b.id)} onDoubleClick={() => onOpen?.(b.id)}>
                <BodyIcon body={b} />
                {/* A station's year and iteration are too long for the column, and its full designation follows its name anyway */}
                {(b.kind !== 'star' || b.letter) && <span className={styles.desig}>{b.kind === 'station' ? '' : designation(b)}</span>}
                <BodyName body={b} />
                <span className={styles.muted}>{kindLabel(b)}</span>
            </button>
            {kids(b.id).length > 0 && <ul>{kids(b.id).map((k) => row(k, depth + 1))}</ul>}
        </li>
    );
    return <ul className={styles.tree}>{kids(null).map((b) => row(b, 0))}</ul>;
}

/**
 * A system's big dot: its star, or every one of its stars (companions too) overlapping
 * from the top left, A in front, each sized a little by its kind.
 */
export function SystemDot({ place }: { place: Place }) {
    // useId's characters are not all safe in a url(#...) reference
    const shade = `dots${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const stars = place.bodies.filter((b) => b.kind === 'star').sort((a, b) => (a.letter ?? '').localeCompare(b.letter ?? '') || a.id - b.id);
    if (stars.length < 2) {
        const star = stars[0];
        return <i className={styles.bigDot} style={{ background: star ? bodyColor(star) : '#7fd3e8', borderRadius: '50%' }} />;
    }
    const size = 44;
    const r = size / (stars.length * 0.9 + 1.3);
    const step = (size - 2 * r) / (stars.length - 1);
    const biggest = Math.max(...stars.map((b) => STAR_TYPES[b.type]?.px ?? 24));
    return (
        <svg className={styles.starDots} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role='img' aria-label={`${stars.length} stars`}>
            <defs>
                <radialGradient id={shade} cx='0.35' cy='0.35' r='0.75'>
                    <stop offset='0.55' stopColor='#000' stopOpacity='0' />
                    <stop offset='1' stopColor='#000' stopOpacity='0.45' />
                </radialGradient>
            </defs>
            {/* B and the rest behind, A last so it sits in front */}
            {stars.map((b, i) => ({ b, i })).reverse().map(({ b, i }) => {
                const at = r + i * step;
                const rr = r * (0.75 + 0.25 * ((STAR_TYPES[b.type]?.px ?? 24) / biggest));
                return (
                    <g key={b.id}>
                        <circle cx={at} cy={at} r={rr} fill={bodyColor(b)} stroke={b.type === 'black_hole' ? '#f0b44c' : 'rgba(0, 0, 0, 0.5)'} strokeWidth='1.5' />
                        <circle cx={at} cy={at} r={rr} fill={`url(#${shade})`} />
                    </g>
                );
            })}
        </svg>
    );
}

export function PlaceHeader({ place }: { place: Place }) {
    return (
        <header className={styles.detailHead}>
            {place.kind === 'system' ? <SystemDot place={place} /> : <i className={styles.bigDot} style={{ background: '#7fd3e8', borderRadius: 0 }} />}
            <div>
                <h3>{placeTitle(place)}</h3>
                <p className='pixel-label'>
                    {place.kind === 'landmark' ? (LANDMARK_CATEGORIES[place.category ?? ''] ?? 'Landmark') : place.placeholder ? 'System, star not named yet' : 'System'}
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
            <dd>{place.owner.username}</dd>
        </dl>
    );
}

export function BodyFacts({ place, body }: { place: Place; body: Body }) {
    const host = hostOf(place.bodies, body);
    const parent = place.bodies.find((b) => b.id === body.parentId);
    const unit = unitOf(place.bodies, body);
    if (body.kind === 'star' || body.kind === 'barycenter') {
        return (
            <dl className={styles.facts}>
                <dt>Kind</dt>
                <dd>{body.kind === 'star' ? STAR_TYPES[body.type]?.label : kindLabel(body)}</dd>
                {body.kind === 'barycenter' && (
                    <>
                        <dt>The pair</dt>
                        <dd>{pairOf(place, body)}</dd>
                    </>
                )}
                {parent && (
                    <>
                        <dt>Orbits</dt>
                        <dd>{parent.name} at {fmtNum(body.orbit)} {unit}</dd>
                    </>
                )}
                <dt>Planets</dt>
                <dd>{place.bodies.filter((b) => b.parentId === body.id && isSlot(b)).length}</dd>
            </dl>
        );
    }
    if (body.kind === 'belt') {
        return (
            <dl className={styles.facts}>
                <dt>Made of</dt>
                <dd>{body.type === 'rocky' ? 'Rock' : COMPOSITIONS[body.type]?.label}</dd>
                <dt>Circles</dt>
                <dd>{parent?.name ?? 'nothing'} at {fmtNum(body.orbit)} {unit}</dd>
                <dt>Width</dt>
                <dd>{fmtNum(body.width ?? 0)} {unit}</dd>
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
            <dd>{parent?.name ?? 'nothing'}{unit === 'AU' ? ` at ${fmtNum(body.orbit)} AU` : `, ${fmtNum(body.orbit)} km out`}</dd>
            {body.kind === 'planet' && host && (
                <>
                    {!host.hole && (
                        <>
                            <dt>Climate</dt>
                            <dd>{zoneOf(orbitAU(place.bodies, body), host).label} orbit</dd>
                        </>
                    )}
                    <dt>Year</dt>
                    <dd>{fmtNum(yearDays(orbitAU(place.bodies, body), host))} equinoxes</dd>
                </>
            )}
        </dl>
    );
}

/** The two (or more) bodies of a pair, by name. */
export const pairOf = (place: Place, b: Body) =>
    place.bodies.filter((k) => k.parentId === b.id && (b.type === 'stars' ? isStarry(k) : k.kind === 'planet')).map((k) => k.name).join(' and ') || 'none yet';

/** Asks once more before deleting. */
export function DeleteButton({ onDelete }: { onDelete: () => void }) {
    const [armed, setArmed] = useState(false);
    return armed ? (
        <>
            <button type='button' className={styles.btn} onClick={() => (setArmed(false), onDelete())}>Yes, delete</button>
            <button type='button' className={styles.btnQuiet} onClick={() => setArmed(false)}>Keep</button>
        </>
    ) : (
        <button type='button' className={styles.btnQuiet} onClick={() => setArmed(true)}>Delete</button>
    );
}

/** Everything about the current selection on the galaxy level. */
export function SelectionDetail({ store }: { store: Store }) {
    const [editing, setEditing] = useState(false);
    const place = store.selPlace;
    if (!place) return null;
    const body = store.selBody;
    const mine = store.canEdit(place);

    return (
        <div className={styles.detail}>
            {body ? (
                <>
                    <header className={styles.detailHead}>
                        <BodyPortrait body={body} />
                        <div>
                            <h3><BodyName body={body} paren /></h3>
                            <p className='pixel-label'>{kindLabel(body)} in {place.placeholder ? 'an unnamed system' : place.name}</p>
                        </div>
                    </header>
                    {!(editing && mine) && <Writeup of={body} />}
                    {editing && mine ? (
                      <>
                        <TextFields key={body.id} store={store} place={place} body={body} />
                        <BodyFields kind={body.kind} draft={body} starType={hostOf(place.bodies, body) ?? 'sunlike'} system={place} selfId={body.id} planet={place.bodies.find((b) => b.id === body.parentId && isSlot(b))} primary={place.bodies.find((b) => b.id === body.parentId)} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
                      </>
                    ) : (
                        <BodyFacts place={place} body={body} />
                    )}
                    <Travelogue store={store} place={place} body={body} />
                    {mine && (
                        <div className={cx(styles.actions, styles.sheetActions)}>
                            <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                            {body.parentId !== null && <DeleteButton onDelete={() => store.removeBody(place.id, body.id)} />}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <PlaceHeader place={place} />
                    {editing && mine ? <TextFields key={place.id} store={store} place={place} body={null} /> : <Writeup of={place} />}
                    <PlaceFacts place={place} />
                    {place.placeholder && mine && !editing && <RenameRow store={store} place={place} />}
                    {place.kind === 'system' && <BodyTree place={place} selBodyId={null} onPick={(id) => store.openSystem(place.id, id)} />}
                    <Travelogue store={store} place={place} body={null} />
                    {/* Last and pinned to the sheet's foot, so Open system is in reach however long the sheet */}
                    <div className={cx(styles.actions, styles.sheetActions)}>
                        {place.kind === 'system' && <button type='button' className={styles.btn} onClick={() => store.openSystem(place.id)}>Open system</button>}
                        {mine && <button type='button' className={styles.btnQuiet} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>}
                        {mine && (
                            <button type='button' className={styles.btnQuiet} onClick={() => store.requestPlace((pos) => store.movePlace(place.id, { pos: [pos[0], pos[1], place.pos[2]], precision: 'exact' }))}>
                                {place.precision === 'region' ? 'Pin it down' : 'Move'}
                            </button>
                        )}
                        {mine && <DeleteButton onDelete={() => store.removePlace(place.id)} />}
                    </div>
                </>
            )}
        </div>
    );
}

export function RenameRow({ store, place }: { store: Store; place: Place }) {
    const [name, setName] = useState('');
    return (
        <form className={styles.inlineForm} onSubmit={(e) => (e.preventDefault(), name.trim() && store.renamePlace(place.id, name.trim()))}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Name this star system' aria-label='System name' maxLength={100} />
            <button type='submit' className={styles.btn}>Name it</button>
        </form>
    );
}

// ---------- Where does it go? ----------
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
                <button type='button' className={cx(styles.chip, where?.precision === 'exact' && styles.chipOn)} onClick={() => store.requestPlace((pos) => onChange({ pos: lifted(pos), precision: 'exact' }))}>
                    Pick the spot on the map
                </button>
            </div>
        </div>
    );
}

// ---------- Add wizard ----------
export type CreateKind = 'system' | 'planet' | 'moon' | 'station' | 'belt' | 'companion' | 'landmark' | 'pair';
const CREATE_KINDS: { key: Exclude<CreateKind, 'pair'>; label: string }[] = [
    { key: 'system', label: 'Star system' },
    { key: 'planet', label: 'Planet' },
    { key: 'moon', label: 'Moon' },
    { key: 'station', label: 'Station' },
    { key: 'belt', label: 'Belt or ring' },
    { key: 'companion', label: 'Companion star' },
    { key: 'landmark', label: 'Landmark' },
];

/** A body to draw a kind's picture with (its texture keys off `type` and `id`). */
const sample = (kind: BodyKind, type: string, id: number): Body => ({ id, kind, parentId: null, name: '', ordinal: null, num: 0, gu: '', type, radiusKm: 6371, orbit: 1, travelogue: [] });

/** What each kind looks like in the system view, small: the same discs, textures, orbits and bands the diagram draws. */
function KindPicture({ kind }: { kind: Exclude<CreateKind, 'pair'> }) {
    if (kind === 'landmark') return <LandmarkIcon category='landmark' size={28} />;
    const glow = (x: number, y: number, r: number, color: string) => (
        <>
            <circle cx={x} cy={y} r={r * 1.7} fill={color} opacity='0.18' />
            <circle cx={x} cy={y} r={r} fill={color} />
        </>
    );
    const disc = (b: Body, x: number, y: number, r: number) => (
        <>
            <circle cx={x} cy={y} r={r} fill={bodyColor(b)} />
            <BodyTexture body={b} x={x} y={y} r={r} scope='kind' />
            <circle cx={x} cy={y} r={r} className={styles.shade} />
        </>
    );
    const sun = STAR_TYPES.sunlike.color;
    return (
        <svg className={styles.kindPicture} width='56' height='36' viewBox='0 0 56 36' aria-hidden>
            {kind === 'system' && (
                <>
                    <circle cx='14' cy='18' r='28' className={styles.orbitLine} />
                    {glow(14, 18, 8, sun)}
                    {disc(sample('planet', 'ocean', 990001), 40.3, 8.4, 3.5)}
                </>
            )}
            {kind === 'planet' && (
                <>
                    <circle cx='-40' cy='18' r='68' className={styles.orbitLine} />
                    {disc(sample('planet', 'ocean', 990002), 28, 18, 11)}
                </>
            )}
            {kind === 'moon' && (
                <>
                    <circle cx='8' cy='18' r='22' className={styles.orbitLine} />
                    {disc(sample('planet', 'gas', 990003), 8, 18, 12)}
                    {disc(sample('moon', 'rocky', 990004), 30, 18, 4.5)}
                </>
            )}
            {kind === 'station' && (
                <>
                    <circle cx='14' cy='18' r='18' className={styles.orbitLine} />
                    {disc(sample('planet', 'rocky', 990005), 14, 18, 9)}
                    <rect x='29' y='14.5' width='7' height='7' fill={COMPOSITIONS.artificial.color} transform='rotate(45 32.5 18)' />
                </>
            )}
            {kind === 'belt' && (
                <g style={{ color: COMPOSITIONS.rocky.color }}>
                    <circle cx='-14' cy='18' r='42' className={styles.beltBand} style={{ strokeWidth: 12 }} />
                    {[{ at: -3.5, gap: 5 }, { at: 0, gap: 7 }, { at: 3.5, gap: 4 }].map((lane) => (
                        <circle key={lane.at} cx='-14' cy='18' r={42 + lane.at} className={styles.beltDots} strokeDasharray={`0.1 ${lane.gap}`} />
                    ))}
                </g>
            )}
            {kind === 'companion' && (
                <>
                    <circle cx='14' cy='18' r='26' className={styles.orbitLine} strokeDasharray='2 4' />
                    {glow(14, 18, 8, sun)}
                    {glow(38.7, 10, 4.5, STAR_TYPES.red_dwarf.color)}
                </>
            )}
        </svg>
    );
}

/** The kinds to add, as cards with each kind's picture (in place of a row of chips). */
function KindCards({ kind, onPick }: { kind: Exclude<CreateKind, 'pair'> | null; onPick: (k: Exclude<CreateKind, 'pair'>) => void }) {
    return (
        <div className={styles.kindCards} role='tablist' aria-label='What are you adding?'>
            {CREATE_KINDS.map((k) => (
                <button key={k.key} type='button' role='tab' aria-selected={kind === k.key} className={cx(styles.kindCard, kind === k.key && styles.kindCardOn)} onClick={() => onPick(k.key)}>
                    <span className={styles.kindPictureBox}><KindPicture kind={k.key} /></span>
                    {k.label}
                </button>
            ))}
        </div>
    );
}

/** "Name (system)", for the pickers that list bodies of every system the member may change. */
const inSystem = (b: Body, p: Place) => `${b.name} (${p.placeholder ? 'unnamed system' : p.name})`;

/** The order of the "Where does it go?" lists: stars, pairs of stars, planets, pairs of planets, moons. */
const BODY_GROUPS: { label: string; test: (b: Body) => boolean }[] = [
    { label: 'stars', test: (b) => b.kind === 'star' },
    { label: 'pairs of stars', test: (b) => b.kind === 'barycenter' && b.type === 'stars' },
    { label: 'planets', test: (b) => b.kind === 'planet' },
    { label: 'pairs of planets', test: (b) => b.kind === 'barycenter' && b.type === 'planets' },
    { label: 'moons', test: (b) => b.kind === 'moon' },
];
const groupOf = (b: Body) => BODY_GROUPS.findIndex((g) => g.test(b));
const byDesignation = (a: Body, b: Body) => (a.gu || a.name).localeCompare(b.gu || b.name, undefined, { numeric: true });

/**
 * The options of a "Where does it go?" list: the bodies of `here` (the system being worked
 * in) first, by type, then everyone else's, one group per type.
 */
function BodyOptions({ items, here }: { items: { b: Body; p: Place }[]; here: Place | null }) {
    const own = items.filter((x) => x.p.id === here?.id).sort((x, y) => groupOf(x.b) - groupOf(y.b) || byDesignation(x.b, y.b));
    const rest = items.filter((x) => x.p.id !== here?.id);
    const option = ({ b, p }: { b: Body; p: Place }, local: boolean) => (
        <option key={b.id} value={b.id}>{local ? (b.unnamed || !b.gu ? b.name : `${b.name} (${b.gu})`) : inSystem(b, p)}</option>
    );
    return (
        <>
            {own.length > 0 && <optgroup label='This system'>{own.map((x) => option(x, true))}</optgroup>}
            {BODY_GROUPS.map((g) => {
                const these = rest.filter((x) => g.test(x.b)).sort((x, y) => placeTitle(x.p).localeCompare(placeTitle(y.p)) || byDesignation(x.b, y.b));
                return these.length > 0 && <optgroup key={g.label} label={`${here ? 'Other ' : ''}${g.label}`.replace(/^./, (c) => c.toUpperCase())}>{these.map((x) => option(x, false))}</optgroup>;
            })}
        </>
    );
}

/** One wizard for everything a member can add, one question at a time. */
export function CreateFlow({ store, onDone, slot, at: spot, kind: asked }: { store: Store; onDone: () => void; /** Opened from a gap ring: the planet that goes there. */ slot?: PlanetSlot; /** Opened from a spot clicked on the map: where it goes. */ at?: Vec3; /** What to start on, when the button that opened this says. */ kind?: Exclude<CreateKind, 'pair'> }) {
    const sel = store.selBody;
    const ctxPlanet = sel && isSlot(sel) ? sel : null;
    const ctxSystem = store.level === 'system' && store.selPlace?.kind === 'system' ? store.selPlace : null;
    const ctxHost = sel && isStarry(sel) ? sel : null;
    // A belt circles the body that is picked, or else the open system's primary
    const canCircle = (b: Body) => isStarry(b) || isSlot(b) || b.kind === 'moon';
    const ctxPrimary = sel && canCircle(sel) ? sel : ctxSystem ? (primaryOf(ctxSystem) ?? null) : null;
    // Opened from a system with nothing picked ("+ Add"): no kind is chosen for the member
    const [kind, setKind] = useState<Exclude<CreateKind, 'pair'> | null>(asked ?? (ctxPlanet ? 'moon' : ctxSystem ? (sel ? 'planet' : null) : 'system'));
    const [name, setName] = useState('');
    // Where it goes, kept as two choices because systems and bodies are numbered separately (a system and a body can
    // share a number, so one choice read as the other picks the wrong thing): a planet's system ('new' = a planet
    // whose star is not known yet), and the body a moon, station, belt or companion star goes round.
    const [systemId, setSystemId] = useState<number | 'new'>(ctxSystem?.id ?? 'new');
    const [bodyId, setBodyId] = useState<number | null>(asked === 'belt' ? (ctxPrimary?.id ?? null) : asked === 'companion' ? (ctxHost?.id ?? (ctxSystem && primaryOf(ctxSystem)?.id) ?? null) : (ctxPlanet?.id ?? null));
    // A planet's star (or pair of stars), when its system has several; null = the system's primary
    const [hostId, setHostId] = useState<number | null>(ctxHost?.id ?? null);
    const [where, setWhere] = useState<Where | null>(() => (spot ? { pos: lifted(spot), precision: 'exact' } : null));
    const [starType, setStarType] = useState('sunlike');
    const [category, setCategory] = useState('landmark');
    const [draft, setDraft] = useState<BodyDraft>(
        asked === 'belt' ? beltDraft(ctxPrimary ?? undefined) : asked === 'companion' ? { type: 'red_dwarf', radiusKm: 0, orbit: 40 } : ctxPlanet ? { type: 'rocky', radiusKm: 1737, orbit: 384400 } : { type: 'rocky', radiusKm: 6371, orbit: 1, ...slot },
    );
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    // Bodies go into systems the member may change
    const systems = store.places.filter((p) => p.kind === 'system' && store.canEdit(p));
    // What a moon or station may orbit: a planet, or a pair of planets
    const planets = systems.flatMap((p) => p.bodies.filter(isSlot).map((b) => ({ b, p })));
    const hosts = systems.flatMap((p) => p.bodies.filter(isStarry).map((b) => ({ b, p })));
    const isSatellite = kind === 'moon' || kind === 'station';
    const primaries = systems.flatMap((p) => p.bodies.filter(canCircle).map((b) => ({ b, p })));
    // The system being worked in: the open one, else the one picked on the galaxy (if the member may change it)
    const here = ctxSystem ?? systems.find((p) => p.id === store.selPlace?.id) ?? null;
    const firstHere = (list: { b: Body; p: Place }[]) => list.find((x) => x.p.id === here?.id) ?? list[0];
    const parentPrimary = kind === 'belt' ? (primaries.find((x) => x.b.id === bodyId) ?? firstHere(primaries)) : null;
    const parentHost = kind === 'companion' ? (hosts.find((x) => x.b.id === bodyId) ?? firstHere(hosts)) : null;
    const parentPlanet = isSatellite ? (planets.find((x) => x.b.id === bodyId) ?? firstHere(planets)) : null;
    const parentSystem = kind === 'planet' ? systems.find((p) => p.id === systemId) : null;
    const systemHosts = parentSystem ? parentSystem.bodies.filter(isStarry) : [];
    const planetHost = parentSystem ? (systemHosts.find((b) => b.id === hostId) ?? primaryOf(parentSystem)) : undefined;
    const needsWhere = kind === 'system' || kind === 'landmark' || (kind === 'planet' && !parentSystem);
    const hostLight: string | Host = kind === 'planet' ? (parentSystem ? (hostOf(parentSystem.bodies, planetHost) ?? 'sunlike') : starType) : 'sunlike';
    // A planet of a known star, a moon, a belt or a companion star may go by its designation alone
    const nameOptional = (kind === 'planet' && !!parentSystem) || (kind === 'moon' && !!parentPlanet) || (kind === 'belt' && !!parentPrimary) || (kind === 'companion' && !!parentHost);
    const canSave =
        !saving && (name.trim() !== '' || nameOptional) && (!needsWhere || where !== null) && (!isSatellite || !!parentPlanet) && (kind !== 'belt' || !!parentPrimary) && (kind !== 'companion' || !!parentHost);

    const pickKind = (k: Exclude<CreateKind, 'pair'>) => {
        setKind(k);
        // Each kind starts from the selection (else this system's primary or first planet), never from what the last kind
        // defaulted to, so the same kind always starts in the same place however it was reached
        if (k === 'belt') {
            const primary = ctxPrimary ?? (here && primaryOf(here)) ?? firstHere(primaries)?.b;
            setBodyId(primary?.id ?? null);
            setDraft(beltDraft(primary));
        } else if (k === 'companion') {
            setBodyId(ctxHost?.id ?? (here && primaryOf(here)?.id) ?? hosts[0]?.b.id ?? null);
            setDraft({ type: 'red_dwarf', radiusKm: 0, orbit: 40 });
        } else if (k === 'moon') setDraft({ type: 'rocky', radiusKm: 1737, orbit: 384400 });
        else if (k === 'station') setDraft({ type: 'artificial', radiusKm: 473, orbit: 42000 });
        else setDraft({ type: 'rocky', radiusKm: 6371, orbit: habAU(hostLight) * 1.1 });
        if (k === 'moon' || k === 'station') setBodyId(ctxPlanet?.id ?? firstHere(planets)?.b.id ?? null);
    };

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        const called = name.trim();
        // Only a number above the one its orbit gives it is worth storing
        const numbered = planetNumber(parentSystem?.bodies ?? [], planetHost?.id ?? null, draft.orbit, draft.ordinal ?? null);
        const ordinal = kind === 'planet' && numbered.n > numbered.min ? numbered.n : null;
        let ok = false;
        if (kind === 'landmark') {
            const p = await store.addPlace({ kind: 'landmark', name: called, category, where: where! });
            if (p) store.select(p.id);
            ok = !!p;
        } else if (kind === 'system') {
            const p = await store.addPlace({ kind: 'system', name: called, where: where!, star: { kind: 'star', name: called, type: starType } });
            if (p) store.openSystem(p.id);
            ok = !!p;
        } else if (kind === 'planet' && !parentSystem) {
            const planet = { kind: 'planet' as const, name: called, ...draft, ordinal };
            const p = await store.addPlace({ kind: 'system', name: null, where: where!, star: { kind: 'star', name: null, type: starType, children: [planet] } });
            if (p) store.openSystem(p.id, p.bodies.find((b) => b.kind === 'planet')?.id ?? null);
            ok = !!p;
        } else if (kind === 'planet' && parentSystem) {
            const id = planetHost ? await store.addBody(parentSystem.id, planetHost.id, { kind: 'planet', name: called || null, ...draft, ordinal }) : null;
            if (id) store.openSystem(parentSystem.id, id);
            ok = !!id;
        } else if (kind === 'companion' && parentHost) {
            const id = await store.addBody(parentHost.p.id, parentHost.b.id, { kind: 'star', name: called || null, type: draft.type, orbit: draft.orbit });
            if (id) store.openSystem(parentHost.p.id, id);
            ok = !!id;
        } else if (kind === 'belt' && parentPrimary) {
            const ring = !isStarry(parentPrimary.b);
            const orbit = ring ? Math.max(draft.orbit, ringRange(parentPrimary.b)[0]) : draft.orbit;
            const width = Math.min(draft.width ?? 1, beltWidthMax(orbit, ring ? parentPrimary.b.radiusKm : 0));
            const id = await store.addBody(parentPrimary.p.id, parentPrimary.b.id, { kind: 'belt', name: called || null, type: draft.type, orbit, width });
            if (id) store.openSystem(parentPrimary.p.id, id);
            ok = !!id;
        } else if (parentPlanet) {
            const type = kind === 'station' ? 'artificial' : draft.type;
            // Never inside the planet's Roche limit (a station: the planet itself)
            const orbit = Math.max(draft.orbit, satelliteRange(kind as BodyKind, parentPlanet.b, type)[0]);
            const id = await store.addBody(parentPlanet.p.id, parentPlanet.b.id, { kind: kind as BodyKind, name: called || null, ...draft, orbit, ordinal: null, type });
            if (id) store.openSystem(parentPlanet.p.id, id);
            ok = !!id;
        }
        setSaving(false);
        if (ok) onDone();
    };

    const kindPicker = <KindCards kind={kind} onPick={pickKind} />;

    // The designation it would get, worked out from where it goes and what it is like so far
    const draftOf = (): Draft | null => {
        const base = { name: name.trim() || null, type: draft.type, radiusKm: draft.radiusKm, orbit: draft.orbit, width: draft.width, builtYear: draft.builtYear, iteration: draft.iteration };
        if (kind === 'planet') return { ...base, kind: 'planet', parentId: planetHost?.id ?? null, ordinal: planetNumber(parentSystem?.bodies ?? [], planetHost?.id ?? null, draft.orbit, draft.ordinal ?? null).n };
        if (kind === 'companion' && parentHost) return { ...base, kind: 'star', parentId: parentHost.b.id };
        if (kind === 'belt' && parentPrimary) return { ...base, kind: 'belt', parentId: parentPrimary.b.id };
        if (isSatellite && parentPlanet) return { ...base, kind: kind as BodyKind, parentId: parentPlanet.b.id };
        return null;
    };
    const drafted = draftOf();
    const placeOf = kind === 'planet' ? parentSystem : kind === 'companion' ? parentHost?.p : kind === 'belt' ? parentPrimary?.p : parentPlanet?.p;
    const designationNow = drafted ? wouldBe(placeOf ?? undefined, drafted) : '';
    const designationHint = drafted && (
        <p className={styles.muted}>
            {kind === 'station' && !designationNow
                ? 'It gets a designation once you enter the year it was built.'
                : name.trim()
                  ? <>Its designation will be <b>{designationNow}</b>.</>
                  : <>With no name it goes by its designation, <b>{designationNow}</b>.</>}
        </p>
    );

    const nameField = kind && (
        <div className={styles.field}>
            <input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${CREATE_KINDS.find((k) => k.key === kind)!.label.toLowerCase()}`} aria-label='Name' maxLength={100} autoFocus />
            {designationHint}
        </div>
    );

    const parentField = kind === 'belt' ? (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>Circles</span></div>
            {/* A star's belt is measured in AU and a ring in km, so a new choice starts the belt over */}
            <select value={parentPrimary?.b.id ?? ''} onChange={(e) => (setBodyId(Number(e.target.value)), setDraft(beltDraft(primaries.find((x) => x.b.id === Number(e.target.value))?.b)))}>
                <BodyOptions items={primaries} here={here} />
            </select>
            {primaries.length === 0 && <p className={styles.muted}>Add its star system first.</p>}
        </div>
    ) : kind === 'companion' ? (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>Orbits</span></div>
            <select value={parentHost?.b.id ?? ''} onChange={(e) => setBodyId(Number(e.target.value))}>
                <BodyOptions items={hosts} here={here} />
            </select>
            {hosts.length === 0 && <p className={styles.muted}>Add its star system first.</p>}
        </div>
    ) : (kind === 'planet' || isSatellite) && (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>{kind === 'planet' ? 'Star system' : 'Orbits'}</span></div>
            {kind === 'planet' ? (
                <select value={systemId} onChange={(e) => (setSystemId(e.target.value === 'new' ? 'new' : Number(e.target.value)), setHostId(null))}>
                    <option value='new'>I don&apos;t know its star yet</option>
                    {here && <optgroup label='This system'><option value={here.id}>{placeTitle(here)}</option></optgroup>}
                    <optgroup label={here ? 'Other systems' : 'Systems'}>
                        {systems.filter((p) => p.id !== here?.id).sort((a, b) => placeTitle(a).localeCompare(placeTitle(b))).map((p) => <option key={p.id} value={p.id}>{placeTitle(p)}</option>)}
                    </optgroup>
                </select>
            ) : (
                <select value={parentPlanet?.b.id ?? ''} onChange={(e) => setBodyId(Number(e.target.value))}>
                    <BodyOptions items={planets} here={here} />
                </select>
            )}
            {isSatellite && planets.length === 0 && <p className={styles.muted}>Add its planet first.</p>}
            {kind === 'planet' && !parentSystem && name.trim() === '' && <p className={styles.formError}>A planet with no name needs its star: pick its system, or go back and name it.</p>}
        </div>
    );
    // A planet of a system with several stars: which one it circles (or a pair, both)
    const hostField = kind === 'planet' && systemHosts.length > 1 && (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>Circles</span></div>
            <select value={planetHost?.id ?? ''} onChange={(e) => (setHostId(Number(e.target.value)), setDraft({ ...draft, ordinal: null }))}>
                {systemHosts.map((b) => <option key={b.id} value={b.id}>{b.kind === 'barycenter' ? `Both of ${b.name}` : b.name}</option>)}
            </select>
        </div>
    );

    const whereField = needsWhere && <WherePicker store={store} where={where} onChange={setWhere} />;
    const starField = (kind === 'system' || (kind === 'planet' && !parentSystem)) && (
        <BodyFields kind='star' draft={{ ...draft, type: starType }} onChange={(p) => p.type && setStarType(p.type)} starType={starType} />
    );
    const bodyFields = kind !== 'system' && kind !== 'landmark' && (
        <BodyFields
            kind={kind === 'companion' ? 'star' : (kind as BodyKind)}
            draft={draft}
            onChange={(p) => setDraft({ ...draft, ...p })}
            starType={kind === 'belt' ? (parentPrimary ? (hostOf(parentPrimary.p.bodies, parentPrimary.b) ?? 'sunlike') : 'sunlike') : hostLight}
            system={parentSystem ?? undefined}
            planet={parentPlanet?.b}
            primary={kind === 'belt' ? parentPrimary?.b : kind === 'companion' ? parentHost?.b : kind === 'planet' ? planetHost : undefined}
        />
    );
    const categoryField = kind === 'landmark' && (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>Kind of landmark</span></div>
            <div className={styles.chips}>
                {Object.entries(LANDMARK_CATEGORIES).map(([key, label]) => (
                    <button key={key} type='button' className={cx(styles.chip, category === key && styles.chipOn)} onClick={() => setCategory(key)}>{label}</button>
                ))}
            </div>
        </div>
    );

    // Started from inside a system (or on a planet or star): where it goes is already known.
    const whereKnown =
        (kind === 'planet' && !!ctxSystem && parentSystem?.id === ctxSystem.id) ||
        (isSatellite && !!ctxPlanet && parentPlanet?.b.id === ctxPlanet.id) ||
        (kind === 'belt' && !!ctxPrimary && parentPrimary?.b.id === ctxPrimary.id) ||
        (kind === 'companion' && !!ctxSystem && parentHost?.p.id === ctxSystem.id && parentHost.b.id === (ctxHost?.id ?? primaryOf(ctxSystem)?.id));
    const pages = [
        { title: 'What are you adding?', body: <>{kindPicker}{nameField}</> },
        ...(!whereKnown && (parentField || whereField) ? [{ title: 'Where does it go?', body: <>{parentField}{whereField}</> }] : []),
        { title: 'What is it like?', body: <>{kind === 'system' ? starField : kind === 'landmark' ? categoryField : <>{hostField}{bodyFields}{designationHint}</>}</> },
    ];
    const at = Math.min(step, pages.length - 1);
    return (
        <div className={styles.create}>
            <p className='pixel-label'>Step {at + 1} of {pages.length}</p>
            <h3>{pages[at].title}</h3>
            {pages[at].body}
            {store.error && <p className={styles.formError} role='alert'>{store.error}</p>}
            <div className={styles.actions}>
                {at > 0 && <button type='button' className={styles.btnQuiet} onClick={() => setStep(at - 1)}>Back</button>}
                {at < pages.length - 1 ? (
                    <button type='button' className={styles.btn} disabled={!kind || (at === 0 && name.trim() === '' && kind !== 'planet' && kind !== 'moon' && kind !== 'belt' && kind !== 'companion')} onClick={() => setStep(at + 1)}>Next</button>
                ) : (
                    <button type='button' className={styles.btn} disabled={!canSave} onClick={save}>{saving ? 'Saving' : 'Done'}</button>
                )}
                <button type='button' className={styles.btnQuiet} onClick={() => (store.clearError(), onDone())}>Cancel</button>
            </div>
        </div>
    );
}

/**
 * Makes the picked star or planet one of a co-equal pair: asks what its companion is
 * like and how far apart the two are, and whether what orbited it now circles both. The
 * two orbits round the barycenter split the distance by mass, the heavier nearer.
 */
export function PairFlow({ store, onDone }: { store: Store; onDone: () => void }) {
    const place = store.selPlace;
    const body = store.selBody;
    const stars = body?.kind === 'star';
    const [name, setName] = useState('');
    const [type, setType] = useState(stars ? 'red_dwarf' : 'rocky');
    const [radiusKm, setRadiusKm] = useState(body && !stars ? body.radiusKm * 0.5 : 3000);
    const [apart, setApart] = useState(stars ? 0.5 : 20000);
    const [both, setBoth] = useState(true);
    const [saving, setSaving] = useState(false);
    if (!place || !body) return null;
    const mine = massOf(place.bodies, body);
    const theirs = stars ? (STAR_TYPES[type]?.mass ?? 1) : massEarths({ ...body, type, radiusKm });
    const unit = stars ? 'AU' : 'km';
    const named = wouldPair(place, body, { kind: body.kind, name: name.trim() || null, type, radiusKm: stars ? undefined : radiusKm });
    const save = async () => {
        setSaving(true);
        const share = theirs / Math.max(mine + theirs, 1e-9);
        const companion = { kind: body.kind.toUpperCase(), name: name.trim() || null, type, orbit: apart * (1 - share), ...(stars ? {} : { radiusKm }) };
        const ok = await store.pairBody(place.id, body.id, { orbit: apart * share, companion, circumbinary: both });
        setSaving(false);
        if (ok) onDone();
    };
    return (
        <div className={styles.create}>
            <h3>Make {body.name} one of a pair</h3>
            <p className={styles.muted}>The two will orbit a point between them, the heavier nearer; {stars ? 'its planets count from both' : 'they share one planet number'}.</p>
            <div className={styles.field}>
                <input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Its companion ${stars ? 'star' : 'planet'}`} aria-label='Name' maxLength={100} autoFocus />
                <p className={styles.muted}>
                    {name.trim() ? 'Its designation will be ' : 'With no name it goes by its designation, '}
                    <b>{named.companion}</b>, and {body.name} {named.body === body.gu ? 'keeps' : 'becomes'} <b>{named.body}</b>.
                </p>
            </div>
            <div className={styles.field}>
                <div className={styles.fieldHead}><span className='pixel-label'>{stars ? 'Kind of star' : 'Type'}</span></div>
                <div className={styles.chips}>
                    {Object.entries(stars ? STAR_TYPES : COMPOSITIONS).filter(([key]) => key !== 'artificial').map(([key, t]) => (
                        <button key={key} type='button' className={cx(styles.chip, type === key && styles.chipOn)} style={{ '--chip': t.color } as React.CSSProperties} onClick={() => setType(key)}>
                            <i className={styles.chipDot} />{t.label}
                        </button>
                    ))}
                </div>
            </div>
            {!stars && <ScaleInput label='Size' sizes value={radiusKm} onChange={setRadiusKm} refs={SIZE_REFS.slice(1)} range={SIZE_RANGE} readout={`${describeSize(radiusKm)}, ${fmtNum(radiusKm)} km`} unit='km' bounds={[1, 1e7]} />}
            <ScaleInput
                label='How far apart they are'
                value={apart}
                onChange={setApart}
                refs={stars ? PAIR_STAR_REFS : PAIR_PLANET_REFS}
                range={stars ? PAIR_STAR_RANGE : PAIR_PLANET_RANGE}
                unit={unit}
                bounds={stars ? [0.001, 1e5] : [100, 1e9]}
                readout={`${fmtNum(apart)} ${unit}`}
            />
            <label className={styles.check}>
                <input type='checkbox' checked={both} onChange={(e) => setBoth(e.target.checked)} />
                {stars ? 'Its planets, belts and stations circle both stars' : 'Its moons, rings and stations circle both planets'}
            </label>
            {store.error && <p className={styles.formError} role='alert'>{store.error}</p>}
            <div className={styles.actions}>
                <button type='button' className={styles.btn} disabled={saving} onClick={save}>{saving ? 'Saving' : 'Done'}</button>
                <button type='button' className={styles.btnQuiet} onClick={() => (store.clearError(), onDone())}>Cancel</button>
            </div>
        </div>
    );
}

export function placeTitle(place: Place): string {
    const planet = place.bodies.find((b) => b.kind === 'planet' && !b.unnamed);
    return place.placeholder && planet ? `${planet.name}'s system` : place.name;
}
