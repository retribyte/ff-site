import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Character, Message, Species } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { lineUrl } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import WikiLink from '@/components/WikiLink';
import styles from './character.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

// One GUY ≈ one Julian year, epoch 1970 — the vortox-bot dob convention
const GUY_SECONDS = 31_557_600;

const SEX_LABELS: Record<Character['sex'], string | null> = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
    UNSPECIFIED: null,
};

async function getCharacter(id: number): Promise<Character | null> {
    try {
        return await api<Character>(`/characters/${id}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const character = await getCharacter(parseInt(id));
        return { title: character ? character.name : 'Characters' };
    } catch {
        return { title: 'Characters' };
    }
}

export default async function CharacterPage({ params }: Props) {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) notFound();

    let character: Character | null;
    let species: Species | null = null;
    let quotes: Message[] = [];
    try {
        character = await getCharacter(id);
        if (character) {
            [species, quotes] = await Promise.all([
                api<Species>(`/species/${character.speciesId}`).catch(() => null),
                api<Message[]>(`/characters/${id}/quotes`).catch(() => [] as Message[]),
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

    // Both theme variants go on the page root; CSS picks per data-theme
    const style = {
        '--char-dark': characterColor(character.name, character.themeColor, 'dark'),
        '--char-light': characterColor(character.name, character.themeColor, 'light'),
    } as React.CSSProperties;

    const aliases = character.aliases ?? [];
    const relationships = character.relationships ?? [];
    const sampleQuotes = [...quotes].sort(() => Math.random() - 0.5).slice(0, 3);

    const facts: [string, React.ReactNode][] = [];
    if (species) {
        facts.push([
            'species',
            <Link key='species' href={`/species/${species.id}`} className={styles.factLink}>
                {species.name}
            </Link>,
        ]);
    }
    const sexLabel = SEX_LABELS[character.sex];
    if (sexLabel) facts.push(['sex', sexLabel]);
    if (character.dob !== null) facts.push(['born', `GUY ${Math.floor(character.dob / GUY_SECONDS)}`]);
    if (character.pob) facts.push(['birthplace', character.pob]);
    if (character.homePlanet) facts.push(['home planet', character.homePlanet]);
    if (character.height !== null) facts.push(['height', `${character.height} m`]);
    if (character.weight !== null) facts.push(['weight', `${character.weight} kg`]);
    if (character.hairColor) facts.push(['hair', character.hairColor]);
    if (character.eyeColor) facts.push(['eyes', character.eyeColor]);

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href='/characters'>← all characters</Link>
            </nav>

            <div className={styles.layout}>
                <article className={styles.article}>
                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{character.name}</h1>
                        <WikiLink article={character.wikiArticle} />
                    </div>
                    {aliases.length > 0 && (
                        <p className={styles.aliases}>
                            a.k.a.{' '}
                            {aliases.map((alias) => (
                                <span key={alias.id} className={styles.alias}>
                                    {alias.name}
                                </span>
                            ))}
                        </p>
                    )}

                    {character.blurb ? (
                        <p className={styles.blurb}>{character.blurb}</p>
                    ) : (
                        <p className='pixel-label'>no dossier on file — records pending</p>
                    )}

                    {relationships.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Known relations</h2>
                            <ul className={styles.relations}>
                                {relationships.map((rel) => (
                                    <li key={rel.id}>{rel.description}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {quotes.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Intercepted transmissions</h2>
                            <ul className={styles.quotes}>
                                {sampleQuotes.map((quote) => (
                                    <li key={`${quote.episodeTitle}-${quote.messageNo}`} className={styles.quote}>
                                        <span className={styles.quoteMark} aria-hidden>
                                            “
                                        </span>
                                        <blockquote>
                                            <p>{quote.text}</p>
                                            {quote.episode && (
                                                <footer>
                                                    <Link href={lineUrl(quote.episode, quote.messageNo)}>
                                                        {quote.episode.seasonTitle} · {quote.episodeTitle}
                                                    </Link>
                                                </footer>
                                            )}
                                        </blockquote>
                                    </li>
                                ))}
                            </ul>
                            <Link href={`/characters/${character.id}/quotes`} className={styles.quotesLink}>
                                full quote log ({quotes.length}) →
                            </Link>
                        </section>
                    )}
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        <ThemedAvatar
                            src={character.image}
                            name={character.name}
                            themeColor={character.themeColor}
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
