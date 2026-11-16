'use client';

// The galaxy map: a search box and a side sheet over the full-bleed galaxy, the
// layers panel, the add wizard, and the full-screen view of one system.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { OCTS, REGIONS, regionAt, regionLabel, starOf } from './data';
import type { ApiPlace, Body, Place, RegionKey } from './data';
import GalaxyScene from './GalaxyScene';
import type { Layers } from './GalaxyScene';
import { BodyIcon, CreateFlow, LandmarkIcon, SelectionDetail, placeTitle } from './parts';
import type { PlanetSlot } from './parts';
import SystemView from './SystemView';
import { useGalaxyStore } from './store';
import type { Store } from './store';
import styles from './galaxy.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// Listed top of the stack first, like layers in a paint program.
const LAYER_ROWS: { key: keyof Layers; label: string; swatch: string; hint: string }[] = [
    { key: 'labels', label: 'Place names', swatch: '#dce4f1', hint: 'Names beside systems and landmarks' },
    { key: 'transit', label: 'Arm lines', swatch: 'linear-gradient(90deg, #ff2fd6 0 25%, #ffe600 0 50%, #22e02a 0 75%, #2f8cff 0)', hint: 'The spiral arms as colored lines, with the Bakree and Omega routes' },
    { key: 'bearings', label: 'Bearings', swatch: '#8792a8', hint: 'The galactic bar and the way to Andromeda' },
    { key: 'octants', label: 'Octants', swatch: 'conic-gradient(#4f8ff0 0 25%, #e9c24a 0 50%, #45c27a 0 75%, #e8584f 0)', hint: 'The eight colored octant slabs and their names' },
    { key: 'grid', label: 'Sector grid', swatch: '#5d6779', hint: 'Sectors, 5 klyr to a square' },
    { key: 'rim', label: 'Outer Rim', swatch: REGIONS.rim.color, hint: 'Sectors centered 38 klyr or more from Sagittarius A' },
    { key: 'territories', label: 'Territories', swatch: `linear-gradient(90deg, ${REGIONS.gu.color} 0 33%, ${REGIONS.ade.color} 0 66%, ${REGIONS.lr.color} 0)`, hint: 'Galactic Union, ADE and Llamanian Republic space' },
    { key: 'galaxy', label: 'Galaxy', swatch: 'radial-gradient(#ffe2b4, #5a6ea8 60%, #1a2238)', hint: 'The shape of the Milky Way' },
];

// The view buttons' pictures. Every slanted edge is isometric: one unit up for two across.
const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'miter' as const, 'aria-hidden': true };
/** A slab seen from a corner: the view that turns. */
const TiltIcon = () => (
    <svg width='36' height='22' viewBox='0 0 36 22' {...ICON}>
        <path d='M18 2L34 10L18 18L2 10Z' />
        <path d='M2 10V13L18 21L34 13V10' />
    </svg>
);
/** The same slab from straight above. */
const TopIcon = () => (
    <svg width='22' height='22' viewBox='0 0 22 22' {...ICON}>
        <rect x='3' y='3' width='16' height='16' />
    </svg>
);
const RecenterIcon = () => (
    <svg width='22' height='22' viewBox='0 0 22 22' {...ICON} strokeWidth={1.6}>
        <circle cx='11' cy='11' r='6' />
        <path d='M11 1V21M1 11H21' />
    </svg>
);
const LayersIcon = () => (
    <svg width='22' height='22' viewBox='0 0 22 22' {...ICON} strokeWidth={1.6}>
        <path d='M11 2L20 6.5L11 11L2 6.5Z' />
        <path d='M11 6.5L20 11L11 15.5L2 11Z' />
        <path d='M11 11L20 15.5L11 20L2 15.5Z' />
    </svg>
);

/** Rotate or top-down, and back to the middle. Pictures only; the names are tooltips. */
export function ViewButtons({ store }: { store: Store }) {
    return (
        <div className={styles.viewBtns}>
            <div className={styles.seg} role='group' aria-label='Camera'>
                <button type='button' aria-pressed={store.view === 'tilt'} onClick={() => store.setView('tilt')} title='Rotate' aria-label='Rotate'><TiltIcon /></button>
                <button type='button' aria-pressed={store.view === 'top'} onClick={() => store.setView('top')} title='Top-down' aria-label='Top-down'><TopIcon /></button>
            </div>
            <button type='button' className={styles.iconBtn} onClick={store.resetView} title='Recenter the map' aria-label='Recenter the map'><RecenterIcon /></button>
        </div>
    );
}

