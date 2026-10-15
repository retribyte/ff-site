'use client';

import { useCallback, useMemo, useState } from 'react';
import styles from './transcript.module.scss';

// In-episode search ("scan"), shared by the transcript and story readers.

export function scrollToMessage(no: number, smooth: boolean) {
    const el = document.getElementById(`m-${no}`);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const offCenter = (target: Element) => {
        const rect = target.getBoundingClientRect();
        return rect.top + rect.height / 2 - window.innerHeight / 2;
    };
    // Inside a skipped (content-visibility: auto) block the message itself
    // reports a bogus rect, so judge distance by the outermost such block
    let box: Element = el;
    for (let a = el.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).contentVisibility === 'auto') box = a;
    }

    // Nearby: a smooth scroll only crosses blocks that are already rendered
    if (smooth && !reduced && Math.abs(offCenter(box)) < window.innerHeight * 2) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Far away: off-screen blocks are content-visibility: auto, laid out at a
    // placeholder height until they render, so one jump lands wherever those
    // estimates said, and blocks rendering around it keep shifting it for a
    // few frames after. Re-center until it holds still for several frames;
    // give up early if the reader starts scrolling on their own.
    let frames = 0;
    let stableFrames = 0;
    let cancelled = false;
    const cancel = () => {
        cancelled = true;
    };
    window.addEventListener('wheel', cancel, { once: true, passive: true });
    window.addEventListener('touchstart', cancel, { once: true, passive: true });
    const settle = () => {
        if (cancelled) return;
        if (frames === 0 || Math.abs(offCenter(el)) > 4) {
            stableFrames = 0;
            el.scrollIntoView({ block: 'center' });
        } else {
            stableFrames++;
        }
        if (stableFrames < 5 && ++frames < 40) {
            requestAnimationFrame(settle);
        } else {
            window.removeEventListener('wheel', cancel);
            window.removeEventListener('touchstart', cancel);
        }
    };
    settle();
}

export interface Scan {
    /** What's typed in the bar — not searched until submitted */
    query: string;
    setQuery: (q: string) => void;
    /** Run the typed query, or step to the next/previous hit if it already ran */
    submit: (direction?: 1 | -1) => void;
    clear: () => void;
    matches: number[];
    matchIndex: number;
    jumpToMatch: (direction: 1 | -1) => void;
    /** Normalized submitted query when long enough to scan, else null */
    activeQuery: string | null;
    /** messageNo of the current match, else null */
    currentMatchNo: number | null;
}

const MIN_QUERY_LENGTH = 2;

function findMatches(messages: { no: number; text: string }[], query: string): number[] {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) return [];
    return messages.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m.no);
}

// Scanning runs on submit (Enter / the ❯ button), not per keystroke — a long
// transcript re-filtered and re-highlighted on every key was laggy.
export function useScan(messages: { no: number; text: string }[]): Scan {
    const [query, setQueryState] = useState('');
    const [submitted, setSubmitted] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);

    const matches = useMemo(() => findMatches(messages, submitted), [messages, submitted]);

    const jumpToMatch = useCallback(
        (direction: 1 | -1) => {
            if (matches.length === 0) return;
            const wrapped = (((matchIndex + direction) % matches.length) + matches.length) % matches.length;
            setMatchIndex(wrapped);
            scrollToMessage(matches[wrapped], true);
        },
        [matches, matchIndex]
    );

    const submit = useCallback(
        (direction: 1 | -1 = 1) => {
            const trimmed = query.trim();
            if (trimmed === submitted.trim()) {
                jumpToMatch(direction);
                return;
            }
            setSubmitted(trimmed);
            const next = findMatches(messages, trimmed);
            const first = direction === 1 ? 0 : Math.max(next.length - 1, 0);
            setMatchIndex(first);
            if (next.length > 0) scrollToMessage(next[first], true);
        },
        [query, submitted, messages, jumpToMatch]
    );

    const clear = useCallback(() => {
        setQueryState('');
        setSubmitted('');
        setMatchIndex(0);
    }, []);

    // Emptying the box (typing it away, or the native search ✕) drops the hits
    const setQuery = useCallback(
        (q: string) => {
            if (q === '') clear();
            else setQueryState(q);
        },
        [clear]
    );

    const activeQuery = submitted.length >= MIN_QUERY_LENGTH ? submitted : null;
    return {
        query,
        setQuery,
        submit,
        clear,
        matches,
        matchIndex,
        jumpToMatch,
        activeQuery,
        currentMatchNo: activeQuery && matches.length > 0 ? matches[matchIndex] : null,
    };
}

export function ScanBar({ scan }: { scan: Scan }) {
    const { query, setQuery, submit, clear, matches, matchIndex, jumpToMatch, activeQuery } = scan;

    return (
        <form
            className={styles.scanBar}
            // Sticky only while there's a term to step through
            data-active={query.trim() !== '' || undefined}
            role='search'
            onSubmit={(e) => {
                e.preventDefault();
                submit(1);
            }}
        >
            <span className={styles.scanPrompt} aria-hidden>
                ❯
            </span>
            <input
                type='search'
                className={styles.scanInput}
                placeholder='scan transcript…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        submit(-1);
                    }
                    if (e.key === 'Escape') clear();
                }}
                aria-label='Search within this transcript'
            />
            {activeQuery && (
                <span className={styles.scanStatus}>
                    {matches.length === 0 ? 'no hits' : `${matchIndex + 1}/${matches.length}`}
                </span>
            )}
            <button
                type='submit'
                className={styles.scanButton}
                disabled={query.trim().length < MIN_QUERY_LENGTH}
                aria-label='Search'
                title='Search (Enter)'
            >
                ❯
            </button>
            <button
                type='button'
                className={styles.scanButton}
                onClick={() => jumpToMatch(-1)}
                disabled={matches.length === 0}
                aria-label='Previous match'
                title='Previous match (Shift+Enter)'
            >
                ▲
            </button>
            <button
                type='button'
                className={styles.scanButton}
                onClick={() => jumpToMatch(1)}
                disabled={matches.length === 0}
                aria-label='Next match'
                title='Next match (Enter)'
            >
                ▼
            </button>
        </form>
    );
}

/** Wraps search hits in <mark>; safe because we only ever render text nodes. */
export function Highlighted({ text, query }: { text: string; query: string | null }) {
    if (!query) return <>{text}</>;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    if (!lower.includes(q)) return <>{text}</>;

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let hit = lower.indexOf(q);
    while (hit !== -1) {
        if (hit > cursor) parts.push(text.slice(cursor, hit));
        parts.push(<mark key={hit}>{text.slice(hit, hit + q.length)}</mark>);
        cursor = hit + q.length;
        hit = lower.indexOf(q, cursor);
    }
    parts.push(text.slice(cursor));
    return <>{parts}</>;
}
