'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './personaStampPanel.module.scss';

interface PersonaOption {
    id: number;
    name: string | null;
    label: string | null;
    characterId: number;
}

interface CharacterOption {
    id: number;
    name: string;
}

interface Envelope<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

// The bulk "set it once" persona stamp (PLAN-alias.md §5) — pick a
// character, pick a persona (or "canonical" to clear), apply across every
// message of that character in this episode/season. Owner-of-character or
// admin (PLAN-alias.md §4/§8.2); shown to any logged-in user since the
// stamp is scoped by *character* ownership, not by anything the episode or
// season page itself owns — the server is the real gate (a non-owner just
// gets a 403 back, surfaced below). `characters` is the candidate list: the
// episode page passes the characters that actually speak in it (derived
// from the already-fetched transcript); the season page has no cheap way to
// know who speaks across every episode, so it passes every character.
export default function PersonaStampPanel({
    scope,
    scopeTitle,
    characters,
}: {
    scope: 'episode' | 'season';
    scopeTitle: string;
    characters: CharacterOption[];
}) {
    const { user } = useSession();
    const [personas, setPersonas] = useState<PersonaOption[] | null>(null);
    const [characterId, setCharacterId] = useState('');
    const [personaId, setPersonaId] = useState(''); // '' = canonical
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetched once, lazily, the first time a logged-in user can see the
    // panel — same /personas index EpisodeImporter uses, filtered locally
    // to the picked character rather than re-fetched per selection.
    useEffect(() => {
        if (!user || personas !== null) return;
        fetch('/api/ff/personas')
            .then((res) => res.json())
            .then((envelope: Envelope<PersonaOption[]>) => {
                if (envelope.status === 'error') throw new Error(envelope.message);
                setPersonas(envelope.data ?? []);
            })
            .catch(() => setPersonas([]));
    }, [user, personas]);

    const personasForCharacter = useMemo(
        () => (personas ?? []).filter((p) => String(p.characterId) === characterId),
        [personas, characterId]
    );

    if (!user) return null;

    const apply = async () => {
        if (!characterId) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const path =
                scope === 'episode'
                    ? `/episodes/${encodeURIComponent(scopeTitle)}/personas/apply`
                    : `/seasons/${encodeURIComponent(scopeTitle)}/personas/apply`;
            const res = await fetch(`/api/ff${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterId: Number(characterId),
                    personaId: personaId === '' ? null : Number(personaId),
                }),
            });
            const envelope = (await res.json()) as Envelope<{ count: number }>;
            if (!res.ok || envelope.status === 'error' || !envelope.data) {
                setError(envelope.message ?? 'Stamp failed');
                return;
            }
            setResult(envelope.data.count);
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={`pixel-panel ${styles.panel}`}>
            <h2 className='pixel-label'>persona stamp</h2>
            <p className={styles.help}>
                set a character&apos;s presentation across every message in this {scope} at once — pick
                &ldquo;canonical&rdquo; to clear back to their default look.
            </p>

            <div className={styles.row}>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>character</span>
                    <select
                        value={characterId}
                        onChange={(e) => {
                            setCharacterId(e.target.value);
                            setPersonaId('');
                            setResult(null);
                            setError(null);
                        }}
                        disabled={busy}
                        aria-label='character to stamp'
                    >
                        <option value=''>— select —</option>
                        {characters.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>persona</span>
                    <select
                        value={personaId}
                        onChange={(e) => setPersonaId(e.target.value)}
                        disabled={busy || !characterId}
                        aria-label='persona to apply'
                    >
                        <option value=''>canonical</option>
                        {personasForCharacter.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name ?? p.label ?? `#${p.id}`}
                            </option>
                        ))}
                    </select>
                </label>

                <button type='button' className={styles.apply} onClick={apply} disabled={busy || !characterId}>
                    {busy ? '…' : 'apply'}
                </button>
            </div>

            {result !== null && <p className={styles.success}>✔ {result} message{result === 1 ? '' : 's'} updated</p>}
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </section>
    );
}
