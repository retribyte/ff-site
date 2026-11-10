import type { Metadata } from 'next';
import Link from 'next/link';
import { api, apiPaged } from '@/lib/api';
import type { Character, Item, Season, Episode, MessageType } from '@/lib/types';
import { episodeNumberLabel, episodesByTitle, lineUrl, seasonColors, seasonOrder, seasonSlug } from '@/lib/seasons';
import { storyQuoteUrl } from '@/lib/stories';
import { messageSnippet, embedLast } from '@/lib/search';
import { Highlighted } from '@/components/transcript/ScanBar';
import CharacterCard from '@/components/characters/CharacterCard';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import Pager from '@/components/Pager';
import SignalLost from '@/components/SignalLost';
import styles from './search.module.scss';

export const metadata: Metadata = { title: 'Search' };

// Results come from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

// Rows per section: short enough that every section (Stories, Commentary)
// shows without scrolling past pages of transcript hits
const PAGE_SIZE = 8;

interface MessageHit {
    episodeTitle: string;
    episodeNo: number;
    messageNo: number;
    text: string;
    type: MessageType;
    seasonTitle: string;
    characterName: string | null;
    characterSlug: string | null;
    characterImage: string | null;
    characterColor: string | null;
    characterColorLight: string | null;
    personaName: string | null;
    personaImage: string | null;
    personaColor: string | null;
    playerName: string | null;
    playerIcon: string | null;
    playerColor: string | null;
}

interface StoryLineHit {
    storySlug: string;
    storyTitle: string;
    seasonTitle: string | null;
    chapterNo: number;
    lineNo: number;
    text: string;
}

interface CommentaryHit {
    id: number;
    content: string;
    author: string;
    episodeTitle: string;
    episodeNo: number;
    episodeSlug: string | null;
    seasonTitle: string;
    messageNo: number;
}

type Paged<T> = { data: T[]; total: number; page: number; limit: number };

type SortKey = 'relevance' | 'first' | 'last';
const SORTS: { key: SortKey; label: string }[] = [
    { key: 'relevance', label: 'best match' },
    { key: 'first', label: 'first appearance' },
    { key: 'last', label: 'latest appearance' },
];

interface Params {
    q?: string;
    sort?: string;
    exclude?: string;
    messagesPage?: string;
    storyLinesPage?: string;
    commentariesPage?: string;
}

interface Props {
    searchParams: Promise<Params>;
}

