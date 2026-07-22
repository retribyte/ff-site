'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MessageType } from '@/lib/types';
import { episodeSlug, seasonSlug } from '@/lib/seasons';
import { apiClient } from '@/lib/apiClient';
import ImportWorkbench, { type UploadContext } from './ImportWorkbench';
import MappingList from './MappingList';
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

export default function EpisodeImporter() {
    const [payload, setPayload] = useState<ImportPayload | null>(null);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [loadNonce, setLoadNonce] = useState(0);

    const [users, setUsers] = useState<Option[]>([]);
    const [characters, setCharacters] = useState<Option[]>([]);
    const [personas, setPersonas] = useState<PersonaOption[]>([]);
    const [seasonTitles, setSeasonTitles] = useState<Set<string> | null>(null);
    const [episodeExists, setEpisodeExists] = useState(false);

    // manual name → id picks; anything not overridden auto-matches by exact name
    const [playerOverrides, setPlayerOverrides] = useState<Record<string, string>>({});
    const [charOverrides, setCharOverrides] = useState<Record<string, string>>({});

    useEffect(() => {
        apiClient<{ id: number; username: string }[]>('/users')
            .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.username }))))
            .catch(() => setUsers([]));
        apiClient<{ id: number; name: string }[]>('/characters')
            .then((data) => setCharacters(data.map((c) => ({ id: c.id, name: c.name }))))
            .catch(() => setCharacters([]));
        apiClient<{ id: number; name: string | null; label: string | null; characterId: number }[]>('/personas')
            .then((data) =>
                setPersonas(data.map((p) => ({ id: p.id, name: p.name, label: p.label, characterId: p.characterId })))
            )
            .catch(() => setPersonas([]));
        apiClient<{ title: string }[]>('/seasons')
            .then((data) => setSeasonTitles(new Set(data.map((s) => s.title))))
            .catch(() => setSeasonTitles(new Set()));
    }, []);

    const loadText = (raw: string, name: string) => {
        // Remount the workbench (fresh idle phase) for each new file.
        setLoadNonce((n) => n + 1);
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
    const upload = async ({ onProgress, onCreated }: UploadContext) => {
        if (!payload) throw new Error('No file loaded.');
        const total = payload.messages.length;
        onProgress(0, total);

        if (seasonTitles && !seasonTitles.has(payload.seasonTitle)) {
            await apiClient('/seasons', { method: 'POST', body: { title: payload.seasonTitle } });
            setSeasonTitles(new Set([...seasonTitles, payload.seasonTitle]));
        }

        const createdEpisode = await apiClient<{ slug?: string }>('/episodes', {
            method: 'POST',
            body: {
                title: payload.episode.title,
                seasonTitle: payload.seasonTitle,
                episode_no: payload.episode.episode_no,
                summary: payload.episode.summary ?? undefined,
                playedDate: payload.episode.playedDate ?? undefined,
            },
        });
        onCreated();

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
            await apiClient(`/episodes/${encodeURIComponent(payload.episode.title)}/messages`, {
                method: 'POST',
                body: { messages: rows.slice(offset, offset + CHUNK_SIZE) },
            });
            onProgress(Math.min(offset + CHUNK_SIZE, total), total);
        }

        const href = `/archives/${seasonSlug(payload.seasonTitle)}/${episodeSlug({
            title: payload.episode.title,
            episode_no: payload.episode.episode_no,
            slug: createdEpisode?.slug,
        })}`;
        setEpisodeExists(true);
        return { count: total, href };
    };

    /** Roll back a partial import so the file can be re-uploaded cleanly. */
    const eject = async () => {
        if (!payload) return;
        await apiClient(`/episodes/${encodeURIComponent(payload.episode.title)}`, { method: 'DELETE' });
        setEpisodeExists(false);
    };

    return (
        <ImportWorkbench
            key={loadNonce}
            dropLabel='▲ select an episode .json'
            dropHint='from archive-to-markdown/api/…'
            fileName={fileName}
            parseError={parseError}
            onFile={onFile}
            ready={payload !== null}
            uploadLabel={`Upload ${payload?.messages.length ?? 0} messages`}
            uploadBlocked={unresolvedPlayers.length > 0}
            exists={episodeExists}
            existsMessage={
                <p className={styles.error}>
                    ✖ an episode titled &ldquo;{payload?.episode.title}&rdquo; already exists — eject it first or
                    retitle this one in the meta file.
                </p>
            }
            upload={upload}
            eject={eject}
            ejectLabel={`eject "${payload?.episode.title ?? ''}"`}
            successMessage={(count, href) => (
                <p className={styles.success}>
                    ✔ {count} messages archived — <Link href={href}>read the transcript →</Link>
                </p>
            )}
            partialHint='The episode was created but the transfer did not finish. Eject it before retrying, or messages will duplicate.'
        >
            {(busy) =>
                payload && (
                    <>
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

                        <MappingList
                            heading='players → users'
                            names={playerNames}
                            value={(name) => playerMap[name] ?? ''}
                            onChange={(name, v) => setPlayerOverrides((prev) => ({ ...prev, [name]: v }))}
                            options={[
                                { value: '', label: '— unresolved —' },
                                ...users.map((u) => ({ value: String(u.id), label: u.name })),
                            ]}
                            disabled={busy}
                            ariaLabel={(name) => `user for ${name}`}
                            note={
                                unresolvedPlayers.length > 0 ? (
                                    <p className={styles.error}>
                                        ✖ every player needs a user account: {unresolvedPlayers.join(', ')}
                                    </p>
                                ) : null
                            }
                        />

                        <MappingList
                            heading='characters'
                            names={characterNames}
                            value={(name) => charMap[name] ?? ''}
                            onChange={(name, v) => setCharOverrides((prev) => ({ ...prev, [name]: v }))}
                            options={[
                                { value: '', label: '(no character)' },
                                ...characters.map((c) => ({ value: `char:${c.id}`, label: c.name })),
                                ...personas.map((p) => ({
                                    value: `persona:${p.id}`,
                                    label: `${charNameById.get(p.characterId) ?? '?'} (as ${p.name ?? p.label})`,
                                })),
                            ]}
                            disabled={busy}
                            ariaLabel={(name) => `character for ${name}`}
                            note={
                                unmatchedCharacters.length > 0 ? (
                                    <p className={styles.hint}>
                                        unmatched characters stay unattributed; their quotes import as OTHER (
                                        {downgradedQuotes} affected). Create the character first if that matters.
                                    </p>
                                ) : null
                            }
                        />
                    </>
                )
            }
        </ImportWorkbench>
    );
}
