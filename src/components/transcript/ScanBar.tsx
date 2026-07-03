'use client';

import { useCallback, useMemo, useState } from 'react';
import styles from './transcript.module.scss';

// In-episode search ("scan"), shared by the transcript and CYOA readers.

export function scrollToMessage(no: number, smooth: boolean) {
    const el = document.getElementById(`m-${no}`);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'auto', block: 'center' });
}

export interface Scan {
    query: string;
    setQuery: (q: string) => void;
    matches: number[];
    matchIndex: number;
    jumpToMatch: (direction: 1 | -1) => void;
    /** Normalized query when long enough to scan, else null */
    activeQuery: string | null;
    /** messageNo of the current match, else null */
    currentMatchNo: number | null;
}

export function useScan(messages: { no: number; text: string }[]): Scan {
    const [query, setQuery] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return messages.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m.no);
    }, [query, messages]);

    // First jump lands on the current match; subsequent jumps step through.
    // Query changes reset the cursor via the derived-state-reset pattern.
    const [hasJumped, setHasJumped] = useState(false);
    const [prevQuery, setPrevQuery] = useState(query);
    if (prevQuery !== query) {
        setPrevQuery(query);
        setMatchIndex(0);
        setHasJumped(false);
    }

    const jumpToMatch = useCallback(
        (direction: 1 | -1) => {
            if (matches.length === 0) return;
            const step = hasJumped ? direction : 0;
            setHasJumped(true);
            const wrapped = (((matchIndex + step) % matches.length) + matches.length) % matches.length;
            setMatchIndex(wrapped);
            scrollToMessage(matches[wrapped], true);
        },
        [matches, matchIndex, hasJumped]
    );

    return {
        query,
        setQuery,
        matches,
        matchIndex,
        jumpToMatch,
        activeQuery: query.trim().length >= 2 ? query.trim() : null,
        currentMatchNo: matches.length > 0 ? matches[matchIndex] : null,
    };
}

export function ScanBar({ scan }: { scan: Scan }) {
    const { query, setQuery, matches, matchIndex, jumpToMatch, activeQuery } = scan;

    return (
        <div className={styles.scanBar}>
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
                    if (e.key === 'Enter') jumpToMatch(e.shiftKey ? -1 : 1);
                    if (e.key === 'Escape') setQuery('');
                }}
                aria-label='Search within this transcript'
            />
            {activeQuery && (
                <span className={styles.scanStatus}>
                    {matches.length === 0 ? 'no hits' : `${matchIndex + 1}/${matches.length}`}
                </span>
            )}
            <button
                type='button'
                className={styles.scanButton}
                onClick={() => jumpToMatch(-1)}
                disabled={matches.length === 0}
                aria-label='Previous match'
            >
                ▲
            </button>
            <button
                type='button'
                className={styles.scanButton}
                onClick={() => jumpToMatch(1)}
                disabled={matches.length === 0}
                aria-label='Next match'
            >
                ▼
            </button>
        </div>
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
