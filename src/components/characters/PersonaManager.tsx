'use client';

import { useState } from 'react';
import type { Persona } from '@/lib/types';
import styles from './personaManager.module.scss';

interface Envelope {
    status: 'success' | 'error';
    message?: string;
    data?: Persona;
}

interface Draft {
    name: string;
    label: string;
    image: string;
    color: string;
}

const EMPTY_DRAFT: Draft = { name: '', label: '', image: '', color: '' };

// A persona must set at least one of name/image/color, and needs a label
// when it sets no name (so a name-less row stays distinguishable in this
// list). Mirrors the server-side rule client-side so the error shows before
// the round trip, not just after a failed POST.
function validateDraft(draft: Draft): string | null {
    const hasName = draft.name.trim() !== '';
    const hasLabel = draft.label.trim() !== '';
    const hasImage = draft.image.trim() !== '';
    const hasColor = draft.color.trim() !== '';
    if (!hasName && !hasImage && !hasColor) return 'set a name, image, or color';
    if (!hasName && !hasLabel) return 'a label is required when no name is set';
    return null;
}

// Child-collection editor for a character's era-correct personas (e.g. `Vec`
// speaks as "Fungus" for a stretch of FF4, or just looks different for a
// stretch with no name change). Personas don't fit the flat
// EDITOR_SCHEMAS/RecordEditor field model — this is a small self-contained
// client component: it owns its own list state and talks to the API
// directly through the /api/ff/ proxy, same pattern as CommentaryThread.
export default function PersonaManager({ characterId, initial }: { characterId: number; initial: Persona[] }) {
    const [personas, setPersonas] = useState<Persona[]>(initial);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const validationError = validateDraft(draft);
    const isDraftEmpty = !draft.name.trim() && !draft.label.trim() && !draft.image.trim() && !draft.color.trim();

    const add = async () => {
        if (isDraftEmpty || validationError) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/ff/characters/${characterId}/personas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name.trim() || undefined,
                    label: draft.label.trim() || undefined,
                    image: draft.image.trim() || undefined,
                    color: draft.color.trim() || undefined,
                }),
            });
            const envelope = (await res.json()) as Envelope;
            if (!res.ok || envelope.status === 'error' || !envelope.data) {
                setError(envelope.message ?? 'Save failed');
                return;
            }
            setPersonas((prev) => [...prev, envelope.data!]);
            setDraft(EMPTY_DRAFT);
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
            const res = await fetch(`/api/ff/personas/${id}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = (await res.json().catch(() => null)) as Envelope | null;
                // e.g. "400 — messages still reference this persona"
                setError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            setPersonas((prev) => prev.filter((p) => p.id !== id));
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={`pixel-panel ${styles.manager}`}>
            <h2 className='pixel-label'>personas</h2>
            <p className={styles.help}>
                era-correct presentations — a different name, a different look, or both. The transcript reader
                shows the persona but still links to this character&apos;s page.
            </p>

            {personas.length > 0 ? (
                <ul className={styles.list}>
                    {personas.map((p) => (
                        <li key={p.id} className={styles.item}>
                            <span className={styles.swatch} style={{ background: p.color ?? 'transparent' }} aria-hidden />
                            <span className={styles.name}>{p.name ?? <em>{p.label ?? 'unnamed'}</em>}</span>
                            {p.name && p.label && <span className={styles.label}>{p.label}</span>}
                            <span className={styles.slug}>{p.slug ?? '—'}</span>
                            <button
                                type='button'
                                className={styles.remove}
                                onClick={() => remove(p.id)}
                                disabled={busy}
                                aria-label={`delete persona ${p.name ?? p.label ?? p.id}`}
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.empty}>no personas on record</p>
            )}

            <div className={styles.addGrid}>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>name</span>
                    <input
                        type='text'
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder='(no name change)'
                        aria-label='new persona name'
                        disabled={busy}
                    />
                </label>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>label</span>
                    <input
                        type='text'
                        value={draft.label}
                        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                        placeholder='admin-facing handle'
                        aria-label='new persona label'
                        disabled={busy}
                    />
                </label>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>image URL</span>
                    <input
                        type='text'
                        value={draft.image}
                        onChange={(e) => setDraft((d) => ({ ...d, image: e.target.value }))}
                        placeholder='(no image change)'
                        aria-label='new persona image URL'
                        disabled={busy}
                    />
                </label>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>color</span>
                    <span className={styles.colorRow}>
                        <input
                            type='color'
                            aria-label='new persona color picker'
                            value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : '#5d4be5'}
                            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                            disabled={busy}
                        />
                        <input
                            type='text'
                            value={draft.color}
                            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                            placeholder='#62DE2C'
                            aria-label='new persona color'
                            disabled={busy}
                        />
                    </span>
                </label>
            </div>

            {!isDraftEmpty && validationError && (
                <p className={styles.hint} role='alert'>
                    {validationError}
                </p>
            )}

            <button
                type='button'
                className={styles.add}
                onClick={add}
                disabled={busy || isDraftEmpty || validationError !== null}
            >
                {busy ? '…' : 'add persona'}
            </button>

            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </section>
    );
}
