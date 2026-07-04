'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { episodeSlug, seasonSlug } from '@/lib/seasons';
import IndexScan from '@/components/IndexScan';
import styles from './episodeList.module.scss';

export interface IndexEpisode {
    episode_no: number;
    title: string;
    summary: string | null;
    playedDate: string | null;
}

function formatPlayedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EpisodeList({ seasonTitle, episodes }: { seasonTitle: string; episodes: IndexEpisode[] }) {
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return episodes;
        return episodes.filter(
            (e) => e.title.toLowerCase().includes(q) || (e.summary ?? '').toLowerCase().includes(q)
        );
    }, [episodes, query]);

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search episode titles…'
                label='Search episodes by title or summary'
                count={visible.length}
            />

            {visible.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {episodes.length === 0 ? 'no episodes recovered yet' : 'no episodes match that scan'}
                </p>
            )}

            <ol className={styles.episodes}>
                {visible.map((episode) => (
                    <li key={episode.episode_no}>
                        <Link
                            href={`/archives/${seasonSlug(seasonTitle)}/${episodeSlug(episode)}`}
                            className={styles.episode}
                        >
                            <span className={styles.episodeNo}>{String(episode.episode_no).padStart(2, '0')}</span>
                            <span className={styles.episodeBody}>
                                <span className={styles.episodeTitle}>{episode.title}</span>
                                {episode.summary && <span className={styles.episodeSummary}>{episode.summary}</span>}
                            </span>
                            {episode.playedDate && (
                                <time className={styles.episodeDate} dateTime={episode.playedDate}>
                                    {formatPlayedDate(episode.playedDate)}
                                </time>
                            )}
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}
