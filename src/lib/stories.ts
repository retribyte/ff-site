import { apiPaged } from './api';
import type { SpeakerInfo } from './transcript';
import type { StoryChapter, StoryLine, StoryLineType } from './types';

// Slim shapes for the story reader — the API includes full character objects
// on every line; we send an id-keyed lookup table to the client instead.

export interface SlimLine {
    no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null;
}

export interface StoryData {
    storySlug: string;
    chapterNo: number;
    lines: SlimLine[];
    characters: Record<number, SpeakerInfo>;
}

export async function fetchAllLines(slug: string, chapterNo: number): Promise<StoryLine[]> {
    const base = `/stories/${encodeURIComponent(slug)}/chapters/${chapterNo}/lines`;
    const limit = 1000;
    const first = await apiPaged<StoryLine>(`${base}?page=1&limit=${limit}`);
    const lines = [...first.data];
    const totalPages = Math.ceil(first.total / limit);
    for (let page = 2; page <= totalPages; page += 1) {
        const next = await apiPaged<StoryLine>(`${base}?page=${page}&limit=${limit}`);
        lines.push(...next.data);
    }
    return lines;
}

export function slimStoryChapter(slug: string, chapterNo: number, lines: StoryLine[]): StoryData {
    const characters: StoryData['characters'] = {};

    for (const line of lines) {
        if (line.character && !(line.character.id in characters)) {
            characters[line.character.id] = {
                name: line.character.name,
                color: line.character.themeColor,
                image: line.character.image,
            };
        }
    }

    return {
        storySlug: slug,
        chapterNo,
        characters,
        lines: lines.map((l) => ({
            no: l.line_no,
            type: l.type,
            text: l.text,
            characterId: l.characterId,
            speaker: l.speaker,
        })),
    };
}

/** Count of distinct speaking voices — linked characters plus name-only speakers. */
export function countVoices(data: StoryData): number {
    const names = new Set<string>(Object.values(data.characters).map((c) => c.name));
    for (const line of data.lines) {
        if (line.characterId === null && line.speaker) names.add(line.speaker);
    }
    return names.size;
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
