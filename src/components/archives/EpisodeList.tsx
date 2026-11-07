'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { episodeNumberLabel, episodeSlug } from '@/lib/seasons';
import IndexScan from '@/components/IndexScan';
import styles from './episodeList.module.scss';

export interface IndexEpisode {
    episode_no: number;
    title: string;
    summary: string | null;
    playedDate: string | null;
    slug: string;
    reconstructed?: boolean;
}

function formatPlayedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

// Missing episode numbers as a label like "EP 01–02"
function gapLabel(from: number, to: number): string {
    return from === to ? `EP ${pad(from)}` : `EP ${pad(from)}–${pad(to)}`;
}

export default function EpisodeList({ seasonSlug, episodes }: { seasonSlug: string; episodes: IndexEpisode[] }) {
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
                {visible.map((episode, i) => {
                    // Only mark gaps in the full list; a search filter makes every row "gappy"
                    const prevNo = i === 0 ? 0 : visible[i - 1].episode_no;
                    const hasGap = !query.trim() && episode.episode_no > prevNo + 1;
                    return (
                        <Fragment key={episode.episode_no}>
                            {hasGap && (
                                <li className={styles.gap} role='separator' aria-label='Archive lost'>
                                    <span className={styles.gapLine} aria-hidden='true' />
                                    <span className='pixel-label'>
                                        Archive lost ⭑ {gapLabel(prevNo + 1, episode.episode_no - 1)}
                                    </span>
                                    <span className={`${styles.gapLine} ${styles.gapLineEnd}`} aria-hidden='true' />
                                </li>
                            )}
                            <li>
                                <Link
                                    href={`/archives/${seasonSlug}/${episodeSlug(episode)}`}
                                    className={styles.episode}
                                >
                                    <span className={styles.episodeNo}>
                                        {episode.reconstructed
                                            ? episodeNumberLabel(episode, episodes)
                                            : String(episode.episode_no).padStart(2, '0')}
                                    </span>
                                    <span className={styles.episodeBody}>
                                        <span className={styles.episodeTitle}>
                                            {episode.title}
                                            {episode.reconstructed && <span className={styles.tag}>reconstructed</span>}
                                        </span>
                                        {episode.summary && <span className={styles.episodeSummary}>{episode.summary}</span>}
                                    </span>
                                    {episode.playedDate && (
                                        <time className={styles.episodeDate} dateTime={episode.playedDate}>
                                            {formatPlayedDate(episode.playedDate)}
                                        </time>
                                    )}
                                </Link>
                            </li>
                        </Fragment>
                    );
                })}
            </ol>
        </div>
    );
}
