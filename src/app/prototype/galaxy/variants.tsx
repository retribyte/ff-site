'use client';

// PROTOTYPE, throwaway. Three structurally different layouts over the same map.
//   A  Floating cards   the paper sketch: "+ New", a places dropdown, cards over the map
//   B  Bottom dock      map on top, a three-column console along the bottom
//   C  Search and sheet map-app pattern: search box, side sheet, add wizard; no separate system screen

import { useState } from 'react';
import GalaxyScene from './GalaxyScene';
import { REGIONS, regionAt, regionLabel } from './data';
import type { Place, RegionKey } from './data';
import { BodyTree, CreateFlow, LayerToggles, SelectionDetail, SystemSchematic, ViewButtons, placeTitle } from './parts';
import type { Store } from './store';
import styles from './proto.module.scss';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

export function Stage({ store, galaxyOnly }: { store: Store; galaxyOnly?: boolean }) {
    const showSystem = !galaxyOnly && store.level === 'system' && store.selPlace?.kind === 'system';
    return (
        <div className={styles.stage}>
            <GalaxyScene
                places={store.places}
                selectedId={store.selPlace?.id ?? null}
                onSelect={(id) => store.select(id)}
                view={store.view}
                layers={store.layers}
                placing={store.placing}
                onPlace={store.handlePlace}
                flyToken={store.flyToken}
                resetToken={store.resetToken}
                onOpen={(id) => store.places.find((p) => p.id === id)?.kind === 'system' && store.openSystem(id)}
            />
            {showSystem && store.selPlace && (
                <div className={styles.systemStage}>
                    <SystemSchematic place={store.selPlace} selBodyId={store.selBody?.id ?? null} onSelect={(id) => store.select(store.selPlace!.id, id)} />
                </div>
            )}
            {store.placing && (
                <div className={styles.placingBanner}>
                    Click the map where it belongs.
                    <button type='button' className={styles.btnQuiet} onClick={store.cancelPlace}>Cancel</button>
                </div>
            )}
        </div>
    );
}

