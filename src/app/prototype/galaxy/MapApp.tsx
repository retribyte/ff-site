'use client';

// PROTOTYPE. The chosen layout: variant C's galaxy level (search box and side
// sheet over a full-bleed map, add wizard) with a full-screen system view.

import { useEffect, useState } from 'react';
import { OCTS, REGIONS, regionAt, regionLabel } from './data';
import type { RegionKey } from './data';
import type { Layers } from './GalaxyScene';
import { CreateFlow, SelectionDetail, placeTitle } from './parts';
import SystemView from './SystemView';
import { Stage } from './variants';
import type { Store } from './store';
import styles from './proto.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// Listed top of the stack first, like layers in a paint program.
const LAYER_ROWS: { key: keyof Layers; label: string; swatch: string; hint: string }[] = [
    { key: 'labels', label: 'Place names', swatch: '#dce4f1', hint: 'Names beside systems and landmarks' },
    { key: 'bearings', label: 'Bearings', swatch: '#8792a8', hint: 'The galactic bar and the way to Andromeda' },
    { key: 'octants', label: 'Octants', swatch: 'conic-gradient(#4f8ff0 0 25%, #e9c24a 0 50%, #45c27a 0 75%, #e8584f 0)', hint: 'The eight colored octant slabs and their names' },
    { key: 'grid', label: 'Sector grid', swatch: '#5d6779', hint: 'Sectors, 5 klyr to a square' },
    { key: 'rim', label: 'Outer Rim', swatch: REGIONS.rim.color, hint: 'Sectors centered 38 klyr or more from Sagittarius A' },
    { key: 'territories', label: 'Territories', swatch: `linear-gradient(90deg, ${REGIONS.gu.color} 0 33%, ${REGIONS.ade.color} 0 66%, ${REGIONS.lr.color} 0)`, hint: 'Galactic Union, ADE and Llamanian Republic space' },
    { key: 'galaxy', label: 'Galaxy', swatch: 'radial-gradient(#ffe2b4, #5a6ea8 60%, #1a2238)', hint: 'The shape of the Milky Way' },
];

export function LayersPanel({ store, startOpen = true }: { store: Store; startOpen?: boolean }) {
    const [open, setOpen] = useState(startOpen);
    const set = (key: keyof Layers, on: boolean) => store.setLayers({ ...store.layers, [key]: on });
    return (
        <section className={cx('pixel-panel', styles.layers)} aria-label='Map layers and view'>
            <button type='button' className={styles.layersHead} onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className='pixel-label'>Layers</span>
                <span aria-hidden>{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <>
                    <ul className={styles.layerList}>
                        {LAYER_ROWS.map((row) => (
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
                    <div className={styles.layersView}>
                        <span className='pixel-label'>View</span>
                        <div className={styles.seg} role='group' aria-label='Camera'>
                            <button type='button' aria-pressed={store.view === 'tilt'} onClick={() => store.setView('tilt')}>Rotate</button>
                            <button type='button' aria-pressed={store.view === 'top'} onClick={() => store.setView('top')}>Top-down</button>
                        </div>
                        <button type='button' className={styles.linkBtn} onClick={store.resetView}>Recenter the map</button>
                    </div>
                </>
            )}
        </section>
    );
}

export default function MapApp({ store }: { store: Store }) {
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState<RegionKey | null>(null);
    const [creating, setCreating] = useState(false);
    const [narrow, setNarrow] = useState<boolean | null>(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNarrow(window.matchMedia('(max-width: 760px)').matches);
    }, []);

    const q = query.trim().toLowerCase();
    const hits = q
        ? store.places.flatMap((p) => [
              ...(placeTitle(p).toLowerCase().includes(q) ? [{ p, bodyId: null as string | null, label: placeTitle(p), sub: regionLabel(p) }] : []),
              ...p.bodies.filter((b) => b.kind !== 'star' && b.name.toLowerCase().includes(q)).map((b) => ({ p, bodyId: b.id as string | null, label: b.name, sub: `in ${placeTitle(p)}` })),
          ])
        : region
          ? store.places.filter((p) => (p.precision === 'region' ? p.regionHint === region : regionAt(p.pos) === region)).map((p) => ({ p, bodyId: null as string | null, label: placeTitle(p), sub: p.kind === 'landmark' ? (p.category ?? 'Landmark') : 'System' }))
          : [];
    const place = store.selPlace;
    const inSystem = store.level === 'system' && place?.kind === 'system';

    return (
        <div className={styles.shell}>
            <Stage store={store} galaxyOnly />
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
                                <ul className={styles.tree}>
                                    {hits.length === 0 && <li className={styles.muted}>Nothing there yet.</li>}
                                    {hits.map((h, i) => (
                                        <li key={i}>
                                            <button type='button' className={styles.treeRow} onClick={() => ((h.bodyId ? store.openSystem(h.p.id, h.bodyId) : store.select(h.p.id)), setQuery(''), setRegion(null))}>
                                                {h.label}
                                                <span className={styles.muted}>{h.sub}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {narrow && <LayersPanel store={store} startOpen={false} />}
                        {place && !store.placing && (
                            <aside className={cx('pixel-panel', styles.cSheet)}>
                                <button type='button' className={styles.close} onClick={() => store.select(null)} aria-label='Close'>x</button>
                                <SelectionDetail store={store} style='lineup' showTree />
                            </aside>
                        )}
                    </div>
                    {narrow === false && (
                        <div className={styles.cRight}>
                            <LayersPanel store={store} />
                        </div>
                    )}
                    <button type='button' className={styles.cFab} onClick={() => setCreating(true)} aria-label='Add to the map'>+</button>
                </>
            )}
            {inSystem && place && <SystemView store={store} place={place} onAdd={() => setCreating(true)} />}
            {creating && (
                <div className={cx(styles.cModalWrap, store.placing && styles.tucked)}>
                    <div className={cx('pixel-panel', styles.cModal)}>
                        <CreateFlow store={store} style='lineup' stepped onDone={() => setCreating(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}
