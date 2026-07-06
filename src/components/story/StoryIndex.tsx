'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import IndexScan from '@/components/IndexScan';
import DeleteStoryButton from './DeleteStoryButton';
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

            <ul className={styles.shelf}>
                {visible.map((s) => (
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
        </div>
    );
}
