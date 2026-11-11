'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/auth/SessionProvider';
import DeleteControl from '@/components/DeleteControl';
import DocxStoryForm, { type DocxPicture, type ImportMeta } from './DocxStoryForm';
import { BOORU_URL } from '@/lib/booru';
import { imageSrc } from '@/lib/images';
import NpcVoiceNamer, { npcFragments, type AssignedVoice } from './NpcVoiceNamer';
import StoryPreview, { type PreviewChapter, type PreviewLine } from './StoryPreview';
import type { PersonaInfo } from '@/lib/stories';
import type { SpeakerInfo } from '@/lib/transcript';
import type { Persona } from '@/lib/types';
import { voiceOptions } from '@/lib/voiceOptions';
import styles from './storyImporter.module.scss';

// Payload produced by ff-server's POST /stories/convert (a Google Doc, via
// DocxStoryForm) or by archive-to-markdown/story-md-to-api.py (the CLI
// pipeline's .json): one story, its author usernames, and chapters of lines
// keyed by *names* (character/speaker names). The converter already derives
// each line's `text` (and, for segmented narration, its clean concatenation),
// so we only resolve names → ids here.

const LINE_TYPES = new Set(['NARRATION', 'DIALOGUE', 'ACTION', 'TRANSCRIPT', 'BREAK', 'HEADING', 'IMAGE']);

// `npc` / `npcVoice`: an NPC voice ([…]{?} in a manuscript, the doc's gray),
// to be named in the NPC namer before upload: a name (an NPC persona, found or
// created on upload), or `voice`, a character (as a persona or not) picked
// there with "@". A named speaker elsewhere maps to a character on the
// speakers list, or uploads as an NPC of that name.
interface ImportSegment {
    text: string;
    speaker?: string;
    npc?: boolean;
    voice?: AssignedVoice;
    italic?: boolean;
    bold?: boolean;
}

interface ImportLine {
    type: string;
    text: string;
    speaker?: string;
    npcVoice?: boolean;
    voice?: AssignedVoice;
    segments?: ImportSegment[];
    booruId?: number; // IMAGE: a manuscript's ![alt](booru:N)
    docxPicture?: number; // IMAGE: picture n of the converted doc, until it's given a booru post
}

// A booru post number typed for a picture, as the booru answered for it
type PostCheck =
    | { state: 'checking' }
    | { state: 'ok'; imageUrl: string; previewUrl: string | null }
    | { state: 'missing'; message: string }
    | { state: 'unavailable'; message: string };

const POST_ID = /^\d{1,9}$/;

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
        canon?: boolean;
    };
    authors?: string[];
    author?: string | null; // payloads converted before co-authorship
    chapters: ImportChapter[];
}

interface Option {
    id: number;
    name: string;
}

interface CharacterOption {
    id: number;
    names: string[];
    color: string | null;
    image: string | null;
}

// The whole story goes up in one request that ff-server applies in one
// transaction (POST /stories/import), so there is no partial state to track
// or roll back: a failed upload wrote nothing and can simply be retried.
// `duplicate` = the server's 409 (slug/title taken, or identical text).
type Phase =
    | { step: 'idle' }
    | { step: 'uploading' }
    | { step: 'success'; count: number; href: string; replaced: boolean }
    | { step: 'failed'; message: string; duplicate: boolean };

// Where the payload came from, for wording the "change the slug" advice.
type Origin = 'docx' | 'json';

interface ShelfStory {
    slug: string;
    title: string;
    authorIds: number[];
}

const SLUG_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

function parsePayload(raw: string): ImportPayload {
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error('That is not JSON.');
    }
    return validatePayload(json);
}

function validatePayload(json: unknown): ImportPayload {
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
    const res = await fetch(`/site/ff${path}`, init);
    const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || envelope?.status === 'error') {
        throw new ApiError(envelope?.message ?? `HTTP ${res.status} on ${path}`, res.status);
    }
    return envelope?.data as T;
}

