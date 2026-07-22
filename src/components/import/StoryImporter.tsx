'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/auth/SessionProvider';
import { apiClient } from '@/lib/apiClient';
import ImportWorkbench, { type UploadContext } from './ImportWorkbench';
import MappingList from './MappingList';
import styles from './episodeImporter.module.scss';

// Payload produced by archive-to-markdown/story-md-to-api.py: one story, its
// author username, and chapters of lines keyed by *names* (character/speaker
// names). The converter already derives each line's `text` (and, for segmented
// narration, its clean concatenation), so we only resolve names → ids here.

const LINE_TYPES = new Set(['NARRATION', 'DIALOGUE', 'ACTION', 'TRANSCRIPT', 'BREAK', 'HEADING']);
const CHUNK_SIZE = 500;

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
        format?: string;
    };
    author?: string | null;
    chapters: ImportChapter[];
}

interface Option {
    id: number;
    name: string;
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

export default function StoryImporter() {
    const { user } = useSession();

    const [payload, setPayload] = useState<ImportPayload | null>(null);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [loadNonce, setLoadNonce] = useState(0);

    const [users, setUsers] = useState<Option[]>([]);
    const [characters, setCharacters] = useState<{ id: number; names: string[] }[]>([]);
    const [storyExists, setStoryExists] = useState(false);

    // manual overrides; anything not overridden auto-matches by exact name
    const [authorOverride, setAuthorOverride] = useState('');
    const [charOverrides, setCharOverrides] = useState<Record<string, string>>({});

    useEffect(() => {
        apiClient<{ id: number; username: string }[]>('/users')
            .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.username }))))
            .catch(() => setUsers([]));
        // Characters, so dialogue speakers can be matched by exact name
        apiClient<{ id: number; name: string }[]>('/characters')
            .then((data) => setCharacters(data.map((c) => ({ id: c.id, names: [c.name] }))))
            .catch(() => setCharacters([]));
    }, []);

    const loadText = (raw: string, name: string) => {
        // Remount the workbench (fresh idle phase) for each new file.
        setLoadNonce((n) => n + 1);
        setStoryExists(false);
        setAuthorOverride('');
        setCharOverrides({});
        try {
            const parsed = parsePayload(raw);
            setPayload(parsed);
            setFileName(name);
            setParseError(null);
            // a slug is globally unique — POST /stories would reject a collision
            fetch(`/api/ff/stories/${encodeURIComponent(parsed.story.slug)}`)
                .then((res) => setStoryExists(res.ok))
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

    const defaultAuthorId = useMemo(() => {
        if (payload?.author) {
            const match = users.find((u) => u.name === payload.author);
            if (match) return String(match.id);
        }
        return user ? String(user.id) : '';
    }, [payload, users, user]);
    const authorId = authorOverride || defaultAuthorId;

    const lineTotal = useMemo(
        () => (payload ? payload.chapters.reduce((sum, c) => sum + c.lines.length, 0) : 0),
        [payload]
    );

    // ---- upload -----------------------------------------------------------
    const upload = async ({ onProgress, onCreated }: UploadContext) => {
        if (!payload) throw new Error('No file loaded.');
        const slug = payload.story.slug;
        onProgress(0, lineTotal);

        // Attach a resolved character id, or fall back to the raw display name.
        const resolveSpeaker = <T extends { characterId?: number; speaker?: string }>(entry: T, speaker: string) => {
            const id = charMap[speaker];
            if (id) entry.characterId = parseInt(id);
            else entry.speaker = speaker;
            return entry;
        };

        await apiClient('/stories', {
            method: 'POST',
            body: {
                slug,
                title: payload.story.title,
                blurb: payload.story.blurb ?? undefined,
                publishedDate: payload.story.publishedDate ?? undefined,
                themeColor: payload.story.themeColor ?? undefined,
                themeColor2: payload.story.themeColor2 ?? undefined,
                format: payload.story.format ?? undefined,
                authorId: authorId ? parseInt(authorId) : undefined,
            },
        });
        onCreated();

        let done = 0;
        for (const chapter of payload.chapters) {
            await apiClient(`/stories/${encodeURIComponent(slug)}/chapters`, {
                method: 'POST',
                body: { chapter_no: chapter.chapter_no, title: chapter.title ?? undefined },
            });

            const rows = chapter.lines.map((line) => {
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
            });

            for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
                await apiClient(`/stories/${encodeURIComponent(slug)}/chapters/${chapter.chapter_no}/lines`, {
                    method: 'POST',
                    body: { lines: rows.slice(offset, offset + CHUNK_SIZE) },
                });
                done += Math.min(CHUNK_SIZE, rows.length - offset);
                onProgress(done, lineTotal);
            }
        }

        setStoryExists(true);
        return { count: lineTotal, href: `/stories/${slug}` };
    };

    /** Roll back a partial import (story + chapters + lines) so it can re-upload cleanly. */
    const eject = async () => {
        if (!payload) return;
        await apiClient(`/stories/${encodeURIComponent(payload.story.slug)}`, { method: 'DELETE' });
        setStoryExists(false);
    };

    return (
        <ImportWorkbench
            key={loadNonce}
            dropLabel='▲ select a story .json'
            dropHint='from archive-to-markdown/api/stories/…'
            fileName={fileName}
            parseError={parseError}
            onFile={onFile}
            ready={payload !== null}
            uploadLabel={`Upload ${lineTotal} lines`}
            exists={storyExists}
            existsMessage={
                <p className={styles.error}>
                    ✖ a story with slug &ldquo;{payload?.story.slug}&rdquo; already exists — eject it first or reslug
                    this one in the manuscript frontmatter.
                </p>
            }
            upload={upload}
            eject={eject}
            ejectLabel={`eject "${payload?.story.title ?? ''}"`}
            successMessage={(_count, href) => (
                <p className={styles.success}>
                    ✔ story archived — <Link href={href}>read it →</Link>
                </p>
            )}
            partialHint='The story was created but the transfer did not finish. Eject it before retrying, or lines will duplicate.'
        >
            {(busy) =>
                payload && (
                    <>
                        <dl className={styles.facts}>
                            <div>
                                <dt>story</dt>
                                <dd>
                                    {payload.story.title}
                                    {storyExists && <span className={styles.badgeWarn}> already on the shelf</span>}
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

                        <MappingList
                            heading='author'
                            names={[payload.author || '(unspecified)']}
                            value={() => authorId}
                            onChange={(_name, v) => setAuthorOverride(v)}
                            options={[
                                { value: '', label: '(no author)' },
                                ...users.map((u) => ({ value: String(u.id), label: u.name })),
                            ]}
                            disabled={busy}
                            ariaLabel={() => 'author user'}
                        />

                        <MappingList
                            heading='speakers → characters'
                            names={speakerNames}
                            value={(name) => charMap[name] ?? ''}
                            onChange={(name, v) => setCharOverrides((prev) => ({ ...prev, [name]: v }))}
                            options={[
                                { value: '', label: '(keep as name)' },
                                ...characters.map((c) => ({ value: String(c.id), label: c.names[0] })),
                            ]}
                            disabled={busy}
                            ariaLabel={(name) => `character for ${name}`}
                            note={
                                unresolvedSpeakers.length > 0 ? (
                                    <p className={styles.hint}>
                                        unmatched speakers keep their display names (no character link):{' '}
                                        {unresolvedSpeakers.join(', ')}. Create the character first if that matters.
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
