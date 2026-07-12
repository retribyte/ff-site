'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ConsoleShell from './ConsoleShell';
import Toolbar from './Toolbar';
import GalaxyMap from './GalaxyMap';
import { starColor } from '@/lib/space';
import type { GalaxyDetail, GalaxySelection } from './types';
import styles from './space.module.scss';

const IDLE_GRIDREF = 'x ·––– y ·–––';

function gridRefText(x: number, y: number): string {
    const fmt = (n: number) => `.${String(Math.round(n * 100)).padStart(2, '0')}`;
    return `x ${fmt(x)} · y ${fmt(y)}`;
}

// /galaxy page composition: registry (systems) + landmarks + selection detail
// in the rail, GalaxyMap in the viewport. Selection state lives here so the
// rail list and the canvas stay in sync in both directions.
export default function GalaxyConsole({ galaxy }: { galaxy: GalaxyDetail }) {
    const [selected, setSelected] = useState<GalaxySelection | null>(null);
    const gridRefEl = useRef<HTMLSpanElement>(null);

    const selectedSystem = selected?.kind === 'system' ? (galaxy.systems.find((s) => s.id === selected.id) ?? null) : null;
    const selectedLandmark =
        selected?.kind === 'landmark' ? (galaxy.landmarks.find((l) => l.id === selected.id) ?? null) : null;

    const toggleSystem = (id: number) =>
        setSelected((prev) => (prev?.kind === 'system' && prev.id === id ? null : { kind: 'system', id }));
    const toggleLandmark = (id: number) =>
        setSelected((prev) => (prev?.kind === 'landmark' && prev.id === id ? null : { kind: 'landmark', id }));

    // Was the page header's stat line — moved into the toolbar so it isn't
    // lost now that the console is full-bleed and header-less.
    const statusText = `${galaxy.systems.length} system${galaxy.systems.length === 1 ? '' : 's'} · ${
        galaxy.landmarks.length
    } landmark${galaxy.landmarks.length === 1 ? '' : 's'} charted`;

    // Owns the toolbar's grid-ref DOM node and mutates it directly on pointer
    // move — the crosshair readout must not force a React re-render.
    const handleCoordsChange = (coords: { x: number; y: number } | null) => {
        if (!gridRefEl.current) return;
        gridRefEl.current.textContent = coords ? gridRefText(coords.x, coords.y) : IDLE_GRIDREF;
    };

    return (
        <ConsoleShell
            toolbar={
                <Toolbar
                    crumb={
                        <>
                            <span className={styles.crumbArrow} aria-hidden>
                                ◤
                            </span>{' '}
                            GALAXY <span className={styles.crumbDim}>▸ {galaxy.name}</span>
                        </>
                    }
                    gridRef={
                        <span ref={gridRefEl} className={styles.gridRef}>
                            x ·––– y ·–––
                        </span>
                    }
                    actions={<span className={`pixel-label ${styles.status}`}>{statusText}</span>}
                />
            }
            railTitle='Registry'
            rail={
                <>
                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>Registry</p>
                        <div className={styles.tree}>
                            {galaxy.systems.length === 0 && <p className='pixel-label'>no charted systems</p>}
                            {galaxy.systems.map((sys) => (
                                <button
                                    key={sys.id}
                                    type='button'
                                    className={`${styles.treeButton} ${
                                        selected?.kind === 'system' && selected.id === sys.id ? styles.treeButtonSelected : ''
                                    }`}
                                    onClick={() => toggleSystem(sys.id)}
                                    aria-pressed={selected?.kind === 'system' && selected.id === sys.id}
                                >
                                    <span
                                        className={`${styles.dot} ${styles.dotStar}`}
                                        style={{
                                            background:
                                                sys.star?.color ||
                                                (sys.star?.temperatureK != null ? starColor(sys.star.temperatureK) : undefined),
                                        }}
                                    />
                                    <span>{sys.name}</span>
                                    {sys.xPos === null && <span className={styles.unplaced}>unplaced</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>Landmarks</p>
                        <div className={styles.tree}>
                            {galaxy.landmarks.length === 0 && <p className='pixel-label'>none charted</p>}
                            {galaxy.landmarks.map((lm) => (
                                <button
                                    key={lm.id}
                                    type='button'
                                    className={`${styles.treeButton} ${
                                        selected?.kind === 'landmark' && selected.id === lm.id ? styles.treeButtonSelected : ''
                                    }`}
                                    onClick={() => toggleLandmark(lm.id)}
                                    aria-pressed={selected?.kind === 'landmark' && selected.id === lm.id}
                                >
                                    <span className={`${styles.dot} ${styles.dotLandmark}`} />
                                    <span>{lm.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedSystem && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>{selectedSystem.name} · selected</p>
                                <div className={styles.coordFields}>
                                    <div className={styles.coordField}>
                                        <label>x</label>
                                        <span className={styles.coordValue}>{selectedSystem.xPos?.toFixed(2) ?? '—'}</span>
                                    </div>
                                    <div className={styles.coordField}>
                                        <label>y</label>
                                        <span className={styles.coordValue}>{selectedSystem.yPos?.toFixed(2) ?? '—'}</span>
                                    </div>
                                </div>
                                <div className={styles.rowActions}>
                                    <Link href={`/galaxy/systems/${selectedSystem.id}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                                        Open system
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}

                    {selectedLandmark && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>{selectedLandmark.name} · selected</p>
                                {selectedLandmark.description && <p className={styles.desc}>{selectedLandmark.description}</p>}
                                <div className={styles.coordFields}>
                                    <div className={styles.coordField}>
                                        <label>x</label>
                                        <span className={styles.coordValue}>{selectedLandmark.xPos.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.coordField}>
                                        <label>y</label>
                                        <span className={styles.coordValue}>{selectedLandmark.yPos.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            }
            viewport={
                <GalaxyMap
                    mapImage={galaxy.image}
                    systems={galaxy.systems}
                    landmarks={galaxy.landmarks}
                    selected={selected}
                    onSelect={setSelected}
                    onCoordsChange={handleCoordsChange}
                />
            }
        />
    );
}
