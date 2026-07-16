import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { Message, Season } from '@/lib/types';
import { episodeSlug, findEpisodeBySlug, findSeasonBySlug, seasonColors } from '@/lib/seasons';
import { fetchAllMessages, slimTranscript } from '@/lib/transcript';
import SignalLost from '@/components/SignalLost';
import TranscriptReader from '@/components/transcript/TranscriptReader';
import EpisodeSelect from '@/components/transcript/EpisodeSelect';
import styles from './episode.module.scss';

interface Props {
    params: Promise<{ season: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { season: seasonParam, episode: episodeParam } = await params;
    try {
        const seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, seasonParam);
        const episode = season?.episodes && findEpisodeBySlug(season.episodes, episodeParam);
        return { title: episode ? episode.title : 'Archives' };
    } catch {
        return { title: 'Archives' };
    }
}

export default async function EpisodePage({ params }: Props) {
    const { season: seasonParam, episode: episodeParam } = await params;

    let seasons: Season[];
    let messages: Message[];
    let episodeTitle: string;

    try {
        seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, seasonParam);
        const episode = season?.episodes && findEpisodeBySlug(season.episodes, episodeParam);
        if (!season || !episode) notFound();
        episodeTitle = episode.title;
        messages = await fetchAllMessages(episode.title);
    } catch (error) {
        // notFound() works by throwing — let it through
        if (error && typeof error === 'object' && 'digest' in error) throw error;
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const season = findSeasonBySlug(seasons, seasonParam)!;
    const episodes = [...(season.episodes ?? [])].sort((a, b) => a.episode_no - b.episode_no);
    const episode = findEpisodeBySlug(episodes, episodeParam)!;
    const index = episodes.indexOf(episode);
    const prev = index > 0 ? episodes[index - 1] : null;
    const next = index < episodes.length - 1 ? episodes[index + 1] : null;

    const colors = seasonColors(season.title);
    const data = slimTranscript(messages);

    return (
        <main className={styles.main} style={{ '--season': colors.primary } as React.CSSProperties}>
            <nav className={styles.breadcrumb}>
                <Link href={`/archives/${season.slug}`}>← {season.title} episodes</Link>
                <EpisodeSelect
                    seasonSlug={season.slug}
                    currentNo={episode.episode_no}
                    options={episodes.map((e) => ({
                        value: episodeSlug(e),
                        label: e.title,
                        episodeNo: e.episode_no,
                    }))}
                />
            </nav>

            <header className={styles.header}>
                <p className='pixel-label'>
                    transmission {String(episode.episode_no).padStart(2, '0')} · {data.messages.length} lines
                    {episode.playedDate && (
                        <>
                            {' '}
                            · recorded{' '}
                            {new Date(episode.playedDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                timeZone: 'UTC',
                            })}
                        </>
                    )}
                </p>
                <h1 className={styles.title}>{episodeTitle}</h1>
                {episode.summary && <p className={styles.summary}>{episode.summary}</p>}
            </header>

            <TranscriptReader data={data} />

            <nav className={styles.pager}>
                {prev ? (
                    <Link href={`/archives/${season.slug}/${episodeSlug(prev)}`}>
                        ← {prev.episode_no}. {prev.title}
                    </Link>
                ) : (
                    <span />
                )}
                {next ? (
                    <Link href={`/archives/${season.slug}/${episodeSlug(next)}`}>
                        {next.episode_no}. {next.title} →
                    </Link>
                ) : (
                    <span />
                )}
            </nav>
        </main>
    );
}
