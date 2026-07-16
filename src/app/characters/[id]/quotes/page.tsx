import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { CharacterQuotes, Character } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { lineUrl } from '@/lib/seasons';
import { quotedSpanText, storyQuoteUrl } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import styles from './quotes.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const character = await api<Character>(`/characters/${id}`);
        return { title: `${character.name} · Quotes` };
    } catch {
        return { title: 'Quotes' };
    }
}

export default async function CharacterQuotesPage({ params }: Props) {
    const { id: idParam } = await params;

    let character: Character;
    let quotes: CharacterQuotes;
    try {
        character = await api<Character>(`/characters/${idParam}`);
        quotes = await api<CharacterQuotes>(`/characters/${character.id}/quotes`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) notFound();
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const style = {
        '--char-dark': characterColor(character.name, character.color, 'dark'),
        '--char-light': characterColor(character.name, character.color, 'light'),
    } as React.CSSProperties;

    const { messages, storyQuotes } = quotes;
    const total = messages.length + storyQuotes.length;

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href={`/characters/${character.slug}`}>← {character.name}&apos;s dossier</Link>
            </nav>

            <header className={styles.header}>
                <ThemedAvatar
                    src={character.image}
                    name={character.name}
                    color={character.color}
                    size={64}
                />
                <div>
                    <h1 className={styles.title}>Quote log</h1>
                    <p className='pixel-label'>
                        {total} recorded quote{total === 1 ? '' : 's'} from {character.name}
                    </p>
                </div>
            </header>

            {total === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    no quotes on record
                </p>
            )}

            {messages.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Intercepted transmissions</h2>
                    <ol className={styles.quotes}>
                        {messages.map((quote) => (
                            <li key={`${quote.episodeTitle}-${quote.messageNo}`} className={styles.quote}>
                                <span className={styles.quoteMark} aria-hidden>
                                    “
                                </span>
                                <blockquote>
                                    <p>{quote.text}</p>
                                    {quote.episode && (
                                        <footer>
                                            <Link href={lineUrl(quote.episode, quote.messageNo)}>
                                                {quote.episode.seasonTitle} · {quote.episodeTitle} · line {quote.messageNo}
                                            </Link>
                                        </footer>
                                    )}
                                </blockquote>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {storyQuotes.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Story appearances</h2>
                    <ol className={styles.quotes}>
                        {storyQuotes.map((quote) => (
                            <li key={quote.id} className={styles.quote}>
                                <span className={styles.quoteMark} aria-hidden>
                                    “
                                </span>
                                <blockquote>
                                    <p>{quotedSpanText(quote, character.id)}</p>
                                    <footer>
                                        <Link href={storyQuoteUrl(quote)}>
                                            {quote.storyTitle} · ch. {quote.chapterNo} · line {quote.line_no}
                                        </Link>
                                    </footer>
                                </blockquote>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </main>
    );
}