/** The list of layers with a checkbox each. */
function LayerList({ store }: { store: Store }) {
    const set = (key: keyof Layers, on: boolean) => store.setLayers({ ...store.layers, [key]: on });
    return (
                    <ul className={styles.layerList}>
                        {/* The still picture (no WebGL) has every other layer painted in */}
                        {LAYER_ROWS.filter((row) => !store.still || row.key === 'labels').map((row) => (
                            <li key={row.key}>
                                <label title={row.hint}>
                                    <input type='checkbox' checked={store.layers[row.key]} onChange={(e) => set(row.key, e.target.checked)} />
                                    <i className={styles.layerSwatch} style={{ background: row.swatch }} />
                                    {row.label}
                                </label>
                                {row.key === 'octants' && store.layers.octants && (
                                    <div className={styles.layerLegend}>
                                        {OCTS.map((o) => (
                                            <span key={o.key}><i style={{ background: o.color }} />{o.key}</span>
                                        ))}
                                    </div>
                                )}
                                {row.key === 'territories' && store.layers.territories && (
                                    <div className={styles.layerLegend}>
                                        {(['gu', 'ade', 'lr'] as RegionKey[]).map((key) => (
                                            <span key={key}><i style={{ background: REGIONS[key].color }} />{key.toUpperCase()}</span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
    );
}

/** Wide screens: the layers, which fold away, over the view buttons, which do not. */
export function LayersPanel({ store }: { store: Store }) {
    const [open, setOpen] = useState(true);
    return (
        <section className={cx('pixel-panel', styles.layers)} aria-label='Map layers and view'>
            <button type='button' className={styles.layersHead} onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className='pixel-label'>Layers</span>
                <span aria-hidden>{open ? '▾' : '▸'}</span>
            </button>
            {open && <LayerList store={store} />}
            {!store.still && (
                <div className={styles.layersView}>
                    <span className='pixel-label'>View</span>
                    <ViewButtons store={store} />
                </div>
            )}
        </section>
    );
}

/** One search result: a place, or a body inside one. */
interface Hit {
    p: Place;
    body: Body | null;
    label: string;
    sub: string;
    /** Key of HIT_GROUPS. */
    group: string;
}

// The order results are listed in, each under its heading
const HIT_GROUPS: [key: string, title: string][] = [
    ['system', 'Systems'],
    ['planet', 'Planets'],
    ['moon', 'Moons'],
    ['station', 'Stations'],
    ['cluster', 'Clusters'],
    ['nebula', 'Nebulae'],
    ['landmark', 'Landmarks'],
];

function HitIcon({ hit }: { hit: Hit }) {
    if (hit.body) return <BodyIcon body={hit.body} />;
    const star = starOf(hit.p);
    return hit.p.kind === 'system' && star ? <BodyIcon body={star} /> : <LandmarkIcon category={hit.p.category} />;
}

export default function MapApp({ places }: { places: ApiPlace[] }) {
    const store = useGalaxyStore(places);
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState<RegionKey | null>(null);
    // true = the add wizard is open; a slot = it adds the planet a gap ring stands for
    const [creating, setCreating] = useState<boolean | PlanetSlot>(false);
    const [narrow, setNarrow] = useState<boolean | null>(null);
    // Phones: the layers list, opened from its button; holds the selection it was opened under, so picking a place folds it away
    const [layersFor, setLayersFor] = useState<number | null>(null);
    useEffect(() => {
        // Followed, not read once: a window can be resized or a phone turned after the page loads
        const media = window.matchMedia('(max-width: 760px)');
        const follow = () => setNarrow(media.matches);
        follow();
        media.addEventListener('change', follow);
        return () => media.removeEventListener('change', follow);
    }, []);

    const q = query.trim().toLowerCase();
    const placeHit = (p: Place): Hit => ({ p, body: null, label: placeTitle(p), sub: regionLabel(p), group: p.kind === 'system' ? 'system' : (p.category ?? 'landmark') });
    const found: Hit[] = q
        ? store.places.flatMap((p) => [
              ...(placeTitle(p).toLowerCase().includes(q) ? [placeHit(p)] : []),
              ...p.bodies.filter((b) => b.kind !== 'star' && (b.name.toLowerCase().includes(q) || b.gu.toLowerCase().includes(q))).map((b) => ({ p, body: b, label: b.name, sub: `in ${placeTitle(p)}`, group: b.kind })),
          ])
        : region
          ? store.places.filter((p) => (p.precision === 'region' ? p.regionHint === region : regionAt(p.pos) === region)).map(placeHit)
          : [];
    const groups = HIT_GROUPS.map(([key, title]) => ({ title, hits: found.filter((h) => h.group === key) })).filter((g) => g.hits.length > 0);
    const place = store.selPlace;
    const inSystem = store.level === 'system' && place?.kind === 'system';

    const layersOpen = layersFor === (place?.id ?? 0);
    // The same plain button the system view adds with; a phone has room for fewer words
    const addButton = store.user ? (
        <button type='button' className={cx(styles.btnQuiet, styles.cAdd)} onClick={() => setCreating(true)} title='Add a system or landmark'>{narrow ? '+ System' : '+ System or landmark'}</button>
    ) : (
        <Link href='/login' className={cx(styles.btnQuiet, styles.cAdd)}>{narrow ? 'Sign in to add' : 'Sign in to add to the map'}</Link>
    );

    return (
        <main className={styles.root}>
        <div className={styles.shell}>
            <div className={styles.stage}>
                <GalaxyScene
                    places={store.places}
                    selectedId={place?.id ?? null}
                    onSelect={(id) => store.select(id)}
                    view={store.view}
                    layers={store.layers}
                    placing={store.placing}
                    onPlace={store.handlePlace}
                    flyToken={store.flyToken}
                    resetToken={store.resetToken}
                    onStill={store.setStill}
                    onOpen={(id) => store.places.find((p) => p.id === id)?.kind === 'system' && store.openSystem(id)}
                />
                {store.placing && (
                    <div className={styles.placingBanner}>
                        Click the map where it belongs.
                        <button type='button' className={styles.btnQuiet} onClick={store.cancelPlace}>Cancel</button>
                    </div>
                )}
            </div>
            {!inSystem && (
                <>
                    <div className={styles.cLeft}>
                        <div className={cx('pixel-panel', styles.cSearch)}>
                            <input className={styles.search} value={query} onChange={(e) => (setQuery(e.target.value), setRegion(null))} placeholder='Search the galaxy' aria-label='Search the galaxy' />
                            <div className={styles.chips}>
                                {(Object.keys(REGIONS) as RegionKey[]).map((key) => (
                                    <button key={key} type='button' className={cx(styles.chip, region === key && styles.chipOn)} style={{ '--chip': REGIONS[key].color } as React.CSSProperties} onClick={() => (setRegion(region === key ? null : key), setQuery(''))}>
                                        <i className={styles.chipDot} />{REGIONS[key].short}
                                    </button>
                                ))}
                            </div>
                            {(q || region) && (
                                <div className={styles.hits}>
                                    {found.length === 0 && <p className={styles.muted}>Nothing there yet.</p>}
                                    {groups.map((g) => (
                                        <section key={g.title}>
                                            <h4 className='pixel-label'>{g.title}</h4>
                                            <ul className={styles.tree}>
                                                {g.hits.map((h) => (
                                                    <li key={`${h.p.id}-${h.body?.id ?? 0}`}>
                                                        <button type='button' className={styles.treeRow} onClick={() => ((h.body ? store.openSystem(h.p.id, h.body.id) : store.select(h.p.id)), setQuery(''), setRegion(null))}>
                                                            <HitIcon hit={h} />
                                                            {h.label}
                                                            <span className={styles.muted}>{h.sub}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Phones: one row of buttons under the search box, the layers list opening beneath it */}
                        {narrow && !store.placing && (
                            <div className={styles.cBar}>
                                {addButton}
                                {!store.still && <ViewButtons store={store} />}
                                <button type='button' className={styles.iconBtn} aria-pressed={layersOpen} onClick={() => setLayersFor(layersOpen ? null : (place?.id ?? 0))} title='Layers' aria-label='Layers'><LayersIcon /></button>
                            </div>
                        )}
                        {narrow && !store.placing && layersOpen && (
                            <section className={cx('pixel-panel', styles.layers)} aria-label='Map layers'>
                                <LayerList store={store} />
                            </section>
                        )}
                        {place && !store.placing && (
                            <aside className={cx('pixel-panel', styles.cSheet)}>
                                <button type='button' className={styles.close} onClick={() => store.select(null)} aria-label='Close'>x</button>
                                <SelectionDetail store={store} />
                            </aside>
                        )}
                        {/* Under the open place, else under the search box: the same plain button the system view adds with */}
                        {!narrow && !store.placing && addButton}
                    </div>
                    {narrow === false && (
                        <div className={styles.cRight}>
                            <LayersPanel store={store} />
                        </div>
                    )}
                </>
            )}
            {inSystem && place && <SystemView store={store} place={place} onAdd={(slot) => setCreating(slot ?? true)} />}
            {creating && (
                <div className={cx(styles.cModalWrap, store.placing && styles.tucked)} onMouseDown={(e) => e.target === e.currentTarget && !store.placing && setCreating(false)}>
                    <div className={cx('pixel-panel', styles.cModal)}>
                        <CreateFlow store={store} slot={creating === true ? undefined : creating} onDone={() => setCreating(false)} />
                    </div>
                </div>
            )}
            {store.error && !creating && (
                <p className={styles.toast} role='alert'>
                    {store.error}
                    <button type='button' className={styles.close} onClick={store.clearError} aria-label='Dismiss'>x</button>
                </p>
            )}
        </div>
        </main>
    );
}
