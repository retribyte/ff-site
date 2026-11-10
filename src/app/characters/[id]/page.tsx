import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { CharacterAppearances, CharacterQuotes, Character } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { personaHasName } from '@/lib/personaIdentity';
import { lineUrl, seasonColors, seasonDisplayName, seasonOrder, seasonSlug } from '@/lib/seasons';
import { quotedSpanText, storyQuoteUrl } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import { getSessionUser } from '@/lib/auth';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import ActionChip from '@/components/editor/ActionChip';
import SpeakerAdmin from '@/components/characters/SpeakerAdmin';
import QuoteTeaser from '@/components/characters/QuoteTeaser';
import WikiLink from '@/components/WikiLink';
import UserLink from '@/components/UserLink';
import { wikiFacts, type WikiFieldSpec } from '@/lib/wiki';
import styles from './character.module.scss';
import RichText from '@/components/RichText';

// Wiki fields pinned to the top of the infobox, in this order (with a label
// where the generated one reads badly); any other wiki field follows.
const CHARACTER_WIKI_ORDER: WikiFieldSpec[] = [
    { field: 'fullname', label: 'Full Name' },
    // Wiki-page nicknames — a different concept from the DB Persona "also
    // known as" chips in the article body (alternate presentation eras)
    { field: 'aliases', label: 'Nicknames' },
    // The wiki owns species (there's no species table in the DB)
    'species',
    'occupation',
    'faction',
    { field: 'birthdate', label: 'Born' },
    'birthplace',
    { field: 'deathdate', label: 'Died' },
    { field: 'deathcause', label: 'Cause of Death' },
    { field: 'relationship', label: 'Relationships' },
    'planet',
    'alignment',
    'sex',
    'sexuality',
    'height',
    'weight',
    'skin',
    'hair',
    'eyes',
];

interface Props {
    params: Promise<{ id: string }>;
}

// Quotes per hand (QuoteTeaser shows the ones that fit in its rows), and how
// many the reroll button cycles through
const TEASER_COUNT = 9;
const TEASER_POOL = 63;

const numberFormat = new Intl.NumberFormat('en-US');

function plural(n: number, word: string, many = `${word}s`): string {
    return `${numberFormat.format(n)} ${n === 1 ? word : many}`;
}

function shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** One story the character speaks in, gathered from its story quotes */
interface StoryAppearance {
    slug: string;
    title: string;
    season: string | null;
    lines: number;
    chapters: Set<number>;
    first: { storySlug: string; chapterNo: number; line_no: number };
}

function storyAppearances(quotes: CharacterQuotes['storyQuotes']): StoryAppearance[] {
    const bySlug = new Map<string, StoryAppearance>();
    for (const q of quotes) {
        let story = bySlug.get(q.storySlug);
        if (!story) {
            story = { slug: q.storySlug, title: q.storyTitle, season: q.storySeason ?? null, lines: 0, chapters: new Set(), first: q };
            bySlug.set(q.storySlug, story);
        }
        story.lines += 1;
        story.chapters.add(q.chapterNo);
        if (q.chapterNo < story.first.chapterNo || (q.chapterNo === story.first.chapterNo && q.line_no < story.first.line_no)) {
            story.first = q;
        }
    }
    return [...bySlug.values()].sort((a, b) => {
        const [ra, ka] = seasonOrder(a.season);
        const [rb, kb] = seasonOrder(b.season);
        return ra - rb || ka.localeCompare(kb) || a.title.localeCompare(b.title);
    });
}

function episodeLabel(episode: { episodeNo: number; title: string; reconstructed: boolean }): React.ReactNode {
    return (
        <>
            <span className={styles.episodeNo}>{episode.reconstructed ? 'reconstructed' : `ep ${episode.episodeNo}`}</span>
            {episode.title}
        </>
    );
}

