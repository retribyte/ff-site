import type { Metadata } from 'next';
import Link from 'next/link';
import { api, apiPaged } from '@/lib/api';
import type { Character, Species, Item, Season, Episode, MessageType } from '@/lib/types';
import { episodesByTitle, lineUrl } from '@/lib/seasons';
import { storyQuoteUrl } from '@/lib/stories';
import { messageSnippet, embedLast } from '@/lib/search';
import { Highlighted } from '@/components/transcript/ScanBar';
import CharacterCard from '@/components/characters/CharacterCard';
import Pager from '@/components/Pager';
import SignalLost from '@/components/SignalLost';
import styles from './search.module.scss';

export const metadata: Metadata = { title: 'Search' };

// Results come from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

interface MessageHit {
    episodeTitle: string;
    messageNo: number;
    text: string;
    type: MessageType;
}

interface StoryLineHit {
    storySlug: string;
    chapterNo: number;
    lineNo: number;
    text: string;
}

interface Props {
    searchParams: Promise<{ q?: string; messagesPage?: string; storyLinesPage?: string }>;
}

function pageParam(value: string | undefined): number {
    const parsed = value ? parseInt(value, 10) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SearchPage({ searchParams }: Props) {
    const { q, messagesPage, storyLinesPage } = await searchParams;
    const query = (q ?? '').trim();

    if (!query) {
        return (
            <main className={styles.main}>
                <header className={styles.header}>
                    <h1>Search</h1>
                </header>
                <p className={`pixel-label ${styles.empty}`}>type something to scan the archive</p>
            </main>
        );
    }

    const msgPage = pageParam(messagesPage);
    const storyPage = pageParam(storyLinesPage);

    let characters: Character[];
    let species: Species[];
    let items: Item[];
    let messagesResult: { data: MessageHit[]; total: number; page: number; limit: number };
    let storyLinesResult: { data: StoryLineHit[]; total: number; page: number; limit: number };
    let episodeMap: Map<string, Episode>;

    try {
        const qs = encodeURIComponent(query);
        const [charactersRes, speciesRes, itemsRes, messagesRes, storyLinesRes, seasons] = await Promise.all([
            api<Character[]>(`/characters?search=${qs}`),
            api<Species[]>(`/species?search=${qs}`),
            api<Item[]>(`/items?search=${qs}`),
            apiPaged<MessageHit>(`/search?category=messages&q=${qs}&page=${msgPage}`),
            apiPaged<StoryLineHit>(`/search?category=storyLines&q=${qs}&page=${storyPage}`),
            api<Season[]>('/seasons'),
        ]);
        characters = charactersRes;
        species = speciesRes;
        items = itemsRes;
        messagesResult = messagesRes;
        storyLinesResult = storyLinesRes;
        episodeMap = episodesByTitle(seasons);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const sortedMessages = [...messagesResult.data].sort(embedLast);
    const hasAnyResults =
        characters.length > 0 ||
        species.length > 0 ||
        items.length > 0 ||
        messagesResult.total > 0 ||
        storyLinesResult.total > 0;

    // Preserves q (and the *other* section's page) when a Pager builds a link,
    // so paging messages doesn't reset story-lines back to page 1 or vice versa.
    const urlParams = new URLSearchParams({ q: query });
    if (messagesPage) urlParams.set('messagesPage', messagesPage);
    if (storyLinesPage) urlParams.set('storyLinesPage', storyLinesPage);

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Search</h1>
                <p className='pixel-label'>results for &ldquo;{query}&rdquo;</p>
            </header>

            {!hasAnyResults && <p className={`pixel-label ${styles.empty}`}>no signal — nothing matches that scan</p>}

            {characters.length > 0 && (
                <section className={styles.section}>
                    <h2>Characters</h2>
                    <ul className={styles.cardGrid}>
                        {characters.map((c) => (
                            <li key={c.id}>
                                <CharacterCard
                                    character={{ id: c.id, name: c.name, color: c.color, image: c.image, slug: c.slug }}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {species.length > 0 && (
                <section className={styles.section}>
                    <h2>Species</h2>
                    <ul className={styles.rowList}>
                        {species.map((s) => (
                            <li key={s.id}>
                                <Link href={`/species/${s.slug}`}>{s.name}</Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {items.length > 0 && (
                <section className={styles.section}>
                    <h2>Items</h2>
                    <ul className={styles.rowList}>
                        {items.map((i) => (
                            <li key={i.id}>
                                <Link href={`/items/${i.slug}`}>{i.name}</Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {messagesResult.total > 0 && (
                <section className={styles.section}>
                    <h2>Transcripts</h2>
                    <p className='pixel-label'>{messagesResult.total} matches</p>
                    <ul className={styles.rowList}>
                        {sortedMessages.map((m) => {
                            const episode = episodeMap.get(m.episodeTitle);
                            const text = messageSnippet(m.text, m.type, query);
                            const snippet = (
                                <>
                                    <span className={styles.rowMeta}>{m.episodeTitle}</span>{' '}
                                    <Highlighted text={text} query={query} />
                                </>
                            );
                            return (
                                <li key={`${m.episodeTitle}-${m.messageNo}`}>
                                    {episode ? <Link href={lineUrl(episode, m.messageNo)}>{snippet}</Link> : snippet}
                                </li>
                            );
                        })}
                    </ul>
                    <Pager
                        page={messagesResult.page}
                        total={messagesResult.total}
                        limit={messagesResult.limit}
                        paramName='messagesPage'
                        searchParams={urlParams}
                    />
                </section>
            )}

            {storyLinesResult.total > 0 && (
                <section className={styles.section}>
                    <h2>Stories</h2>
                    <p className='pixel-label'>{storyLinesResult.total} matches</p>
                    <ul className={styles.rowList}>
                        {storyLinesResult.data.map((sl) => (
                            <li key={`${sl.storySlug}-${sl.chapterNo}-${sl.lineNo}`}>
                                <Link
                                    href={storyQuoteUrl({
                                        storySlug: sl.storySlug,
                                        chapterNo: sl.chapterNo,
                                        line_no: sl.lineNo,
                                    })}
                                >
                                    <span className={styles.rowMeta}>chapter {sl.chapterNo}</span>{' '}
                                    <Highlighted text={sl.text} query={query} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <Pager
                        page={storyLinesResult.page}
                        total={storyLinesResult.total}
                        limit={storyLinesResult.limit}
                        paramName='storyLinesPage'
                        searchParams={urlParams}
                    />
                </section>
            )}
        </main>
    );
}
