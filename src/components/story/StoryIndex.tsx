'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import IndexScan from '@/components/IndexScan';
import DeleteStoryButton from './DeleteStoryButton';
import { storyGroupId } from '@/lib/stories';
import styles from './storyIndex.module.scss';

export interface IndexStory {
    slug: string;
    title: string;
    blurb: string | null;
    authorName: string | null;
    publishedDate: string | null;
    chapterCount: number;
    lineCount: number;
    colors: { primary: string; secondary: string };
    /** Shelf section heading (e.g. the story's campaign); stories arrive pre-sorted by group. */
    group?: string | null;
}

export default function StoryIndex({ stories }: { stories: IndexStory[] }) {
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return stories;
        return stories.filter(
            (s) => s.title.toLowerCase().includes(q) || (s.blurb ?? '').toLowerCase().includes(q)
        );
    }, [stories, query]);

    // Consecutive stories sharing a group form one section; ungrouped lists render as a single shelf.
    const groups = useMemo(() => {
        const out: { label: string | null; stories: IndexStory[] }[] = [];
        for (const s of visible) {
            const label = s.group ?? null;
            if (out.length && out[out.length - 1].label === label) out[out.length - 1].stories.push(s);
            else out.push({ label, stories: [s] });
        }
        return out;
    }, [visible]);

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by title or blurb…'
                label='Search stories by title or blurb'
                count={visible.length}
            />

            {visible.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {stories.length === 0 ? 'no stories on the shelf yet' : 'no stories match that scan'}
                </p>
            )}

            {groups.map((group) => (
                <section key={group.label ?? '_'} id={group.label ? storyGroupId(group.label) : undefined}>
                    {group.label && <h2 className={styles.groupHeading}>{group.label}</h2>}
                    <ul className={styles.shelf}>
                        {group.stories.map((s) => (
                            <li key={s.slug} className={styles.row}>
                                <Link
                                    href={`/stories/${s.slug}`}
                                    className={styles.card}
                                    style={{ '--story': s.colors.primary, '--story-2': s.colors.secondary } as React.CSSProperties}
                                >
                                    <span className={styles.cardTitle}>{s.title}</span>
                                    {s.blurb && <span className={styles.cardBlurb}>{s.blurb}</span>}
                                    <span className={styles.cardMeta}>
                                        <span className='pixel-label'>
                                            {s.chapterCount > 1 && <>{s.chapterCount} chapters · </>}
                                            {s.lineCount} line{s.lineCount === 1 ? '' : 's'}
                                            {s.authorName && <> · by {s.authorName}</>}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
