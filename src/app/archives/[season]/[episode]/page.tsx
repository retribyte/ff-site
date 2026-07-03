import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, apiPaged } from '@/lib/api';
import type { Message, Season } from '@/lib/types';
import { episodeNoFromSlug, episodeSlug, findSeasonBySlug, seasonColors } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import TranscriptReader, { type TranscriptData } from '@/components/transcript/TranscriptReader';
import EpisodeSelect from '@/components/transcript/EpisodeSelect';
import styles from './episode.module.scss';

interface Props {
    params: Promise<{ season: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { season: seasonParam, episode: episodeParam } = await params;
    const episodeNo = episodeNoFromSlug(episodeParam);
    try {
        const seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, seasonParam);
        const episode = season?.episodes?.find((e) => e.episode_no === episodeNo);
        return { title: episode ? episode.title : 'Archives' };
    } catch {
        return { title: 'Archives' };
    }
}

async function fetchAllMessages(episodeTitle: string): Promise<Message[]> {
    const encoded = encodeURIComponent(episodeTitle);
    const limit = 1000;
    const first = await apiPaged<Message>(`/episodes/${encoded}/messages?page=1&limit=${limit}`);
    const messages = [...first.data];
    const totalPages = Math.ceil(first.total / limit);
    for (let page = 2; page <= totalPages; page += 1) {
        const next = await apiPaged<Message>(`/episodes/${encoded}/messages?page=${page}&limit=${limit}`);
        messages.push(...next.data);
    }
    return messages;
}

// The API includes full character/player objects on every message; sending
// that to the client 1,500× would be silly. Slim to id-keyed lookup tables.
function slimTranscript(messages: Message[]): TranscriptData {
    const characters: TranscriptData['characters'] = {};
    const players: TranscriptData['players'] = {};

    for (const message of messages) {
        if (message.character && !(message.character.id in characters)) {
            characters[message.character.id] = {
                name: message.character.name,
                color: message.character.themeColor,
                image: message.character.image,
            };
        }
        if (message.player && !(message.player.id in players)) {
            players[message.player.id] = {
                name: message.player.username,
                icon: message.player.icon,
            };
        }
    }

    return {
        characters,
        players,
        messages: messages.map((m) => ({
            no: m.messageNo,
            type: m.type,
            text: m.text,
            characterId: m.characterId,
            playerId: m.playerId,
            timestamp: m.timestamp,
        })),
    };
}

export default async function EpisodePage({ params }: Props) {
    const { season: seasonParam, episode: episodeParam } = await params;
    const episodeNo = episodeNoFromSlug(episodeParam);
    if (episodeNo === null) notFound();

    let seasons: Season[];
    let messages: Message[];
    let episodeTitle: string;

    try {
        seasons = await api<Season[]>('/seasons');
        const season = findSeasonBySlug(seasons, seasonParam);
        const episode = season?.episodes?.find((e) => e.episode_no === episodeNo);
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
    const episode = episodes.find((e) => e.episode_no === episodeNo)!;
    const index = episodes.indexOf(episode);
    const prev = index > 0 ? episodes[index - 1] : null;
    const next = index < episodes.length - 1 ? episodes[index + 1] : null;

    const colors = seasonColors(season.title);
    const data = slimTranscript(messages);

    return (
        <main className={styles.main} style={{ '--season': colors.primary } as React.CSSProperties}>
            <nav className={styles.breadcrumb}>
                <Link href={`/archives/${seasonParam}`}>← {season.title} episodes</Link>
                <EpisodeSelect
                    seasonSlug={seasonParam}
                    currentNo={episodeNo}
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
                    <Link href={`/archives/${seasonParam}/${episodeSlug(prev)}`}>
                        ← {prev.episode_no}. {prev.title}
                    </Link>
                ) : (
                    <span />
                )}
                {next ? (
                    <Link href={`/archives/${seasonParam}/${episodeSlug(next)}`}>
                        {next.episode_no}. {next.title} →
                    </Link>
                ) : (
                    <span />
                )}
            </nav>
        </main>
    );
}
