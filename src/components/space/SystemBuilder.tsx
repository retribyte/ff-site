'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConsoleShell from './ConsoleShell';
import Toolbar from './Toolbar';
import SystemDiagram from './SystemDiagram';
import BuilderBodyTree, { type CreateTarget } from './BuilderBodyTree';
import BodyForm from './BodyForm';
import BodyInfoPanel from './BodyInfoPanel';
import DeleteControl from '@/components/DeleteControl';
import WikiLink from '@/components/WikiLink';
import type { CelestialBody, StarSystem } from '@/lib/types';
import { addMoon, addPlanet, draftToBody, findBody, removeBody, serializeTree, updateBody, type BodyDraft } from './builderTree';
import styles from './space.module.scss';

type Creating = { kind: 'star' } | CreateTarget;

function deletePrompt(body: CelestialBody): string {
    if (body.type === 'STAR') return 'eject the star? this clears the whole system';
    if (body.type === 'PLANET' && (body.children?.length ?? 0) > 0) return 'eject this planet? its moons go too';
    return 'eject this body?';
}

// The system builder: local tree state (star → planets → moons) edited with
// contextual create forms and saved as a whole via PUT /systems/:id/bodies.
// Auth/ownership is gated server-side by the /edit route's page.tsx before
// this ever mounts (see that file for why: useSession's loading flag would
// otherwise let an unauthorized paint flash through on first render).
export default function SystemBuilder({ system }: { system: StarSystem }) {
    const router = useRouter();
    const [star, setStar] = useState<CelestialBody | null>(system.bodies?.[0] ?? null);
    const [selectedId, setSelectedId] = useState<number | null>(star?.id ?? null);
    const [creating, setCreating] = useState<Creating | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const nextIdRef = useRef(0);
    const nextId = () => --nextIdRef.current;

    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    }, []);

    const selected = selectedId != null ? findBody(star, selectedId) : null;
    const effectiveCreating: Creating | null = star ? creating : { kind: 'star' };

    const select = (id: number) => {
        setSelectedId(id);
        setEditingId(null);
    };

    const requestCreate = (target: CreateTarget) => {
        setCreating(target);
        setEditingId(null);
    };

    const submitCreate = (draft: BodyDraft) => {
        if (!star) {
            const newStar = draftToBody(nextId(), system.id, null, 'STAR', draft);
            setStar(newStar);
            setSelectedId(newStar.id);
            setDirty(true);
            return;
        }
        if (effectiveCreating?.kind === 'planet') {
            const planet = draftToBody(nextId(), system.id, star.id, 'PLANET', draft);
            setStar(addPlanet(star, planet));
            setSelectedId(planet.id);
        } else if (effectiveCreating?.kind === 'moon') {
            const moon = draftToBody(nextId(), system.id, effectiveCreating.planetId, 'MOON', draft);
            setStar(addMoon(star, effectiveCreating.planetId, moon));
            setSelectedId(moon.id);
        }
        setCreating(null);
        setDirty(true);
    };

    const submitEdit = (body: CelestialBody, draft: BodyDraft) => {
        if (!star) return;
        setStar(updateBody(star, body.id, draft));
        setEditingId(null);
        setDirty(true);
    };

    const handleDelete = (body: CelestialBody) => {
        if (!star) return;
        if (body.id === star.id) {
            setStar(null);
        } else {
            setStar(removeBody(star, body.id));
        }
        setSelectedId(null);
        setEditingId(null);
        setDirty(true);
    };

    const handleSave = async () => {
        if (!star) {
            setErrorMsg('chart a star before saving');
            return;
        }
        setSaveState('saving');
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/ff/systems/${system.id}/bodies`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serializeTree(star)),
            });
            const envelope = (await res.json()) as { status: string; message?: string; data?: StarSystem };
            if (!res.ok || envelope.status === 'error') {
                setSaveState('error');
                setErrorMsg(envelope.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            const updatedStar = envelope.data?.bodies?.[0] ?? null;
            setStar(updatedStar);
            setSelectedId(updatedStar?.id ?? null);
            setEditingId(null);
            setCreating(null);
            setDirty(false);
            setSaveState('saved');
            savedTimeoutRef.current = setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1600);
        } catch {
            setSaveState('error');
            setErrorMsg('The lore server is not answering');
        }
    };

    return (
        <ConsoleShell
            toolbar={
                <Toolbar
                    crumb={
                        <>
                            <Link href='/galaxy'>
                                <span className={styles.crumbArrow} aria-hidden>
                                    ◤
                                </span>{' '}
                                GALAXY
                            </Link>{' '}
                            <span className={styles.crumbDim}>▸</span> {system.name.toUpperCase()}
                            {dirty && <span className={styles.crumbDim}> · UNSAVED</span>}
                        </>
                    }
                    actions={
                        <>
                            {errorMsg && (
                                <span className={styles.formError} role='alert'>
                                    ✖ {errorMsg}
                                </span>
                            )}
                            <button type='button' className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => router.push(`/galaxy/systems/${system.id}`)}>
                                Exit
                            </button>
                            <button
                                type='button'
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={handleSave}
                                disabled={!star || saveState === 'saving'}
                            >
                                {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'SAVED!' : 'Save system'}
                            </button>
                        </>
                    }
                />
            }
            railTitle='Bodies'
            rail={
                <>
                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>Bodies</p>
                        {star ? (
                            <BuilderBodyTree star={star} selectedId={selectedId} onSelect={select} onRequestCreate={requestCreate} />
                        ) : (
                            <p className='pixel-label'>chart the primary star to begin</p>
                        )}
                    </div>

                    {effectiveCreating && (
                        <div className={styles.section}>
                            <p className={styles.sectionHeader}>
                                {effectiveCreating.kind === 'star'
                                    ? 'New star'
                                    : effectiveCreating.kind === 'planet'
                                      ? 'New planet'
                                      : `New moon · ${findBody(star, effectiveCreating.planetId)?.name ?? ''}`}
                            </p>
                            <BodyForm
                                key={effectiveCreating.kind === 'moon' ? `moon-${effectiveCreating.planetId}` : effectiveCreating.kind}
                                type={effectiveCreating.kind === 'star' ? 'STAR' : effectiveCreating.kind === 'planet' ? 'PLANET' : 'MOON'}
                                onCancel={star ? () => setCreating(null) : undefined}
                                submitLabel={
                                    effectiveCreating.kind === 'star'
                                        ? 'Chart star'
                                        : effectiveCreating.kind === 'planet'
                                          ? 'Add planet'
                                          : 'Add moon'
                                }
                                onSubmit={submitCreate}
                            />
                        </div>
                    )}

                    <hr className={styles.divider} />

                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>{system.name}</p>
                        {system.description && <p className={styles.desc}>{system.description}</p>}
                        <WikiLink article={system.wikiArticle} />
                        <div className={styles.rowActions}>
                            <Link href={`/galaxy/systems/${system.id}/meta`} className={styles.btn}>
                                Edit info
                            </Link>
                        </div>
                    </div>

                    {selected && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>Telemetry · {selected.name}</p>
                                {editingId === selected.id ? (
                                    <BodyForm
                                        key={`edit-${selected.id}`}
                                        type={selected.type}
                                        initial={selected}
                                        submitLabel='Save changes'
                                        onCancel={() => setEditingId(null)}
                                        onSubmit={(draft) => submitEdit(selected, draft)}
                                    />
                                ) : (
                                    <>
                                        <BodyInfoPanel body={selected} starTemperatureK={star?.temperatureK ?? null} />
                                        {selected.description && <p className={styles.desc}>{selected.description}</p>}
                                        <WikiLink article={selected.wikiArticle} />
                                        <div className={styles.rowActions}>
                                            <button
                                                type='button'
                                                className={styles.btn}
                                                onClick={() => {
                                                    setEditingId(selected.id);
                                                    setCreating(null);
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <DeleteControl onConfirm={() => handleDelete(selected)} prompt={deletePrompt(selected)} />
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </>
            }
            viewport={<SystemDiagram star={star} selectedId={selectedId} onSelect={(id) => id != null && select(id)} />}
        />
    );
}