export default function StoryImporter() {
    const { user } = useSession();

    const [payload, setPayload] = useState<ImportPayload | null>(null);
    const [origin, setOrigin] = useState<Origin>('docx');
    // A Google Doc's color map, saved on the story (Story.importMeta); none for a .json
    const [importMeta, setImportMeta] = useState<ImportMeta | undefined>(undefined);
    // The converted doc's pictures, and the booru post typed for each (by picture n)
    const [docxPictures, setDocxPictures] = useState<DocxPicture[]>([]);
    const [pictureIds, setPictureIds] = useState<Record<number, string>>({});
    const [posts, setPosts] = useState<Record<number, PostCheck>>({});
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);

    const [users, setUsers] = useState<Option[]>([]);
    const [characters, setCharacters] = useState<CharacterOption[]>([]);
    // What's already on the shelf, fetched once: the slug/title collision
    // check below is derived from it rather than fetched per file (which
    // raced when a second file was picked before the first check returned).
    const [shelf, setShelf] = useState<ShelfStory[] | null>(null);

    // manual overrides; anything not overridden auto-matches by exact name
    const [authorOverrides, setAuthorOverrides] = useState<Record<string, string>>({});
    const [charOverrides, setCharOverrides] = useState<Record<string, string>>({});

    const [phase, setPhase] = useState<Phase>({ step: 'idle' });
    const [naming, setNaming] = useState(false);
    // Every persona: characters' (a speaker can map to "Vec as Sascha") and NPCs' (name suggestions)
    const [personas, setPersonas] = useState<Persona[]>([]);
    // NPC quotes a revision pre-filled from the story's current voices
    const [carried, setCarried] = useState<number | null>(null);
    const carriedPayload = useRef<ImportPayload | null>(null);

    useEffect(() => {
        ff<{ id: number; username: string }[]>('/users')
            .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.username }))))
            .catch(() => setUsers([]));
        // Characters, so dialogue speakers can be matched by exact name
        ff<{ id: number; name: string; color?: string | null; image?: string | null }[]>('/characters')
            .then((data) =>
                setCharacters(
                    data.map((c) => ({ id: c.id, names: [c.name], color: c.color ?? null, image: c.image ?? null }))
                )
            )
            .catch(() => setCharacters([]));
        ff<Persona[]>('/personas')
            .then(setPersonas)
            .catch(() => setPersonas([]));
        ff<{ slug: string; title: string; authors?: { id: number }[] }[]>('/stories')
            .then((data) =>
                setShelf(
                    data.map((s) => ({ slug: s.slug, title: s.title, authorIds: (s.authors ?? []).map((a) => a.id) }))
                )
            )
            .catch(() => setShelf(null)); // unknown — the server's 409 still guards the upload
    }, []);

    // Both paths land here: a converted Google Doc, or a CLI .json file.
    const loadPayload = (
        read: () => ImportPayload,
        name: string,
        from: Origin,
        meta?: ImportMeta,
        pictures: DocxPicture[] = []
    ) => {
        setPhase({ step: 'idle' });
        setImportMeta(meta);
        setDocxPictures(pictures);
        setPictureIds({});
        setAuthorOverrides({});
        setCharOverrides({});
        setCarried(null);
        setOrigin(from);
        setFileName(name);
        try {
            setPayload(read());
            setParseError(null);
        } catch (error) {
            setPayload(null);
            setParseError(error instanceof Error ? error.message : 'Unreadable file.');
        }
    };

    const onJsonFile = (file: File | undefined) => {
        if (!file) return;
        void file.text().then((raw) => loadPayload(() => parsePayload(raw), file.name, 'json'));
    };

    // ---- pictures ---------------------------------------------------------
    // Booru post per doc picture (blank = leave it out), and every post the
    // story will point at: those, plus a CLI manuscript's ![alt](booru:N)
    const docxPostIds = useMemo(() => {
        const ids: Record<number, number> = {};
        for (const [n, raw] of Object.entries(pictureIds)) {
            if (POST_ID.test(raw.trim())) ids[Number(n)] = parseInt(raw.trim(), 10);
        }
        return ids;
    }, [pictureIds]);
    const wantedPosts = useMemo(() => {
        const ids = new Set(Object.values(docxPostIds));
        for (const chapter of payload?.chapters ?? []) {
            for (const line of chapter.lines) if (line.type === 'IMAGE' && line.booruId) ids.add(line.booruId);
        }
        return [...ids].sort((a, b) => a - b);
    }, [docxPostIds, payload]);

    // Look each post up once (debounced while typing), via the avatar picker's endpoint
    useEffect(() => {
        const unchecked = wantedPosts.filter((id) => !posts[id]);
        if (unchecked.length === 0) return;
        const timer = setTimeout(() => {
            setPosts((prev) => ({ ...prev, ...Object.fromEntries(unchecked.map((id) => [id, { state: 'checking' }])) }));
            for (const id of unchecked) {
                ff<{ imageUrl: string; previewUrl: string | null }>(`/booru/${id}`)
                    .then((post) =>
                        setPosts((prev) => ({
                            ...prev,
                            [id]: { state: 'ok', imageUrl: post.imageUrl, previewUrl: post.previewUrl },
                        }))
                    )
                    .catch((error: unknown) => {
                        const message = error instanceof Error ? error.message : 'lookup failed';
                        const unavailable = error instanceof ApiError && error.status === 502;
                        setPosts((prev) => ({
                            ...prev,
                            [id]: unavailable ? { state: 'unavailable', message } : { state: 'missing', message },
                        }));
                    });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [wantedPosts, posts]);

    const badPosts = wantedPosts.filter((id) => posts[id]?.state === 'missing');
    const checkingPosts = wantedPosts.filter((id) => !posts[id] || posts[id].state === 'checking');
    const badPictureInputs = Object.values(pictureIds).filter((raw) => raw.trim() && !POST_ID.test(raw.trim()));

    // What the preview shows for each post: the doc's own picture when it came
    // from the doc, else the booru's file
    const previewImages = useMemo(() => {
        const images: Record<number, string> = {};
        for (const [id, post] of Object.entries(posts)) {
            if (post.state === 'ok') images[Number(id)] = post.imageUrl;
        }
        for (const picture of docxPictures) {
            const id = docxPostIds[picture.n];
            if (id !== undefined && picture.data && picture.contentType) {
                images[id] = `data:${picture.contentType};base64,${picture.data}`;
            }
        }
        return images;
    }, [posts, docxPictures, docxPostIds]);

    // ---- name resolution --------------------------------------------------
    // Every distinct speaker across dialogue lines and inline dialogue segments.
    const speakerNames = useMemo(() => {
        if (!payload) return [];
        const names = new Set<string>();
        for (const chapter of payload.chapters) {
            for (const line of chapter.lines) {
                if (line.speaker && !line.npcVoice) names.add(line.speaker);
                for (const seg of line.segments ?? []) {
                    if (seg.speaker && !seg.npc) names.add(seg.speaker);
                }
            }
        }
        return [...names].sort();
    }, [payload]);

    // The voices a speaker can map to: a character ("c:<id>"), or a character
    // as one of its personas ("p:<personaId>"); '' leaves it an NPC by name
    const options = useMemo(
        () => voiceOptions(characters.map((c) => ({ id: c.id, name: c.names[0] })), personas),
        [characters, personas]
    );
    const optionValue = (o: { characterId: number; personaId: number | null }) =>
        o.personaId !== null ? `p:${o.personaId}` : `c:${o.characterId}`;

    // name → voice: a character's exact name first, then a character persona's
    const charByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of characters) {
            for (const alias of c.names) {
                if (!map.has(alias)) map.set(alias, `c:${c.id}`);
            }
        }
        for (const p of personas) {
            if (p.characterId !== null && p.name && !map.has(p.name)) map.set(p.name, `p:${p.id}`);
        }
        return map;
    }, [characters, personas]);

    const charMap = useMemo(
        () =>
            Object.fromEntries(
                speakerNames.map((n) => [n, charOverrides[n] ?? charByName.get(n) ?? ''])
            ) as Record<string, string>,
        [speakerNames, charByName, charOverrides]
    );

    const unresolvedSpeakers = speakerNames.filter((n) => charMap[n] === '');

    const npcQuotes = useMemo(() => (payload ? npcFragments(payload.chapters) : []), [payload]);
    const npcNamed = npcQuotes.filter((f) => f.name.trim()).length;
    const npcUnnamed = npcQuotes.length - npcNamed;
    // NPC personas already in the archive, to suggest in the namer
    const npcNames = useMemo(
        () => personas.filter((p) => p.characterId === null && p.name).map((p) => p.name as string),
        [personas]
    );

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
    const pickedAuthorIds = [...new Set(Object.values(authorMap).filter(Boolean))].map((id) => parseInt(id));
    // A member is always one of the authors of what they import (the server
    // adds them too); an admin can import on someone else's behalf.
    const isAdmin = user?.role === 'ADMIN';
    const selfAdded = !!user && !isAdmin && !pickedAuthorIds.includes(user.id);
    const authorIds = selfAdded && user ? [...pickedAuthorIds, user.id] : pickedAuthorIds;

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
    // Replacing a story's text is for its authors and admins
    const canReplace =
        collision?.field === 'slug' && !!user && (isAdmin || collision.story.authorIds.includes(user.id));

    // A revision: pre-fill its unnamed NPC quotes with the voices the same text
    // has in the story now (ff-server matches them by occurrence), once per
    // loaded draft. Names already typed here are kept.
    const replaceSlug = canReplace ? collision.story.slug : null;
    useEffect(() => {
        if (!payload || !replaceSlug || options.length === 0 || carriedPayload.current === payload) return;
        carriedPayload.current = payload;
        const draft = payload;
        ff<{ chapters: ImportChapter[]; filled: number }>(`/stories/${encodeURIComponent(replaceSlug)}/voices/carry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapters: draft.chapters }),
        })
            .then((result) => {
                const byNo = new Map(result.chapters.map((c) => [c.chapter_no, c]));
                const labelFor = (characterId: number, personaId: number | null | undefined) =>
                    options.find((o) => o.characterId === characterId && o.personaId === (personaId ?? null))?.label;
                const next: ImportPayload = structuredClone(draft);
                let filled = 0;
                // copy a carried voice onto a quote that's still unnamed here
                const fill = (
                    target: { speaker?: string; voice?: AssignedVoice },
                    from: { speaker?: string; characterId?: number; personaId?: number | null } | undefined
                ) => {
                    if (!from || target.speaker || target.voice) return;
                    const label = from.characterId ? labelFor(from.characterId, from.personaId) : undefined;
                    if (from.characterId && label) target.voice = { characterId: from.characterId, personaId: from.personaId ?? null, label };
                    else if (!from.characterId && from.speaker) target.speaker = from.speaker;
                    else return;
                    filled++;
                };
                for (const chapter of next.chapters) {
                    const carriedChapter = byNo.get(chapter.chapter_no);
                    chapter.lines.forEach((line, li) => {
                        const from = carriedChapter?.lines[li] as (ImportLine & { characterId?: number; personaId?: number }) | undefined;
                        if (line.npcVoice) fill(line, from);
                        line.segments?.forEach((seg, si) => {
                            if (seg.npc) fill(seg, from?.segments?.[si] as ImportSegment & { characterId?: number; personaId?: number });
                        });
                    });
                }
                if (filled > 0) {
                    carriedPayload.current = next;
                    setPayload((current) => (current === draft ? next : current));
                }
                setCarried(filled);
            })
            .catch(() => setCarried(null)); // nothing pre-filled; the quotes can still be named by hand
    }, [payload, replaceSlug, options]);

    // Chapters with voices resolved: a character (and persona) by id, or an NPC
    // by name. The preview renders exactly this, and the upload sends it.
    const resolvedChapters = useMemo((): PreviewChapter[] => {
        if (!payload) return [];
        const personaById = new Map(personas.map((p) => [p.id, p]));
        // A mapped speaker becomes its character (as a persona or not); anyone else an NPC by name
        const resolveSpeaker = <T extends { characterId?: number; personaId?: number; speaker?: string }>(entry: T, speaker: string) => {
            const [kind, raw] = (charMap[speaker] ?? '').split(':');
            const persona = kind === 'p' ? personaById.get(parseInt(raw)) : undefined;
            if (kind === 'c') entry.characterId = parseInt(raw);
            else if (persona?.characterId != null) {
                entry.characterId = persona.characterId;
                entry.personaId = persona.id;
            } else entry.speaker = speaker;
            return entry;
        };
        // An NPC quote: the character picked in the namer, else its NPC name, else still unnamed
        const resolveNpc = <T extends { characterId?: number; personaId?: number; speaker?: string; npc?: boolean; npcVoice?: boolean }>(
            entry: T,
            from: { speaker?: string; voice?: AssignedVoice },
            flag: 'npc' | 'npcVoice'
        ) => {
            if (from.voice) {
                entry.characterId = from.voice.characterId;
                if (from.voice.personaId !== null) entry.personaId = from.voice.personaId;
                return entry;
            }
            entry[flag] = true;
            if (from.speaker) entry.speaker = from.speaker;
            return entry;
        };

        // A doc picture with no booru post yet is left out
        const postFor = (line: ImportLine) =>
            line.docxPicture !== undefined ? docxPostIds[line.docxPicture] : line.booruId;

        return payload.chapters.map((chapter) => ({
            chapter_no: chapter.chapter_no,
            title: chapter.title ?? undefined,
            lines: chapter.lines
                .filter((line) => line.type !== 'IMAGE' || postFor(line) !== undefined)
                .map((line) => {
                    const out: PreviewLine = { type: line.type, text: line.text };
                    if (line.type === 'IMAGE') {
                        out.booruId = postFor(line);
                        return out;
                    }
                    if (line.npcVoice) resolveNpc(out, line, 'npcVoice');
                    else if (line.speaker) resolveSpeaker(out, line.speaker);
                    if (line.segments) {
                        out.segments = line.segments.map((seg) => {
                            const resolved: Omit<ImportSegment, 'voice'> & { characterId?: number; personaId?: number } = { text: seg.text };
                            if (seg.npc) resolveNpc(resolved, seg, 'npc');
                            else if (seg.speaker) resolveSpeaker(resolved, seg.speaker);
                            if (seg.italic) resolved.italic = true;
                            if (seg.bold) resolved.bold = true;
                            return resolved;
                        });
                    }
                    return out;
                }),
        }));
    }, [payload, charMap, docxPostIds, personas]);

    // Name/color/portrait by id, for the preview's dialogue colors and legend
    const previewCharacters = useMemo(
        () =>
            Object.fromEntries(
                characters.map((c) => [c.id, { name: c.names[0], color: c.color, image: c.image }])
            ) as Record<number, SpeakerInfo>,
        [characters]
    );
    const previewPersonas = useMemo(
        () =>
            Object.fromEntries(
                personas.map((p) => [p.id, { name: p.name, image: p.image, color: p.color, characterId: p.characterId }])
            ) as Record<number, PersonaInfo>,
        [personas]
    );

    // ---- upload -----------------------------------------------------------

    const failed = (error: unknown) =>
        setPhase({
            step: 'failed',
            message: error instanceof Error ? error.message : 'The lore server is not answering.',
            duplicate: error instanceof ApiError && error.status === 409,
        });

    const upload = async () => {
        if (!payload) return;
        setPhase({ step: 'uploading' });
        const chapters = resolvedChapters;
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
                        canon: typeof payload.story.canon === 'boolean' ? payload.story.canon : undefined,
                        authorIds,
                    },
                    chapters,
                    importMeta,
                }),
            });
            setPhase({ step: 'success', count: lineTotal, href: `/stories/${created.slug}`, replaced: false });
            setShelf((prev) => (prev ? [...prev, { slug: created.slug, title: created.title, authorIds }] : prev));
        } catch (error) {
            failed(error);
        }
    };

    // A revised draft of a story already on the shelf: PUT /stories/:slug/import
    // swaps every chapter and line in one transaction, keeping the story's id,
    // title, blurb, authors and season (edit those on the story page).
    const replace = async () => {
        if (!payload || collision?.field !== 'slug' || !canReplace || npcUnnamed > 0) return;
        setPhase({ step: 'uploading' });
        const slug = collision.story.slug;
        try {
            await ff(`/stories/${encodeURIComponent(slug)}/import`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapters: resolvedChapters, importMeta }),
            });
            setPhase({ step: 'success', count: lineTotal, href: `/stories/${slug}`, replaced: true });
        } catch (error) {
            failed(error);
        }
    };

    const busy = phase.step === 'uploading';
    // Every typed post must exist (one the booru can't be asked about is left to the server)
    const picturesReady = badPosts.length === 0 && checkingPosts.length === 0 && badPictureInputs.length === 0;
    const canUpload =
        payload !== null && !busy && phase.step !== 'success' && collision === null && picturesReady && npcUnnamed === 0;
    const changeWhere = origin === 'docx' ? 'in the form above' : 'in the manuscript frontmatter';

    return (
        <div className={styles.importer}>
            <DocxStoryForm
                onConverted={(converted, name, _warnings, meta, pictures) =>
                    loadPayload(() => validatePayload(converted), name, 'docx', meta, pictures)
                }
                disabled={busy}
            />

            <details className={styles.advanced}>
                <summary className='pixel-label'>advanced: upload a story .json from the CLI pipeline</summary>
                <label className={`pixel-panel ${styles.dropzone}`}>
                    <input
                        type='file'
                        accept='.json,application/json'
                        onChange={(e) => onJsonFile(e.target.files?.[0])}
                        disabled={busy}
                    />
                    <span className='pixel-label'>▲ select a story .json</span>
                    <span className={styles.dropHint}>
                        {(origin === 'json' && fileName) || 'from archive-to-markdown/api/stories/…'}
                    </span>
                </label>
            </details>

            {parseError && (
                <p className={styles.error} role='alert'>
                    ✖ {parseError}
                </p>
            )}

            {payload && (
                <section className={`pixel-panel ${styles.preview}`}>
                    <h2 className='pixel-label'>manifest ⭑ {fileName}</h2>
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
                        <div>
                            <dt>continuity</dt>
                            <dd>{payload.story.canon === false ? 'non-canon' : 'canon'}</dd>
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
                                {payload.chapters.length} chapter{payload.chapters.length === 1 ? '' : 's'},{' '}
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
                    {selfAdded && user && (
                        <p className={styles.hint}>
                            You&rsquo;re credited too, as {user.username}: whoever imports a story is one of its
                            authors.
                        </p>
                    )}

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
                                            <option value=''>(an NPC: just this name)</option>
                                            {options.map((o) => (
                                                <option key={o.label} value={optionValue(o)}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                            {unresolvedSpeakers.length > 0 && (
                                <p className={styles.hint}>
                                    These upload as NPCs, a name with no character page (one NPC per name across the
                                    archive): {unresolvedSpeakers.join(', ')}. Pick a character for any that has one, or
                                    create it first.
                                </p>
                            )}
                        </>
                    )}

                    {npcQuotes.length > 0 && (
                        <>
                            <h3 className='pixel-label'>npc voices</h3>
                            <div className={styles.npcSummary}>
                                <p className={npcUnnamed > 0 ? styles.error : styles.hint}>
                                    {`${npcNamed} of ${npcQuotes.length} NPC quote${npcQuotes.length === 1 ? '' : 's'} named.`}
                                    {npcUnnamed > 0 && ' Name every one (or give it to a character) before uploading.'}
                                </p>
                                {canReplace && carried !== null && carried > 0 && (
                                    <p className={styles.hint}>
                                        {`${carried} ${carried === 1 ? 'quote' : 'quotes'} filled in from the story as it stands, where the text is unchanged. Check them in the list.`}
                                    </p>
                                )}
                                <button
                                    type='button'
                                    className={styles.namerOpen}
                                    onClick={() => setNaming(true)}
                                    disabled={busy || phase.step === 'success'}
                                >
                                    {npcNamed > 0 ? 'Edit NPC names…' : 'Name them now…'}
                                </button>
                            </div>
                        </>
                    )}
                    {naming && payload && (
                        <NpcVoiceNamer
                            chapters={payload.chapters}
                            knownNames={npcNames}
                            voiceOptions={options}
                            onApply={(chapters) => setPayload({ ...payload, chapters: chapters as ImportChapter[] })}
                            onClose={() => setNaming(false)}
                        />
                    )}

                    {docxPictures.length > 0 && (
                        <>
                            <h3 className='pixel-label'>pictures</h3>
                            <p className={styles.hint}>
                                Stories show pictures from the{' '}
                                <a href={BOORU_URL} target='_blank' rel='noreferrer'>
                                    booru
                                </a>
                                . Upload each one there, then type its post number. A picture left blank isn&rsquo;t
                                imported.
                            </p>
                            <ul className={styles.pictureList}>
                                {docxPictures.map((picture) => {
                                    const raw = pictureIds[picture.n] ?? '';
                                    const id = docxPostIds[picture.n];
                                    const check = id !== undefined ? posts[id] : undefined;
                                    return (
                                        <li key={picture.n} className={styles.pictureRow}>
                                            {picture.data && picture.contentType ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- a data: URL from the doc
                                                <img
                                                    className={styles.pictureThumb}
                                                    src={`data:${picture.contentType};base64,${picture.data}`}
                                                    alt={picture.alt || `picture ${picture.n}`}
                                                />
                                            ) : (
                                                <span className={styles.pictureThumb}>?</span>
                                            )}
                                            <span className={styles.colorMeta}>
                                                <span className={styles.mapName}>
                                                    picture {picture.n}
                                                    {picture.alt ? ` ⭑ “${picture.alt}”` : ''}
                                                </span>
                                                <label className={styles.pictureInput}>
                                                    <span>booru post #</span>
                                                    <input
                                                        inputMode='numeric'
                                                        value={raw}
                                                        onChange={(e) =>
                                                            setPictureIds((prev) => ({ ...prev, [picture.n]: e.target.value }))
                                                        }
                                                        placeholder='leave out'
                                                        disabled={busy || phase.step === 'success'}
                                                        aria-label={`booru post for picture ${picture.n}`}
                                                    />
                                                </label>
                                                <span className={styles.pickHint} aria-live='polite'>
                                                    {raw.trim() && !POST_ID.test(raw.trim())
                                                        ? '✖ a post number is digits only'
                                                        : check?.state === 'checking'
                                                          ? 'checking the booru…'
                                                          : check?.state === 'ok'
                                                            ? '✔ found on the booru'
                                                            : check?.state === 'missing'
                                                              ? `✖ ${check.message}`
                                                              : check?.state === 'unavailable'
                                                                ? '⚠ the booru isn’t answering; the upload will check again'
                                                                : ''}
                                                </span>
                                            </span>
                                            {check?.state === 'ok' && (
                                                // eslint-disable-next-line @next/next/no-img-element -- the booru's copy, through the proxy
                                                <img
                                                    className={styles.pictureThumb}
                                                    src={imageSrc(check.previewUrl ?? check.imageUrl)}
                                                    alt={`booru post ${id}`}
                                                />
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}

                    <h3 className='pixel-label'>preview</h3>
                    <p className={styles.hint}>
                        How it will read on the shelf. Check that each color became the right speaker; change a pick
                        above and the preview follows.
                    </p>
                    <StoryPreview
                        slug={payload.story.slug}
                        format={payload.story.format === 'PROSE' ? 'PROSE' : 'SCRIPT'}
                        themeColor={payload.story.themeColor}
                        themeColor2={payload.story.themeColor2}
                        season={payload.story.season}
                        chapters={resolvedChapters}
                        characters={previewCharacters}
                        personas={previewPersonas}
                        images={previewImages}
                    />
                    {badPosts.length > 0 && (
                        <p className={styles.error}>
                            ✖ no booru post {badPosts.join(', ')}: fix the number, or leave the picture out.
                        </p>
                    )}

                    <div className={styles.actions}>
                        {canReplace ? (
                            phase.step !== 'success' &&
                            (npcUnnamed > 0 ? (
                                <button type='button' className={styles.upload} disabled>
                                    Name the NPC quotes first
                                </button>
                            ) : (
                                <DeleteControl
                                    onConfirm={() => void replace()}
                                    busy={busy}
                                    deleteLabel={`Replace its text with these ${lineTotal} lines`}
                                    prompt={`replace every chapter of “${collision.story.title}”?`}
                                    confirmLabel={busy ? 'replacing…' : 'Replace'}
                                    cancelLabel='Keep'
                                />
                            ))
                        ) : (
                            <button type='button' className={styles.upload} onClick={upload} disabled={!canUpload}>
                                {phase.step === 'uploading' ? `transmitting ${lineTotal} lines…` : `Upload ${lineTotal} lines`}
                            </button>
                        )}
                    </div>

                    {phase.step === 'success' && (
                        <p className={styles.success}>
                            ✔ {phase.replaced ? 'story text replaced' : 'story archived'} —{' '}
                            <Link href={phase.href}>read it →</Link>
                        </p>
                    )}
                    {phase.step === 'failed' && (
                        <div className={styles.failure}>
                            <p className={styles.error} role='alert'>
                                ✖ {phase.message}
                            </p>
                            <p className={styles.hint}>
                                {phase.duplicate
                                    ? `Nothing was imported. Delete the existing story from its page first, or give this one a new slug and title ${changeWhere}.`
                                    : 'Nothing was imported — the upload is all-or-nothing, so it is safe to fix the file and try again.'}
                            </p>
                        </div>
                    )}
                    {collision?.field === 'slug' && !canReplace && phase.step !== 'success' && (
                        <p className={styles.error}>
                            ✖ the slug is already taken by{' '}
                            <Link href={`/stories/${collision.story.slug}`}>&ldquo;{collision.story.title}&rdquo;</Link>,
                            and only its authors or an admin can replace its text. Change the slug {changeWhere}.
                        </p>
                    )}
                    {canReplace && phase.step !== 'success' && (
                        <p className={styles.hint}>
                            This slug is{' '}
                            <Link href={`/stories/${collision.story.slug}`}>&ldquo;{collision.story.title}&rdquo;</Link>,
                            already on the shelf. If this is a revised draft of it, replace its text: every chapter and
                            line is swapped at once, and its title, blurb, authors and season stay as they are (edit
                            those on the story page). If it&rsquo;s a different story, change the slug {changeWhere}.
                        </p>
                    )}
                    {collision?.field === 'title' && phase.step !== 'success' && (
                        <p className={styles.error}>
                            ✖ the title is already taken by{' '}
                            <Link href={`/stories/${collision.story.slug}`}>&ldquo;{collision.story.title}&rdquo;</Link>{' '}
                            — change the title {changeWhere}, or use that story&rsquo;s slug to replace its text.
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
