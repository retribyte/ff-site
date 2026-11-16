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
    COMPOSITIONS, LANDMARK_CATEGORIES, MOON_ORBIT_RANGE, MOON_ORBIT_REFS, ORBIT_RANGE, ORBIT_REFS, REGIONS, SIZE_RANGE, SIZE_REFS, STAR_TYPES, ZONES,
    bodyColor, describeSize, fmtNum, fromT, fullAddress, gravityG, habAU, randomPointIn, regionAt, regionLabel, sectorOf, starOf, toT, yearDays, zoneOf,
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
}

function ScaleInput({ label, value, onChange, refs, range, readout, starType, sizes }: ScaleProps) {
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
                <span className={styles.fieldReadout}>{readout}</span>
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
}

export function BodyFields({ kind, draft, onChange, starType }: { kind: BodyKind; draft: BodyDraft; onChange: (patch: Partial<BodyDraft>) => void; starType: string }) {
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
                readout={`${describeSize(draft.radiusKm)}, ${fmtNum(draft.radiusKm)} km`}
            />
            {orbitsStar ? (
                <ScaleInput
                    label='Distance from its star'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={ORBIT_REFS}
                    range={ORBIT_RANGE}
                    starType={starType}
                    readout={`${zone.label}, ${fmtNum(draft.orbit)} AU, a year of ${fmtNum(yearDays(draft.orbit, starType))} equinoxes`}
                />
            ) : (
                <ScaleInput
                    label='Distance from what it orbits'
                    value={draft.orbit}
                    onChange={(v) => onChange({ orbit: v })}
                    refs={MOON_ORBIT_REFS}
                    range={MOON_ORBIT_RANGE}
                    readout={`${fmtNum(draft.orbit)} km`}
                />
            )}
        </>
    );
}

// ---------- Detail blocks ----------
/** A place's or body's description, with the link to its wiki article when it has a slug. */
export function Writeup({ note, slug }: { note?: string; slug?: string }) {
    return (
        <>
            {note && <RichText html={note} />}
            {slug && <WikiLink slug={slug} />}
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
    // A name may be empty only where the map allows "not named yet": a system and its star
    const nameless = body ? body.kind === 'star' : place.kind === 'system';

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
                <input {...field('name')} placeholder={nameless ? 'Not named yet' : undefined} />
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
                            {tag.episode ? (
                                <Link href={`/archives/${tag.episode.seasonSlug}/${tag.episode.slug}`}>
                                    {tag.episode.seasonTitle} episode {tag.episode.episode_no}, {tag.episode.title}
                                </Link>
                            ) : (
                                <span className={styles.muted}>{tag.episodeSlug}</span>
                            )}
                            {via && <span className={styles.muted}> on {via}</span>}
                            {user && (user.id === tag.creatorId || store.canEdit(place)) && (
                                <button type='button' className={styles.untag} title='Remove from the travelogue' aria-label={`Remove ${tag.episode?.title ?? tag.episodeSlug} from the travelogue`} onClick={() => store.untagEpisode(place.id, tag.id)}>
                                    ×
                                </button>
                            )}
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

export function BodyTree({ place, selBodyId, onPick, onOpen }: { place: Place; selBodyId: number | null; onPick: (bodyId: number) => void; onOpen?: (bodyId: number) => void }) {
    const kids = (parentId: number | null) => place.bodies.filter((b) => b.parentId === parentId).sort((a, b) => a.orbit - b.orbit);
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
                            <h3>{body.name}</h3>
                            <p className='pixel-label'>{KIND_LABEL[body.kind]} in {place.placeholder ? 'an unnamed system' : place.name}</p>
                        </div>
                    </header>
                    {!(editing && mine) && <Writeup note={body.note} slug={body.slug} />}
                    {editing && mine ? (
                      <>
                        <TextFields key={body.id} store={store} place={place} body={body} />
                        <BodyFields kind={body.kind} draft={body} starType={star?.type ?? 'sunlike'} onChange={(patch) => store.updateBody(place.id, body.id, patch)} />
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
                    {editing && mine ? <TextFields key={place.id} store={store} place={place} body={null} /> : <Writeup note={place.note} slug={place.slug} />}
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
export function CreateFlow({ store, onDone }: { store: Store; onDone: () => void }) {
    const ctxPlanet = store.selBody?.kind === 'planet' ? store.selBody : null;
    const ctxSystem = store.level === 'system' && store.selPlace?.kind === 'system' ? store.selPlace : null;
    const [kind, setKind] = useState<CreateKind>(ctxPlanet ? 'moon' : ctxSystem ? 'planet' : 'system');
    const [name, setName] = useState('');
    // A planet's system or a satellite's planet, by id; 'new' = a planet whose star is not known yet
    const [parent, setParent] = useState<number | 'new'>(ctxPlanet?.id ?? ctxSystem?.id ?? 'new');
    const [where, setWhere] = useState<Where | null>(null);
    const [starType, setStarType] = useState('sunlike');
    const [category, setCategory] = useState('landmark');
    const [draft, setDraft] = useState<BodyDraft>(ctxPlanet ? { type: 'rocky', radiusKm: 1737, orbit: 384400 } : { type: 'rocky', radiusKm: 6371, orbit: 1 });
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
    const canSave = !saving && name.trim() !== '' && (!needsWhere || where !== null) && (!isSatellite || !!parentPlanet);

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
            const planet = { kind: 'planet' as const, name: called, ...draft };
            const p = await store.addPlace({ kind: 'system', name: null, where: where!, star: { kind: 'star', name: null, type: starType, children: [planet] } });
            if (p) store.openSystem(p.id, p.bodies.find((b) => b.kind === 'planet')?.id ?? null);
            ok = !!p;
        } else if (kind === 'planet' && parentSystem) {
            const star = starOf(parentSystem);
            const id = star ? await store.addBody(parentSystem.id, star.id, { kind: 'planet', name: called, ...draft }) : null;
            if (id) store.openSystem(parentSystem.id, id);
            ok = !!id;
        } else if (parentPlanet) {
            const id = await store.addBody(parentPlanet.p.id, parentPlanet.b.id, { kind: kind as BodyKind, name: called, ...draft, type: kind === 'station' ? 'artificial' : draft.type });
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
        </div>
    );

    const whereField = needsWhere && <WherePicker store={store} where={where} onChange={setWhere} />;
    const starField = (kind === 'system' || (kind === 'planet' && !parentSystem)) && (
        <BodyFields kind='star' draft={{ ...draft, type: starType }} onChange={(p) => p.type && setStarType(p.type)} starType={starType} />
    );
    const bodyFields = kind !== 'system' && kind !== 'landmark' && (
        <BodyFields kind={kind as BodyKind} draft={draft} onChange={(p) => setDraft({ ...draft, ...p })} starType={hostStarType} />
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
                    <button type='button' className={styles.btn} disabled={at === 0 && name.trim() === ''} onClick={() => setStep(at + 1)}>Next</button>
                ) : (
                    <button type='button' className={styles.btn} disabled={!canSave} onClick={save}>{saving ? 'Saving' : 'Done'}</button>
                )}
                <button type='button' className={styles.btnQuiet} onClick={() => (store.clearError(), onDone())}>Cancel</button>
            </div>
        </div>
    );
}

export function placeTitle(place: Place): string {
    const planet = place.bodies.find((b) => b.kind === 'planet');
    return place.placeholder && planet ? `${planet.name}'s system` : place.name;
}
