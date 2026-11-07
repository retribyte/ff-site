import { seasonColors } from './seasons';
import { apiRaw } from './api';
import type { SpeakerInfo } from './transcript';
import type { Character, SeasonKind, StoryChapter, StoryFormat, StoryLine, StoryLineType, StoryQuote, StorySegment } from './types';

// Slim shapes for the story reader — the API includes full character objects
// on every line; we send an id-keyed lookup table to the client instead.

export interface SlimLine {
    no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null;
    npcVoice: boolean; // DIALOGUE: an NPC voice, named by `speaker` or unnamed
    segments: StorySegment[] | null; // sub-paragraph dialogue spans, or null for plain lines
    imageUrl: string | null; // IMAGE: the picture (a booru file URL, or a data: URL in an import preview)
}

export interface StoryData {
    storySlug: string;
    chapterNo: number;
    format: StoryFormat;
    lines: SlimLine[];
    characters: Record<number, SpeakerInfo>;
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

export function slimStoryChapter(
    slug: string,
    chapterNo: number,
    format: StoryFormat,
    lines: StoryLine[],
    segmentCharacters: Character[] = [],
): StoryData {
    const characters: StoryData['characters'] = {};

    const addCharacter = (c: Pick<Character, 'id' | 'name' | 'color' | 'colorLight' | 'image'>) => {
        if (!(c.id in characters)) {
            characters[c.id] = { name: c.name, color: c.color, colorLight: c.colorLight ?? null, image: c.image };
        }
    };

    for (const line of lines) {
        if (line.character) addCharacter(line.character);
    }
    // Characters that only speak inside segment spans, hydrated by the API
    for (const c of segmentCharacters) addCharacter(c);

    return {
        storySlug: slug,
        chapterNo,
        format,
        characters,
        lines: lines.map((l) => ({
            no: l.line_no,
            type: l.type,
            text: l.text,
            characterId: l.characterId,
            speaker: l.speaker,
            npcVoice: l.npcVoice ?? false,
            segments: l.segments ?? null,
            imageUrl: l.imageUrl ?? null,
        })),
    };
}

/** Count of distinct speaking voices — linked characters plus name-only speakers. */
export function countVoices(data: StoryData): number {
    const names = new Set<string>();
    for (const line of data.lines) {
        addLineVoices(line, data.characters, names);
    }
    return names.size;
}

/** Collects every distinct speaking voice (name) in the chapter, in reading order. */
export function collectVoices(data: StoryData): { name: string; characterId: number | null }[] {
    const seen = new Set<string>();
    const voices: { name: string; characterId: number | null }[] = [];
    const push = (name: string, characterId: number | null) => {
        if (name && !seen.has(name)) {
            seen.add(name);
            voices.push({ name, characterId });
        }
    };
    for (const line of data.lines) {
        if (line.type === 'DIALOGUE') {
            const name = voiceName(line.characterId, line.speaker, data.characters);
            if (name) push(name, line.characterId);
        }
        for (const seg of line.segments ?? []) {
            if (seg.characterId != null || seg.speaker) {
                const name = voiceName(seg.characterId ?? null, seg.speaker ?? null, data.characters);
                if (name) push(name, seg.characterId ?? null);
            }
        }
    }
    return voices;
}

/** Resolves a voice's display name from a linked character or a bare speaker string. */
function voiceName(
    characterId: number | null,
    speaker: string | null,
    characters: StoryData['characters'],
): string | null {
    if (characterId != null && characters[characterId]) return characters[characterId].name;
    return speaker ?? null;
}

function addLineVoices(line: SlimLine, characters: StoryData['characters'], names: Set<string>) {
    if (line.type === 'DIALOGUE') {
        const name = voiceName(line.characterId, line.speaker, characters);
        if (name) names.add(name);
    }
    for (const seg of line.segments ?? []) {
        if (seg.characterId != null || seg.speaker) {
            const name = voiceName(seg.characterId ?? null, seg.speaker ?? null, characters);
            if (name) names.add(name);
        }
    }
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

/** Deep link to a quoted line — chapter route only needs the leading number.
 * Takes just the three fields it needs (not a full StoryQuote) so callers
 * with a lighter-weight hit (e.g. a site-wide search result) can pass one
 * directly; every existing StoryQuote caller still satisfies this. */
export function storyQuoteUrl(quote: Pick<StoryQuote, 'storySlug' | 'chapterNo' | 'line_no'>): string {
    return `/stories/${quote.storySlug}/${quote.chapterNo}?line=${quote.line_no}`;
}

/**
 * One NPC voice quote in the reader: a whole npcVoice DIALOGUE line
 * (`segments: null`), or a run of adjacent `npc` segments in a paragraph — one
 * span that emphasis split into pieces. Named together, as one voice.
 */
export interface NpcRun {
    lineNo: number;
    segments: number[] | null;
    speaker: string | null;
}

/** Every NPC voice quote in a chapter, in reading order. */
export function npcRuns(lines: SlimLine[]): NpcRun[] {
    const runs: NpcRun[] = [];
    for (const line of lines) {
        if (line.npcVoice) runs.push({ lineNo: line.no, segments: null, speaker: line.speaker });
        const segs = line.segments ?? [];
        let start = -1;
        for (let i = 0; i <= segs.length; i++) {
            const npc = i < segs.length && !!segs[i].npc;
            if (npc && start < 0) start = i;
            if (!npc && start >= 0) {
                const indexes = Array.from({ length: i - start }, (_, k) => start + k);
                runs.push({ lineNo: line.no, segments: indexes, speaker: segs[start].speaker ?? null });
                start = -1;
            }
        }
    }
    return runs;
}
