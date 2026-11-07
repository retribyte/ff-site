'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import IndexScan from '@/components/IndexScan';
import { formatWords, storyGroupId } from '@/lib/stories';
import styles from './storyIndex.module.scss';

export interface IndexStory {
    slug: string;
    title: string;
    blurb: string | null;
    authorNames: string[];
    publishedDate: string | null;
    chapterCount: number;
    wordCount: number;
    colors: { primary: string; secondary: string };
    /** Shelf section heading (e.g. the story's campaign); stories arrive pre-sorted by group. */
    group?: string | null;
    /** The story's season: its code ("FF3", "T&L") and identity color; null = no season */
    season: { code: string; color: string } | null;
    canon: boolean;
}

type Continuity = 'canon' | 'noncanon';

// Filter key for stories filed under no season
const NO_SEASON = '';
const NO_SEASON_LABEL = 'other';

const CONTINUITY: Continuity[] = ['canon', 'noncanon'];
const CONTINUITY_LABELS: Record<Continuity, string> = { canon: 'canon', noncanon: 'non-canon' };

/** A set with `value` flipped in or out. */
function toggled<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
}

export default function StoryIndex({ stories }: { stories: IndexStory[] }) {
    const [query, setQuery] = useState('');
    // Seasons switched off (so a season that shows up later starts switched on)
    const [hiddenSeasons, setHiddenSeasons] = useState<Set<string>>(() => new Set());
    const [continuity, setContinuity] = useState<Set<Continuity>>(() => new Set(CONTINUITY));

    // One chip per season on the shelf, in shelf order (stories arrive sorted)
    const seasons = useMemo(() => {
        const seen = new Map<string, { key: string; label: string; color: string }>();
        for (const s of stories) {
            const key = s.season?.code ?? NO_SEASON;
            if (!seen.has(key)) {
                seen.set(key, {
                    key,
                    label: s.season?.code ?? NO_SEASON_LABEL,
                    color: s.season?.color ?? 'var(--text-muted)',
                });
            }
        }
        return [...seen.values()];
    }, [stories]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return stories.filter((s) => {
            if (hiddenSeasons.has(s.season?.code ?? NO_SEASON)) return false;
            if (!continuity.has(s.canon ? 'canon' : 'noncanon')) return false;
            if (!q) return true;
            return s.title.toLowerCase().includes(q) || (s.blurb ?? '').toLowerCase().includes(q);
        });
    }, [stories, query, hiddenSeasons, continuity]);

    // Consecutive stories sharing a group form one section; ungrouped lists render as a single shelf.
    const groups = useMemo(() => {
        const out: { label: string | null; stories: IndexStory[] }[] = [];
        for (const s of visible) {
            const label = s.group ?? null;
            if (out.length && out[out.length - 1].label === label) out[out.length - 1].stories.push(s);
            else out.push({ label, stories: [s] });
        }
        return out;
    }, [visible]);

    const filtersNarrowed = hiddenSeasons.size > 0 || continuity.size < CONTINUITY.length;

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by title or blurb…'
                label='Search stories by title or blurb'
                count={visible.length}
            />

            <div className={styles.filters}>
                <div className={styles.filterGroup} role='group' aria-label='Show stories by season'>
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
                <span className={styles.filterRule} aria-hidden />
                <div className={styles.filterGroup} role='group' aria-label='Show canon or non-canon stories'>
                    {CONTINUITY.map((c) => (
                        <button
                            key={c}
                            type='button'
                            className={styles.filter}
                            data-tone={c}
                            aria-pressed={continuity.has(c)}
                            onClick={() => setContinuity((set) => toggled(set, c))}
                        >
                            {CONTINUITY_LABELS[c]}
                        </button>
                    ))}
                </div>
            </div>

            {visible.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {stories.length === 0
                        ? 'no stories on the shelf yet'
                        : filtersNarrowed && !query.trim()
                          ? 'no stories of that kind on the shelf'
                          : 'no stories match that scan'}
                </p>
            )}

            {groups.map((group) => (
                <section key={group.label ?? '_'} id={group.label ? storyGroupId(group.label) : undefined}>
                    {group.label && <h2 className={styles.groupHeading}>{group.label}</h2>}
                    <ul className={styles.shelf}>
                        {group.stories.map((s) => (
                            <li key={s.slug} className={styles.row}>
                                <Link
                                    href={`/stories/${s.slug}`}
                                    className={styles.card}
                                    style={{ '--story': s.colors.primary, '--story-2': s.colors.secondary } as React.CSSProperties}
                                >
                                    <span className={styles.cardTitle}>{s.title}</span>
                                    {s.blurb && <span className={styles.cardBlurb}>{s.blurb}</span>}
                                    <span className={styles.cardMeta}>
                                        <span className='pixel-label'>
                                            {s.chapterCount > 1 && <>{s.chapterCount} chapters ⭑ </>}
                                            {formatWords(s.wordCount)}
                                            {s.authorNames.length > 0 && <> ⭑ by {s.authorNames.join(', ')}</>}
                                        </span>
                                        <span className={styles.tags}>
                                            {s.season && (
                                                <span
                                                    className={styles.tag}
                                                    style={{ '--tone': s.season.color } as React.CSSProperties}
                                                >
                                                    {s.season.code}
                                                </span>
                                            )}
                                            <span className={styles.tag} data-tone={s.canon ? 'canon' : 'noncanon'}>
                                                {s.canon ? 'canon' : 'non-canon'}
                                            </span>
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