function PlaceList({ store, places, onPick }: { store: Store; places: Place[]; onPick?: () => void }) {
    const group = (kind: Place['kind'], title: string) => {
        const rows = places.filter((p) => p.kind === kind);
        if (!rows.length) return null;
        return (
            <>
                <h4 className='pixel-label'>{title}</h4>
                <ul className={styles.tree}>
                    {rows.map((p) => (
                        <li key={p.id}>
                            <button type='button' className={cx(styles.treeRow, store.selPlace?.id === p.id && styles.treeRowOn)} onClick={() => (store.select(p.id), onPick?.())}>
                                {placeTitle(p)}
                                <span className={styles.muted}>{regionLabel(p)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </>
        );
    };
    return (
        <>
            {group('system', 'Systems')}
            {group('landmark', 'Landmarks')}
        </>
    );
}

// ---------- A: floating cards ----------
export function VariantA({ store }: { store: Store }) {
    const [listOpen, setListOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const inSystem = store.level === 'system' && store.selPlace;

    return (
        <div className={styles.shell}>
            <Stage store={store} />
            <div className={styles.aTopLeft}>
                <button type='button' className={styles.btn} onClick={() => setCreating(true)}>+ New</button>
                <div className={styles.aDropdown}>
                    <button type='button' className={styles.aDropdownHead} aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
                        <span>{inSystem ? placeTitle(store.selPlace!) : 'Milky Way'}</span>
                        <span aria-hidden>{listOpen ? '▴' : '▾'}</span>
                    </button>
                    {listOpen && (
                        <div className={cx('pixel-panel', styles.aDropdownBody)}>
                            {inSystem ? (
                                <>
                                    <button type='button' className={styles.linkBtn} onClick={store.closeSystem}>Back to the galaxy</button>
                                    <BodyTree place={store.selPlace!} selBodyId={store.selBody?.id ?? null} onPick={(id) => store.select(store.selPlace!.id, id)} />
                                </>
                            ) : (
                                <PlaceList store={store} places={store.places} />
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.aTopRight}>
                {!inSystem && <ViewButtons store={store} />}
                {!inSystem && <LayerToggles store={store} />}
            </div>
            {store.selPlace && !store.placing && (
                <aside className={cx('pixel-panel', styles.aInfo)}>
                    <button type='button' className={styles.close} onClick={() => store.select(inSystem && store.selBody ? store.selPlace!.id : null)} aria-label='Close'>x</button>
                    <SelectionDetail store={store} style='slider' showTree={!inSystem} />
                </aside>
            )}
            {creating && (
                <aside className={cx('pixel-panel', styles.aCreate, store.placing && styles.tucked)}>
                    <CreateFlow store={store} style='slider' tabs onDone={() => setCreating(false)} />
                </aside>
            )}
        </div>
    );
}

// ---------- B: bottom dock ----------
export function VariantB({ store }: { store: Store }) {
    const [open, setOpen] = useState(true);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState('');
    const inSystem = store.level === 'system' && store.selPlace;
    const shown = store.places.filter((p) => placeTitle(p).toLowerCase().includes(filter.toLowerCase()) || p.bodies.some((b) => b.name.toLowerCase().includes(filter.toLowerCase())));

    return (
        <div className={cx(styles.shell, styles.bShell)}>
            <div className={styles.bTop}>
                <nav className={styles.crumbs} aria-label='Where you are'>
                    <button type='button' onClick={() => store.select(null)}>Milky Way</button>
                    {store.selPlace && (
                        <>
                            <span aria-hidden>&gt;</span>
                            <button type='button' onClick={() => store.select(store.selPlace!.id)}>{placeTitle(store.selPlace)}</button>
                        </>
                    )}
                    {store.selBody && (
                        <>
                            <span aria-hidden>&gt;</span>
                            <b>{store.selBody.name}</b>
                        </>
                    )}
                </nav>
                {inSystem ? <button type='button' className={styles.btnQuiet} onClick={store.closeSystem}>Back to the galaxy</button> : <><ViewButtons store={store} /><LayerToggles store={store} /></>}
            </div>
            <Stage store={store} />
            <div className={cx(styles.bDock, !open && styles.bDockShut)}>
                <button type='button' className={styles.bHandle} onClick={() => setOpen(!open)} aria-expanded={open}>
                    {open ? 'Hide console' : 'Show console'}
                </button>
                {open && (
                    <div className={styles.bCols}>
                        <section>
                            <input className={styles.search} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder='Find a system, planet or landmark' aria-label='Filter places' />
                            {inSystem ? (
                                <BodyTree place={store.selPlace!} selBodyId={store.selBody?.id ?? null} onPick={(id) => store.select(store.selPlace!.id, id)} />
                            ) : (
                                <PlaceList store={store} places={shown} />
                            )}
                        </section>
                        <section>
                            {store.selPlace ? <SelectionDetail store={store} style='chips' showTree={!inSystem} /> : <p className={styles.muted}>Pick something on the map or in the list to read about it.</p>}
                        </section>
                        <section>
                            {creating ? (
                                <CreateFlow store={store} style='chips' onDone={() => setCreating(false)} />
                            ) : (
                                <div className={styles.bAdd}>
                                    <h4 className='pixel-label'>Add to the map</h4>
                                    <p className={styles.muted}>A star system, a planet whose star nobody has named, a moon, a station or a landmark.</p>
                                    <button type='button' className={styles.btn} onClick={() => setCreating(true)}>+ Add something</button>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------- C: search and sheet ----------
export function VariantC({ store }: { store: Store }) {
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState<RegionKey | null>(null);
    const [creating, setCreating] = useState(false);
    const [layersOpen, setLayersOpen] = useState(false);
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

    return (
        <div className={styles.shell}>
            <Stage store={store} galaxyOnly />
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
                                    <button type='button' className={styles.treeRow} onClick={() => (store.select(h.p.id, h.bodyId), setQuery(''), setRegion(null))}>
                                        {h.label}
                                        <span className={styles.muted}>{h.sub}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {place && !store.placing && (
                    <aside className={cx('pixel-panel', styles.cSheet)}>
                        <button type='button' className={styles.close} onClick={() => store.select(store.selBody ? place.id : null)} aria-label='Close'>x</button>
                        {place.kind === 'system' && (
                            <div className={styles.cInset}>
                                <SystemSchematic compact place={place} selBodyId={store.selBody?.id ?? null} onSelect={(id) => store.select(place.id, id)} />
                            </div>
                        )}
                        <SelectionDetail store={store} style='lineup' showTree={false} noOpen />
                    </aside>
                )}
            </div>
            <div className={styles.cRight}>
                <ViewButtons store={store} />
                <button type='button' className={styles.btnQuiet} onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen}>Layers</button>
                {layersOpen && <LayerToggles store={store} />}
            </div>
            <button type='button' className={styles.cFab} onClick={() => setCreating(true)} aria-label='Add to the map'>+</button>
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
