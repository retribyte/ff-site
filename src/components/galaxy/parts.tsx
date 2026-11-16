'use client';

// Pieces of the galaxy map shared by the galaxy level and the system view: the "no
// raw numbers" inputs, the detail blocks for a selection, and the add wizard.

import { useState } from 'react';
import Link from 'next/link';
import RichText from '@/components/RichText';
import WikiLink from '@/components/WikiLink';
import { decodeEntities } from '@/lib/html';
import { isValidSlug } from '@/lib/slug';
import {
    COMPOSITIONS, LANDMARK_CATEGORIES, MOON_ORBIT_REFS, ORBIT_RANGE, ORBIT_REFS, REGIONS, SIZE_RANGE, SIZE_REFS, STAR_TYPES, ZONES,
    bodyColor, describeSize, fmtNum, fromT, fullAddress, gravityG, habAU, planetNumber, randomPointIn, regionAt, regionLabel, satelliteRange, sectorOf, starOf, toT, yearDays, zoneOf,
} from './data';
import type { Body, BodyKind, Place, Ref, RegionKey } from './data';
import type { Store, TextPatch, Where } from './store';
import styles from './galaxy.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
export const KIND_LABEL: Record<string, string> = { star: 'Star', planet: 'Planet', moon: 'Moon', station: 'Station', system: 'System', landmark: 'Landmark' };

// ---------- Inputs that never ask for a raw number ----------
interface ScaleProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    refs: Ref[];
    range: [number, number];
    readout: string;
    /** Planet orbits only: draws warm-to-cold bands. */
    starType?: string;
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
    /** Planets: "this is planet N". */
    ordinal?: number | null;
}

/** The planet a gap ring of the system diagram stands for. */
export interface PlanetSlot {
    ordinal: number;
    orbit: number;
}

/** "This is planet N": steps up from the number the planet's orbit gives it, for one whose inner neighbours are not on the map. */
function PlanetNumber({ draft, onChange, system, selfId }: { draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; system?: Place; selfId?: number }) {
    const star = system && starOf(system);
    const { n, min } = planetNumber((system?.bodies ?? []).filter((b) => b.id !== selfId), draft.orbit, draft.ordinal ?? null);
    return (
        <div className={styles.field}>
            <div className={styles.fieldHead}>
                <span className='pixel-label'>Planet number</span>
                <span className={styles.fieldReadout}>{star && !star.unnamed ? `${star.name}-${n}` : `Planet ${n} of its star`}</span>
            </div>
            <div className={styles.stepper}>
                <button type='button' className={styles.chip} disabled={n <= min} onClick={() => onChange({ ordinal: n - 1 > min ? n - 1 : null })} aria-label='One planet closer to the star'>-</button>
                <b>{n}</b>
                <button type='button' className={styles.chip} disabled={n >= 99} onClick={() => onChange({ ordinal: n + 1 })} aria-label='One planet farther from the star'>+</button>
            </div>
        </div>
    );
}

