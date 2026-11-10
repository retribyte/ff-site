'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NpcRun } from '@/lib/stories';
import type { StoryLine } from '@/lib/types';
import { findVoiceOption, loadVoiceOptions, type VoiceOption } from '@/lib/voiceOptions';
import styles from './story.module.scss';

// Re-voices one NPC quote in the reader (PATCH /stories/:slug/voices): another
// NPC name (an NPC persona, found or created), and optionally the next few
// quotes the same NPC speaks in the chapter, since a placeholder voice usually
// covers a stretch of a scene. Only the story's authors and admins see it.
// They can instead give the quote to a character from the archive, or a
// character as one of its personas: it stops being an NPC voice (ff-server
// records that in the admin History).

type Updated = StoryLine;

const WIDTH = 300; // px, matches .namePopover

export default function VoiceNamePopover({
    storySlug,
    chapterNo,
    run,
    anchor,
    runs,
    suggestions,
    onSaved,
    onClose,
}: {
    storySlug: string;
    chapterNo: number;
    run: NpcRun;
    /** the quote's element; the panel follows it on scroll/resize */
    anchor: HTMLElement;
    /** every NPC quote in the chapter, in reading order */
    runs: NpcRun[];
    suggestions: string[];
    onSaved: (updated: Updated[]) => void;
    onClose: () => void;
}) {
    const panel = useRef<HTMLFormElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const [name, setName] = useState(run.speaker ?? '');
    const [alsoNext, setAlsoNext] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const router = useRouter();
    const [linkCharacter, setLinkCharacter] = useState(false);
    const [characters, setCharacters] = useState<VoiceOption[] | null>(null);

    useEffect(() => {
        if (!linkCharacter || characters) return;
        loadVoiceOptions()
            .then(setCharacters)
            .catch(() => setCharacters([]));
    }, [linkCharacter, characters]);
    const linkedCharacter = linkCharacter && characters ? findVoiceOption(characters, name) : null;

    // later quotes in the chapter by the same NPC (or, for an unnamed one, other unnamed ones)
    const sameSpeaker = (r: NpcRun) => (r.speaker ?? '').toLowerCase() === (run.speaker ?? '').toLowerCase();
    const nextSame = useMemo(() => {
        const at = runs.findIndex((r) => r.lineNo === run.lineNo && r.segments?.[0] === run.segments?.[0]);
        return runs.slice(at + 1).filter(sameSpeaker);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sameSpeaker only reads run
    }, [runs, run]);

    const names = useMemo(
        () => [...new Set([...runs.map((r) => r.speaker).filter((n): n is string => !!n), ...suggestions])].sort(),
        [runs, suggestions]
    );

    // Follow the quote and stay on screen: below it, or above it near the bottom edge
    useLayoutEffect(() => {
        const place = () => {
            const rect = anchor.getBoundingClientRect();
            const height = panel.current?.offsetHeight ?? 160;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8));
            const below = rect.bottom + 6;
            const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
            setPosition({ top, left });
        };
        place();
        window.addEventListener('scroll', place, { passive: true });
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('scroll', place);
            window.removeEventListener('resize', place);
        };
    }, [anchor]);

    useEffect(() => {
        input.current?.focus();
        input.current?.select();
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        // a press outside closes it, except on the quote itself (its click reopens it)
        const onDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (panel.current && !panel.current.contains(target) && !anchor.contains(target)) onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onDown);
        };
    }, [onClose, anchor]);

    const assignmentsFor = (r: NpcRun, speaker: string | null, character: VoiceOption | null) => {
        const voice = character ? { characterId: character.characterId, personaId: character.personaId } : { speaker };
        return r.segments === null
            ? [{ chapterNo, lineNo: r.lineNo, ...voice }]
            : r.segments.map((segment) => ({ chapterNo, lineNo: r.lineNo, segment, ...voice }));
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (linkCharacter && !linkedCharacter) {
            setError(`No character (or character as persona) named '${name.trim()}'`);
            return;
        }
        const speaker = name.trim() || null;
        if (!speaker) return;
        const targets = [run, ...nextSame.slice(0, alsoNext)];
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/site/ff/stories/${encodeURIComponent(storySlug)}/voices`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignments: targets.flatMap((r) => assignmentsFor(r, speaker, linkedCharacter)),
                }),
            });
            const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: Updated[] } | null;
            if (!res.ok || envelope?.status === 'error') throw new Error(envelope?.message ?? `HTTP ${res.status}`);
            // The reader keeps the lines changed in this visit, so it always
            // gets the new ones: a line renamed earlier would otherwise go on
            // showing that name over whatever the server sends next.
            onSaved(envelope?.data ?? []);
            // A character's line also needs that character (color, link,
            // legend), which only the server render carries
            if (linkedCharacter) router.refresh();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The lore server is not answering.');
            setBusy(false);
        }
    };

    return (
        <form
            ref={panel}
            className={`pixel-panel ${styles.namePopover}`}
            style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}
            onSubmit={save}
            role='dialog'
            aria-label='Change who speaks this NPC quote'
        >
            <label className={styles.namePopoverField}>
                <span className='pixel-label'>who&rsquo;s speaking?</span>
                <input
                    ref={input}
                    list={linkCharacter ? 'story-character-names' : 'story-npc-names'}
                    value={name}
                    maxLength={80}
                    placeholder={linkCharacter ? 'a character, or "Vec as Sascha"' : 'an NPC name, e.g. Llamanian Guard'}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                />
            </label>
            <datalist id='story-npc-names'>
                {names.map((n) => (
                    <option key={n} value={n} />
                ))}
            </datalist>
            <label className={styles.namePopoverCheck}>
                <input
                    type='checkbox'
                    checked={linkCharacter}
                    onChange={(e) => {
                        setLinkCharacter(e.target.checked);
                        setError(null);
                    }}
                    disabled={busy}
                />
                a character in the archive, or one as a persona (it stops being an NPC voice)
            </label>
            <datalist id='story-character-names'>
                {(characters ?? []).map((c) => (
                    <option key={c.label} value={c.label} />
                ))}
            </datalist>
            {nextSame.length > 0 && (
                <label className={styles.namePopoverNext}>
                    also the next
                    <input
                        type='number'
                        min={0}
                        max={nextSame.length}
                        value={alsoNext}
                        onChange={(e) => setAlsoNext(Math.max(0, Math.min(nextSame.length, parseInt(e.target.value) || 0)))}
                        disabled={busy || !name.trim()}
                        aria-label={`How many of the following quotes by ${run.speaker ?? 'this NPC'} change too`}
                    />
                    of {nextSame.length} later quote{nextSame.length === 1 ? '' : 's'} by {run.speaker ?? 'unnamed NPCs'} in this
                    chapter
                </label>
            )}
            {error && (
                <p className={styles.namePopoverError} role='alert'>
                    ✖ {error}
                </p>
            )}
            <div className={styles.namePopoverActions}>
                <button type='submit' disabled={busy || (linkCharacter && !characters) || !name.trim()}>
                    {busy ? 'saving…' : linkCharacter ? 'Link character' : 'Save'}
                </button>
                <button type='button' onClick={onClose} disabled={busy}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
