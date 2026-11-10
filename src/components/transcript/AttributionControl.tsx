'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Character, Persona } from '@/lib/types';
import styles from './transcript.module.scss';

interface Envelope<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

interface Props {
    episodeTitle: string;
    /** The block's character, or null for an NPC / player line. */
    characterId: number | null;
    /** Display name of that character, for the option group label. */
    characterName: string | null;
    /** The block's first messageNo — what "this line" targets. */
    anchorNo: number;
    /** Every messageNo in the block — what "whole transmission" targets. */
    blockNos: number[];
    /** The block's current personaId (null = canonical), to preselect. */
    currentPersonaId: number | null;
}

// Choice encoding for the one "voice" select:
//   'c:'      this character, canonical      'c:<id>' this character as persona <id>
//   'n:<id>'  NPC voice <id>                 'other'  another character (+ its persona)
//   'new'     a new NPC voice, by name
type Choice = string;

async function getJson<T>(url: string): Promise<T> {
    const envelope = (await fetch(url).then((res) => res.json())) as Envelope<T>;
    if (envelope.status === 'error') throw new Error(envelope.message ?? 'Request failed');
    return envelope.data as T;
}

function initialChoice(characterId: number | null, currentPersonaId: number | null): Choice {
    if (characterId !== null) return currentPersonaId !== null ? `c:${currentPersonaId}` : 'c:';
    return currentPersonaId !== null ? `n:${currentPersonaId}` : 'new';
}

