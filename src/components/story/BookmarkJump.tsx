'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { scrollToMessage } from '@/components/transcript/ScanBar';
import { bookmarkFits, bookmarkSpot, clearBookmark, useStoryBookmark } from '@/lib/storyBookmarks';
import styles from './bookmarkJump.module.scss';

export interface BookmarkChapter {
    no: number;
    /** how many lines the chapter has */
    lines: number;
    /** the page that reads it */
    href: string;
}

// The story header's "jump to bookmark" button, shown once the reader has
// bookmarked a line (see the reader's rail). On the page that shows the line
// it scrolls there and puts it in the URL as a ?line= deep link; elsewhere it
// links to that chapter's page at the line.
export default function BookmarkJump({
    slug,
    chapters,
    here = null,
}: {
    slug: string;
    chapters: BookmarkChapter[];
    /** the chapter this page reads, if any */
    here?: number | null;
}) {
    const bookmark = useStoryBookmark(slug);
    const fits = bookmark !== null && bookmarkFits(bookmark, chapters);

    // A bookmark past the story's end (its text was replaced) is dropped
    useEffect(() => {
        if (bookmark !== null && !fits) clearBookmark(slug);
    }, [bookmark, fits, slug]);

    if (bookmark === null || !fits) return null;

    const { chapter, line } = bookmarkSpot(bookmark);
    const target = chapters.find((c) => c.no === chapter)!;
    const href = `${target.href}?line=${line}`;
    const label = '↓ jump to bookmark';

    if (chapter !== here) {
        return (
            <Link href={href} className={styles.button} prefetch={false}>
                {label}
            </Link>
        );
    }

    return (
        <a
            href={href}
            className={styles.button}
            onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                // Already the URL's line: the reader won't see a change, so scroll here
                if (new URLSearchParams(window.location.search).get('line') === String(line)) {
                    scrollToMessage(line, true);
                } else {
                    window.history.pushState(null, '', href);
                }
            }}
        >
            {label}
        </a>
    );
}
