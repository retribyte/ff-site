import { seasonColors } from './seasons';
import { apiRaw } from './api';
import type { SlimCommentary, SpeakerInfo } from './transcript';
import type { BookmarkChapter } from '@/components/story/BookmarkJump';
import type { Character, SeasonKind, StoryChapter, StoryFormat, StoryLine, StoryLineType, StoryPersona, StoryQuote, StorySegment } from './types';

// Slim shapes for the story reader — the API includes full character objects
// on every line; we send id-keyed lookup tables to the client instead.

export interface SlimLine {
    no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    /** one of the character's personas, or (characterId null) an NPC persona */
    personaId: number | null;
    /** an NPC voice's name (an import draft's, or its persona's), else null */
    speaker: string | null;
    npcVoice: boolean; // DIALOGUE: an NPC voice
    segments: StorySegment[] | null; // sub-paragraph dialogue spans, or null for plain lines
    imageUrl: string | null; // IMAGE: the picture (a booru file URL, or a data: URL in an import preview)
    /** margin notes on the line, oldest first (none in an import preview) */
    notes: SlimCommentary[];
}

/** How a persona presents a story voice: each field overrides the character's when set */
export interface PersonaInfo {
    name: string | null;
    image: string | null;
    color: string | null;
    characterId: number | null;
}

export interface StoryData {
    storySlug: string;
    chapterNo: number;
    format: StoryFormat;
    lines: SlimLine[];
    characters: Record<number, SpeakerInfo>;
    personas: Record<number, PersonaInfo>;
}

/**
 * All lines of a chapter, plus the characters referenced only inside segment
 * spans (the line-level `character` include doesn't hydrate those).
 */
export async function fetchAllLines(
    slug: string,
    chapterNo: number,
): Promise<{ lines: StoryLine[]; characters: Character[] }> {
    const base = `/stories/${encodeURIComponent(slug)}/chapters/${chapterNo}/lines`;
    const limit = 1000;
    type LinesEnvelope = { data: StoryLine[]; total?: number; characters?: Character[] };

    const first = await apiRaw<LinesEnvelope>(`${base}?page=1&limit=${limit}`);
    const lines = [...(first.data ?? [])];
    const characters = [...(first.characters ?? [])];
    const totalPages = Math.ceil((first.total ?? lines.length) / limit);
    for (let page = 2; page <= totalPages; page += 1) {
        const next = await apiRaw<LinesEnvelope>(`${base}?page=${page}&limit=${limit}`);
        lines.push(...(next.data ?? []));
        characters.push(...(next.characters ?? []));
    }
    return { lines, characters };
}

const isNpcPersona = (persona: StoryPersona | null | undefined) => !!persona && persona.characterId === null;

/** A served segment as the reader holds it: ids, plus the NPC name when an NPC persona speaks it. */
export function slimSegment(seg: StorySegment): StorySegment {
    const npc = isNpcPersona(seg.persona);
    return {
        text: seg.text,
        ...(seg.characterId != null ? { characterId: seg.characterId } : {}),
        ...(seg.personaId != null ? { personaId: seg.personaId } : {}),
        ...(npc ? { npc: true, speaker: seg.persona!.name } : {}),
        ...(seg.italic ? { italic: true } : {}),
        ...(seg.bold ? { bold: true } : {}),
    };
}

/** A served line as the reader holds it. */
export function slimLine(l: StoryLine): SlimLine {
    const npc = isNpcPersona(l.persona);
    return {
        no: l.line_no,
        type: l.type,
        text: l.text,
        characterId: l.characterId,
        personaId: l.personaId ?? null,
        speaker: npc ? l.persona!.name : null,
        npcVoice: npc,
        segments: l.segments ? l.segments.map(slimSegment) : null,
        imageUrl: l.imageUrl ?? null,
        notes: (l.commentaries ?? []).map((c) => ({
            id: c.id,
            content: c.content,
            creatorId: c.creatorId,
            creatorName: c.creator?.username ?? '',
        })),
    };
}

/** Every persona a line or its segments are voiced by, into `into`. */
export function collectPersonas(l: Pick<StoryLine, 'persona' | 'segments'>, into: Record<number, PersonaInfo>) {
    const add = (p: StoryPersona | null | undefined) => {
        if (p && !(p.id in into)) into[p.id] = { name: p.name, image: p.image, color: p.color, characterId: p.characterId };
    };
    add(l.persona);
    for (const seg of l.segments ?? []) add(seg.persona);
}

export function slimStoryChapter(
    slug: string,
    chapterNo: number,
    format: StoryFormat,
    lines: StoryLine[],
    segmentCharacters: Character[] = [],
): StoryData {
    const characters: StoryData['characters'] = {};
    const personas: StoryData['personas'] = {};

    const addCharacter = (c: Pick<Character, 'id' | 'name' | 'slug' | 'color' | 'colorLight' | 'image'>) => {
        if (!(c.id in characters)) {
            characters[c.id] = { name: c.name, slug: c.slug, color: c.color, colorLight: c.colorLight ?? null, image: c.image };
        }
    };

    for (const line of lines) {
        if (line.character) addCharacter(line.character);
        collectPersonas(line, personas);
    }
    // Characters that only speak inside segment spans, hydrated by the API
    for (const c of segmentCharacters) addCharacter(c);

    return { storySlug: slug, chapterNo, format, characters, personas, lines: lines.map(slimLine) };
}