// Admin-only per-line attribution (FR-EP-2: changing attribution is an admin
// right). Switches a line or a whole grouped block between the character's
// personas, an NPC voice (a persona with no character), or another character
// entirely. Lives next to the copy-anchor button in a block's action tray,
// same floating-panel pattern as CommentaryThread.
export default function AttributionControl({ episodeTitle, characterId, characterName, anchorNo, blockNos, currentPersonaId }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [ownPersonas, setOwnPersonas] = useState<Persona[] | null>(characterId === null ? [] : null);
    const [npcs, setNpcs] = useState<Persona[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [choice, setChoice] = useState<Choice>(initialChoice(characterId, currentPersonaId));
    const [newNpcName, setNewNpcName] = useState('');
    const [characters, setCharacters] = useState<Character[] | null>(null);
    const [otherName, setOtherName] = useState('');
    const [otherPersonas, setOtherPersonas] = useState<Persona[] | null>(null);
    const [otherPersonaId, setOtherPersonaId] = useState('');
    const [target, setTarget] = useState<'line' | 'block'>('block');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const otherCharacter = characters?.find((c) => c.name.toLowerCase() === otherName.trim().toLowerCase()) ?? null;

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (!next) return;
        setChoice(initialChoice(characterId, currentPersonaId));
        setTarget('block');
        setError(null);
        // a failed earlier load is retried below — clear it, or its error
        // branch would keep hiding the form even after the retry succeeds
        setLoadError(null);
        const loads: Promise<void>[] = [];
        if (ownPersonas === null && characterId !== null) {
            loads.push(getJson<Persona[]>(`/site/ff/characters/${characterId}/personas`).then(setOwnPersonas));
        }
        if (npcs === null) {
            loads.push(getJson<Persona[]>('/site/ff/personas?npc=true').then(setNpcs));
        }
        Promise.all(loads).catch((err) => setLoadError(err instanceof Error ? err.message : 'The lore server is not answering'));
    };

    const chooseOther = (value: Choice) => {
        setChoice(value);
        if (value === 'other' && characters === null) {
            getJson<Character[]>('/site/ff/characters')
                .then((list) => setCharacters([...list].sort((a, b) => a.name.localeCompare(b.name))))
                .catch(() => setError('Could not load characters'));
        }
    };

    const pickOtherCharacter = (name: string) => {
        setOtherName(name);
        setOtherPersonaId('');
        setOtherPersonas(null);
        const match = characters?.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
        if (match) {
            getJson<Persona[]>(`/site/ff/characters/${match.id}/personas`)
                .then(setOtherPersonas)
                .catch(() => setOtherPersonas([]));
        }
    };

    /** The new voice, as POST /admin/messages/reassign takes it (a new NPC voice is created there, in the same transaction). */
    const resolveAttribution = (): { characterId: number | null; personaId: number | null; newNpcName?: string } => {
        if (choice.startsWith('c:')) {
            const id = choice.slice(2);
            return { characterId, personaId: id === '' ? null : Number(id) };
        }
        if (choice.startsWith('n:')) return { characterId: null, personaId: Number(choice.slice(2)) };
        if (choice === 'other') {
            if (!otherCharacter) throw new Error(`No character named '${otherName}'`);
            return { characterId: otherCharacter.id, personaId: otherPersonaId === '' ? null : Number(otherPersonaId) };
        }
        const name = newNpcName.trim();
        if (!name) throw new Error('Name the new NPC voice');
        return { characterId: null, personaId: null, newNpcName: name };
    };

    // One request for the whole block: all lines change together or none do,
    // and the change is a row in the admin History (job "message-reassign")
    const apply = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/site/ff/admin/messages/reassign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    episodeTitle,
                    messageNos: target === 'block' ? blockNos : [anchorNo],
                    ...resolveAttribution(),
                }),
            });
            const envelope = (await res.json().catch(() => null)) as Envelope<unknown> | null;
            if (!res.ok || envelope?.status === 'error') {
                throw new Error(envelope?.message ?? `HTTP ${res.status}`);
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

    const loading = ownPersonas === null || npcs === null;
    const canApply =
        !busy && !loading &&
        (choice !== 'other' || otherCharacter !== null) &&
        (choice !== 'new' || newNpcName.trim() !== '');

    return (
        <div className={styles.attribution}>
            <button
                type='button'
                className={styles.attributionTrigger}
                onClick={toggle}
                aria-expanded={open}
                aria-label='Edit attribution'
                title='Edit attribution'
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
                                <span>voice</span>
                                <select
                                    value={choice}
                                    onChange={(e) => chooseOther(e.target.value)}
                                    disabled={busy || loading}
                                    aria-label='who speaks this line'
                                >
                                    {characterId !== null && (
                                        <optgroup label={characterName ?? 'this character'}>
                                            <option value='c:'>canonical</option>
                                            {(ownPersonas ?? []).map((p) => (
                                                <option key={p.id} value={`c:${p.id}`}>
                                                    as {p.name ?? p.label ?? `#${p.id}`}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label='NPC voices'>
                                        {(npcs ?? []).map((p) => (
                                            <option key={p.id} value={`n:${p.id}`}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label='elsewhere'>
                                        <option value='other'>another character…</option>
                                        <option value='new'>new NPC voice…</option>
                                    </optgroup>
                                </select>
                            </label>

                            {choice === 'other' && (
                                <>
                                    <label className={styles.attributionField}>
                                        <span>character</span>
                                        <input
                                            list={`attr-chars-${anchorNo}`}
                                            value={otherName}
                                            onChange={(e) => pickOtherCharacter(e.target.value)}
                                            disabled={busy || characters === null}
                                            placeholder={characters === null ? 'loading…' : 'name'}
                                        />
                                        <datalist id={`attr-chars-${anchorNo}`}>
                                            {(characters ?? []).map((c) => (
                                                <option key={c.id} value={c.name} />
                                            ))}
                                        </datalist>
                                    </label>
                                    {otherCharacter && (
                                        <label className={styles.attributionField}>
                                            <span>as</span>
                                            <select
                                                value={otherPersonaId}
                                                onChange={(e) => setOtherPersonaId(e.target.value)}
                                                disabled={busy || otherPersonas === null}
                                            >
                                                <option value=''>canonical</option>
                                                {(otherPersonas ?? []).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name ?? p.label ?? `#${p.id}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                </>
                            )}

                            {choice === 'new' && (
                                <label className={styles.attributionField}>
                                    <span>NPC name</span>
                                    <input
                                        value={newNpcName}
                                        onChange={(e) => setNewNpcName(e.target.value)}
                                        disabled={busy}
                                        placeholder='e.g. Llamanian Guard'
                                    />
                                </label>
                            )}

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
                                <button type='button' onClick={apply} disabled={!canApply}>
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
