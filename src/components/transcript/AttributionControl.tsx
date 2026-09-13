'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Persona } from '@/lib/types';
import styles from './transcript.module.scss';

interface Envelope<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

interface Props {
    episodeTitle: string;
    characterId: number;
    /** The block's first messageNo — what "this line" targets. */
    anchorNo: number;
    /** Every messageNo in the block — what "whole transmission" targets. */
    blockNos: number[];
    /** The block's current personaId (null = canonical), to preselect. */
    currentPersonaId: number | null;
}

// Admin-only post-import tagging affordance (PLAN-alias.md §5, Phase 3):
// set or clear a character's persona for one message or a whole grouped
// block, without going through the bulk episode/season stamp. Lives next to
// the copy-anchor button in a block's action tray, same floating-panel
// pattern as CommentaryThread.
export default function AttributionControl({ episodeTitle, characterId, anchorNo, blockNos, currentPersonaId }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [personas, setPersonas] = useState<Persona[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [personaId, setPersonaId] = useState(currentPersonaId !== null ? String(currentPersonaId) : '');
    const [target, setTarget] = useState<'line' | 'block'>('block');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) {
            setPersonaId(currentPersonaId !== null ? String(currentPersonaId) : '');
            setTarget('block');
            setError(null);
            if (personas === null) {
                fetch(`/api/ff/characters/${characterId}/personas`)
                    .then((res) => res.json())
                    .then((envelope: Envelope<Persona[]>) => {
                        if (envelope.status === 'error') {
                            setLoadError(envelope.message ?? 'Could not load personas');
                            return;
                        }
                        setPersonas(envelope.data ?? []);
                    })
                    .catch(() => setLoadError('The lore server is not answering'));
            }
        }
    };

    const apply = async () => {
        setBusy(true);
        setError(null);
        try {
            const nos = target === 'block' ? blockNos : [anchorNo];
            const value = personaId === '' ? null : Number(personaId);
            for (const no of nos) {
                const res = await fetch(`/api/ff/episodes/${encodeURIComponent(episodeTitle)}/messages/${no}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personaId: value }),
                });
                const envelope = (await res.json().catch(() => null)) as Envelope<unknown> | null;
                if (!res.ok || envelope?.status === 'error') {
                    throw new Error(envelope?.message ?? `HTTP ${res.status} on line ${no}`);
                }
            }
            setOpen(false);
            // Attribution changes affect block grouping/speaker/color, all
            // derived server-side from the fetched transcript — refetch
            // rather than try to hand-patch local state.
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.attribution}>
            <button
                type='button'
                className={styles.attributionTrigger}
                onClick={toggle}
                aria-expanded={open}
                aria-label='Edit persona attribution'
                title='Edit persona attribution'
            >
                🎭
            </button>

            {open && (
                <div className={styles.attributionPanel}>
                    {loadError ? (
                        <p className={styles.attributionError} role='alert'>
                            ✖ {loadError}
                        </p>
                    ) : (
                        <>
                            <label className={styles.attributionField}>
                                <span>persona</span>
                                <select
                                    value={personaId}
                                    onChange={(e) => setPersonaId(e.target.value)}
                                    disabled={busy || personas === null}
                                    aria-label='persona for this line'
                                >
                                    <option value=''>canonical</option>
                                    {(personas ?? []).map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name ?? p.label ?? `#${p.id}`}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {blockNos.length > 1 && (
                                <fieldset className={styles.attributionTargets}>
                                    <legend>apply to</legend>
                                    <label>
                                        <input
                                            type='radio'
                                            name={`attr-target-${anchorNo}`}
                                            checked={target === 'line'}
                                            onChange={() => setTarget('line')}
                                            disabled={busy}
                                        />
                                        this line (#{anchorNo})
                                    </label>
                                    <label>
                                        <input
                                            type='radio'
                                            name={`attr-target-${anchorNo}`}
                                            checked={target === 'block'}
                                            onChange={() => setTarget('block')}
                                            disabled={busy}
                                        />
                                        whole transmission ({blockNos.length} lines)
                                    </label>
                                </fieldset>
                            )}

                            <div className={styles.attributionActions}>
                                <button type='button' onClick={apply} disabled={busy || personas === null}>
                                    {busy ? '…' : 'apply'}
                                </button>
                                <button type='button' onClick={() => setOpen(false)} disabled={busy}>
                                    cancel
                                </button>
                            </div>
                        </>
                    )}

                    {error && (
                        <p className={styles.attributionError} role='alert'>
                            ✖ {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
