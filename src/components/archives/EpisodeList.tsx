'use client';

import Link from 'next/link';
import { episodeSlug } from '@/lib/seasons';
import IndexScan from '@/components/IndexScan';
import EmptyState from '@/components/EmptyState';
import { useIndexFilter } from '@/hooks/useIndexFilter';
import styles from './episodeList.module.scss';

export interface IndexEpisode {
    episode_no: number;
    title: string;
    summary: string | null;
    playedDate: string | null;
    slug: string;
}

function formatPlayedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EpisodeList({ seasonSlug, episodes }: { seasonSlug: string; episodes: IndexEpisode[] }) {
    const { query, setQuery, visible } = useIndexFilter(
        episodes,
        (e, q) => !q || e.title.toLowerCase().includes(q) || (e.summary ?? '').toLowerCase().includes(q)
    );

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
                <EmptyState>
                    {episodes.length === 0 ? 'no episodes recovered yet' : 'no episodes match that scan'}
                </EmptyState>
            )}

            <ol className={styles.episodes}>
                {visible.map((episode) => (
                    <li key={episode.episode_no}>
                        <Link
                            href={`/archives/${seasonSlug}/${episodeSlug(episode)}`}
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
