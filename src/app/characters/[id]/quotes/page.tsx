import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Character, Message } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { lineUrl } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import styles from './quotes.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const character = await api<Character>(`/characters/${parseInt(id)}`);
        return { title: `${character.name} · Quotes` };
    } catch {
        return { title: 'Quotes' };
    }
}

export default async function CharacterQuotesPage({ params }: Props) {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) notFound();

    let character: Character;
    let quotes: Message[];
    try {
        character = await api<Character>(`/characters/${id}`);
        quotes = await api<Message[]>(`/characters/${id}/quotes`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) notFound();
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const style = {
        '--char-dark': characterColor(character.name, character.themeColor, 'dark'),
        '--char-light': characterColor(character.name, character.themeColor, 'light'),
    } as React.CSSProperties;

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href={`/characters/${character.id}`}>← {character.name}&apos;s dossier</Link>
            </nav>

            <header className={styles.header}>
                <ThemedAvatar
                    src={character.image}
                    name={character.name}
                    themeColor={character.themeColor}
                    size={64}
                />
                <div>
                    <h1 className={styles.title}>Quote log</h1>
                    <p className='pixel-label'>
                        {quotes.length} recorded transmission{quotes.length === 1 ? '' : 's'} from {character.name}
                    </p>
                </div>
            </header>

            {quotes.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    no transmissions on record
                </p>
            )}

            <ol className={styles.quotes}>
                {quotes.map((quote) => (
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
        </main>
    );
}
