'use client';

import Link from 'next/link';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import { useTheme, type ColorMode } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import { imageSrc } from '@/lib/images';
import { collectVoices, npcRuns, type NpcRun, type SlimLine, type StoryData } from '@/lib/stories';
import type { StorySegment } from '@/lib/types';
import { Highlighted, ScanBar, scrollToMessage, useScan } from '@/components/transcript/ScanBar';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import DeleteStoryButton from './DeleteStoryButton';
import VoiceNamePopover from './VoiceNamePopover';
import styles from './story.module.scss';

// An import preview (`/import`, before publishing): character names don't
// link, since leaving the page would lose the unsaved import, and there are
// no line anchors or NPC naming (the story isn't on the server yet).
const PreviewContext = createContext(false);

function CharacterLink({
    characterId,
    slug,
    className,
    style,
    title,
    children,
}: {
    characterId: number;
    /** Links use the slug; the id is only a fallback for a character without one */
    slug?: string;
    className: string;
    style?: React.CSSProperties;
    title?: string;
    children: React.ReactNode;
}) {
    const preview = useContext(PreviewContext);
    return preview ? (
        <span className={className} style={style} title={title}>
            {children}
        </span>
    ) : (
        <Link href={`/characters/${slug ?? characterId}`} className={className} style={style} title={title}>
            {children}
        </Link>
    );
}

/** Opens the namer for the NPC quote at this line (and segment, for a span), anchored to `el`. */
type NameHandler = (lineNo: number, segment: number | null, el: HTMLElement) => void;

// Stories read as prose: NARRATION is narrator voice, ACTION is a command the
// protagonist (or the readers, in a CYOA) chose, DIALOGUE is a character
// speaking, TRANSCRIPT is an in-universe recording fragment, BREAK is a
// scene break.

// Voices with no linked character (an ambiguous "?", a ship's computer) aren't
// anyone with a color of their own, so they read in neutral grey.
function voiceColor(
    characterId: number | null,
    name: string,
    character: { color?: string | null; colorLight?: string | null } | null,
    colorMode: ColorMode,
): string {
    return characterId === null
        ? 'var(--text-muted)'
        : characterColor(name, character?.color ?? null, colorMode, character?.colorLight ?? null);
}

// An NPC voice has no character page, so its name is a tooltip instead
// (`help` cursor). Story authors and admins can click one to name it.
function NpcRunText({
    text,
    speaker,
    query,
    className,
    style,
    onName,
}: {
    text: string;
    speaker: string | null;
    query: string | null;
    className: string;
    style: React.CSSProperties;
    onName?: (el: HTMLElement) => void;
}) {
    const inner = <Highlighted text={text} query={query} />;
    const classes = `${className} ${styles.npcVoice} ${speaker ? '' : styles.npcUnnamed} ${onName ? styles.npcEditable : ''}`;
    if (!onName) {
        return (
            <span className={classes} style={style} title={speaker ?? 'An unnamed NPC'}>
                {inner}
            </span>
        );
    }
    return (
        <span
            role='button'
            tabIndex={0}
            className={classes}
            style={style}
            title={speaker ? `${speaker} (click to rename)` : "Who's speaking? Click to name this NPC"}
            onClick={(e) => onName(e.currentTarget)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onName(e.currentTarget);
                }
            }}
        >
            {inner}
        </span>
    );
}

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
    npc = false,
    onName,
}: {
    text: string;
    characterId: number | null;
    speaker: string | null;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    className: string;
    npc?: boolean;
    onName?: (el: HTMLElement) => void;
}) {
    const character = characterId !== null ? characters[characterId] : null;
    const name = character?.name ?? speaker ?? '?';
    const color = voiceColor(characterId, name, character, colorMode);
    const style = { '--char': color } as React.CSSProperties;
    if (npc) {
        return <NpcRunText text={text} speaker={speaker} query={query} className={className} style={style} onName={onName} />;
    }
    const inner = <Highlighted text={text} query={query} />;
    return characterId !== null ? (
        <CharacterLink characterId={characterId} slug={character?.slug} className={className} style={style} title={name}>
            {inner}
        </CharacterLink>
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
    onName,
}: {
    seg: StorySegment;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    onName?: (el: HTMLElement) => void;
}) {
    const hasVoice = seg.characterId != null || !!seg.speaker || !!seg.npc;
    let node: React.ReactNode = hasVoice ? (
        <DialogueRun
            text={seg.text}
            characterId={seg.characterId ?? null}
            speaker={seg.speaker ?? null}
            characters={characters}
            colorMode={colorMode}
            query={query}
            className={styles.dialogueSpan}
            npc={!!seg.npc}
            onName={seg.npc ? onName : undefined}
        />
    ) : (
        <Highlighted text={seg.text} query={query} />
    );
    if (seg.bold) node = <strong>{node}</strong>;
    if (seg.italic) node = <em>{node}</em>;
    return <>{node}</>;
}

