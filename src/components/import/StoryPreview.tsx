'use client';

import { useState } from 'react';
import StoryReader from '@/components/story/StoryReader';
import { storyColors, type SlimLine, type StoryData } from '@/lib/stories';
import type { SpeakerInfo } from '@/lib/transcript';
import type { StoryFormat, StoryLineType, StorySegment } from '@/lib/types';
import styles from './storyImporter.module.scss';

// The import payload rendered with the real story reader, chapter by chapter,
// so a wrong color → speaker pick (or a bad heading/break) shows before the
// story goes on the shelf. It reads the same resolved chapters the upload
// sends, so what's shown is what's stored.

export interface PreviewLine {
    type: string;
    text: string;
    characterId?: number;
    speaker?: string;
    npcVoice?: boolean;
    segments?: StorySegment[];
    booruId?: number; // IMAGE
}

export interface PreviewChapter {
    chapter_no: number;
    title?: string;
    lines: PreviewLine[];
}

function chapterData(
    slug: string,
    format: StoryFormat,
    chapter: PreviewChapter,
    characters: Record<number, SpeakerInfo>,
    images: Record<number, string>
): StoryData {
    const lines: SlimLine[] = chapter.lines.map((line, index) => ({
        no: index + 1, // the server numbers lines the same way
        type: line.type as StoryLineType,
        text: line.text,
        characterId: line.characterId ?? null,
        speaker: line.speaker ?? null,
        npcVoice: line.npcVoice ?? false,
        segments: line.segments ?? null,
        imageUrl: line.booruId !== undefined ? (images[line.booruId] ?? null) : null,
    }));
    return { storySlug: slug, chapterNo: chapter.chapter_no, format, lines, characters };
}

const chapterName = (chapter: PreviewChapter) =>
    chapter.title ?? (chapter.chapter_no === 0 ? 'Preface' : `Chapter ${chapter.chapter_no}`);

export default function StoryPreview({
    slug,
    format,
    themeColor,
    themeColor2,
    season,
    chapters,
    characters,
    images,
}: {
    slug: string;
    format: StoryFormat;
    themeColor?: string;
    themeColor2?: string;
    season?: string;
    chapters: PreviewChapter[];
    characters: Record<number, SpeakerInfo>;
    /** booru post -> what to show for it (the doc's own picture, or the post's file URL) */
    images: Record<number, string>;
}) {
    const [index, setIndex] = useState(0);
    const chapter = chapters[Math.min(index, chapters.length - 1)];
    if (!chapter) return null;

    const colors = storyColors({
        slug,
        themeColor: themeColor ?? null,
        themeColor2: themeColor2 ?? null,
        season: season ? { title: season } : null,
    });
    const style = {
        '--story': colors.primary,
        '--story-2': colors.secondary,
        '--scan-accent': colors.primary,
    } as React.CSSProperties;

    return (
        <div className={styles.readerPreview} style={style}>
            {chapters.length > 1 && (
                <div className={styles.chapterTabs} role='tablist' aria-label='Chapters'>
                    {chapters.map((c, i) => (
                        <button
                            key={c.chapter_no}
                            type='button'
                            role='tab'
                            aria-selected={c === chapter}
                            className={styles.chapterTab}
                            onClick={() => setIndex(i)}
                        >
                            {chapterName(c)}
                        </button>
                    ))}
                </div>
            )}
            <div className={styles.readerFrame}>
                <p className='pixel-label'>
                    {chapterName(chapter)} ⭑ {chapter.lines.length} line{chapter.lines.length === 1 ? '' : 's'}
                </p>
                <StoryReader
                    key={chapter.chapter_no}
                    data={chapterData(slug, format, chapter, characters, images)}
                    preview
                />
            </div>
        </div>
    );
}
