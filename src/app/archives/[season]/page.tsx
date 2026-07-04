import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { Season } from '@/lib/types';
import { findSeasonBySlug, seasonColors, seasonDisplayName } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import EpisodeList from '@/components/archives/EpisodeList';
import styles from './season.module.scss';

interface Props {
    params: Promise<{ season: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { season: slug } = await params;
    try {
        const seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, slug);
        return { title: season ? seasonDisplayName(season.title) : 'Archives' };
    } catch {
        return { title: 'Archives' };
    }
}

function formatMonthYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default async function SeasonPage({ params }: Props) {
    const { season: slug } = await params;

    let seasons: Season[];
    try {
        seasons = await api<Season[]>('/seasons');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const season = findSeasonBySlug(seasons, slug);
    if (!season) notFound();

    const episodes = [...(season.episodes ?? [])].sort((a, b) => a.episode_no - b.episode_no);
    const colors = seasonColors(season.title);
    const style = {
        '--season': colors.primary,
        '--season-2': colors.secondary,
        '--scan-accent': colors.primary,
    } as React.CSSProperties;

    const playedDates = episodes
        .map((e) => e.playedDate)
        .filter((d): d is string => d !== null)
        .sort();
    const dateRange =
        playedDates.length > 0
            ? `${formatMonthYear(playedDates[0])} — ${formatMonthYear(playedDates[playedDates.length - 1])}`
            : null;

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href='/archives'>← all archives</Link>
            </nav>

            <header className={styles.header}>
                <h1 className={styles.title}>{seasonDisplayName(season.title)}</h1>
                <p className='pixel-label'>
                    {episodes.length} episode{episodes.length === 1 ? '' : 's'}
                    {dateRange && <> · recorded {dateRange}</>}
                </p>
            </header>

            <EpisodeList
                seasonTitle={season.title}
                episodes={episodes.map((e) => ({
                    episode_no: e.episode_no,
                    title: e.title,
                    summary: e.summary,
                    playedDate: e.playedDate,
                }))}
            />
        </main>
    );
}
