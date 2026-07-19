'use client';

import { useState } from 'react';
import type { Alias } from '@/lib/types';
import styles from './aliasManager.module.scss';

interface Envelope {
    status: 'success' | 'error';
    message?: string;
    data?: Alias;
}

// Child-collection editor for a character's era-correct aliases (e.g. `Vec`
// speaks as "Fungus" for a stretch of FF4). Aliases don't fit the flat
// EDITOR_SCHEMAS/RecordEditor field model — this is a small self-contained
// client component: it owns its own list state and talks to the API
// directly through the /api/ff/ proxy, same pattern as CommentaryThread.
export default function AliasManager({ characterId, initial }: { characterId: number; initial: Alias[] }) {
    const [aliases, setAliases] = useState<Alias[]>(initial);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const add = async () => {
        const alias = draft.trim();
        if (!alias) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/ff/characters/${characterId}/aliases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias }),
            });
            const envelope = (await res.json()) as Envelope;
            if (!res.ok || envelope.status === 'error' || !envelope.data) {
                setError(envelope.message ?? 'Save failed');
                return;
            }
            setAliases((prev) => [...prev, envelope.data!]);
            setDraft('');
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: number) => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/ff/aliases/${id}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = (await res.json().catch(() => null)) as Envelope | null;
                // e.g. "400 — messages still reference this alias"
                setError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            setAliases((prev) => prev.filter((a) => a.id !== id));
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={`pixel-panel ${styles.manager}`}>
            <h2 className='pixel-label'>aliases</h2>
            <p className={styles.help}>
                era-correct display names — the transcript reader shows the alias but still links to this
                character&apos;s page.
            </p>

            {aliases.length > 0 ? (
                <ul className={styles.list}>
                    {aliases.map((a) => (
                        <li key={a.id} className={styles.item}>
                            <span className={styles.name}>{a.alias}</span>
                            <span className={styles.slug}>{a.slug}</span>
                            <button
                                type='button'
                                className={styles.remove}
                                onClick={() => remove(a.id)}
                                disabled={busy}
                                aria-label={`delete alias ${a.alias}`}
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.empty}>no aliases on record</p>
            )}

            <div className={styles.addRow}>
                <input
                    type='text'
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder='add an alias…'
                    aria-label='new alias'
                    disabled={busy}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <button type='button' onClick={add} disabled={busy || !draft.trim()}>
                    {busy ? '…' : 'add'}
                </button>
            </div>

            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </section>
    );
}
