'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './storyImporter.module.scss';

// Optional step between "Convert" and "Upload": name the story's unnamed NPC
// voices (a color several NPCs share — gray #666666, usually) one quote at a
// time, reading each in its paragraph. Anything left blank uploads unnamed and
// can be named later in the story reader by an author or admin.

interface Segment {
    text: string;
    speaker?: string;
    npc?: boolean;
}

interface Line {
    type: string;
    text: string;
    speaker?: string;
    npcVoice?: boolean;
    segments?: Segment[];
}

export interface NamerChapter {
    chapter_no: number;
    title?: string | null;
    lines: Line[];
}

/** One NPC quote: a whole npcVoice line, or a run of adjacent npc segments in a paragraph. */
interface Fragment {
    chapter: number; // index into chapters
    line: number; // index into lines
    segments: number[] | null; // null = the whole (DIALOGUE) line
    name: string;
}

/** Every NPC quote in reading order; adjacent npc segments (one span split by emphasis) are one quote. */
export function npcFragments(chapters: NamerChapter[]): Fragment[] {
    const out: Fragment[] = [];
    chapters.forEach((chapter, ci) =>
        chapter.lines.forEach((line, li) => {
            if (line.npcVoice) out.push({ chapter: ci, line: li, segments: null, name: line.speaker ?? '' });
            let run: number[] = [];
            const flush = () => {
                if (run.length > 0) {
                    const segs = line.segments!;
                    out.push({ chapter: ci, line: li, segments: run, name: segs[run[0]].speaker ?? '' });
                }
                run = [];
            };
            (line.segments ?? []).forEach((seg, si) => {
                if (seg.npc) run.push(si);
                else flush();
            });
            flush();
        })
    );
    return out;
}

/** The chapters with these names written onto their NPC quotes (blank = unnamed). */
function applyNames(chapters: NamerChapter[], fragments: Fragment[]): NamerChapter[] {
    const next: NamerChapter[] = structuredClone(chapters);
    for (const f of fragments) {
        const line = next[f.chapter].lines[f.line];
        const name = f.name.trim();
        if (f.segments === null) {
            if (name) line.speaker = name;
            else delete line.speaker;
            continue;
        }
        for (const si of f.segments) {
            if (name) line.segments![si].speaker = name;
            else delete line.segments![si].speaker;
        }
    }
    return next;
}

function tail(text: string, max = 180): string {
    return text.length > max ? `…${text.slice(text.length - max)}` : text;
}

export default function NpcVoiceNamer({
    chapters,
    knownNames,
    onApply,
    onClose,
}: {
    chapters: NamerChapter[];
    /** names to suggest besides the ones typed here */
    knownNames: string[];
    onApply: (chapters: NamerChapter[]) => void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const [fragments, setFragments] = useState<Fragment[]>(() => npcFragments(chapters));

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    const setName = (i: number, name: string) =>
        setFragments((prev) => prev.map((f, j) => (j === i ? { ...f, name } : f)));

    // Enter: carry this name to the next quote if it's still blank, and move there
    // (speakers cluster by scene, so the next quote is usually the same NPC).
    const advance = (i: number) => {
        const name = fragments[i].name.trim();
        if (i + 1 >= fragments.length) return;
        if (name && !fragments[i + 1].name.trim()) setName(i + 1, name);
        inputs.current[i + 1]?.focus();
        inputs.current[i + 1]?.scrollIntoView({ block: 'center' });
    };

    const suggestions = useMemo(
        () => [...new Set([...fragments.map((f) => f.name.trim()).filter(Boolean), ...knownNames])].sort(),
        [fragments, knownNames]
    );
    const named = fragments.filter((f) => f.name.trim()).length;

    return (
        <dialog ref={dialog} className={`pixel-panel ${styles.namer}`} onClose={onClose} aria-labelledby='npc-namer-heading'>
            <header className={styles.namerHeader}>
                <h2 className='pixel-label' id='npc-namer-heading'>
                    name the npc voices
                </h2>
                <p className={styles.hint}>
                    {named} of {fragments.length} named. Enter copies a name to the next quote and moves there. Leave any
                    blank: it uploads unnamed, and an author or admin can name it while reading.
                </p>
            </header>
            <datalist id='npc-names'>
                {suggestions.map((n) => (
                    <option key={n} value={n} />
                ))}
            </datalist>
            <ol className={styles.namerList}>
                {fragments.map((f, i) => {
                    const chapter = chapters[f.chapter];
                    const line = chapter.lines[f.line];
                    const prev = f.line > 0 ? chapter.lines[f.line - 1] : null;
                    const quoteId = `npc-quote-${i}`;
                    return (
                        <li key={`${f.chapter}-${f.line}-${f.segments?.[0] ?? 'line'}`} className={styles.namerRow}>
                            <div className={styles.namerContext}>
                                {prev && prev.text && <p className={styles.namerPrev}>{tail(prev.text)}</p>}
                                <p>
                                    {f.segments === null ? (
                                        <mark id={quoteId}>{line.text}</mark>
                                    ) : (
                                        (line.segments ?? []).map((seg, si) =>
                                            f.segments!.includes(si) ? (
                                                <mark key={si} id={si === f.segments![0] ? quoteId : undefined}>
                                                    {seg.text}
                                                </mark>
                                            ) : (
                                                <span key={si} className={seg.npc ? styles.namerOtherNpc : undefined}>
                                                    {seg.text}
                                                </span>
                                            )
                                        )
                                    )}
                                </p>
                            </div>
                            <div className={styles.namerPick}>
                                <input
                                    ref={(el) => {
                                        inputs.current[i] = el;
                                    }}
                                    list='npc-names'
                                    value={f.name}
                                    maxLength={80}
                                    placeholder='unnamed'
                                    aria-describedby={quoteId}
                                    aria-label={`speaker of quote ${i + 1}`}
                                    onChange={(e) => setName(i, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            advance(i);
                                        }
                                    }}
                                />
                                {i > 0 && (
                                    <button
                                        type='button'
                                        className={styles.namerSame}
                                        onClick={() => setName(i, fragments[i - 1].name)}
                                        title='Same speaker as the quote above'
                                    >
                                        ↑ same
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
            <footer className={styles.actions}>
                <button
                    type='button'
                    className={styles.upload}
                    onClick={() => {
                        onApply(applyNames(chapters, fragments));
                        dialog.current?.close();
                    }}
                >
                    Use these names
                </button>
                <button type='button' className={styles.namerCancel} onClick={() => dialog.current?.close()}>
                    Cancel
                </button>
            </footer>
        </dialog>
    );
}