/**
 * Who speaks a fragment, as the reader shows it: the persona's name (and
 * image/color, see the reader) over the character's, or an NPC's name.
 * null when nobody does (narration).
 */
export interface StoryVoice {
    name: string;
    characterId: number | null;
    personaId: number | null;
    character: SpeakerInfo | null;
    persona: PersonaInfo | null;
    npc: boolean;
}

export function storyVoice(
    v: { characterId?: number | null; personaId?: number | null; speaker?: string | null; npc?: boolean },
    data: Pick<StoryData, 'characters' | 'personas'>,
): StoryVoice | null {
    const characterId = v.characterId ?? null;
    const personaId = v.personaId ?? null;
    const character = characterId !== null ? (data.characters[characterId] ?? null) : null;
    const persona = personaId !== null ? (data.personas[personaId] ?? null) : null;
    if (characterId === null && personaId === null && !v.speaker && !v.npc) return null;
    const name = persona?.name ?? character?.name ?? v.speaker ?? null;
    return {
        name: name ?? (v.npc ? 'unnamed' : '?'),
        characterId,
        personaId,
        character,
        persona,
        npc: characterId === null,
    };
}

/** Count of distinct speaking voices — characters (as each persona) plus NPCs. */
export function countVoices(data: StoryData): number {
    return collectVoices(data).length;
}

