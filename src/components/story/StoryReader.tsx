'use client';

import Link from 'next/link';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useTheme, type ColorMode } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import { collectVoices, type SlimLine, type StoryData } from '@/lib/stories';
import type { StorySegment } from '@/lib/types';
import {
    clearScroller,
    Highlighted,
    registerScroller,
    ScanBar,
    scrollToMessage,
    useScan,
} from '@/components/transcript/ScanBar';
import DeleteStoryButton from './DeleteStoryButton';
import styles from './story.module.scss';

// Stories read as prose: NARRATION is narrator voice, ACTION is a command the
// protagonist (or the readers, in a CYOA) chose, DIALOGUE is a character
// speaking, TRANSCRIPT is an in-universe recording fragment, BREAK is a
// scene break.

// A colored dialogue fragment — a segment span inside narration, or a whole
// prose-format dialogue line. Links to the character page when one is linked.
function DialogueRun({
    text,
    characterId,
    speaker,
    characters,
    colorMode,
    query,
    className,
}: {
    text: string;
    characterId: number | null;
    speaker: string | null;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    className: string;
}) {
    const character = characterId !== null ? characters[characterId] : null;
    const name = character?.name ?? speaker ?? '?';
    const color = characterColor(name, character?.color ?? null, colorMode);
    const style = { '--char': color } as React.CSSProperties;
    const inner = <Highlighted text={text} query={query} />;
    return characterId !== null ? (
        <Link href={`/characters/${characterId}`} className={className} style={style} title={name}>
            {inner}
        </Link>
    ) : (
        <span className={className} style={style} title={name}>
            {inner}
        </span>
    );
}

// One inline segment of a narration paragraph: a colored dialogue run when it
// carries a voice, plain text otherwise, wrapped in <em>/<strong> for styling.
// Segment texts concatenate verbatim to line.text; the markup is presentational.
function Segment({
    seg,
    characters,
    colorMode,
    query,
}: {
    seg: StorySegment;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
}) {
    const hasVoice = seg.characterId != null || !!seg.speaker;
    let node: React.ReactNode = hasVoice ? (
        <DialogueRun
            text={seg.text}
            characterId={seg.characterId ?? null}
            speaker={seg.speaker ?? null}
            characters={characters}
            colorMode={colorMode}
            query={query}
            className={styles.dialogueSpan}
        />
    ) : (
        <Highlighted text={seg.text} query={query} />
    );
    if (seg.bold) node = <strong>{node}</strong>;
    if (seg.italic) node = <em>{node}</em>;
    return <>{node}</>;
}