export function BodyFields({ kind, draft, onChange, starType, system, selfId, planet }: { kind: BodyKind; draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; starType: string; /** Planets: the system it is in, and its own id once it exists. */ system?: Place; selfId?: number; /** Moons and stations: the planet it orbits. */ planet?: Body }) {
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
            {orbitsStar && <PlanetNumber draft={draft} onChange={onChange} system={system} selfId={selfId} />}
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
                <input {...field('name')} placeholder={!nameless ? undefined : body && body.kind !== 'star' ? body.gu : 'Not named yet'} />
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

/** A planet's number as I, II, III; whatever orbits it is a, b, c (`designate` in data.ts does the counting). */
export function designation(b: Body): string {
    if (b.kind === 'star') return '';
    return b.kind === 'planet' ? (ROMAN[b.num - 1] ?? String(b.num)) : String.fromCharCode(97 + ((b.num - 1) % 26));
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
export function BodyTexture({ body, x, y, r }: { body: Body; x: number; y: number; r: number }) {
    const banded = body.type === 'gas' || body.type === 'ice' || body.type === 'desert';
    const turn = banded ? ((body.id * 47) % 50) - 25 : (body.id * 47) % 360;
    return (
        <g transform={`translate(${x} ${y}) scale(${r})`} pointerEvents='none'>
            <clipPath id={`galaxy-disc-${body.id}`}><circle r='1' /></clipPath>
            <g clipPath={`url(#galaxy-disc-${body.id})`}>
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
                {b.kind !== 'star' && <span className={styles.desig}>{designation(b)}</span>}
                <BodyName body={b} />
                <span className={styles.muted}>{KIND_LABEL[b.kind]}</span>
            </button>
            {kids(b.id).length > 0 && <ul>{kids(b.id).map((k) => row(k, depth + 1))}</ul>}
        </li>
    );
    return <ul className={styles.tree}>{kids(null).map((b) => row(b, 0))}</ul>;
}

export function PlaceHeader({ place }: { place: Place }) {
    const star = starOf(place);
    return (
        <header className={styles.detailHead}>
            <i className={styles.bigDot} style={{ background: place.kind === 'system' && star ? bodyColor(star) : '#7fd3e8', borderRadius: place.kind === 'landmark' ? 0 : '50%' }} />
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
    const star = starOf(place);
    const mine = store.canEdit(place);

    return (
        <div className={styles.detail}>
            {body ? (
                <>
                    <header className={styles.detailHead}>
                        <BodyIcon body={body} size={40} />
                        <div>
                            <h3><BodyName body={body} paren /></h3>
                            <p className='pixel-label'>{KIND_LABEL[body.kind]} in {place.placeholder ? 'an unnamed system' : place.name}</p>
                        </div>
                    </header>
                    {!(editing && mine) && <Writeup of={body} />}
                    {editing && mine ? (
                      <>
                        <TextFields key={body.id} store={store} place={place} body={body} />
                        <BodyFields kind={body.kind} draft={body} starType={star?.type ?? 'sunlike'} system={place} selfId={body.id} planet={place.bodies.find((b) => b.id === body.parentId && b.kind === 'planet')} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
                      </>
                    ) : (
                        <BodyFacts place={place} body={body} />
                    )}
                    {mine && (
                        <div className={styles.actions}>
                            <button type='button' className={styles.btn} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
                            {body.kind !== 'star' && <DeleteButton onDelete={() => store.removeBody(place.id, body.id)} />}
                        </div>
                    )}
                    <Travelogue store={store} place={place} body={body} />
                </>
            ) : (
                <>
                    <PlaceHeader place={place} />
                    {editing && mine ? <TextFields key={place.id} store={store} place={place} body={null} /> : <Writeup of={place} />}
                    <PlaceFacts place={place} />
                    {place.placeholder && mine && !editing && <RenameRow store={store} place={place} />}
                    {place.kind === 'system' && <BodyTree place={place} selBodyId={null} onPick={(id) => store.openSystem(place.id, id)} />}
                    <div className={styles.actions}>
                        {place.kind === 'system' && <button type='button' className={styles.btn} onClick={() => store.openSystem(place.id)}>Open system</button>}
                        {mine && <button type='button' className={styles.btnQuiet} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>}
                        {mine && (
                            <button type='button' className={styles.btnQuiet} onClick={() => store.requestPlace((pos) => store.movePlace(place.id, { pos, precision: 'exact' }))}>
                                {place.precision === 'region' ? 'Pin it down' : 'Move'}
                            </button>
                        )}
                        {mine && <DeleteButton onDelete={() => store.removePlace(place.id)} />}
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
                <button type='button' className={cx(styles.chip, where?.precision === 'exact' && styles.chipOn)} onClick={() => store.requestPlace((pos) => onChange({ pos, precision: 'exact' }))}>
                    Pick the spot on the map
                </button>
            </div>
        </div>
    );
}

// ---------- Add wizard ----------
type CreateKind = 'system' | 'planet' | 'moon' | 'station' | 'landmark';
const CREATE_KINDS: { key: CreateKind; label: string; glyph: string }[] = [
    { key: 'system', label: 'Star system', glyph: '☀' },
    { key: 'planet', label: 'Planet', glyph: '◐' },
    { key: 'moon', label: 'Moon', glyph: '☾' },
    { key: 'station', label: 'Station', glyph: '▣' },
    { key: 'landmark', label: 'Landmark', glyph: '✦' },
];

/** One wizard for everything a member can add, one question at a time. */
export function CreateFlow({ store, onDone, slot }: { store: Store; onDone: () => void; /** Opened from a gap ring: the planet that goes there. */ slot?: PlanetSlot }) {
    const ctxPlanet = store.selBody?.kind === 'planet' ? store.selBody : null;
    const ctxSystem = store.level === 'system' && store.selPlace?.kind === 'system' ? store.selPlace : null;
    const [kind, setKind] = useState<CreateKind>(ctxPlanet ? 'moon' : ctxSystem ? 'planet' : 'system');
    const [name, setName] = useState('');
    // A planet's system or a satellite's planet, by id; 'new' = a planet whose star is not known yet
    const [parent, setParent] = useState<number | 'new'>(ctxPlanet?.id ?? ctxSystem?.id ?? 'new');
    const [where, setWhere] = useState<Where | null>(null);
    const [starType, setStarType] = useState('sunlike');
    const [category, setCategory] = useState('landmark');
    const [draft, setDraft] = useState<BodyDraft>(ctxPlanet ? { type: 'rocky', radiusKm: 1737, orbit: 384400 } : { type: 'rocky', radiusKm: 6371, orbit: 1, ...slot });
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    // Bodies go into systems the member may change
    const systems = store.places.filter((p) => p.kind === 'system' && store.canEdit(p));
    const planets = systems.flatMap((p) => p.bodies.filter((b) => b.kind === 'planet').map((b) => ({ b, p })));
    const isSatellite = kind === 'moon' || kind === 'station';
    const parentPlanet = isSatellite ? (planets.find((x) => x.b.id === parent) ?? planets[0]) : null;
    const parentSystem = kind === 'planet' ? systems.find((p) => p.id === parent) : null;
    const needsWhere = kind === 'system' || kind === 'landmark' || (kind === 'planet' && !parentSystem);
    const hostStarType = kind === 'planet' ? (parentSystem ? (starOf(parentSystem)?.type ?? 'sunlike') : starType) : 'sunlike';
    // A planet of a known star, or a moon, may go by its designation alone
    const nameOptional = (kind === 'planet' && !!parentSystem) || (kind === 'moon' && !!parentPlanet);
    const canSave = !saving && (name.trim() !== '' || nameOptional) && (!needsWhere || where !== null) && (!isSatellite || !!parentPlanet);

    const pickKind = (k: CreateKind) => {
        setKind(k);
        if (k === 'moon') setDraft({ type: 'rocky', radiusKm: 1737, orbit: 384400 });
        else if (k === 'station') setDraft({ type: 'artificial', radiusKm: 473, orbit: 42000 });
        else setDraft({ type: 'rocky', radiusKm: 6371, orbit: habAU(hostStarType) * 1.1 });
        if (k === 'planet' && !systems.some((p) => p.id === parent)) setParent(ctxSystem?.id ?? 'new');
        if ((k === 'moon' || k === 'station') && !planets.some((x) => x.b.id === parent)) setParent(planets[0]?.b.id ?? 'new');
    };

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        const called = name.trim();
        // Only a number above the one its orbit gives it is worth storing
        const numbered = planetNumber(parentSystem?.bodies ?? [], draft.orbit, draft.ordinal ?? null);
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
            const star = starOf(parentSystem);
            const id = star ? await store.addBody(parentSystem.id, star.id, { kind: 'planet', name: called || null, ...draft, ordinal }) : null;
            if (id) store.openSystem(parentSystem.id, id);
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

    const kindPicker = (
        <div className={styles.chips} role='tablist' aria-label='What are you adding?'>
            {CREATE_KINDS.map((k) => (
                <button key={k.key} type='button' role='tab' aria-selected={kind === k.key} className={cx(styles.chip, kind === k.key && styles.chipOn)} onClick={() => pickKind(k.key)}>
                    <span aria-hidden>{k.glyph}</span> {k.label}
                </button>
            ))}
        </div>
    );

    const nameField = (
        <div className={styles.field}>
            <input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${CREATE_KINDS.find((k) => k.key === kind)!.label.toLowerCase()}`} aria-label='Name' maxLength={100} autoFocus />
            {(kind === 'planet' || kind === 'moon') && <p className={styles.muted}>With no name it goes by its designation, like Sol-3{kind === 'moon' && 'a'}.</p>}
        </div>
    );

    const parentField = (kind === 'planet' || isSatellite) && (
        <div className={styles.field}>
            <div className={styles.fieldHead}><span className='pixel-label'>{kind === 'planet' ? 'Star system' : 'Orbits'}</span></div>
            <select value={isSatellite ? (parentPlanet?.b.id ?? '') : parent} onChange={(e) => setParent(e.target.value === 'new' ? 'new' : Number(e.target.value))}>
                {kind === 'planet' && <option value='new'>I don&apos;t know its star yet</option>}
                {kind === 'planet'
                    ? systems.map((p) => <option key={p.id} value={p.id}>{placeTitle(p)}</option>)
                    : planets.map(({ b, p }) => <option key={b.id} value={b.id}>{b.name} ({p.placeholder ? 'unnamed system' : p.name})</option>)}
            </select>
            {isSatellite && planets.length === 0 && <p className={styles.muted}>Add its planet first.</p>}
            {kind === 'planet' && !parentSystem && name.trim() === '' && <p className={styles.formError}>A planet with no name needs its star: pick its system, or go back and name it.</p>}
        </div>
    );

    const whereField = needsWhere && <WherePicker store={store} where={where} onChange={setWhere} />;
    const starField = (kind === 'system' || (kind === 'planet' && !parentSystem)) && (
        <BodyFields kind='star' draft={{ ...draft, type: starType }} onChange={(p) => p.type && setStarType(p.type)} starType={starType} />
    );
    const bodyFields = kind !== 'system' && kind !== 'landmark' && (
        <BodyFields kind={kind as BodyKind} draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} starType={hostStarType} system={parentSystem ?? undefined} planet={parentPlanet?.b} />
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

    // Started from inside a system (or on a planet): where it goes is already known.
    const whereKnown = (kind === 'planet' && !!ctxSystem && parentSystem?.id === ctxSystem.id) || (isSatellite && !!ctxPlanet && parentPlanet?.b.id === ctxPlanet.id);
    const pages = [
        { title: 'What are you adding?', body: <>{kindPicker}{nameField}</> },
        ...(!whereKnown && (parentField || whereField) ? [{ title: 'Where does it go?', body: <>{parentField}{whereField}</> }] : []),
        { title: 'What is it like?', body: <>{kind === 'system' ? starField : kind === 'landmark' ? categoryField : bodyFields}</> },
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
                    <button type='button' className={styles.btn} disabled={at === 0 && name.trim() === '' && kind !== 'planet' && kind !== 'moon'} onClick={() => setStep(at + 1)}>Next</button>
                ) : (
                    <button type='button' className={styles.btn} disabled={!canSave} onClick={save}>{saving ? 'Saving' : 'Done'}</button>
                )}
                <button type='button' className={styles.btnQuiet} onClick={() => (store.clearError(), onDone())}>Cancel</button>
            </div>
        </div>
    );
}

export function placeTitle(place: Place): string {
    const planet = place.bodies.find((b) => b.kind === 'planet' && !b.unnamed);
    return place.placeholder && planet ? `${planet.name}'s system` : place.name;
}
