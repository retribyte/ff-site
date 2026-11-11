'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { findVoiceOption, type VoiceOption } from '@/lib/voiceOptions';
import styles from './storyImporter.module.scss';

// Step between "Convert" and "Upload": name the story's NPC voices (a color
// several NPCs share, gray #666666 usually) one quote at a time, reading each
// in its paragraph. Each name is an NPC persona (found or created on upload).
// "@Name" gives the quote to a character from the archive instead, and
// "@Name as Persona" to a character as one of its personas. Every quote needs
// one before the story can upload.

/** A quote given to a character (a client-side mark; the upload turns it into ids) */
export interface AssignedVoice {
    characterId: number;
    personaId: number | null;
    label: string;
}

interface Segment {
    text: string;
    speaker?: string;
    npc?: boolean;
    voice?: AssignedVoice;
}

interface Line {
    type: string;
    text: string;
    speaker?: string;
    npcVoice?: boolean;
    voice?: AssignedVoice;
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

/** What a fragment's input shows: "@label" for a character, else the NPC name */
const nameOf = (f: { speaker?: string; voice?: AssignedVoice }) => (f.voice ? `@${f.voice.label}` : (f.speaker ?? ''));

/** Every NPC quote in reading order; adjacent npc segments (one span split by emphasis) are one quote. */
export function npcFragments(chapters: NamerChapter[]): Fragment[] {
    const out: Fragment[] = [];
    chapters.forEach((chapter, ci) =>
        chapter.lines.forEach((line, li) => {
            if (line.npcVoice) out.push({ chapter: ci, line: li, segments: null, name: nameOf(line) });
            let run: number[] = [];
            const flush = () => {
                if (run.length > 0) {
                    const segs = line.segments!;
                    out.push({ chapter: ci, line: li, segments: run, name: nameOf(segs[run[0]]) });
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

/** A typed name that starts with "@" picks a character; null when it names none. */
function characterPick(name: string, options: VoiceOption[]): VoiceOption | null | undefined {
    if (!name.trim().startsWith('@')) return undefined;
    return findVoiceOption(options, name.trim().slice(1));
}

/** Writes a name (or a character, for "@…") onto one quote's line or segment (blank = unnamed). */
function setVoice(target: { speaker?: string; voice?: AssignedVoice }, name: string, options: VoiceOption[]) {
    delete target.speaker;
    delete target.voice;
    const pick = characterPick(name, options);
    if (pick) target.voice = { characterId: pick.characterId, personaId: pick.personaId, label: pick.label };
    else if (pick === undefined && name.trim()) target.speaker = name.trim();
}

/** The chapters with these names written onto their NPC quotes. */
function applyNames(chapters: NamerChapter[], fragments: Fragment[], options: VoiceOption[]): NamerChapter[] {
    const next: NamerChapter[] = structuredClone(chapters);
    for (const f of fragments) {
        const line = next[f.chapter].lines[f.line];
        if (f.segments === null) setVoice(line, f.name, options);
        else for (const si of f.segments) setVoice(line.segments![si], f.name, options);
    }
    return next;
}

function tail(text: string, max = 180): string {
    return text.length > max ? `…${text.slice(text.length - max)}` : text;
}

export default function NpcVoiceNamer({
    chapters,
    knownNames,
    voiceOptions,
    onApply,
    onClose,
}: {
    chapters: NamerChapter[];
    /** names to suggest besides the ones typed here */
    knownNames: string[];
    /** characters (and characters as personas) a quote can be given to with "@" */
    voiceOptions: VoiceOption[];
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
        () => [
            ...[...new Set([...fragments.map((f) => f.name.trim()).filter(Boolean), ...knownNames])].sort(),
            ...voiceOptions.map((o) => `@${o.label}`),
        ],
        [fragments, knownNames, voiceOptions]
    );
    const named = fragments.filter((f) => f.name.trim()).length;
    const invalid = fragments.filter((f) => characterPick(f.name, voiceOptions) === null).length;

    return (
        <dialog ref={dialog} className={`pixel-panel ${styles.namer}`} onClose={onClose} aria-labelledby='npc-namer-heading'>
            <header className={styles.namerHeader}>
                <h2 className='pixel-label' id='npc-namer-heading'>
                    name the npc voices
                </h2>
                <p className={styles.hint}>
                    {named} of {fragments.length} named. Each name is an NPC (the same name anywhere in the archive is
                    the same NPC). Type @ to give a quote to a character instead, or @Name as Persona. Enter copies a
                    name to the next quote and moves there. Every quote needs a name before the story can upload.
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
                                    aria-invalid={characterPick(f.name, voiceOptions) === null || undefined}
                                    title={characterPick(f.name, voiceOptions) === null ? 'No character by that name' : undefined}
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
                    disabled={invalid > 0}
                    title={invalid > 0 ? `${invalid} quote${invalid === 1 ? '' : 's'} name no character after @` : undefined}
                    onClick={() => {
                        onApply(applyNames(chapters, fragments, voiceOptions));
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