const Line = memo(function Line({
    line,
    characters,
    colorMode,
    query,
    highlighted,
    format,
    measureRef,
    dataIndex,
    positionStyle,
}: {
    line: SlimLine;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    highlighted: boolean;
    format: StoryData['format'];
    // Wiring for the windowing virtualizer
    measureRef?: (el: HTMLElement | null) => void;
    dataIndex?: number;
    positionStyle?: React.CSSProperties;
}) {
    const [copied, setCopied] = useState(false);

    const copyAnchor = () => {
        const url = `${window.location.origin}${window.location.pathname}?line=${line.no}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    };

    let content: React.ReactNode;
    switch (line.type) {
        case 'ACTION':
            content = (
                <p className={styles.action}>
                    <span aria-hidden>❯ </span>
                    <Highlighted text={line.text} query={query} />
                </p>
            );
            break;
        case 'DIALOGUE': {
            const character = line.characterId !== null ? characters[line.characterId] : null;
            const name = character?.name ?? line.speaker ?? '?';
            const color = characterColor(name, character?.color ?? null, colorMode);
            // Novel-style: colored prose, no "Name:" prefix — speaker read from
            // color + tooltip + the voice legend.
            if (format === 'PROSE') {
                content = (
                    <p className={styles.dialogueProse}>
                        <DialogueRun
                            text={line.text}
                            characterId={line.characterId}
                            speaker={line.speaker}
                            characters={characters}
                            colorMode={colorMode}
                            query={query}
                            className={styles.dialogueSpan}
                        />
                    </p>
                );
                break;
            }
            content = (
                <p className={styles.dialogue} style={{ '--char': color } as React.CSSProperties}>
                    {line.characterId !== null ? (
                        <Link href={`/characters/${line.characterId}`} className={styles.dialogueName}>
                            {name}:
                        </Link>
                    ) : (
                        <span className={styles.dialogueName}>{name}:</span>
                    )}{' '}
                    <Highlighted text={line.text} query={query} />
                </p>
            );
            break;
        }
        case 'TRANSCRIPT':
            content = (
                <div className={styles.vcomm}>
                    <p className='pixel-label'>⌁ vcomm broadcast fragment ⌁</p>
                    {line.text.split(/\n{2,}/).map((paragraph, i) => (
                        <p key={i}>
                            <Highlighted text={paragraph} query={query} />
                        </p>
                    ))}
                </div>
            );
            break;
        case 'BREAK':
            content = (
                <p className={styles.sceneBreak} aria-hidden>
                    ✦ ✦ ✦
                </p>
            );
            break;
        case 'HEADING':
            // In-chapter section heading (prose sub-sections). Sits under the
            // page's <h1> chapter title.
            content = (
                <h2 className={styles.heading}>
                    <Highlighted text={line.text} query={query} />
                </h2>
            );
            break;
        default:
            // NARRATION — long-form prose. When the paragraph carries segment
            // annotations, render it as one block with colored dialogue spans
            // and inline styling; the spans concatenate verbatim to line.text.
            if (line.segments && line.segments.length > 0) {
                content = (
                    <p className={styles.narration}>
                        {line.segments.map((seg, i) => (
                            <Segment
                                key={i}
                                seg={seg}
                                characters={characters}
                                colorMode={colorMode}
                                query={query}
                            />
                        ))}
                    </p>
                );
                break;
            }
            content = (
                <p className={styles.narration}>
                    <Highlighted text={line.text} query={query} />
                </p>
            );
    }

    return (
        <div
            ref={measureRef}
            data-index={dataIndex}
            id={`m-${line.no}`}
            className={styles.line}
            style={positionStyle}
            data-target={highlighted || undefined}
        >
            {content}
            <button
                type='button'
                className={styles.anchor}
                onClick={copyAnchor}
                aria-label={`Copy link to line ${line.no}`}
                title='Copy link to this line'
            >
                {copied ? '✓' : '#'}
            </button>
        </div>
    );
});

export default function StoryReader({ data, canDelete = false }: { data: StoryData; canDelete?: boolean }) {
    const { colorMode } = useTheme();
    const searchParams = useSearchParams();

    // line.no → row index for scrollToIndex (1:1 for stories)
    const noToIndex = useMemo(() => {
        const map = new Map<number, number>();
        data.lines.forEach((line, i) => map.set(line.no, i));
        return map;
    }, [data.lines]);

    // ── Windowing over the page scroll ────────────────────────────────────
    const listRef = useRef<HTMLDivElement>(null);
    // In state (not a ref) so the virtualizer re-renders once it's measured.
    const [scrollMargin, setScrollMargin] = useState(0);
    useEffect(() => {
        const el = listRef.current;
        if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    }, [data.lines.length]);
    const virtualizer = useWindowVirtualizer({
        count: data.lines.length,
        estimateSize: () => 80,
        overscan: 8,
        gap: 14, // was the flex `gap: 0.9rem` on .prose
        scrollMargin,
        initialRect: { width: 1280, height: 900 },
    });

    const jumpToNo = useCallback(
        (no: number) => {
            const index = noToIndex.get(no);
            if (index === undefined) return false;
            // Always an instant jump: react-virtual can't smooth-scroll to a
            // dynamically-measured row (off-screen heights are only estimates,
            // so a smooth animation never converges). Instant find-next also
            // matches native browser find behavior.
            virtualizer.scrollToIndex(index, { align: 'center' });
            // First scroll uses size estimates; re-issue once the target has
            // mounted and measured so we land exactly on it.
            requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'center' }));
            return true;
        },
        [noToIndex, virtualizer]
    );
    useEffect(() => {
        registerScroller(jumpToNo);
        return () => clearScroller(jumpToNo);
    }, [jumpToNo]);

    const lineParam = searchParams.get('line');
    const targetNo = lineParam ? parseInt(lineParam) : null;
    useEffect(() => {
        if (targetNo !== null && !Number.isNaN(targetNo)) {
            requestAnimationFrame(() => scrollToMessage(targetNo, false));
        }
    }, [targetNo]);

    const scan = useScan(data.lines);
    const items = virtualizer.getVirtualItems();

    // Novel-style stories don't print speaker names inline, so a legend keys
    // the dialogue colors to their characters.
    const voices = data.format === 'PROSE' ? collectVoices(data) : [];

    return (
        <div>
            <ScanBar scan={scan} />
            {voices.length > 0 && (
                <ul className={styles.legend} aria-label='Voices in this chapter'>
                    {voices.map((voice) => {
                        const character = voice.characterId !== null ? data.characters[voice.characterId] : null;
                        const color = characterColor(voice.name, character?.color ?? null, colorMode);
                        const style = { '--char': color } as React.CSSProperties;
                        return (
                            <li key={voice.name}>
                                {voice.characterId !== null ? (
                                    <Link
                                        href={`/characters/${voice.characterId}`}
                                        className={styles.legendChip}
                                        style={style}
                                    >
                                        {voice.name}
                                    </Link>
                                ) : (
                                    <span className={styles.legendChip} style={style}>
                                        {voice.name}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            <div
                ref={listRef}
                className={styles.prose}
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
                {items.map((vi) => {
                    const line = data.lines[vi.index];
                    return (
                        <Line
                            key={line.no}
                            line={line}
                            characters={data.characters}
                            colorMode={colorMode}
                            query={scan.activeQuery}
                            highlighted={line.no === targetNo || line.no === scan.currentMatchNo}
                            format={data.format}
                            measureRef={virtualizer.measureElement}
                            dataIndex={vi.index}
                            positionStyle={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
