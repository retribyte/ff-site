'use client';

import { useEffect, useRef, useState } from 'react';
import StoryReader from '@/components/story/StoryReader';
import { findVoiceOption, type VoiceOption } from '@/lib/voiceOptions';
import type { MarkVoice } from './markDialogue';
import { storyColors, type PersonaInfo, type SlimLine, type StoryData } from '@/lib/stories';
import type { SpeakerInfo } from '@/lib/transcript';
import type { StoryFormat, StoryLineType, StorySegment } from '@/lib/types';
import styles from './storyImporter.module.scss';

// The import payload rendered with the real story reader, chapter by chapter,
// so a wrong color → speaker pick (or a bad heading/break) shows before the
// story goes on the shelf. It reads the same resolved chapters the upload
// sends, so what's shown is what's stored. Selecting words in a narration
// paragraph offers to make them a quote (or a quote narration again).

export interface PreviewLine {
    type: string;
    text: string;
    characterId?: number;
    personaId?: number;
    speaker?: string; // an NPC by name
    npcVoice?: boolean;
    segments?: StorySegment[];
    booruId?: number; // IMAGE
    imageUrl?: string | null; // IMAGE kept from the shelf: its booru file, as stored
    /** the line's index in the payload chapter (a picture with no post is left out of the preview) */
    source?: number;
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
    personas: Record<number, PersonaInfo>,
    images: Record<number, string>
): StoryData {
    const lines: SlimLine[] = chapter.lines.map((line, index) => ({
        no: index + 1, // the server numbers lines the same way
        type: line.type as StoryLineType,
        text: line.text,
        characterId: line.characterId ?? null,
        personaId: line.personaId ?? null,
        speaker: line.speaker ?? null,
        // a voice with no character is an NPC (named or not)
        npcVoice: !!line.npcVoice || (line.characterId === undefined && !!line.speaker),
        segments: line.segments ?? null,
        imageUrl: line.booruId !== undefined ? (images[line.booruId] ?? line.imageUrl ?? null) : null,
        notes: [], // not on the server yet
    }));
    return { storySlug: slug, chapterNo: chapter.chapter_no, format, lines, characters, personas };
}

/** A selection inside one narration paragraph, by character offsets into its text */
interface Marking {
    lineIndex: number;
    start: number;
    end: number;
    hasDialogue: boolean;
    /** where to show the popover (viewport coordinates, under the selection) */
    top: number;
    left: number;
}

const MARK_HIGHLIGHT = 'import-mark';

// Keeps the selected words lit while the popover's field has focus
function showMark(range: Range | null) {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
    if (range) CSS.highlights.set(MARK_HIGHLIGHT, new Highlight(range));
    else CSS.highlights.delete(MARK_HIGHLIGHT);
}

/** What the popover's field means: "@Name" a character, a name a speaker, blank an NPC to name later */
function parseVoice(typed: string, options: VoiceOption[]): MarkVoice | 'unknown' {
    const name = typed.trim();
    if (!name) return { npc: true };
    if (!name.startsWith('@')) return { speaker: name };
    const pick = findVoiceOption(options, name.slice(1));
    return pick ? { npc: true, voice: { characterId: pick.characterId, personaId: pick.personaId, label: pick.label } } : 'unknown';
}

