import { apiRaw } from './api';
import type { SpeakerInfo } from './transcript';
import type { Character, StoryChapter, StoryFormat, StoryLine, StoryLineType, StorySegment } from './types';

// Slim shapes for the story reader — the API includes full character objects
// on every line; we send an id-keyed lookup table to the client instead.

export interface SlimLine {
    no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null;
    segments: StorySegment[] | null; // sub-paragraph dialogue spans, or null for plain lines
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

    const addCharacter = (c: Pick<Character, 'id' | 'name' | 'themeColor' | 'image'>) => {
        if (!(c.id in characters)) {
            characters[c.id] = { name: c.name, color: c.themeColor, image: c.image };
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
            segments: l.segments ?? null,
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
}): { primary: string; secondary: string } {
    if (THEMED_SLUGS.has(story.slug)) {
        return { primary: `var(--${story.slug})`, secondary: `var(--${story.slug}-2)` };
    }
    if (story.themeColor) {
        return { primary: story.themeColor, secondary: story.themeColor2 ?? story.themeColor };
    }
    return { primary: 'var(--accent)', secondary: 'var(--accent-soft)' };
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