/** Collects every distinct speaking voice in the chapter, in reading order. */
export function collectVoices(data: StoryData): StoryVoice[] {
    const seen = new Set<string>();
    const voices: StoryVoice[] = [];
    const push = (voice: StoryVoice | null) => {
        if (!voice || voice.name === 'unnamed') return;
        const key = voice.characterId !== null ? `c${voice.characterId}:${voice.personaId ?? ''}` : `n${voice.name.toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);
            voices.push(voice);
        }
    };
    for (const line of data.lines) {
        if (line.type === 'DIALOGUE') push(storyVoice({ ...line, npc: line.npcVoice }, data));
        for (const seg of line.segments ?? []) push(storyVoice(seg, data));
    }
    return voices;
}

/**
 * CSS color values for a story's primary/secondary identity colors.
 * Stories with dedicated tokens in _tokens.scss ("vm" → --vm/--vm-2) use those;
 * otherwise DB colors, otherwise the site accent.
 */
const THEMED_SLUGS = new Set(['vm']);

export function storyColors(story: {
    slug: string;
    themeColor: string | null;
    themeColor2: string | null;
    season?: { title: string } | null;
}): { primary: string; secondary: string } {
    if (THEMED_SLUGS.has(story.slug)) {
        return { primary: `var(--${story.slug})`, secondary: `var(--${story.slug}-2)` };
    }
    if (story.themeColor) {
        return { primary: story.themeColor, secondary: story.themeColor2 ?? story.themeColor };
    }
    // No colors of its own — wear its campaign's (falls back to the accent too)
    if (story.season) return seasonColors(story.season.title);
    return { primary: 'var(--accent)', secondary: 'var(--accent-soft)' };
}

export type StoryBranch = 'mainline' | 'spinoff';

/**
 * Which branch of the universe a story belongs to: a mainline campaign's
 * (FF1–FF5; a PLANNED season is a mainline campaign not played yet) or a
 * spin-off's (a SIDE campaign such as Truth & Lies or Vortox Machina). A story
 * filed under no campaign stands on its own, so it counts as a spin-off.
 */
export function storyBranch(season: { kind?: SeasonKind } | null | undefined): StoryBranch {
    return season?.kind === 'MAINLINE' || season?.kind === 'PLANNED' ? 'mainline' : 'spinoff';
}

/** Words in a piece of text: runs of non-whitespace (the same rule ff-server's word counts use). */
export function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

/** Mean words per item, to one decimal ("9.4"); "0" for none. */
export function averageWords(items: { words: number }[]): string {
    if (items.length === 0) return '0';
    const avg = items.reduce((sum, item) => sum + item.words, 0) / items.length;
    return avg.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** "54,833 words" */
export function formatWords(count: number): string {
    return `${count.toLocaleString('en-US')} word${count === 1 ? '' : 's'}`;
}

/** Anchor id for a /stories shelf section, e.g. "Final Frontier 3" → "final-frontier-3". */
export function storyGroupId(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/** "2-the-signal" for /stories/foo/2-the-signal; resolved by number prefix. */
export function chapterSlug(chapter: Pick<StoryChapter, 'chapter_no' | 'title'>): string {
    if (!chapter.title) return `${chapter.chapter_no}`;
    const titlePart = chapter.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return titlePart ? `${chapter.chapter_no}-${titlePart}` : `${chapter.chapter_no}`;
}

/** Parses the leading chapter number out of a chapter URL segment. */
/**
 * The chapters as the header's bookmark button needs them: line counts and
 * the page that reads each one (a single-chapter story reads on its own page).
 */
export function bookmarkChapters(slug: string, chapters: StoryChapter[]): BookmarkChapter[] {
    return chapters.map((chapter) => ({
        no: chapter.chapter_no,
        // a missing count never drops a bookmark
        lines: chapter._count?.lines ?? Number.MAX_SAFE_INTEGER,
        href: chapters.length === 1 ? `/stories/${slug}` : `/stories/${slug}/${chapterSlug(chapter)}`,
    }));
}

export function chapterNoFromSlug(slug: string): number | null {
    const match = slug.match(/^(\d+)(-|$)/);
    return match ? parseInt(match[1]) : null;
}

/**
 * The character's own words from a StoryQuote — for a whole DIALOGUE line
 * that's the full `text`, but for a segmented NARRATION paragraph it's just
 * the matching segment span(s), not the surrounding narration prose.
 */
export function quotedSpanText(quote: StoryQuote, characterId: number): string {
    if (!quote.segments) return quote.text;
    return quote.segments
        .filter((s) => s.characterId === characterId)
        .map((s) => s.text)
        .join(' ');
}

/**
 * The persona name a character speaks a quote under, for "(as X)": the
 * line's own persona, or the first named one on its spans. Look-only personas
 * (no name) carry none.
 */
export function quotePersonaName(quote: StoryQuote, characterId: number): string | null {
    if (quote.characterId === characterId && quote.persona?.name) return quote.persona.name;
    return quote.segments?.find((s) => s.characterId === characterId && s.persona?.name)?.persona?.name ?? null;
}

/** Deep link to a quoted line — chapter route only needs the leading number.
 * Takes just the three fields it needs (not a full StoryQuote) so callers
 * with a lighter-weight hit (e.g. a site-wide search result) can pass one
 * directly; every existing StoryQuote caller still satisfies this. */
export function storyQuoteUrl(quote: Pick<StoryQuote, 'storySlug' | 'chapterNo' | 'line_no'>): string {
    return `/stories/${quote.storySlug}/${quote.chapterNo}?line=${quote.line_no}`;
}

/**
 * One voice's quote in the reader: a whole DIALOGUE line (`segments: null`),
 * or a run of adjacent segments in a paragraph with the same voice (one span
 * that emphasis split into pieces). Re-voiced together, as one quote. An NPC
 * run has `characterId` null and its name (or null, unnamed) in `speaker`; a
 * character's run has the character and, when it speaks as one, the persona.
 */
export interface VoiceRun {
    lineNo: number;
    segments: number[] | null;
    speaker: string | null;
    characterId: number | null;
    personaId: number | null;
}

/** Every NPC voice quote in a chapter, in reading order. */
export function npcRuns(lines: SlimLine[]): VoiceRun[] {
    const runs: VoiceRun[] = [];
    for (const line of lines) {
        if (line.npcVoice) runs.push({ lineNo: line.no, segments: null, speaker: line.speaker, characterId: null, personaId: null });
        const segs = line.segments ?? [];
        let start = -1;
        for (let i = 0; i <= segs.length; i++) {
            const npc = i < segs.length && !!segs[i].npc;
            if (npc && start < 0) start = i;
            if (!npc && start >= 0) {
                const indexes = Array.from({ length: i - start }, (_, k) => start + k);
                runs.push({ lineNo: line.no, segments: indexes, speaker: segs[start].speaker ?? null, characterId: null, personaId: null });
                start = -1;
            }
        }
    }
    return runs;
}

/** Every quote a character speaks in a chapter (as itself or a persona), in reading order. */
export function characterRuns(lines: SlimLine[]): VoiceRun[] {
    const runs: VoiceRun[] = [];
    for (const line of lines) {
        if (line.type === 'DIALOGUE' && line.characterId !== null) {
            runs.push({ lineNo: line.no, segments: null, speaker: null, characterId: line.characterId, personaId: line.personaId });
        }
        const segs = line.segments ?? [];
        let start = -1;
        for (let i = 0; i <= segs.length; i++) {
            const same =
                start >= 0 &&
                i < segs.length &&
                (segs[i].characterId ?? null) === (segs[start].characterId ?? null) &&
                (segs[i].personaId ?? null) === (segs[start].personaId ?? null);
            if (start >= 0 && !same) {
                const seg = segs[start];
                const indexes = Array.from({ length: i - start }, (_, k) => start + k);
                runs.push({ lineNo: line.no, segments: indexes, speaker: null, characterId: seg.characterId!, personaId: seg.personaId ?? null });
                start = -1;
            }
            if (start < 0 && i < segs.length && (segs[i].characterId ?? null) !== null) start = i;
        }
    }
    return runs;
}
