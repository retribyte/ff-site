'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './quoteTeaser.module.scss';

export interface TeaserQuote {
    key: string;
    text: string;
    href?: string;
    context?: string;
}

function shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// Most rows of quotes on screen; a hand's quotes that wrap past them are hidden
const ROWS = 3;

/**
 * A hand of a character's quotes, with a reroll button. `pool` arrives already
 * shuffled from the server (so the first render matches it) and capped, so a
 * much-quoted character doesn't ship its whole quote log to the browser.
 * Rerolls walk through the pool, reshuffling once it's used up.
 *
 * The quotes wrap into rows by length inside a fixed-height box (see
 * quoteTeaser.module.scss), and only the rows that fully fit show, at most
 * ROWS: CSS can't tell which row a wrapped item landed on, so a layout effect
 * measures and hides the rest (again on reroll and on resize). Every quote is
 * laid out from the first paint, so hiding later rows never moves the ones
 * on screen. The list stays invisible until web fonts are in and it's been
 * fitted (fallback-font text wraps differently). The reroll button sits in
 * the heading row, so it never moves either.
 */
export default function QuoteTeaser({
    pool,
    count,
    title,
    titleClassName,
}: {
    pool: TeaserQuote[];
    count: number;
    /** The section heading, drawn in the same row as the reroll button */
    title: string;
    titleClassName?: string;
}) {
    const [order, setOrder] = useState(pool);
    const [start, setStart] = useState(0);
    const shown = order.slice(start, start + count);
    const listRef = useRef<HTMLUListElement>(null);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;
        let width = -1;
        const fit = () => {
            const items = [...list.children] as HTMLElement[];
            for (const li of items) li.hidden = false;
            const tops = items.map((li) => li.offsetTop);
            const rowTops = [...new Set(tops)].sort((a, b) => a - b);
            items.forEach((li, i) => {
                const row = rowTops.indexOf(tops[i]);
                const overflows = tops[i] + li.offsetHeight > list.clientHeight;
                // The first row always shows, even a tall one (clipped)
                li.hidden = row > 0 && (row >= ROWS || overflows);
            });
        };
        fit();
        // Width changes only: hiding items changes the height, which must not re-trigger
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width === width) return;
            width = entry.contentRect.width;
            fit();
        });
        observer.observe(list);
        // Fonts swap in after the first paint and re-wrap the rows, so the list
        // stays invisible (its space already reserved) until they're in and
        // it's been fitted with them; a font that loads later re-fits it.
        let cancelled = false;
        void document.fonts.ready.then(() => {
            if (cancelled) return;
            fit();
            list.dataset.fitted = '';
        });
        document.fonts.addEventListener('loadingdone', fit);
        return () => {
            cancelled = true;
            observer.disconnect();
            document.fonts.removeEventListener('loadingdone', fit);
        };
    }, [order, start]);

    function reroll() {
        const next = start + count;
        if (next + count <= order.length) {
            setStart(next);
            return;
        }
        // Used up: reshuffle, keeping the quotes on screen out of the next hand
        const onScreen = new Set(shown.map((q) => q.key));
        const fresh = shuffle(order);
        setOrder([...fresh.filter((q) => !onScreen.has(q.key)), ...fresh.filter((q) => onScreen.has(q.key))]);
        setStart(0);
    }

    return (
        <>
            <div className={styles.head}>
                <h2 className={titleClassName}>{title}</h2>
                {pool.length > count && (
                    <button type='button' className={styles.reroll} onClick={reroll}>
                        ↻ reroll
                    </button>
                )}
            </div>
            <ul ref={listRef} className={styles.quotes} data-fixed={pool.length > count || undefined} aria-live='polite'>
                {shown.map((quote) => (
                    <li key={quote.key} className={styles.quote}>
                        <span className={styles.quoteMark} aria-hidden>
                            “
                        </span>
                        <blockquote>
                            <p>{quote.text}</p>
                            {quote.href && (
                                <footer>
                                    <Link href={quote.href}>{quote.context}</Link>
                                </footer>
                            )}
                        </blockquote>
                    </li>
                ))}
            </ul>
        </>
    );
}
