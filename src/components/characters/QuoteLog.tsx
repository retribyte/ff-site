'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import IndexScan from '@/components/IndexScan';
import { seasonColors, seasonOrder } from '@/lib/seasons';
import { averageWords } from '@/lib/stories';
import styles from './quoteLog.module.scss';

/** One quote on a character's quote log, from a transcript or a story. */
export interface LogQuote {
    key: string;
    source: 'transcript' | 'story';
    /** Season title ("FF2", "T&L"); null for a story filed under no season */
    season: string | null;
    story: { slug: string; title: string } | null;
    text: string;
    /** Deep link to the line, and its "FF2 — Episode, line 4" label */
    href: string | null;
    context: string;
    words: number;
}

// Filter keys: a season with no title, and the story select's special values
const NO_SEASON = '';
const ALL_SOURCES = '';
const TRANSCRIPTS = '__transcripts';

/** A set with `value` flipped in or out. */
function toggled<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
}

export default function QuoteLog({ name, quotes }: { name: string; quotes: LogQuote[] }) {
    const [query, setQuery] = useState('');
    // Seasons switched off, so every season starts switched on
    const [hiddenSeasons, setHiddenSeasons] = useState<Set<string>>(() => new Set());
    const [source, setSource] = useState(ALL_SOURCES);

    // One chip per season this character is quoted in, in campaign order (no season last)
    const seasons = useMemo(() => {
        const seen = new Map<string, { key: string; label: string; color: string }>();
        for (const q of quotes) {
            const key = q.season ?? NO_SEASON;
            if (!seen.has(key)) {
                seen.set(key, {
                    key,
                    label: q.season ?? 'other',
                    color: q.season ? seasonColors(q.season).primary : 'var(--text-muted)',
                });
            }
        }
        return [...seen.values()].sort((a, b) => {
            const [ra, ka] = seasonOrder(a.key || null);
            const [rb, kb] = seasonOrder(b.key || null);
            return ra - rb || ka.localeCompare(kb);
        });
    }, [quotes]);

    const stories = useMemo(() => {
        const seen = new Map<string, string>();
        for (const q of quotes) if (q.story && !seen.has(q.story.slug)) seen.set(q.story.slug, q.story.title);
        return [...seen].map(([slug, title]) => ({ slug, title })).sort((a, b) => a.title.localeCompare(b.title));
    }, [quotes]);
    const hasTranscripts = quotes.some((q) => q.source === 'transcript');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return quotes.filter((quote) => {
            if (hiddenSeasons.has(quote.season ?? NO_SEASON)) return false;
            if (source === TRANSCRIPTS && quote.source !== 'transcript') return false;
            if (source !== ALL_SOURCES && source !== TRANSCRIPTS && quote.story?.slug !== source) return false;
            return !q || quote.text.toLowerCase().includes(q);
        });
    }, [quotes, query, hiddenSeasons, source]);

    const transcriptQuotes = visible.filter((q) => q.source === 'transcript');
    const storyQuotes = visible.filter((q) => q.source === 'story');
    const narrowed = visible.length < quotes.length;

    return (
        <div>
            {quotes.length > 0 && (
                <>
                    <IndexScan
                        query={query}
                        onQueryChange={setQuery}
                        placeholder='search quotes…'
                        label={`Search ${name}'s quotes`}
                        count={visible.length}
                    >
                        {(stories.length > 0 || hasTranscripts) && (
                            <select
                                className={styles.sourceSelect}
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                aria-label='Filter by story'
                            >
                                <option value={ALL_SOURCES}>all sources</option>
                                {hasTranscripts && stories.length > 0 && <option value={TRANSCRIPTS}>transcripts only</option>}
                                {stories.length > 0 && (
                                    <optgroup label='stories'>
                                        {stories.map((s) => (
                                            <option key={s.slug} value={s.slug}>
                                                {s.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        )}
                    </IndexScan>

                    {seasons.length > 1 && (
                        <div className={styles.filters} role='group' aria-label='Show quotes by season'>
                            {seasons.map((season) => (
                                <button
                                    key={season.key}
                                    type='button'
                                    className={styles.filter}
                                    style={{ '--tone': season.color } as React.CSSProperties}
                                    aria-pressed={!hiddenSeasons.has(season.key)}
                                    onClick={() => setHiddenSeasons((set) => toggled(set, season.key))}
                                >
                                    {season.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {narrowed && visible.length > 0 && (
                        <p className={`pixel-label ${styles.stats}`}>
                            {visible.length.toLocaleString('en-US')} shown &mdash; {averageWords(visible)} words on average
                        </p>
                    )}
                </>
            )}

            {visible.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {quotes.length === 0 ? 'no quotes on record' : 'no quotes match that scan'}
                </p>
            )}

            {transcriptQuotes.length > 0 && (
                <QuoteSection title='Quotes' quotes={transcriptQuotes} />
            )}
            {storyQuotes.length > 0 && <QuoteSection title='Story appearances' quotes={storyQuotes} />}
        </div>
    );
}

function QuoteSection({ title, quotes }: { title: string; quotes: LogQuote[] }) {
    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <ol className={styles.quotes}>
                {quotes.map((quote) => (
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
            </ol>
        </section>
    );
}
