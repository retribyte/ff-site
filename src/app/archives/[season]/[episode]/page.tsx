import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { Message, Season, SeasonCast } from '@/lib/types';
import { episodeNumberLabel, episodeSlug, findEpisodeBySlug, findSeasonBySlug, seasonColors } from '@/lib/seasons';
import { fetchAllMessages, slimTranscript } from '@/lib/transcript';
import SignalLost from '@/components/SignalLost';
import TranscriptReader from '@/components/transcript/TranscriptReader';
import EpisodeSelect from '@/components/transcript/EpisodeSelect';
import PersonaStampPanel from '@/components/transcript/PersonaStampPanel';
import CastAvatar from '@/components/characters/CastAvatar';
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
    let cast: SeasonCast | null;

    try {
        seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, seasonParam);
        const episode = season?.episodes && findEpisodeBySlug(season.episodes, episodeParam);
        if (!season || !episode) notFound();
        episodeTitle = episode.title;
        [messages, cast] = await Promise.all([
            fetchAllMessages(episode.title),
            // A failed fetch just leaves out the episode's player characters
            api<SeasonCast>(`/seasons/${encodeURIComponent(season.slug)}/cast`).catch(() => null),
        ]);
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
    // The player characters that led this episode (each player's most active one)
    const castById = new Map((cast?.characters ?? []).map((c) => [c.id, c]));
    const episodeCast = (cast?.byEpisode[episodeTitle] ?? []).map((id) => castById.get(id)!).filter(Boolean);
    // Speaking characters only — the picker for an admin/owner action scoped
    // to "presentation in this episode" has no use for characters who never
    // appear here.
    const speakingCharacters = Object.entries(data.characters)
        .map(([id, info]) => ({ id: Number(id), name: info.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

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
                        numberLabel: episodeNumberLabel(e, episodes),
                    }))}
                />
            </nav>

            <header className={styles.header}>
                <h1 className={styles.title}>{episodeTitle}</h1>
                {episode.reconstructed && (
                    <p className={styles.reconstructed}>
                        <span className={styles.tag}>reconstructed</span> The logs of this session are lost.
                        This episode was rewritten from memory, so it isn&apos;t part of the recovered archive.
                    </p>
                )}
                <p className='pixel-label'>
                    {data.messages.length} lines
                    {episode.playedDate && (
                        <>
                            {' '}
                            ⭑ recorded{' '}
                            {new Date(episode.playedDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                timeZone: 'UTC',
                            })}
                        </>
                    )}
                </p>
                {episode.summary && <p className={styles.summary}>{episode.summary}</p>}
                {episodeCast.length > 0 && (
                    <ul className={styles.cast} aria-label='Player characters in this episode'>
                        {episodeCast.map((c) => (
                            <li key={c.id}>
                                <CastAvatar character={c} size={42} />
                            </li>
                        ))}
                    </ul>
                )}
            </header>

            <PersonaStampPanel scope='episode' scopeTitle={episodeTitle} characters={speakingCharacters} />

            <TranscriptReader data={data} />

            <nav className={styles.pager}>
                {prev ? (
                    <Link href={`/archives/${season.slug}/${episodeSlug(prev)}`}>
                        ← {episodeNumberLabel(prev, episodes)}. {prev.title}
                    </Link>
                ) : (
                    <span />
                )}
                {next ? (
                    <Link href={`/archives/${season.slug}/${episodeSlug(next)}`}>
                        {episodeNumberLabel(next, episodes)}. {next.title} →
                    </Link>
                ) : (
                    <span />
                )}
            </nav>
        </main>
    );
}
