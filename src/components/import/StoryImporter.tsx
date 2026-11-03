'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './episodeImporter.module.scss';

// Payload produced by archive-to-markdown/story-md-to-api.py: one story, its
// author username, and chapters of lines keyed by *names* (character/speaker
// names). The converter already derives each line's `text` (and, for segmented
// narration, its clean concatenation), so we only resolve names → ids here.

const LINE_TYPES = new Set(['NARRATION', 'DIALOGUE', 'ACTION', 'TRANSCRIPT', 'BREAK', 'HEADING']);

interface ImportSegment {
    text: string;
    speaker?: string;
    italic?: boolean;
    bold?: boolean;
}

interface ImportLine {
    type: string;
    text: string;
    speaker?: string;
    segments?: ImportSegment[];
}

interface ImportChapter {
    chapter_no: number;
    title?: string | null;
    lines: ImportLine[];
}

interface ImportPayload {
    story: {
        slug: string;
        title: string;
        blurb?: string;
        publishedDate?: string;
        themeColor?: string;
        themeColor2?: string;
        season?: string;
        format?: string;
    };
    authors?: string[];
    author?: string | null; // payloads converted before co-authorship
    chapters: ImportChapter[];
}

interface Option {
    id: number;
    name: string;
}

// The whole story goes up in one request that ff-server applies in one
// transaction (POST /stories/import), so there is no partial state to track
// or roll back: a failed upload wrote nothing and can simply be retried.
// `duplicate` = the server's 409 (slug/title taken, or identical text).
type Phase =
    | { step: 'idle' }
    | { step: 'uploading' }
    | { step: 'success'; count: number; href: string }
    | { step: 'failed'; message: string; duplicate: boolean };

interface ShelfStory {
    slug: string;
    title: string;
}

const SLUG_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

function parsePayload(raw: string): ImportPayload {
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error('That is not JSON.');
    }
    const payload = json as ImportPayload;
    if (typeof payload?.story?.slug !== 'string' || !SLUG_RE.test(payload.story.slug)) {
        throw new Error("Missing or invalid story.slug — is this a story-md-to-api.py output file?");
    }
    if (typeof payload.story.title !== 'string' || !payload.story.title) {
        throw new Error('Missing story.title.');
    }
    if (!Array.isArray(payload.chapters) || payload.chapters.length === 0) {
        throw new Error('No chapters in this file.');
    }
    payload.chapters.forEach((chapter, ci) => {
        if (typeof chapter.chapter_no !== 'number') {
            throw new Error(`Chapter ${ci + 1} has no chapter_no.`);
        }
        if (!Array.isArray(chapter.lines) || chapter.lines.length === 0) {
            throw new Error(`Chapter ${chapter.chapter_no} has no lines.`);
        }
        chapter.lines.forEach((line, li) => {
            if (!LINE_TYPES.has(line.type)) {
                throw new Error(`Chapter ${chapter.chapter_no}, line ${li + 1} has invalid type '${line.type}'.`);
            }
            if (typeof line.text !== 'string') {
                throw new Error(`Chapter ${chapter.chapter_no}, line ${li + 1} has no text.`);
            }
        });
    });
    return payload;
}

class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
    }
}