async function getCharacter(param: string): Promise<Character | null> {
    try {
        return await api<Character>(`/characters/${param}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const character = await getCharacter(id);
        return { title: character ? character.name : 'Characters' };
    } catch {
        return { title: 'Characters' };
    }
}

export default async function CharacterPage({ params }: Props) {
    const { id: idParam } = await params;

    let character: Character | null;
    let quotes: CharacterQuotes = { messages: [], storyQuotes: [] };
    let appearances: CharacterAppearances = { campaigns: [], costars: [] };
    try {
        character = await getCharacter(idParam);
        if (character) {
            [quotes, appearances] = await Promise.all([
                api<CharacterQuotes>(`/characters/${character.id}/quotes`).catch(() => quotes),
                api<CharacterAppearances>(`/characters/${character.id}/appearances`).catch(() => appearances),
            ]);
        }
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!character) notFound();

    const user = await getSessionUser();
    const canEdit = user !== null && (user.role === 'ADMIN' || user.id === character.creatorId);

    // Both theme variants go on the page root; CSS picks per data-theme
    const style = {
        '--char-dark': characterColor(character.name, character.color, 'dark', character.colorLight ?? null),
        '--char-light': characterColor(character.name, character.color, 'light', character.colorLight ?? null),
    } as React.CSSProperties;

    // Transcript messages and story-embedded dialogue have no shared sort
    // key (message timestamp vs. story/chapter/line position) — flatten to a
    // display-only teaser list, keeping each source's own link context.
    const teaserQuotes = [
        ...quotes.messages.map((m) => ({
            key: `msg-${m.episodeTitle}-${m.messageNo}`,
            text: m.text,
            href: m.episode ? lineUrl(m.episode, m.messageNo) : undefined,
            // Name-less personas (look-only) carry no lore-relevant name, so
            // they're skipped here — only named personas earn "(as X)".
            context: m.episode
                ? `${m.episode.seasonTitle} — ${m.episodeTitle}${personaHasName(m.persona) ? ` (as ${m.persona!.name})` : ''}`
                : undefined,
        })),
        ...quotes.storyQuotes.map((q) => ({
            key: `story-${q.id}`,
            text: quotedSpanText(q, character.id),
            href: storyQuoteUrl(q),
            context: `${q.storyTitle} — ch. ${q.chapterNo}`,
        })),
    ];
    // Fresh random intercepts on every visit — intentional impurity on a
    // dynamic server-rendered route. QuoteTeaser takes this order as its
    // initial state, so hydration matches whatever the server picked.
    const quotePool = shuffled(teaserQuotes).slice(0, TEASER_POOL);

    // Campaigns: the ones it speaks in, plus story-only campaigns an admin
    // cast it in (no transcript, so no stats)
    const mainIn = new Set((character.mainIn ?? []).map((s) => s.title));
    const campaignRows = [
        ...appearances.campaigns,
        ...(character.mainIn ?? [])
            .filter((s) => !appearances.campaigns.some((c) => c.season === s.title))
            .map((s) => ({ season: s.title, slug: s.slug, castOnly: true as const })),
    ].sort((a, b) => {
        const [ra, ka] = seasonOrder(a.season);
        const [rb, kb] = seasonOrder(b.season);
        return ra - rb || ka.localeCompare(kb);
    });
    const stories = storyAppearances(quotes.storyQuotes);

    const facts: [string, React.ReactNode][] = [];
    if (character.creator) facts.push(['played by', <UserLink key='creator' username={character.creator.username} icon={character.creator.icon} />]);
    facts.push(...wikiFacts(character.wiki, CHARACTER_WIKI_ORDER, facts.map(([label]) => label)));

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href='/characters'>← all characters</Link>
            </nav>

            <div className={styles.layout}>
                <article className={styles.article}>
                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{character.name}</h1>
                        <WikiLink slug={character.slug} />
                        {canEdit && <ActionChip href={`/characters/${character.slug}/edit`} label='edit ✎' />}
                    </div>

                    {(() => {
                        // Name-less personas (look-only: a new avatar/color
                        // with the same name) are presentation plumbing, not
                        // a lore fact — only named personas show as chips.
                        // Distinct from the infobox's "nicknames" row (wiki
                        // aliases) — these are alternate presentation eras,
                        // not nicknames.
                        const namedPersonas = character.personas?.filter(personaHasName) ?? [];
                        return (
                            namedPersonas.length > 0 && (
                                <p className={styles.personas}>
                                    <span className='pixel-label'>also known as</span>
                                    {namedPersonas.map((p) => (
                                        <span key={p.id} className={styles.personaChip}>
                                            {p.name}
                                        </span>
                                    ))}
                                </p>
                            )
                        );
                    })()}

                    {character.blurb ? (
                        <RichText html={character.blurb} className={styles.blurb} />
                    ) : (
                        <p className='pixel-label'>no dossier on file — records pending</p>
                    )}

                    {teaserQuotes.length > 0 && (
                        <section className={styles.section}>
                            <QuoteTeaser
                                pool={quotePool}
                                count={TEASER_COUNT}
                                title='Quotes'
                                titleClassName={styles.sectionTitle}
                            />
                            <Link href={`/characters/${character.slug}/quotes`} className={styles.quotesLink}>
                                full quote log ({numberFormat.format(teaserQuotes.length)}) →
                            </Link>
                        </section>
                    )}

                    {campaignRows.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Episode appearances</h2>
                            <ul className={styles.record}>
                                {campaignRows.map((row) => (
                                    <li
                                        key={row.season}
                                        className={styles.recordRow}
                                        style={{ '--season': seasonColors(row.season).primary } as React.CSSProperties}
                                    >
                                        <div className={styles.recordHead}>
                                            <Link href={`/archives/${row.slug ?? seasonSlug(row.season)}`} className={styles.recordTitle}>
                                                {seasonDisplayName(row.season)}
                                            </Link>
                                            {mainIn.has(row.season) && <span className={styles.recordTag}>main cast</span>}
                                        </div>
                                        {'castOnly' in row ? (
                                            <p className={styles.recordStats}>story-only campaign</p>
                                        ) : (
                                            <>
                                                <p className={styles.recordStats}>
                                                    {numberFormat.format(row.episodes)} of {plural(row.seasonEpisodes, 'episode')},{' '}
                                                    {plural(row.messages, 'message')}
                                                </p>
                                                <dl className={styles.recordLinks}>
                                                    <div>
                                                        <dt>first seen</dt>
                                                        <dd>
                                                            <Link
                                                                href={lineUrl(
                                                                    { title: row.first.title, slug: row.first.slug, episode_no: row.first.episodeNo, seasonTitle: row.season },
                                                                    row.first.messageNo
                                                                )}
                                                            >
                                                                {episodeLabel(row.first)}
                                                            </Link>
                                                        </dd>
                                                    </div>
                                                    {row.last.title !== row.first.title && (
                                                        <div>
                                                            <dt>last seen</dt>
                                                            <dd>
                                                                <Link
                                                                    href={lineUrl(
                                                                        { title: row.last.title, slug: row.last.slug, episode_no: row.last.episodeNo, seasonTitle: row.season },
                                                                        row.last.messageNo
                                                                    )}
                                                                >
                                                                    {episodeLabel(row.last)}
                                                                </Link>
                                                            </dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {stories.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Story appearances</h2>
                            <ul className={styles.record}>
                                {stories.map((story) => (
                                    <li
                                        key={story.slug}
                                        className={styles.recordRow}
                                        style={{ '--season': story.season ? seasonColors(story.season).primary : 'var(--accent)' } as React.CSSProperties}
                                    >
                                        <div className={styles.recordHead}>
                                            <Link href={`/stories/${story.slug}`} className={styles.recordTitle}>
                                                {story.title}
                                            </Link>
                                            {story.season && <span className={styles.recordTag}>{story.season}</span>}
                                        </div>
                                        <p className={styles.recordStats}>
                                            {plural(story.lines, 'line')} across {plural(story.chapters.size, 'chapter')}
                                        </p>
                                        <dl className={styles.recordLinks}>
                                            <div>
                                                <dt>first line</dt>
                                                <dd>
                                                    <Link href={storyQuoteUrl(story.first)}>
                                                        chapter {story.first.chapterNo}, line {story.first.line_no}
                                                    </Link>
                                                </dd>
                                            </div>
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {appearances.costars.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Frequent co-stars</h2>
                            <ul className={styles.costars}>
                                {appearances.costars.map((c) => (
                                    <li key={c.id}>
                                        <Link
                                            href={`/characters/${c.slug}`}
                                            className={styles.costar}
                                            style={
                                                {
                                                    '--co-dark': characterColor(c.name, c.color, 'dark', c.colorLight),
                                                    '--co-light': characterColor(c.name, c.color, 'light', c.colorLight),
                                                } as React.CSSProperties
                                            }
                                        >
                                            <ThemedAvatar src={c.image} name={c.name} color={c.color} colorLight={c.colorLight} size={42} />
                                            <span className={styles.costarName}>{c.name}</span>
                                            {c.episodes > 0 && <span className={styles.costarStats}>{plural(c.episodes, 'episode')}</span>}
                                            {c.stories > 0 && <span className={styles.costarStats}>{plural(c.stories, 'story', 'stories')}</span>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {user?.role === 'ADMIN' && (
                        <SpeakerAdmin
                            characterId={character.id}
                            name={character.name}
                            slug={character.slug}
                            mainIn={(character.mainIn ?? []).map((s) => s.title)}
                            creatorId={character.creatorId}
                        />
                    )}
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        <ThemedAvatar
                            src={character.image}
                            name={character.name}
                            color={character.color}
                            colorLight={character.colorLight ?? null}
                            size={96}
                        />
                    </div>
                    {facts.length > 0 ? (
                        <dl className={styles.facts}>
                            {facts.map(([label, value]) => (
                                <div key={label} className={styles.fact}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <p className='pixel-label' style={{ textAlign: 'center', padding: '0.75rem' }}>
                            no data recovered
                        </p>
                    )}
                </aside>
            </div>
        </main>
    );
}
