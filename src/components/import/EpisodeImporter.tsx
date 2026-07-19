'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MessageType } from '@/lib/types';
import { episodeSlug, seasonSlug } from '@/lib/seasons';
import styles from './episodeImporter.module.scss';

// Payload produced by archive-to-markdown/md-to-api.py: one episode plus its
// messages keyed by *names* (player usernames, character names). Names are
// resolved to database ids here, with manual mapping for anything unknown.

const MESSAGE_TYPES = new Set(['BOT_RESPONSE', 'COMMAND', 'QUOTE', 'ACTION', 'EMBED', 'OTHER']);
const CHUNK_SIZE = 500;

interface ImportMessage {
    player: string;
    character: string | null;
    timestamp: string | null;
    type: MessageType;
    text: string;
}

interface ImportPayload {
    seasonTitle: string;
    episode: {
        title: string;
        episode_no: number;
        summary: string | null;
        playedDate: string | null;
    };
    messages: ImportMessage[];
}

interface Option {
    id: number;
    name: string;
}

interface PersonaOption {
    id: number;
    name: string | null;
    label: string | null;
    characterId: number;
}

type Phase =
    | { step: 'idle' }
    | { step: 'uploading'; done: number; total: number }
    | { step: 'success'; count: number; href: string }
    | { step: 'failed'; message: string; episodeCreated: boolean };

function parsePayload(raw: string): ImportPayload {
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error('That is not JSON.');
    }
    const payload = json as ImportPayload;
    if (typeof payload?.seasonTitle !== 'string' || !payload.seasonTitle) {
        throw new Error('Missing seasonTitle — is this an md-to-api.py output file?');
    }
    if (typeof payload.episode?.title !== 'string' || !payload.episode.title) {
        throw new Error('Missing episode.title.');
    }
    if (typeof payload.episode.episode_no !== 'number') {
        throw new Error('Missing episode.episode_no.');
    }
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
        throw new Error('No messages in this file.');
    }
    payload.messages.forEach((msg, index) => {
        if (typeof msg.player !== 'string' || !msg.player) {
            throw new Error(`Message ${index + 1} has no player.`);
        }
        if (typeof msg.text !== 'string') {
            throw new Error(`Message ${index + 1} has no text.`);
        }
        if (!MESSAGE_TYPES.has(msg.type)) {
            throw new Error(`Message ${index + 1} has invalid type '${msg.type}'.`);
        }
    });
    return payload;
}

