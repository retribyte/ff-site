import { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { CharacterQuotes, Character } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { personaHasName } from '@/lib/personaIdentity';
import { lineUrl } from '@/lib/seasons';
import { quotedSpanText, storyQuoteUrl } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import { getSessionUser } from '@/lib/auth';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import ActionChip from '@/components/editor/ActionChip';
import WikiLink from '@/components/WikiLink';
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
    try {
        character = await getCharacter(idParam);
        if (character) {
            quotes = await api<CharacterQuotes>(`/characters/${character.id}/quotes`).catch(() => quotes);
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
        '--char-dark': characterColor(character.name, character.color, 'dark'),
        '--char-light': characterColor(character.name, character.color, 'light'),
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
                ? `${m.episode.seasonTitle} · ${m.episodeTitle}${personaHasName(m.persona) ? ` (as ${m.persona!.name})` : ''}`
                : undefined,
        })),
        ...quotes.storyQuotes.map((q) => ({
            key: `story-${q.id}`,
            text: quotedSpanText(q, character.id),
            href: storyQuoteUrl(q),
            context: `${q.storyTitle} · ch. ${q.chapterNo}`,
        })),
    ];
    // Fresh random intercepts on every visit — intentional impurity on a
    // dynamic server-rendered route (nothing rehydrates against it).
    // eslint-disable-next-line react-hooks/purity
    const sampleQuotes = [...teaserQuotes].sort(() => Math.random() - 0.5).slice(0, 3);

    const facts: [string, React.ReactNode][] = [];
    if (character.species.length) {
        facts.push([
            'species',
            character.species.map((s, i) => (
                <Fragment key={s.id}>
                    {i > 0 && ' / '}
                    <Link href={`/species/${s.slug}`} className={styles.factLink}>
                        {s.name}
                    </Link>
                </Fragment>
            )),
        ]);
    }

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
                            <h2 className={styles.sectionTitle}>Intercepted transmissions</h2>
                            <ul className={styles.quotes}>
                                {sampleQuotes.map((quote) => (
                                    <li key={quote.key} className={styles.quote}>
                                        <span className={styles.quoteMark} aria-hidden>
                                            “
                                        </span>
                                        <blockquote>
                                            <p>{quote.text}</p>
                                            {quote.href && (
                                                <footer>
                                                    <Link href={quote.href}>{quote.context}</Link>
                                                </footer>
                                            )}
                                        </blockquote>
                                    </li>
                                ))}
                            </ul>
                            <Link href={`/characters/${character.slug}/quotes`} className={styles.quotesLink}>
                                full quote log ({teaserQuotes.length}) →
                            </Link>
                        </section>
                    )}
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        <ThemedAvatar
                            src={character.image}
                            name={character.name}
                            color={character.color}
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