// The selection as offsets into the paragraph's text, when it lies inside
// one narration line's paragraph (the rendered text is the line's text
// verbatim: segments concatenate to it, and the markup adds none)
function readSelection(frame: HTMLElement, lines: PreviewLine[]): (Marking & { range: Range }) | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const lineEl = (range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement
    )?.closest<HTMLElement>('[id^="m-"]');
    if (!lineEl || !frame.contains(lineEl)) return null;
    const lineIndex = parseInt(lineEl.id.slice(2)) - 1;
    const line = lines[lineIndex];
    const paragraph = lineEl.querySelector('p');
    if (!line || line.type !== 'NARRATION' || !paragraph) return null;
    if (!paragraph.contains(range.startContainer) || !paragraph.contains(range.endContainer)) return null;

    const before = document.createRange();
    before.setStart(paragraph, 0);
    before.setEnd(range.startContainer, range.startOffset);
    let start = before.toString().length;
    let end = start + range.toString().length;
    if (line.text.slice(start, end) !== range.toString()) return null; // not the text as stored
    // a double-click takes the space after a word with it
    while (start < end && /\s/.test(line.text[start])) start++;
    while (end > start && /\s/.test(line.text[end - 1])) end--;
    if (start === end) return null;

    let pos = 0;
    const hasDialogue = (line.segments ?? []).some((seg) => {
        const from = pos;
        pos += seg.text.length;
        return pos > start && from < end && (seg.characterId != null || !!seg.npc || !!seg.speaker);
    });
    const rect = range.getBoundingClientRect();
    // below the selection, or above it when the window ends first (the popover is ~11rem tall)
    const top = rect.bottom + 6 + 180 > window.innerHeight ? Math.max(8, rect.top - 186) : rect.bottom + 6;
    return { lineIndex, start, end, hasDialogue, top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)), range };
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
    personas,
    images,
    onMark,
    voiceOptions = [],
    names = [],
}: {
    slug: string;
    format: StoryFormat;
    themeColor?: string;
    themeColor2?: string;
    season?: string;
    chapters: PreviewChapter[];
    characters: Record<number, SpeakerInfo>;
    personas: Record<number, PersonaInfo>;
    /** booru post -> what to show for it (the doc's own picture, or the post's file URL) */
    images: Record<number, string>;
    /** marks characters [start, end) of a preview line as spoken by `voice` (null: narration) */
    onMark?: (chapterIndex: number, lineIndex: number, start: number, end: number, voice: MarkVoice) => void;
    /** characters (and characters as personas) a quote can be given with "@" */
    voiceOptions?: VoiceOption[];
    /** speaker and NPC names to suggest */
    names?: string[];
}) {
    const [index, setIndex] = useState(0);
    const [marking, setMarking] = useState<Marking | null>(null);
    const [typed, setTyped] = useState('');
    const frame = useRef<HTMLDivElement>(null);
    const popover = useRef<HTMLDivElement>(null);
    const chapterIndex = Math.min(index, chapters.length - 1);
    const chapter = chapters[chapterIndex];

    const close = () => {
        setMarking(null);
        showMark(null);
    };

    // A click outside the popover, or scrolling the frame, drops it
    useEffect(() => {
        if (!marking) return;
        const close = () => {
            setMarking(null);
            showMark(null);
        };
        const away = (e: MouseEvent) => {
            if (!popover.current?.contains(e.target as Node)) close();
        };
        const el = frame.current;
        document.addEventListener('mousedown', away);
        el?.addEventListener('scroll', close);
        window.addEventListener('scroll', close);
        return () => {
            document.removeEventListener('mousedown', away);
            el?.removeEventListener('scroll', close);
            window.removeEventListener('scroll', close);
        };
    }, [marking]);
    useEffect(() => () => showMark(null), []);

    if (!chapter) return null;

    const select = () => {
        if (!onMark || !frame.current) return;
        // after the browser settles a double- or triple-click selection
        setTimeout(() => {
            const found = frame.current && readSelection(frame.current, chapter.lines);
            if (!found) return;
            const { range, ...rest } = found;
            setMarking(rest);
            showMark(range.cloneRange());
        }, 0);
    };

    const parsed = marking ? parseVoice(typed, voiceOptions) : null;
    const apply = (voice: MarkVoice) => {
        if (!marking || !onMark) return;
        onMark(chapterIndex, marking.lineIndex, marking.start, marking.end, voice);
        window.getSelection()?.removeAllRanges();
        close();
    };

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
                            onClick={() => {
                                close();
                                setIndex(i);
                            }}
                        >
                            {chapterName(c)}
                        </button>
                    ))}
                </div>
            )}
            <div
                ref={frame}
                className={styles.readerFrame}
                onMouseUp={select}
                onKeyUp={(e) => {
                    if (e.shiftKey) select();
                }}
            >
                <p className='pixel-label'>
                    {chapterName(chapter)}, {chapter.lines.length} line{chapter.lines.length === 1 ? '' : 's'}
                </p>
                <StoryReader
                    key={chapter.chapter_no}
                    data={chapterData(slug, format, chapter, characters, personas, images)}
                    preview
                />
            </div>
            {marking && (
                <div
                    ref={popover}
                    className={`pixel-panel ${styles.markPopover}`}
                    style={{ top: marking.top, left: marking.left }}
                    role='dialog'
                    aria-label='Make the selected words a quote'
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') close();
                    }}
                >
                    <datalist id='mark-voices'>
                        {[...names, ...voiceOptions.map((o) => `@${o.label}`)].map((n) => (
                            <option key={n} value={n} />
                        ))}
                    </datalist>
                    <label className='pixel-label' htmlFor='mark-voice'>
                        spoken by
                    </label>
                    <input
                        id='mark-voice'
                        list='mark-voices'
                        value={typed}
                        maxLength={80}
                        autoFocus
                        placeholder='an NPC, named later'
                        aria-invalid={parsed === 'unknown' || undefined}
                        title={parsed === 'unknown' ? 'No character by that name' : undefined}
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && parsed && parsed !== 'unknown') {
                                e.preventDefault();
                                apply(parsed);
                            }
                        }}
                    />
                    <p className={styles.hint}>A speaker&apos;s name, @ for a character (or @Name as Persona), or blank.</p>
                    <div className={styles.markActions}>
                        <button
                            type='button'
                            className={styles.markGo}
                            disabled={!parsed || parsed === 'unknown'}
                            onClick={() => parsed && parsed !== 'unknown' && apply(parsed)}
                        >
                            make it a quote
                        </button>
                        {marking.hasDialogue && (
                            <button type='button' className={styles.namerCancel} onClick={() => apply(null)}>
                                make it narration
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