async function ff<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api/ff${path}`, init);
    const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || envelope?.status === 'error') {
        throw new ApiError(envelope?.message ?? `HTTP ${res.status} on ${path}`, res.status);
    }
    return envelope?.data as T;
}

export default function StoryImporter() {
    const { user } = useSession();

    const [payload, setPayload] = useState<ImportPayload | null>(null);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);

    const [users, setUsers] = useState<Option[]>([]);
    const [characters, setCharacters] = useState<{ id: number; names: string[] }[]>([]);
    // What's already on the shelf, fetched once: the slug/title collision
    // check below is derived from it rather than fetched per file (which
    // raced when a second file was picked before the first check returned).
    const [shelf, setShelf] = useState<ShelfStory[] | null>(null);

    // manual overrides; anything not overridden auto-matches by exact name
    const [authorOverrides, setAuthorOverrides] = useState<Record<string, string>>({});
    const [charOverrides, setCharOverrides] = useState<Record<string, string>>({});

    const [phase, setPhase] = useState<Phase>({ step: 'idle' });

    useEffect(() => {
        ff<{ id: number; username: string }[]>('/users')
            .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.username }))))
            .catch(() => setUsers([]));
        // Characters, so dialogue speakers can be matched by exact name
        ff<{ id: number; name: string }[]>('/characters')
            .then((data) => setCharacters(data.map((c) => ({ id: c.id, names: [c.name] }))))
            .catch(() => setCharacters([]));
        ff<ShelfStory[]>('/stories')
            .then((data) => setShelf(data.map((s) => ({ slug: s.slug, title: s.title }))))
            .catch(() => setShelf(null)); // unknown — the server's 409 still guards the upload
    }, []);

    const loadText = (raw: string, name: string) => {
        setPhase({ step: 'idle' });
        setAuthorOverrides({});
        setCharOverrides({});
        try {
            const parsed = parsePayload(raw);
            setPayload(parsed);
            setFileName(name);
            setParseError(null);
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
    // Every distinct speaker across dialogue lines and inline dialogue segments.
    const speakerNames = useMemo(() => {
        if (!payload) return [];
        const names = new Set<string>();
        for (const chapter of payload.chapters) {
            for (const line of chapter.lines) {
                if (line.speaker) names.add(line.speaker);
                for (const seg of line.segments ?? []) {
                    if (seg.speaker) names.add(seg.speaker);
                }
            }
        }
        return [...names].sort();
    }, [payload]);

    // name → character id (exact name first, then any alias)
    const charByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of characters) {
            for (const alias of c.names) {
                if (!map.has(alias)) map.set(alias, String(c.id));
            }
        }
        return map;
    }, [characters]);

    const charMap = useMemo(
        () =>
            Object.fromEntries(
                speakerNames.map((n) => [n, charOverrides[n] ?? charByName.get(n) ?? ''])
            ) as Record<string, string>,
        [speakerNames, charByName, charOverrides]
    );

    const unresolvedSpeakers = speakerNames.filter((n) => charMap[n] === '');

    // Frontmatter author names; none credits the uploader (the '' row)
    const authorNames = useMemo(() => {
        const names = payload?.authors ?? (payload?.author ? [payload.author] : []);
        return names.length > 0 ? names : [''];
    }, [payload]);
    const authorMap = useMemo(
        () =>
            Object.fromEntries(
                authorNames.map((n) => {
                    const match = n ? users.find((u) => u.name === n)?.id : user?.id;
                    return [n, authorOverrides[n] ?? (match !== undefined ? String(match) : '')];
                })
            ) as Record<string, string>,
        [authorNames, users, user, authorOverrides]
    );
    const authorIds = [...new Set(Object.values(authorMap).filter(Boolean))].map((id) => parseInt(id));

    const lineTotal = useMemo(
        () => (payload ? payload.chapters.reduce((sum, c) => sum + c.lines.length, 0) : 0),
        [payload]
    );

    // Slug and title are each unique on the shelf (title case-insensitively,
    // matching the server). Identical text under a new slug+title can only be
    // caught server-side (Story.contentHash) — that surfaces as a 409.
    const collision = useMemo(() => {
        if (!payload || !shelf) return null;
        const bySlug = shelf.find((s) => s.slug === payload.story.slug);
        if (bySlug) return { field: 'slug' as const, story: bySlug };
        const title = payload.story.title.toLowerCase();
        const byTitle = shelf.find((s) => s.title.toLowerCase() === title);
        return byTitle ? { field: 'title' as const, story: byTitle } : null;
    }, [payload, shelf]);

    // ---- upload -----------------------------------------------------------
    const upload = async () => {
        if (!payload) return;
        setPhase({ step: 'uploading' });

        // Attach a resolved character id, or fall back to the raw display name.
        const resolveSpeaker = <T extends { characterId?: number; speaker?: string }>(entry: T, speaker: string) => {
            const id = charMap[speaker];
            if (id) entry.characterId = parseInt(id);
            else entry.speaker = speaker;
            return entry;
        };

        const chapters = payload.chapters.map((chapter) => ({
            chapter_no: chapter.chapter_no,
            title: chapter.title ?? undefined,
            lines: chapter.lines.map((line) => {
                const out: {
                    type: string;
                    text: string;
                    characterId?: number;
                    speaker?: string;
                    segments?: (ImportSegment & { characterId?: number })[];
                } = { type: line.type, text: line.text };
                if (line.speaker) resolveSpeaker(out, line.speaker);
                if (line.segments) {
                    out.segments = line.segments.map((seg) => {
                        const resolved: ImportSegment & { characterId?: number } = { text: seg.text };
                        if (seg.speaker) resolveSpeaker(resolved, seg.speaker);
                        if (seg.italic) resolved.italic = true;
                        if (seg.bold) resolved.bold = true;
                        return resolved;
                    });
                }
                return out;
            }),
        }));

        try {
            const created = await ff<{ slug: string; title: string }>('/stories/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    story: {
                        slug: payload.story.slug,
                        title: payload.story.title,
                        blurb: payload.story.blurb ?? undefined,
                        publishedDate: payload.story.publishedDate ?? undefined,
                        themeColor: payload.story.themeColor ?? undefined,
                        themeColor2: payload.story.themeColor2 ?? undefined,
                        season: payload.story.season ?? undefined,
                        format: payload.story.format ?? undefined,
                        authorIds,
                    },
                    chapters,
                }),
            });
            setPhase({ step: 'success', count: lineTotal, href: `/stories/${created.slug}` });
            setShelf((prev) => (prev ? [...prev, { slug: created.slug, title: created.title }] : prev));
        } catch (error) {
            setPhase({
                step: 'failed',
                message: error instanceof Error ? error.message : 'The lore server is not answering.',
                duplicate: error instanceof ApiError && error.status === 409,
            });
        }
    };

    const busy = phase.step === 'uploading';
    const canUpload = payload !== null && !busy && phase.step !== 'success' && collision === null;

    return (
        <div className={styles.importer}>
            <label className={`pixel-panel ${styles.dropzone}`}>
                <input
                    type='file'
                    accept='.json,application/json'
                    onChange={(e) => onFile(e.target.files?.[0])}
                    disabled={busy}
                />
                <span className='pixel-label'>▲ select a story .json</span>
                <span className={styles.dropHint}>{fileName || 'from archive-to-markdown/api/stories/…'}</span>
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
                            <dt>story</dt>
                            <dd>
                                {payload.story.title}
                                {collision && phase.step !== 'success' && (
                                    <span className={styles.badgeWarn}> already on the shelf</span>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>slug</dt>
                            <dd>{payload.story.slug}</dd>
                        </div>
                        {payload.story.blurb && (
                            <div>
                                <dt>blurb</dt>
                                <dd>{payload.story.blurb}</dd>
                            </div>
                        )}
                        <div>
                            <dt>format</dt>
                            <dd>{payload.story.format === 'PROSE' ? 'prose (novel-style)' : 'script'}</dd>
                        </div>
                        {payload.story.publishedDate && (
                            <div>
                                <dt>published</dt>
                                <dd>{new Date(payload.story.publishedDate).toDateString()}</dd>
                            </div>
                        )}
                        <div>
                            <dt>content</dt>
                            <dd>
                                {payload.chapters.length} chapter{payload.chapters.length === 1 ? '' : 's'} ·{' '}
                                {lineTotal} line{lineTotal === 1 ? '' : 's'}
                            </dd>
                        </div>
                    </dl>

                    <h3 className='pixel-label'>{authorNames.length > 1 ? 'authors' : 'author'}</h3>
                    <ul className={styles.mappings}>
                        {authorNames.map((name) => (
                            <li key={name}>
                                <span className={styles.mapName}>{name || '(unspecified)'}</span>
                                <select
                                    value={authorMap[name]}
                                    onChange={(e) => setAuthorOverrides((prev) => ({ ...prev, [name]: e.target.value }))}
                                    disabled={busy}
                                    aria-label={`author user for ${name || 'unspecified'}`}
                                >
                                    <option value=''>(no author)</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </li>
                        ))}
                    </ul>

                    {speakerNames.length > 0 && (
                        <>
                            <h3 className='pixel-label'>speakers → characters</h3>
                            <ul className={styles.mappings}>
                                {speakerNames.map((name) => (
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
                                            <option value=''>(keep as name)</option>
                                            {characters.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.names[0]}
                                                </option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                            {unresolvedSpeakers.length > 0 && (
                                <p className={styles.hint}>
                                    unmatched speakers keep their display names (no character link):{' '}
                                    {unresolvedSpeakers.join(', ')}. Create the character first if that matters.
                                </p>
                            )}
                        </>
                    )}

                    <div className={styles.actions}>
                        <button type='button' className={styles.upload} onClick={upload} disabled={!canUpload}>
                            {phase.step === 'uploading' ? `transmitting ${lineTotal} lines…` : `Upload ${lineTotal} lines`}
                        </button>
                    </div>

                    {phase.step === 'success' && (
                        <p className={styles.success}>
                            ✔ story archived — <Link href={phase.href}>read it →</Link>
                        </p>
                    )}
                    {phase.step === 'failed' && (
                        <div className={styles.failure}>
                            <p className={styles.error} role='alert'>
                                ✖ {phase.message}
                            </p>
                            <p className={styles.hint}>
                                {phase.duplicate
                                    ? 'Nothing was imported. Delete the existing story from its page first, or give this one a new slug and title in the manuscript frontmatter.'
                                    : 'Nothing was imported — the upload is all-or-nothing, so it is safe to fix the file and try again.'}
                            </p>
                        </div>
                    )}
                    {collision && phase.step !== 'success' && (
                        <p className={styles.error}>
                            ✖ the {collision.field} is already taken by{' '}
                            <Link href={`/stories/${collision.story.slug}`}>&ldquo;{collision.story.title}&rdquo;</Link>{' '}
                            — delete it from its page first, or change the {collision.field} in the manuscript frontmatter.
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