function pageParam(value: string | undefined): number {
    const parsed = value ? parseInt(value, 10) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// Note text is sanitized HTML with entities encoded: plain text for a snippet
function plainText(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function matches(n: number): string {
    return `${n.toLocaleString('en-US')} match${n === 1 ? '' : 'es'}`;
}

function SeasonTag({ title }: { title: string | null }) {
    if (!title) return null;
    return (
        <span className={styles.seasonTag} style={{ '--tint': seasonColors(title).primary } as React.CSSProperties}>
            {title}
        </span>
    );
}

export default async function SearchPage({ searchParams }: Props) {
    const params = await searchParams;
    const query = (params.q ?? '').trim();

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

    const sort: SortKey = SORTS.some((s) => s.key === params.sort) ? (params.sort as SortKey) : 'relevance';
    const excluded = new Set(
        (params.exclude ?? '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
    );
    const msgPage = pageParam(params.messagesPage);
    const storyPage = pageParam(params.storyLinesPage);
    const notePage = pageParam(params.commentariesPage);

    let characters: Character[];
    let items: Item[];
    let messagesResult: Paged<MessageHit>;
    let storyLinesResult: Paged<StoryLineHit>;
    let commentariesResult: Paged<CommentaryHit>;
    let episodeMap: Map<string, Episode>;
    let seasonList: Season[];

    try {
        const qs = encodeURIComponent(query);
        const options = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (sort !== 'relevance') {
            options.set('sort', 'appearance');
            options.set('dir', sort === 'last' ? 'desc' : 'asc');
        }
        if (excluded.size > 0) options.set('exclude', [...excluded].join(','));
        const category = (name: string, page: number) =>
            `/search?category=${name}&q=${qs}&page=${page}&${options.toString()}`;
        const [charactersRes, itemsRes, messagesRes, storyLinesRes, commentariesRes, seasons] = await Promise.all([
            api<Character[]>(`/characters?search=${qs}`),
            api<Item[]>(`/items?search=${qs}`),
            apiPaged<MessageHit>(category('messages', msgPage)),
            apiPaged<StoryLineHit>(category('storyLines', storyPage)),
            apiPaged<CommentaryHit>(category('commentaries', notePage)),
            api<Season[]>('/seasons'),
        ]);
        characters = charactersRes;
        items = itemsRes;
        messagesResult = messagesRes;
        storyLinesResult = storyLinesRes;
        commentariesResult = commentariesRes;
        episodeMap = episodesByTitle(seasons);
        seasonList = seasons;
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    // Best-match keeps EMBED hits (bot posts) under readable lines; archive
    // order is the server's and stays as it is
    const messages = sort === 'relevance' ? [...messagesResult.data].sort(embedLast) : messagesResult.data;
    const hasAnyResults =
        characters.length > 0 ||
        items.length > 0 ||
        messagesResult.total > 0 ||
        storyLinesResult.total > 0 ||
        commentariesResult.total > 0;

    // A link to this search with some params changed; a changed sort or
    // season set starts every section back on page 1
    const href = (changes: Partial<Params>, resetPages = true) => {
        const next: Params = { ...params, ...changes };
        if (resetPages) {
            delete next.messagesPage;
            delete next.storyLinesPage;
            delete next.commentariesPage;
        }
        const u = new URLSearchParams();
        for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
        return `/search?${u.toString()}`;
    };
    // What a Pager keeps: everything but its own page
    const urlParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) urlParams.set(k, v);

    const seasonChips = [...seasonList].sort((a, b) => {
        const [ag, ak] = seasonOrder(a.title);
        const [bg, bk] = seasonOrder(b.title);
        return ag - bg || ak.localeCompare(bk);
    });
    const toggleSeason = (slug: string) => {
        const next = new Set(excluded);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return href({ exclude: [...next].join(',') || undefined });
    };

    // An episode's whole season, for numbering its reconstructed episodes R1…Rn
    const seasonEpisodes = (ep: Episode) => seasonList.find((x) => x.title === ep.seasonTitle)?.episodes ?? [];
    const episodeLabel = (title: string, no: number) => {
        const episode = episodeMap.get(title);
        return `${episode ? episodeNumberLabel(episode, seasonEpisodes(episode)) : no}. ${title}`;
    };

    const sections = [
        { id: 'characters', label: 'Characters', count: characters.length },
        { id: 'items', label: 'Items', count: items.length },
        { id: 'transcripts', label: 'Transcripts', count: messagesResult.total },
        { id: 'stories', label: 'Stories', count: storyLinesResult.total },
        { id: 'commentary', label: 'Commentary', count: commentariesResult.total },
    ];

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Search</h1>
                <p className='pixel-label'>results for &ldquo;{query}&rdquo;</p>
            </header>

            <div className={styles.controls}>
                <div className={styles.controlRow}>
                    <span className='pixel-label'>sort</span>
                    {SORTS.map((s) => (
                        <Link
                            key={s.key}
                            href={href({ sort: s.key === 'relevance' ? undefined : s.key })}
                            className={styles.chip}
                            data-active={sort === s.key || undefined}
                            aria-current={sort === s.key || undefined}
                        >
                            {s.label}
                        </Link>
                    ))}
                </div>
                <div className={styles.controlRow}>
                    <span className='pixel-label'>seasons</span>
                    {seasonChips.map((s) => {
                        const slug = s.slug || seasonSlug(s.title);
                        const off = excluded.has(slug);
                        return (
                            <Link
                                key={s.title}
                                href={toggleSeason(slug)}
                                className={styles.seasonChip}
                                style={{ '--tint': seasonColors(s.title).primary } as React.CSSProperties}
                                data-active={!off || undefined}
                                aria-label={`${s.title}: ${off ? 'left out, click to include' : 'included, click to leave out'}`}
                            >
                                {s.title}
                            </Link>
                        );
                    })}
                    {excluded.size > 0 && (
                        <Link href={href({ exclude: undefined })} className={styles.reset}>
                            all seasons
                        </Link>
                    )}
                </div>
                <p className={styles.controlHint}>
                    Sorting and seasons apply to transcripts, stories and commentary.
                </p>
            </div>

            {hasAnyResults && (
                <nav className={styles.jump} aria-label='Result sections'>
                    {sections.map((s) =>
                        s.count > 0 ? (
                            <a key={s.id} href={`#${s.id}`}>
                                {s.label} <span className={styles.jumpCount}>{s.count.toLocaleString('en-US')}</span>
                            </a>
                        ) : (
                            <span key={s.id} className={styles.jumpEmpty}>
                                {s.label} <span className={styles.jumpCount}>0</span>
                            </span>
                        )
                    )}
                </nav>
            )}

            {!hasAnyResults && <p className={`pixel-label ${styles.empty}`}>no signal — nothing matches that scan</p>}

            {characters.length > 0 && (
                <section id='characters' className={styles.section}>
                    <h2>Characters</h2>
                    <ul className={styles.cardGrid}>
                        {characters.map((c) => (
                            <li key={c.id}>
                                <CharacterCard
                                    character={{ id: c.id, name: c.name, color: c.color, colorLight: c.colorLight ?? null, image: c.image, slug: c.slug }}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {items.length > 0 && (
                <section id='items' className={styles.section}>
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
                <section id='transcripts' className={styles.section}>
                    <h2>Transcripts</h2>
                    <p className='pixel-label'>{matches(messagesResult.total)}</p>
                    <ul className={styles.rowList}>
                        {messages.map((m) => {
                            const episode = episodeMap.get(m.episodeTitle);
                            const text = messageSnippet(m.text, m.type, query);
                            // The speaker as the reader shows them: persona over character, else the player (bots)
                            const speaker = m.personaName ?? m.characterName ?? m.playerName ?? '?';
                            const avatar = m.characterName ? (
                                <ThemedAvatar
                                    src={m.personaImage ?? m.characterImage}
                                    name={m.characterName}
                                    color={m.personaColor ?? m.characterColor}
                                    colorLight={m.personaColor ? null : m.characterColorLight}
                                    size={22}
                                />
                            ) : (
                                <ThemedAvatar src={m.playerIcon} name={speaker} color={m.playerColor} size={22} />
                            );
                            const row = (
                                <>
                                    <SeasonTag title={m.seasonTitle} />
                                    <span className={styles.rowMeta}>{episodeLabel(m.episodeTitle, m.episodeNo)}</span>
                                    <span className={styles.speakerIcon} title={speaker}>
                                        {avatar}
                                    </span>
                                    <span className={styles.rowText}>
                                        <Highlighted text={text} query={query} />
                                    </span>
                                </>
                            );
                            return (
                                <li key={`${m.episodeTitle}-${m.messageNo}`}>
                                    {episode ? (
                                        <Link href={lineUrl(episode, m.messageNo)} className={styles.row}>
                                            {row}
                                        </Link>
                                    ) : (
                                        <span className={styles.row}>{row}</span>
                                    )}
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
                <section id='stories' className={styles.section}>
                    <h2>Stories</h2>
                    <p className='pixel-label'>{matches(storyLinesResult.total)}</p>
                    <ul className={styles.rowList}>
                        {storyLinesResult.data.map((sl) => (
                            <li key={`${sl.storySlug}-${sl.chapterNo}-${sl.lineNo}`}>
                                <Link
                                    href={storyQuoteUrl({
                                        storySlug: sl.storySlug,
                                        chapterNo: sl.chapterNo,
                                        line_no: sl.lineNo,
                                    })}
                                    className={styles.row}
                                >
                                    <SeasonTag title={sl.seasonTitle} />
                                    <span className={styles.rowMeta}>
                                        {sl.storyTitle}, chapter {sl.chapterNo}
                                    </span>
                                    <span className={styles.rowText}>
                                        <Highlighted text={sl.text} query={query} />
                                    </span>
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

            {commentariesResult.total > 0 && (
                <section id='commentary' className={styles.section}>
                    <h2>Commentary</h2>
                    <p className='pixel-label'>{matches(commentariesResult.total)}</p>
                    <ul className={styles.rowList}>
                        {commentariesResult.data.map((c) => (
                            <li key={c.id}>
                                <Link
                                    href={lineUrl(
                                        {
                                            title: c.episodeTitle,
                                            episode_no: c.episodeNo,
                                            slug: c.episodeSlug ?? undefined,
                                            seasonTitle: c.seasonTitle,
                                        },
                                        c.messageNo
                                    )}
                                    className={styles.row}
                                >
                                    <SeasonTag title={c.seasonTitle} />
                                    <span className={styles.rowMeta}>
                                        {episodeLabel(c.episodeTitle, c.episodeNo)}, line {c.messageNo}, {c.author}
                                    </span>
                                    <span className={styles.rowText}>
                                        <Highlighted text={plainText(c.content)} query={query} />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <Pager
                        page={commentariesResult.page}
                        total={commentariesResult.total}
                        limit={commentariesResult.limit}
                        paramName='commentariesPage'
                        searchParams={urlParams}
                    />
                </section>
            )}
        </main>
    );
}
