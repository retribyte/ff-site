'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Character } from '@/lib/types';
import styles from './speakerAdmin.module.scss';

interface Envelope<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

interface Props {
    characterId: number;
    name: string;
    slug: string;
}

type Action = 'rename' | 'merge' | 'demote';

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`/site/ff${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const envelope = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || envelope?.status === 'error' || !envelope) {
        throw new Error(envelope?.message ?? `HTTP ${res.status}`);
    }
    return envelope.data as T;
}

/** "ff4 ff5" -> ['ff4', 'ff5']; empty -> undefined (all of the character's lines). */
function seasonScope(text: string): { seasons: string[] } | undefined {
    const seasons = text.split(/[\s,]+/).filter(Boolean);
    return seasons.length ? { seasons } : undefined;
}

// Admin-only speaker tools on a character page (FR-EP-2: attribution is an
// admin right). Each action calls one ff-server speaker operation, which
// moves transcript lines, story lines and in-prose quotes together in one
// transaction. Destructive actions take a second click instead of a browser
// confirm() dialog.
export default function SpeakerAdmin({ characterId, name, slug }: Props) {
    const router = useRouter();
    const [action, setAction] = useState<Action | null>(null);
    const [armed, setArmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    const [newName, setNewName] = useState(name);
    const [newSlug, setNewSlug] = useState(slug);
    const [characters, setCharacters] = useState<Character[] | null>(null);
    const [targetName, setTargetName] = useState('');
    const [asPersona, setAsPersona] = useState(false);
    const [seasons, setSeasons] = useState('');

    const target = characters?.find((c) => c.name.toLowerCase() === targetName.trim().toLowerCase() && c.id !== characterId) ?? null;

    const choose = (next: Action) => {
        setAction(action === next ? null : next);
        setArmed(false);
        setError(null);
        setResult(null);
        if (next === 'merge' && characters === null) {
            fetch('/site/ff/characters')
                .then((res) => res.json())
                .then((envelope: Envelope<Character[]>) =>
                    setCharacters([...(envelope.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
                )
                .catch(() => setError('Could not load characters'));
        }
    };

    const run = async () => {
        if (!armed) {
            setArmed(true);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (action === 'rename') {
                const updated = await post<Character>('/admin/speakers/rename', {
                    characterId,
                    ...(newName.trim() !== name ? { name: newName.trim() } : {}),
                    ...(newSlug.trim() !== slug ? { slug: newSlug.trim() } : {}),
                });
                router.push(`/characters/${updated.slug}`);
                router.refresh();
            } else if (action === 'merge' && target) {
                const r = await post<{ messages: number; storyLines: number; storySegmentLines: number; deletedCharacter: boolean }>(
                    '/admin/speakers/merge',
                    { sourceId: characterId, targetId: target.id, asPersona, scope: seasonScope(seasons) }
                );
                if (r.deletedCharacter) {
                    router.push(`/characters/${target.slug}`);
                } else {
                    setResult(`Moved ${r.messages} lines, ${r.storyLines + r.storySegmentLines} story lines.`);
                    router.refresh();
                }
            } else if (action === 'demote') {
                const r = await post<{ messages: number; storyLines: number; storySegmentLines: number; deletedCharacter: boolean }>(
                    '/admin/speakers/demote',
                    { characterId, scope: seasonScope(seasons) }
                );
                if (r.deletedCharacter) {
                    router.push('/characters/npcs');
                } else {
                    setResult(`Moved ${r.messages} lines, ${r.storyLines + r.storySegmentLines} story lines to the NPC voice.`);
                    router.refresh();
                }
            }
            setArmed(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The lore server is not answering');
            setArmed(false);
        } finally {
            setBusy(false);
        }
    };

    const ready =
        !busy &&
        (action === 'rename' ? newName.trim() !== '' && (newName.trim() !== name || newSlug.trim() !== slug) : true) &&
        (action === 'merge' ? target !== null : true);

    const runLabel = {
        rename: armed ? 'confirm rename' : 'rename',
        merge: armed ? `confirm: move lines to ${target?.name ?? '…'}` : 'merge',
        demote: armed ? `confirm: ${name} becomes an NPC` : 'demote to NPC',
    };

    return (
        <section className={styles.panel} aria-label='Speaker admin'>
            <div className={styles.tabs}>
                <span className='pixel-label'>admin</span>
                {(['rename', 'merge', 'demote'] as const).map((a) => (
                    <button key={a} type='button' className={styles.tab} aria-pressed={action === a} onClick={() => choose(a)} disabled={busy}>
                        {a === 'merge' ? 'merge into…' : a === 'demote' ? 'demote to NPC' : 'rename'}
                    </button>
                ))}
            </div>

            {action === 'rename' && (
                <div className={styles.form}>
                    <label className={styles.field}>
                        <span>name</span>
                        <input value={newName} onChange={(e) => { setNewName(e.target.value); setArmed(false); }} disabled={busy} />
                    </label>
                    <label className={styles.field}>
                        <span>slug</span>
                        <input value={newSlug} onChange={(e) => { setNewSlug(e.target.value); setArmed(false); }} disabled={busy} />
                    </label>
                    <p className={styles.help}>Before go-live only: once the site is public, slugs are permanent links.</p>
                </div>
            )}

            {action === 'merge' && (
                <div className={styles.form}>
                    <label className={styles.field}>
                        <span>into character</span>
                        <input
                            list='speaker-admin-characters'
                            value={targetName}
                            onChange={(e) => { setTargetName(e.target.value); setArmed(false); }}
                            disabled={busy || characters === null}
                            placeholder={characters === null ? 'loading…' : 'name'}
                        />
                        <datalist id='speaker-admin-characters'>
                            {(characters ?? []).filter((c) => c.id !== characterId).map((c) => (
                                <option key={c.id} value={c.name} />
                            ))}
                        </datalist>
                    </label>
                    <label className={styles.check}>
                        <input type='checkbox' checked={asPersona} onChange={(e) => { setAsPersona(e.target.checked); setArmed(false); }} disabled={busy} />
                        keep &ldquo;{name}&rdquo; as a persona of the target (lines keep reading as {name})
                    </label>
                    <label className={styles.field}>
                        <span>only seasons (optional)</span>
                        <input value={seasons} onChange={(e) => { setSeasons(e.target.value); setArmed(false); }} disabled={busy} placeholder='e.g. ff4 — empty = every line' />
                    </label>
                    <p className={styles.help}>Moving every line deletes {name}. A season-limited move keeps it.</p>
                </div>
            )}

            {action === 'demote' && (
                <div className={styles.form}>
                    <label className={styles.field}>
                        <span>only seasons (optional)</span>
                        <input value={seasons} onChange={(e) => { setSeasons(e.target.value); setArmed(false); }} disabled={busy} placeholder='e.g. ff4 — empty = every line' />
                    </label>
                    <p className={styles.help}>
                        {name}&rsquo;s lines become an NPC voice of the same name (joining one that already exists). Moving every line
                        deletes the character; it can be promoted back from the NPC voices list.
                    </p>
                </div>
            )}

            {action && (
                <div className={styles.actions}>
                    <button type='button' className={armed ? styles.danger : styles.go} onClick={run} disabled={!ready}>
                        {busy ? '…' : runLabel[action]}
                    </button>
                    {armed && (
                        <button type='button' className={styles.go} onClick={() => setArmed(false)} disabled={busy}>
                            cancel
                        </button>
                    )}
                </div>
            )}

            {result && <p className={styles.help} role='status'>{result}</p>}
            {error && <p className={styles.error} role='alert'>✖ {error}</p>}
        </section>
    );
}
