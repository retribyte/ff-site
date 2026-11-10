import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { CharacterQuotes, Character } from '@/lib/types';
import { characterColor } from '@/lib/characterColors';
import { personaHasName } from '@/lib/personaIdentity';
import { lineUrl } from '@/lib/seasons';
import { averageWords, countWords, quotedSpanText, storyQuoteUrl } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import QuoteLog, { type LogQuote } from '@/components/characters/QuoteLog';
import styles from './quotes.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const character = await api<Character>(`/characters/${id}`);
        return { title: `${character.name}'s Quotes` };
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
        '--char-dark': characterColor(character.name, character.color, 'dark', character.colorLight ?? null),
        '--char-light': characterColor(character.name, character.color, 'light', character.colorLight ?? null),
    } as React.CSSProperties;

    // Only what the log shows and filters on goes to the client
    const log: LogQuote[] = [
        ...quotes.messages.map((m) => ({
            key: `m-${m.episodeTitle}-${m.messageNo}`,
            source: 'transcript' as const,
            season: m.episode?.seasonTitle ?? null,
            story: null,
            text: m.text,
            href: m.episode ? lineUrl(m.episode, m.messageNo) : null,
            // Named personas show as "(as X)", as on the character page; look-only ones don't
            context: m.episode
                ? `${m.episode.seasonTitle} — ${m.episodeTitle}${personaHasName(m.persona) ? ` (as ${m.persona!.name})` : ''}, line ${m.messageNo}`
                : '',
            words: countWords(m.text),
        })),
        ...quotes.storyQuotes.map((q) => {
            // A segmented paragraph quotes only this character's spans
            const text = quotedSpanText(q, character.id);
            return {
                key: `s-${q.id}`,
                source: 'story' as const,
                season: q.storySeason ?? null,
                story: { slug: q.storySlug, title: q.storyTitle },
                text,
                href: storyQuoteUrl(q),
                context: `${q.storyTitle} — ch. ${q.chapterNo}, line ${q.line_no}`,
                words: countWords(text),
            };
        }),
    ];

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
                    colorLight={character.colorLight ?? null}
                    size={64}
                />
                <div>
                    <h1 className={styles.title}>Quote log</h1>
                    <p className='pixel-label'>
                        {log.length.toLocaleString('en-US')} recorded quote{log.length === 1 ? '' : 's'} from{' '}
                        {character.name}
                        {log.length > 0 && <> ⭑ {averageWords(log)} words on average</>}
                    </p>
                </div>
            </header>

            <QuoteLog name={character.name} quotes={log} />
        </main>
    );
}
