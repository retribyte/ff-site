'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import DeleteControl from '@/components/DeleteControl';
import ConsoleShell from './ConsoleShell';
import Toolbar from './Toolbar';
import GalaxyMap from './GalaxyMap';
import { starColor } from '@/lib/space';
import type { GalaxyDetail, GalaxyLandmarkSummary, GalaxySelection, GalaxySystemSummary } from './types';
import styles from './space.module.scss';

const IDLE_GRIDREF = 'x ·––– y ·–––';

function gridRefText(x: number, y: number): string {
    const fmt = (n: number) => `.${String(Math.round(n * 100)).padStart(2, '0')}`;
    return `x ${fmt(x)} · y ${fmt(y)}`;
}

/** Same envelope shape RecordEditor/DeleteStoryButton expect from the proxy. */
async function readEnvelope(res: Response): Promise<{ status?: string; message?: string } | null> {
    return res.json().catch(() => null) as Promise<{ status?: string; message?: string } | null>;
}

// /galaxy page composition: registry (systems) + landmarks + selection detail
// in the rail, GalaxyMap in the viewport. Selection state lives here so the
// rail list and the canvas stay in sync in both directions.
//
// Authoring (3.3): `systems`/`landmarks` are local optimistic copies of the
// server-fetched `galaxy` prop — click-to-place/drag-to-move/coord-field
// edits update them immediately and PUT in the background, reverting on
// failure. They resync from `galaxy` whenever the server payload changes
// (i.e. after router.refresh(), which deletes trigger).
export default function GalaxyConsole({ galaxy }: { galaxy: GalaxyDetail }) {
    const { user } = useSession();
    const router = useRouter();

    const [systems, setSystems] = useState<GalaxySystemSummary[]>(galaxy.systems);
    const [landmarks, setLandmarks] = useState<GalaxyLandmarkSummary[]>(galaxy.landmarks);
    // Resync when the server payload changes (router.refresh(), after a
    // delete). Adjusting state during render — React's documented escape
    // hatch for "reset state when an input changes" — rather than an effect,
    // since a plain effect would set state synchronously every render cycle.
    const [prevGalaxy, setPrevGalaxy] = useState(galaxy);
    if (galaxy !== prevGalaxy) {
        setPrevGalaxy(galaxy);
        setSystems(galaxy.systems);
        setLandmarks(galaxy.landmarks);
    }

    const [tutorialDismissed, setTutorialDismissed] = useState(false);
    const showTutorial = systems.length === 0 && landmarks.length === 0 && !tutorialDismissed;

    const [selected, setSelected] = useState<GalaxySelection | null>(null);
    const [armed, setArmed] = useState<GalaxySelection | null>(null);
    const [coordDraft, setCoordDraft] = useState<{ x: string; y: string } | null>(null);
    const [placeError, setPlaceError] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [flashSignal, setFlashSignal] = useState<{ sel: GalaxySelection; token: number } | null>(null);
    const flashTokenRef = useRef(0);
    const gridRefEl = useRef<HTMLSpanElement>(null);

    const selectedSystem = selected?.kind === 'system' ? (systems.find((s) => s.id === selected.id) ?? null) : null;
    const selectedLandmark = selected?.kind === 'landmark' ? (landmarks.find((l) => l.id === selected.id) ?? null) : null;
    const systemSel: GalaxySelection | null = selectedSystem ? { kind: 'system', id: selectedSystem.id } : null;
    const landmarkSel: GalaxySelection | null = selectedLandmark ? { kind: 'landmark', id: selectedLandmark.id } : null;

    const canEdit = (sel: GalaxySelection): boolean => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        if (sel.kind === 'system') return systems.find((s) => s.id === sel.id)?.creatorId === user.id;
        return landmarks.find((l) => l.id === sel.id)?.creatorId === user.id;
    };

    const systemEditable = systemSel != null && canEdit(systemSel);
    const landmarkEditable = landmarkSel != null && canEdit(landmarkSel);
    const systemArmed = systemSel != null && armed?.kind === 'system' && armed.id === systemSel.id;
    const landmarkArmed = landmarkSel != null && armed?.kind === 'landmark' && armed.id === landmarkSel.id;

    // Unplaced editable systems are place-armed by default the moment
    // they're selected (there's nothing to accidentally move yet); anything
    // else needs an explicit "Place"/"Move" click. Keyed on `selected`'s
    // identity so it only recomputes when the *selection* changes, not on
    // every optimistic array update (e.g. while some *other* marker drags).
    const [prevSelected, setPrevSelected] = useState<GalaxySelection | null>(null);
    if (selected !== prevSelected) {
        setPrevSelected(selected);
        setArmed(selectedSystem && selectedSystem.xPos === null && systemEditable ? selected : null);
    }

    // Keyboard-path draft for the coordinate fields — resyncs whenever the
    // selection or its live position changes (so a drag or a place updates
    // the fields too).
    const coordKey = systemSel
        ? `s:${systemSel.id}:${selectedSystem?.xPos ?? ''}:${selectedSystem?.yPos ?? ''}`
        : landmarkSel
          ? `l:${landmarkSel.id}:${selectedLandmark?.xPos ?? ''}:${selectedLandmark?.yPos ?? ''}`
          : 'none';
    const [prevCoordKey, setPrevCoordKey] = useState(coordKey);
    if (coordKey !== prevCoordKey) {
        setPrevCoordKey(coordKey);
        if (selectedSystem && systemEditable) {
            setCoordDraft({
                x: selectedSystem.xPos !== null ? selectedSystem.xPos.toFixed(2) : '0.50',
                y: selectedSystem.yPos !== null ? selectedSystem.yPos.toFixed(2) : '0.50',
            });
        } else if (selectedLandmark && landmarkEditable) {
            setCoordDraft({ x: selectedLandmark.xPos.toFixed(2), y: selectedLandmark.yPos.toFixed(2) });
        } else {
            setCoordDraft(null);
        }
    }

    const toggleSystem = (id: number) =>
        setSelected((prev) => (prev?.kind === 'system' && prev.id === id ? null : { kind: 'system', id }));
    const toggleLandmark = (id: number) =>
        setSelected((prev) => (prev?.kind === 'landmark' && prev.id === id ? null : { kind: 'landmark', id }));

    // Rail double-click → system view. Timed ourselves (not the native
    // `dblclick` event, whose threshold is OS-configurable) so the window is
    // exactly 500ms everywhere — using the click event's own `timeStamp`
    // (a pure read of the event arg, unlike `Date.now()`) so the compiler's
    // purity check has nothing to flag. The first click always toggles
    // selection as before; a second click on the same row within the window
    // additionally navigates — even though that click's own toggle may have
    // just deselected the row, which is fine since we're leaving the page.
    // Landmarks have no detail page, so they keep plain toggleLandmark.
    const lastSystemClickRef = useRef<{ id: number; time: number } | null>(null);
    const handleSystemRowClick = (id: number, timeStamp: number) => {
        toggleSystem(id);
        const last = lastSystemClickRef.current;
        lastSystemClickRef.current = { id, time: timeStamp };
        if (last && last.id === id && timeStamp - last.time < 500) {
            lastSystemClickRef.current = null;
            router.push(`/galaxy/systems/${id}`);
        }
    };

    const toggleArm = (sel: GalaxySelection) =>
        setArmed((prev) => (prev && prev.kind === sel.kind && prev.id === sel.id ? null : sel));

    // Click-to-place and drag-to-move both land here (GalaxyMap doesn't care
    // which gesture produced the coords) — optimistic update, PUT through
    // the proxy, revert both arrays on failure.
    const handlePlace = async (sel: GalaxySelection, coords: { x: number; y: number }) => {
        if (!canEdit(sel)) return;
        setPlaceError(null);
        const prevSystems = systems;
        const prevLandmarks = landmarks;
        if (sel.kind === 'system') {
            setSystems((prev) => prev.map((s) => (s.id === sel.id ? { ...s, xPos: coords.x, yPos: coords.y } : s)));
        } else {
            setLandmarks((prev) => prev.map((l) => (l.id === sel.id ? { ...l, xPos: coords.x, yPos: coords.y } : l)));
        }
        setArmed(null);
        setPlacing(true);
        try {
            const path = sel.kind === 'system' ? `/systems/${sel.id}` : `/landmarks/${sel.id}`;
            const res = await fetch(`/api/ff${path}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xPos: coords.x, yPos: coords.y }),
            });
            const envelope = await readEnvelope(res);
            if (!res.ok || envelope?.status === 'error') {
                throw new Error(envelope?.message ?? `Placement failed (HTTP ${res.status})`);
            }
            flashTokenRef.current += 1;
            setFlashSignal({ sel, token: flashTokenRef.current });
        } catch (err) {
            setSystems(prevSystems);
            setLandmarks(prevLandmarks);
            setPlaceError(err instanceof Error ? err.message : 'The lore server is not answering');
        } finally {
            setPlacing(false);
        }
    };

    const applyCoordDraft = (sel: GalaxySelection) => {
        if (!coordDraft) return;
        const x = parseFloat(coordDraft.x);
        const y = parseFloat(coordDraft.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
            setPlaceError('x/y must be between 0 and 1');
            return;
        }
        handlePlace(sel, { x, y });
    };

    const handleDelete = async (sel: GalaxySelection) => {
        setDeletingId(sel.id);
        setPlaceError(null);
        try {
            const path = sel.kind === 'system' ? `/systems/${sel.id}` : `/landmarks/${sel.id}`;
            const res = await fetch(`/api/ff${path}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = await readEnvelope(res);
                setPlaceError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            if (sel.kind === 'system') setSystems((prev) => prev.filter((s) => s.id !== sel.id));
            else setLandmarks((prev) => prev.filter((l) => l.id !== sel.id));
            setSelected(null);
            router.refresh();
        } catch {
            setPlaceError('The lore server is not answering');
        } finally {
            setDeletingId(null);
        }
    };

    // Was the page header's stat line — moved into the toolbar so it isn't
    // lost now that the console is full-bleed and header-less.
    const statusText = `${systems.length} system${systems.length === 1 ? '' : 's'} · ${landmarks.length} landmark${
        landmarks.length === 1 ? '' : 's'
    } charted`;

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
                    actions={
                        <>
                            {placeError && (
                                <span className={styles.formError} role='alert'>
                                    ✖ {placeError}
                                </span>
                            )}
                            {user && (
                                <>
                                    <Link href='/galaxy/systems/new' className={`${styles.btn} ${styles.btnQuiet}`}>
                                        New system
                                    </Link>
                                    <Link href='/galaxy/landmarks/new' className={`${styles.btn} ${styles.btnQuiet}`}>
                                        New landmark
                                    </Link>
                                </>
                            )}
                            <span className={`pixel-label ${styles.status}`}>{statusText}</span>
                        </>
                    }
                />
            }
            railTitle='Registry'
            rail={
                <>
                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>Registry</p>
                        <div className={styles.tree}>
                            {systems.length === 0 && <p className='pixel-label'>no charted systems</p>}
                            {systems.map((sys) => (
                                <button
                                    key={sys.id}
                                    type='button'
                                    className={`${styles.treeButton} ${
                                        selected?.kind === 'system' && selected.id === sys.id ? styles.treeButtonSelected : ''
                                    }`}
                                    onClick={(e) => handleSystemRowClick(sys.id, e.timeStamp)}
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
                            {landmarks.length === 0 && <p className='pixel-label'>none charted</p>}
                            {landmarks.map((lm) => (
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

                    {selectedSystem && systemSel && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>{selectedSystem.name} · selected</p>
                                {systemEditable ? (
                                    <>
                                        {selectedSystem.xPos === null ? (
                                            <p className='pixel-label'>◈ unplaced — click the map to chart it</p>
                                        ) : (
                                            <form
                                                className={styles.coordFields}
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    applyCoordDraft(systemSel);
                                                }}
                                            >
                                                <div className={styles.coordField}>
                                                    <label htmlFor='system-x'>x</label>
                                                    <input
                                                        id='system-x'
                                                        type='number'
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        className={styles.coordInput}
                                                        value={coordDraft?.x ?? ''}
                                                        onChange={(e) => setCoordDraft((d) => ({ x: e.target.value, y: d?.y ?? '' }))}
                                                    />
                                                </div>
                                                <div className={styles.coordField}>
                                                    <label htmlFor='system-y'>y</label>
                                                    <input
                                                        id='system-y'
                                                        type='number'
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        className={styles.coordInput}
                                                        value={coordDraft?.y ?? ''}
                                                        onChange={(e) => setCoordDraft((d) => ({ x: d?.x ?? '', y: e.target.value }))}
                                                    />
                                                </div>
                                                <button type='submit' className={`${styles.btn} ${styles.btnPrimary}`} disabled={placing}>
                                                    Apply
                                                </button>
                                            </form>
                                        )}
                                        <div className={styles.rowActions}>
                                            {selectedSystem.xPos !== null && (
                                                <button
                                                    type='button'
                                                    className={`${styles.btn} ${systemArmed ? styles.btnPrimary : styles.btnQuiet}`}
                                                    onClick={() => toggleArm(systemSel)}
                                                >
                                                    {systemArmed ? 'Cancel move' : 'Move'}
                                                </button>
                                            )}
                                            <Link href={`/galaxy/systems/${selectedSystem.id}`} className={styles.btn}>
                                                View
                                            </Link>
                                            <Link href={`/galaxy/systems/${selectedSystem.id}/edit`} className={styles.btn}>
                                                Edit
                                            </Link>
                                            <DeleteControl
                                                onConfirm={() => handleDelete(systemSel)}
                                                busy={deletingId === selectedSystem.id}
                                                prompt='eject this system? its bodies go too'
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {selectedLandmark && landmarkSel && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>{selectedLandmark.name} · selected</p>
                                {selectedLandmark.description && <p className={styles.desc}>{selectedLandmark.description}</p>}
                                {landmarkEditable ? (
                                    <>
                                        <form
                                            className={styles.coordFields}
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                applyCoordDraft(landmarkSel);
                                            }}
                                        >
                                            <div className={styles.coordField}>
                                                <label htmlFor='landmark-x'>x</label>
                                                <input
                                                    id='landmark-x'
                                                    type='number'
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    className={styles.coordInput}
                                                    value={coordDraft?.x ?? ''}
                                                    onChange={(e) => setCoordDraft((d) => ({ x: e.target.value, y: d?.y ?? '' }))}
                                                />
                                            </div>
                                            <div className={styles.coordField}>
                                                <label htmlFor='landmark-y'>y</label>
                                                <input
                                                    id='landmark-y'
                                                    type='number'
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    className={styles.coordInput}
                                                    value={coordDraft?.y ?? ''}
                                                    onChange={(e) => setCoordDraft((d) => ({ x: d?.x ?? '', y: e.target.value }))}
                                                />
                                            </div>
                                            <button type='submit' className={`${styles.btn} ${styles.btnPrimary}`} disabled={placing}>
                                                Apply
                                            </button>
                                        </form>
                                        <div className={styles.rowActions}>
                                            <button
                                                type='button'
                                                className={`${styles.btn} ${landmarkArmed ? styles.btnPrimary : styles.btnQuiet}`}
                                                onClick={() => toggleArm(landmarkSel)}
                                            >
                                                {landmarkArmed ? 'Cancel move' : 'Move'}
                                            </button>
                                            <Link href={`/galaxy/landmarks/${selectedLandmark.id}/edit`} className={styles.btn}>
                                                Edit
                                            </Link>
                                            <DeleteControl
                                                onConfirm={() => handleDelete(landmarkSel)}
                                                busy={deletingId === selectedLandmark.id}
                                            />
                                        </div>
                                    </>
                                ) : (
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
                                )}
                            </div>
                        </>
                    )}
                </>
            }
            viewport={
                <>
                    <GalaxyMap
                        mapImage={galaxy.image}
                        systems={systems}
                        landmarks={landmarks}
                        selected={selected}
                        onSelect={setSelected}
                        onCoordsChange={handleCoordsChange}
                        currentUserId={user?.id ?? null}
                        isAdmin={user?.role === 'ADMIN'}
                        armed={armed}
                        onPlace={handlePlace}
                        flashSignal={flashSignal}
                    />
                    {showTutorial && (
                        <div className={`pixel-panel ${styles.tutorial}`}>
                            <button
                                type='button'
                                className={styles.tutorialDismiss}
                                onClick={() => setTutorialDismissed(true)}
                                aria-label='Dismiss welcome message'
                            >
                                ✕
                            </button>
                            <p className={styles.tutorialTitle}>◈ Chart your first system</p>
                            {user ? (
                                <p className={styles.tutorialBody}>
                                    This galaxy is unmapped. Use <strong>New system</strong> or <strong>New landmark</strong> in the
                                    toolbar above to start plotting — then click the map to place it.
                                </p>
                            ) : (
                                <p className={styles.tutorialBody}>
                                    This galaxy is unmapped. <Link href='/login'>Log in</Link> to chart the first system or landmark.
                                </p>
                            )}
                        </div>
                    )}
                </>
            }
        />
    );
}
