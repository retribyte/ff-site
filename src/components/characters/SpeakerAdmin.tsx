'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Character, Season } from '@/lib/types';
import { seasonDisplayName, seasonOrder } from '@/lib/seasons';
import OwnerControl from '@/components/admin/OwnerControl';
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
    /** Titles of the campaigns an admin added the character to the cast of */
    mainIn: string[];
    /** The player who plays the character (Character.creatorId) */
    creatorId: number;
}

type Action = 'rename' | 'merge' | 'demote' | 'main' | 'owner';

async function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
    const res = await fetch(`/site/ff${path}`, {
        method,
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
export default function SpeakerAdmin({ characterId, name, slug, mainIn, creatorId }: Props) {
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
    const [allSeasons, setAllSeasons] = useState<string[] | null>(null);
    const [mainPicks, setMainPicks] = useState<Set<string>>(() => new Set(mainIn));

    const target = characters?.find((c) => c.name.toLowerCase() === targetName.trim().toLowerCase() && c.id !== characterId) ?? null;

    const choose = (next: Action) => {
        setAction(action === next ? null : next);
        setArmed(false);
        setError(null);
        setResult(null);
        if (next === 'main' && allSeasons === null) {
            fetch('/site/ff/seasons')
                .then((res) => res.json())
                .then((envelope: Envelope<Season[]>) =>
                    setAllSeasons(
                        (envelope.data ?? [])
                            .map((s) => s.title)
                            .sort((a, b) => {
                                const [ra, ka] = seasonOrder(a);
                                const [rb, kb] = seasonOrder(b);
                                return ra - rb || ka.localeCompare(kb);
                            })
                    )
                )
                .catch(() => {
                    setAllSeasons([]);
                    setError('Could not load campaigns');
                });
        }
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
        // Not destructive, so no second click
        if (action === 'main') {
            setBusy(true);
            setError(null);
            try {
                await post<Character>(`/characters/${characterId}/main-in`, { seasons: [...mainPicks] }, 'PUT');
                setResult('Saved.');
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'The lore server is not answering');
            } finally {
                setBusy(false);
            }
            return;
        }
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
        (action === 'merge' ? target !== null : true) &&
        (action === 'main'
            ? allSeasons !== null && (mainPicks.size !== mainIn.length || mainIn.some((t) => !mainPicks.has(t)))
            : true);

    const runLabel = {
        rename: armed ? 'confirm rename' : 'rename',
        merge: armed ? `confirm: move lines to ${target?.name ?? '…'}` : 'merge',
        demote: armed ? `confirm: ${name} becomes an NPC` : 'demote to NPC',
        main: 'save',
        owner: 'save',
    };

    return (
        <section className={styles.panel} aria-label='Speaker admin'>
            <div className={styles.tabs}>
                <span className='pixel-label'>admin</span>
                {(['rename', 'merge', 'demote', 'main', 'owner'] as const).map((a) => (
                    <button key={a} type='button' className={styles.tab} aria-pressed={action === a} onClick={() => choose(a)} disabled={busy}>
                        {a === 'merge'
                            ? 'merge into…'
                            : a === 'demote'
                              ? 'demote to NPC'
                              : a === 'main'
                                ? 'add to cast…'
                                : a === 'owner'
                                  ? 'played by…'
                                  : 'rename'}
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

            {action === 'main' && (
                <div className={styles.form}>
                    <p className={styles.help}>
                        Each campaign&rsquo;s player characters are found from its transcripts (every player&rsquo;s most
                        active character per episode). {`Tick a campaign to add ${name} by hand, `}
                        for a story-only campaign (no transcripts) or one the transcripts miss.
                    </p>
                    {allSeasons === null ? (
                        <p className={styles.help}>loading…</p>
                    ) : (
                        allSeasons.map((title) => (
                            <label key={title} className={styles.check}>
                                <input
                                    type='checkbox'
                                    checked={mainPicks.has(title)}
                                    onChange={() => {
                                        const next = new Set(mainPicks);
                                        if (next.has(title)) next.delete(title);
                                        else next.add(title);
                                        setMainPicks(next);
                                        setResult(null);
                                    }}
                                    disabled={busy}
                                />
                                {seasonDisplayName(title)}
                            </label>
                        ))
                    )}
                </div>
            )}

            {action === 'owner' && (
                <div className={styles.form}>
                    {/* saves itself (POST /admin/owner, logged in the admin History) */}
                    <OwnerControl kind='character' id={characterId} ownerIds={[creatorId]} inline />
                </div>
            )}

            {action && action !== 'owner' && (
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