function speakerHeads(line: SlimLine, characters: StoryData['characters']) {
    const ids: number[] = [];
    const add = (id: number | null | undefined, npc?: boolean) => {
        if (id != null && !npc && characters[id] && !ids.includes(id)) ids.push(id);
    };
    if (line.type === 'DIALOGUE') add(line.characterId, line.npcVoice);
    else if (line.type === 'NARRATION') line.segments?.forEach((seg) => add(seg.characterId, seg.npc));
    return ids.map((id) => ({ id, character: characters[id] }));
}

const Line = memo(function Line({
    line,
    characters,
    colorMode,
    query,
    highlighted,
    format,
    onName,
}: {
    line: SlimLine;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    highlighted: boolean;
    format: StoryData['format'];
    onName?: NameHandler;
}) {
    const [copied, setCopied] = useState(false);
    const preview = useContext(PreviewContext);

    const copyAnchor = () => {
        const url = `${window.location.origin}${window.location.pathname}?line=${line.no}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    };

    const heads = speakerHeads(line, characters);

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
            const color = voiceColor(line.characterId, name, character, colorMode);
            const nameLine = line.npcVoice && onName ? (el: HTMLElement) => onName(line.no, null, el) : undefined;
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
                            npc={line.npcVoice}
                            onName={nameLine}
                        />
                    </p>
                );
                break;
            }
            content = (
                <p className={styles.dialogue} style={{ '--char': color } as React.CSSProperties}>
                    {line.characterId !== null ? (
                        <CharacterLink characterId={line.characterId} slug={character?.slug} className={styles.dialogueName}>
                            {name}:
                        </CharacterLink>
                    ) : line.npcVoice ? (
                        <>
                            <NpcRunText
                                text={line.speaker ?? 'unnamed'}
                                speaker={line.speaker}
                                query={null}
                                className={styles.dialogueName}
                                style={{}}
                                onName={nameLine}
                            />
                            :
                        </>
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
        case 'IMAGE':
            // A booru post (through the image proxy), or a data: URL in an import preview
            content = line.imageUrl ? (
                <figure className={styles.picture}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- booru size unknown; proxied */}
                    <img src={imageSrc(line.imageUrl)} alt={line.text} loading='lazy' />
                </figure>
            ) : (
                <p className={styles.picturePending}>▣ picture{line.text ? `: ${line.text}` : ''}</p>
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
                                onName={onName ? (el) => onName(line.no, i, el) : undefined}
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
            id={`m-${line.no}`}
            className={styles.line}
            data-target={highlighted || undefined}
            style={{ '--heads': heads.length } as React.CSSProperties}
        >
            {heads.length > 0 && (
                <div className={styles.heads}>
                    {heads.map(({ id, character }) => (
                        <CharacterLink key={id} characterId={id} slug={character.slug} className={styles.head} title={character.name}>
                            <PixelAvatar
                                src={character.image}
                                name={character.name}
                                color={voiceColor(id, character.name, character, colorMode)}
                                size={32}
                            />
                        </CharacterLink>
                    ))}
                </div>
            )}
            {content}
            {!preview && (
                <button
                    type='button'
                    className={styles.anchor}
                    onClick={copyAnchor}
                    aria-label={`Copy link to line ${line.no}`}
                    title='Copy link to this line'
                >
                    {copied ? '✓' : '#'}
                </button>
            )}
        </div>
    );
});

interface Editing {
    run: NpcRun;
    anchor: HTMLElement;
}

export default function StoryReader({
    data,
    canDelete = false,
    authorIds = [],
    preview = false,
}: {
    data: StoryData;
    canDelete?: boolean;
    /** the story's authors, who (with admins) may name its NPC voices */
    authorIds?: number[];
    /** an unpublished import: no character links, line anchors or NPC naming */
    preview?: boolean;
}) {
    const { colorMode } = useTheme();
    const { user } = useSession();
    const searchParams = useSearchParams();
    const canNameVoices = !preview && !!user && (user.role === 'ADMIN' || authorIds.includes(user.id));

    // NPC names given in this visit, by line number; reset on another chapter
    const chapterKey = `${data.storySlug}#${data.chapterNo}`;
    const [named, setNamed] = useState<{ key: string; lines: Record<number, Pick<SlimLine, 'speaker' | 'segments'>> }>({
        key: chapterKey,
        lines: {},
    });
    const lines = useMemo(() => {
        const overrides = named.key === chapterKey ? named.lines : {};
        return data.lines.map((line) => (overrides[line.no] ? { ...line, ...overrides[line.no] } : line));
    }, [data.lines, named, chapterKey]);
    const runs = useMemo(() => npcRuns(lines), [lines]);
    const [editing, setEditing] = useState<Editing | null>(null);

    const openNamer = useCallback<NameHandler>(
        (lineNo, segment, el) => {
            const run = runs.find(
                (r) => r.lineNo === lineNo && (segment === null ? r.segments === null : r.segments?.includes(segment))
            );
            if (run) setEditing({ run, anchor: el });
        },
        [runs]
    );

    const closeNamer = useCallback(() => setEditing(null), []);

    const applyUpdated = (updated: { lineNo: number; speaker: string | null; segments: StorySegment[] | null }[]) =>
        setNamed((prev) => {
            const base = prev.key === chapterKey ? prev.lines : {};
            const next = { ...base };
            for (const u of updated) next[u.lineNo] = { speaker: u.speaker, segments: u.segments };
            return { key: chapterKey, lines: next };
        });

    const lineParam = searchParams.get('line');
    const targetNo = lineParam ? parseInt(lineParam) : null;
    useEffect(() => {
        if (targetNo !== null && !Number.isNaN(targetNo)) {
            requestAnimationFrame(() => scrollToMessage(targetNo, false));
        }
    }, [targetNo]);

    const scan = useScan(data.lines);

    // Novel-style stories don't print speaker names inline, so a legend keys
    // the dialogue colors to their characters.
    const voices = data.format === 'PROSE' ? collectVoices({ ...data, lines }) : [];

    return (
        <PreviewContext.Provider value={preview}>
            <div>
                <ScanBar scan={scan} />
                {voices.length > 0 && (
                    <ul className={styles.legend} aria-label='Voices in this chapter'>
                        {voices.map((voice) => {
                            const character = voice.characterId !== null ? data.characters[voice.characterId] : null;
                            const color = voiceColor(voice.characterId, voice.name, character, colorMode);
                            const style = { '--char': color } as React.CSSProperties;
                            return (
                                <li key={voice.name}>
                                    {voice.characterId !== null ? (
                                        <CharacterLink
                                            characterId={voice.characterId}
                                            slug={character?.slug}
                                            className={styles.legendChip}
                                            style={style}
                                        >
                                            {voice.name}
                                        </CharacterLink>
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
                <div className={styles.prose}>
                    {lines.map((line) => (
                        <Line
                            key={line.no}
                            line={line}
                            characters={data.characters}
                            colorMode={colorMode}
                            query={scan.activeQuery}
                            highlighted={line.no === targetNo || line.no === scan.currentMatchNo}
                            format={data.format}
                            onName={canNameVoices ? openNamer : undefined}
                        />
                    ))}
                </div>
                {editing && (
                    <VoiceNamePopover
                        key={`${editing.run.lineNo}-${editing.run.segments?.[0] ?? 'line'}`}
                        storySlug={data.storySlug}
                        chapterNo={data.chapterNo}
                        run={editing.run}
                        anchor={editing.anchor}
                        runs={runs}
                        suggestions={voices.filter((v) => v.characterId === null).map((v) => v.name)}
                        onSaved={applyUpdated}
                        onClose={closeNamer}
                    />
                )}
            </div>
        </PreviewContext.Provider>
    );
}