async function ff<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api/ff${path}`, init);
    const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || envelope?.status === 'error') {
        throw new Error(envelope?.message ?? `HTTP ${res.status} on ${path}`);
    }
    return envelope?.data as T;
}

export default function EpisodeImporter() {
    const [payload, setPayload] = useState<ImportPayload | null>(null);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);

    const [users, setUsers] = useState<Option[]>([]);
    const [characters, setCharacters] = useState<Option[]>([]);
    const [personas, setPersonas] = useState<PersonaOption[]>([]);
    const [seasonTitles, setSeasonTitles] = useState<Set<string> | null>(null);
    const [episodeExists, setEpisodeExists] = useState(false);

    // manual name → id picks; anything not overridden auto-matches by exact name
    const [playerOverrides, setPlayerOverrides] = useState<Record<string, string>>({});
    const [charOverrides, setCharOverrides] = useState<Record<string, string>>({});

    const [phase, setPhase] = useState<Phase>({ step: 'idle' });

    useEffect(() => {
        ff<{ id: number; username: string }[]>('/users')
            .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.username }))))
            .catch(() => setUsers([]));
        ff<{ id: number; name: string }[]>('/characters')
            .then((data) => setCharacters(data.map((c) => ({ id: c.id, name: c.name }))))
            .catch(() => setCharacters([]));
        ff<{ id: number; name: string | null; label: string | null; characterId: number }[]>('/personas')
            .then((data) =>
                setPersonas(data.map((p) => ({ id: p.id, name: p.name, label: p.label, characterId: p.characterId })))
            )
            .catch(() => setPersonas([]));
        ff<{ title: string }[]>('/seasons')
            .then((data) => setSeasonTitles(new Set(data.map((s) => s.title))))
            .catch(() => setSeasonTitles(new Set()));
    }, []);

    const loadText = (raw: string, name: string) => {
        setPhase({ step: 'idle' });
        setEpisodeExists(false);
        setPlayerOverrides({});
        setCharOverrides({});
        try {
            const parsed = parsePayload(raw);
            setPayload(parsed);
            setFileName(name);
            setParseError(null);
            // check for an episode title collision (titles are globally unique)
            fetch(`/api/ff/episodes/${encodeURIComponent(parsed.episode.title)}`)
                .then((res) => setEpisodeExists(res.ok))
                .catch(() => {});
        } catch (error) {
            setPayload(null);
            setFileName(name);
            setParseError(error instanceof Error ? error.message : 'Unreadable file.');
        }
    };

    const onFile = (file: File | undefined) => {
        if (!file) return;
        void file.text().then((raw) => loadText(raw, file.name));
    };

    // ---- name resolution --------------------------------------------------
    const playerNames = useMemo(
        () => (payload ? [...new Set(payload.messages.map((m) => m.player))].sort() : []),
        [payload]
    );
    const characterNames = useMemo(
        () =>
            payload
                ? [...new Set(payload.messages.flatMap((m) => (m.character ? [m.character] : [])))].sort()
                : [],
        [payload]
    );

    const playerMap = useMemo(() => {
        const byName = new Map(users.map((u) => [u.name, String(u.id)]));
        return Object.fromEntries(playerNames.map((n) => [n, playerOverrides[n] ?? byName.get(n) ?? '']));
    }, [playerNames, users, playerOverrides]);
    // charMap values are encoded so a persona-resolved speaker carries both
    // ids: 'char:<characterId>' for a direct character match,
    // 'persona:<personaId>' for a persona match (its characterId is looked
    // up from `personas` at upload time). A character-name match always
    // wins over a persona-name match. Name-less personas (look-only) have
    // nothing to match an import speaker string against, so they're
    // excluded from the match map (they still show up in the dropdown).
    const charNameById = useMemo(() => new Map(characters.map((c) => [c.id, c.name])), [characters]);
    const charMap = useMemo(() => {
        const byCharName = new Map(characters.map((c) => [c.name, `char:${c.id}`]));
        const byPersonaName = new Map(
            personas
                .filter((p): p is PersonaOption & { name: string } => p.name !== null)
                .map((p) => [p.name, `persona:${p.id}`])
        );
        return Object.fromEntries(
            characterNames.map((n) => [n, charOverrides[n] ?? byCharName.get(n) ?? byPersonaName.get(n) ?? ''])
        );
    }, [characterNames, characters, personas, charOverrides]);

    const unresolvedPlayers = playerNames.filter((n) => playerMap[n] === '');
    const unmatchedCharacters = characterNames.filter((n) => charMap[n] === '');
    const downgradedQuotes = payload
        ? payload.messages.filter((m) => m.type === 'QUOTE' && (!m.character || charMap[m.character] === '')).length
        : 0;

    const typeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const msg of payload?.messages ?? []) {
            counts.set(msg.type, (counts.get(msg.type) ?? 0) + 1);
        }
        return [...counts.entries()].sort();
    }, [payload]);

    // ---- upload -----------------------------------------------------------
    const upload = async () => {
        if (!payload) return;
        const total = payload.messages.length;
        setPhase({ step: 'uploading', done: 0, total });
        let episodeCreated = false;
        try {
            if (seasonTitles && !seasonTitles.has(payload.seasonTitle)) {
                await ff('/seasons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: payload.seasonTitle }),
                });
                setSeasonTitles(new Set([...seasonTitles, payload.seasonTitle]));
            }

            const createdEpisode = await ff<{ slug?: string }>('/episodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: payload.episode.title,
                    seasonTitle: payload.seasonTitle,
                    episode_no: payload.episode.episode_no,
                    summary: payload.episode.summary ?? undefined,
                    playedDate: payload.episode.playedDate ?? undefined,
                }),
            });
            episodeCreated = true;

            const rows = payload.messages.map((msg) => {
                const resolved = msg.character ? charMap[msg.character] : '';
                let characterId: number | null = null;
                let personaId: number | null = null;
                if (resolved.startsWith('char:')) {
                    characterId = parseInt(resolved.slice('char:'.length));
                } else if (resolved.startsWith('persona:')) {
                    personaId = parseInt(resolved.slice('persona:'.length));
                    characterId = personas.find((p) => p.id === personaId)?.characterId ?? null;
                }
                return {
                    playerId: parseInt(playerMap[msg.player]),
                    characterId,
                    personaId,
                    timestamp: msg.timestamp,
                    // FR-MSG-4: a quote with no resolvable speaker becomes OTHER
                    // (a persona-resolved quote IS attributed — characterId is set)
                    type: msg.type === 'QUOTE' && characterId === null ? 'OTHER' : msg.type,
                    text: msg.text,
                };
            });
            for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
                await ff(`/episodes/${encodeURIComponent(payload.episode.title)}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: rows.slice(offset, offset + CHUNK_SIZE) }),
                });
                setPhase({ step: 'uploading', done: Math.min(offset + CHUNK_SIZE, total), total });
            }

            const href = `/archives/${seasonSlug(payload.seasonTitle)}/${episodeSlug({
                title: payload.episode.title,
                episode_no: payload.episode.episode_no,
                slug: createdEpisode?.slug,
            })}`;
            setPhase({ step: 'success', count: total, href });
            setEpisodeExists(true);
        } catch (error) {
            setPhase({
                step: 'failed',
                message: error instanceof Error ? error.message : 'The lore server is not answering.',
                episodeCreated,
            });
        }
    };

    /** Roll back a partial import so the file can be re-uploaded cleanly. */
    const eject = async () => {
        if (!payload) return;
        try {
            await ff(`/episodes/${encodeURIComponent(payload.episode.title)}`, { method: 'DELETE' });
            setPhase({ step: 'idle' });
            setEpisodeExists(false);
        } catch (error) {
            setPhase({
                step: 'failed',
                message: `Rollback failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                episodeCreated: true,
            });
        }
    };

    const busy = phase.step === 'uploading';
    const canUpload =
        payload !== null && !busy && phase.step !== 'success' && unresolvedPlayers.length === 0 && !episodeExists;

    return (
        <div className={styles.importer}>
            <label className={`pixel-panel ${styles.dropzone}`}>
                <input
                    type='file'
                    accept='.json,application/json'
                    onChange={(e) => onFile(e.target.files?.[0])}
                    disabled={busy}
                />
                <span className='pixel-label'>▲ select an episode .json</span>
                <span className={styles.dropHint}>{fileName || 'from archive-to-markdown/api/…'}</span>
            </label>

            {parseError && (
                <p className={styles.error} role='alert'>
                    ✖ {parseError}
                </p>
            )}

            {payload && (
                <section className={`pixel-panel ${styles.preview}`}>
                    <h2 className='pixel-label'>manifest</h2>
                    <dl className={styles.facts}>
                        <div>
                            <dt>season</dt>
                            <dd>
                                {payload.seasonTitle}
                                {seasonTitles && !seasonTitles.has(payload.seasonTitle) && (
                                    <span className={styles.badge}> new — will be created</span>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>episode</dt>
                            <dd>
                                #{payload.episode.episode_no} · {payload.episode.title}
                                {episodeExists && <span className={styles.badgeWarn}> already in the archive</span>}
                            </dd>
                        </div>
                        {payload.episode.summary && (
                            <div>
                                <dt>summary</dt>
                                <dd>{payload.episode.summary}</dd>
                            </div>
                        )}
                        {payload.episode.playedDate && (
                            <div>
                                <dt>played</dt>
                                <dd>{new Date(payload.episode.playedDate).toDateString()}</dd>
                            </div>
                        )}
                        <div>
                            <dt>messages</dt>
                            <dd>
                                {payload.messages.length} —{' '}
                                {typeCounts.map(([type, count]) => `${count} ${type}`).join(', ')}
                            </dd>
                        </div>
                    </dl>

                    <h3 className='pixel-label'>players → users</h3>
                    <ul className={styles.mappings}>
                        {playerNames.map((name) => (
                            <li key={name}>
                                <span className={styles.mapName}>{name}</span>
                                <select
                                    value={playerMap[name] ?? ''}
                                    onChange={(e) =>
                                        setPlayerOverrides((prev) => ({ ...prev, [name]: e.target.value }))
                                    }
                                    disabled={busy}
                                    aria-label={`user for ${name}`}
                                >
                                    <option value=''>— unresolved —</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </li>
                        ))}
                    </ul>
                    {unresolvedPlayers.length > 0 && (
                        <p className={styles.error}>
                            ✖ every player needs a user account: {unresolvedPlayers.join(', ')}
                        </p>
                    )}

                    {characterNames.length > 0 && (
                        <>
                            <h3 className='pixel-label'>characters</h3>
                            <ul className={styles.mappings}>
                                {characterNames.map((name) => (
                                    <li key={name}>
                                        <span className={styles.mapName}>{name}</span>
                                        <select
                                            value={charMap[name] ?? ''}
                                            onChange={(e) =>
                                                setCharOverrides((prev) => ({ ...prev, [name]: e.target.value }))
                                            }
                                            disabled={busy}
                                            aria-label={`character for ${name}`}
                                        >
                                            <option value=''>(no character)</option>
                                            {characters.map((c) => (
                                                <option key={`char:${c.id}`} value={`char:${c.id}`}>
                                                    {c.name}
                                                </option>
                                            ))}
                                            {personas.map((p) => (
                                                <option key={`persona:${p.id}`} value={`persona:${p.id}`}>
                                                    {charNameById.get(p.characterId) ?? '?'} (as {p.name ?? p.label})
                                                </option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                            {unmatchedCharacters.length > 0 && (
                                <p className={styles.hint}>
                                    unmatched characters stay unattributed; their quotes import as OTHER (
                                    {downgradedQuotes} affected). Create the character first if that matters.
                                </p>
                            )}
                        </>
                    )}

                    <div className={styles.actions}>
                        <button type='button' className={styles.upload} onClick={upload} disabled={!canUpload}>
                            {phase.step === 'uploading'
                                ? `transmitting ${phase.done}/${phase.total}…`
                                : `Upload ${payload.messages.length} messages`}
                        </button>
                        {phase.step === 'uploading' && (
                            <progress value={phase.done} max={phase.total} className={styles.progress} />
                        )}
                    </div>

                    {phase.step === 'success' && (
                        <p className={styles.success}>
                            ✔ {phase.count} messages archived — <Link href={phase.href}>read the transcript →</Link>
                        </p>
                    )}
                    {phase.step === 'failed' && (
                        <div className={styles.failure}>
                            <p className={styles.error} role='alert'>
                                ✖ {phase.message}
                            </p>
                            {phase.episodeCreated && (
                                <p className={styles.hint}>
                                    The episode was created but the transfer did not finish. Eject it before retrying,
                                    or messages will duplicate.{' '}
                                    <button type='button' className={styles.eject} onClick={eject}>
                                        eject &ldquo;{payload.episode.title}&rdquo;
                                    </button>
                                </p>
                            )}
                        </div>
                    )}
                    {episodeExists && phase.step !== 'success' && (
                        <p className={styles.error}>
                            ✖ an episode titled &ldquo;{payload.episode.title}&rdquo; already exists — eject it first
                            or retitle this one in the meta file.
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
