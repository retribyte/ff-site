'use client';

import { useMemo, useState } from 'react';
import CharacterCard from './CharacterCard';
import IndexScan from '@/components/IndexScan';
import { compareAppearances, firstAppearance } from '@/lib/characterSort';
import { seasonDisplayName, seasonOrder } from '@/lib/seasons';
import type { CharacterAppearance } from '@/lib/types';
import styles from './characterIndex.module.scss';

export interface IndexCharacter {
    id: number;
    name: string;
    color: string | null;
    colorLight: string | null;
    image: string | null;
    slug: string;
    quoteCount: number;
    quoteWordCount: number;
    appearances: CharacterAppearance[];
}

type SortKey = 'quotes' | 'length' | 'appearance' | 'name';
type Direction = 'asc' | 'desc';

// `directions` names each direction in the sort's own terms. The first sort
// is the default (see compareByQuotes).
const SORTS: {
    key: SortKey;
    label: string;
    defaultDirection: Direction;
    directions: Record<Direction, string>;
}[] = [
    {
        key: 'quotes',
        label: 'times quoted',
        defaultDirection: 'desc',
        directions: { desc: 'most first', asc: 'fewest first' },
    },
    {
        key: 'length',
        label: 'average quote length',
        defaultDirection: 'desc',
        directions: { desc: 'longest first', asc: 'shortest first' },
    },
    {
        key: 'appearance',
        label: 'first appearance',
        defaultDirection: 'asc',
        directions: { asc: 'earliest first', desc: 'latest first' },
    },
    { key: 'name', label: 'name', defaultDirection: 'asc', directions: { asc: 'A → Z', desc: 'Z → A' } },
];

/** Mean words per quote, or null for a character with no quotes. */
function averageLength(c: IndexCharacter): number | null {
    return c.quoteCount > 0 ? c.quoteWordCount / c.quoteCount : null;
}

// Section headings for appearances outside a campaign, and for no appearances at all
const NO_CAMPAIGN = 'Other stories';
const UNPLACED = 'No recorded appearances';

// A section key: a season title, '' for a story outside any campaign, null for unplaced
type GroupKey = string | null;

interface Group {
    key: GroupKey;
    label: string;
    characters: IndexCharacter[];
}

/** The appearance a character is placed by: in its section's campaign when grouped, else its earliest. */
function placement(c: IndexCharacter, group: GroupKey | undefined): CharacterAppearance | null {
    if (group === undefined) return firstAppearance(c.appearances);
    return c.appearances.find((a) => (a.season ?? '') === group) ?? null;
}

/** "FF2 ⭑ ep 1", "VM ⭑ story", or just "ep 3" inside that campaign's own section. */
function appearanceNote(a: CharacterAppearance | null, grouped: boolean): string | null {
    if (!a) return null;
    const where = a.episodeNo === null ? 'story' : a.reconstructed ? 'reconstructed ep' : `ep ${a.episodeNo}`;
    if (grouped) return where;
    return a.season ? `${a.season} ⭑ ${where}` : where;
}

export default function CharacterIndex({ characters }: { characters: IndexCharacter[] }) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortKey>(SORTS[0].key);
    const [direction, setDirection] = useState<Direction>(SORTS[0].defaultDirection);
    const [grouped, setGrouped] = useState(false);

    const matching = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return characters;
        return characters.filter((c) => c.name.toLowerCase().includes(q));
    }, [characters, query]);

    const groups = useMemo<Group[]>(() => {
        const sign = direction === 'asc' ? 1 : -1;
        const sorted = (list: IndexCharacter[], group?: GroupKey): IndexCharacter[] => {
            return [...list].sort((a, b) => {
                let diff = 0;
                if (sort === 'quotes') diff = sign * (a.quoteCount - b.quoteCount);
                else if (sort === 'name') diff = sign * a.name.localeCompare(b.name);
                else if (sort === 'length') {
                    const [la, lb] = [averageLength(a), averageLength(b)];
                    // no quotes, no length: last either way
                    if (la === null || lb === null) diff = (la === null ? 1 : 0) - (lb === null ? 1 : 0);
                    else diff = sign * (la - lb);
                }
                else {
                    const [pa, pb] = [placement(a, group), placement(b, group)];
                    // no appearance on record sorts last either way
                    if (!pa || !pb) diff = (pa ? 0 : 1) - (pb ? 0 : 1);
                    else diff = sign * compareAppearances(pa, pb);
                }
                return diff || a.name.localeCompare(b.name) || a.id - b.id;
            });
        };

        if (!grouped) return [{ key: null, label: '', characters: sorted(matching) }];

        // One section per campaign the character appears in, so a character
        // in several campaigns is listed under each of them
        const sections = new Map<GroupKey, IndexCharacter[]>();
        for (const c of matching) {
            const keys: GroupKey[] = c.appearances.length ? [...new Set(c.appearances.map((a) => a.season ?? ''))] : [null];
            for (const key of keys) sections.set(key, [...(sections.get(key) ?? []), c]);
        }
        const rank = (key: GroupKey): readonly [number, string] => (key === null ? [4, ''] : key === '' ? [3, ''] : seasonOrder(key));
        return [...sections.keys()]
            .sort((a, b) => {
                const [ra, ka] = rank(a);
                const [rb, kb] = rank(b);
                return ra - rb || ka.localeCompare(kb);
            })
            .map((key) => ({
                key,
                label: key === null ? UNPLACED : key === '' ? NO_CAMPAIGN : seasonDisplayName(key),
                characters: sorted(sections.get(key)!, key),
            }));
    }, [matching, sort, direction, grouped]);

    const note = (c: IndexCharacter, group: GroupKey): string | null => {
        if (sort === 'quotes') return `quoted ${c.quoteCount.toLocaleString('en-US')} time${c.quoteCount === 1 ? '' : 's'}`;
        if (sort === 'length') {
            const length = averageLength(c);
            if (length === null) return 'never quoted';
            const shown = length.toLocaleString('en-US', { maximumFractionDigits: 1 });
            return `${shown} word${shown === '1' ? '' : 's'} a quote`;
        }
        if (sort === 'appearance') {
            return appearanceNote(grouped ? placement(c, group) : firstAppearance(c.appearances), grouped);
        }
        return null;
    };

    const sortDef = SORTS.find((s) => s.key === sort)!;

    const changeSort = (key: SortKey) => {
        setSort(key);
        setDirection(SORTS.find((s) => s.key === key)!.defaultDirection);
    };

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name…'
                label='Search characters by name'
                count={matching.length}
            />

            <div className={styles.options}>
                <label className={styles.sortField}>
                    <span className='pixel-label'>sort</span>
                    <select className={styles.sortSelect} value={sort} onChange={(e) => changeSort(e.target.value as SortKey)}>
                        {SORTS.map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type='button'
                    className={styles.direction}
                    onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
                    aria-label={`Order: ${sortDef.directions[direction]} (click for ${sortDef.directions[direction === 'asc' ? 'desc' : 'asc']})`}
                >
                    ⇅ {sortDef.directions[direction]}
                </button>
                <button
                    type='button'
                    className={styles.option}
                    aria-pressed={grouped}
                    onClick={() => setGrouped(!grouped)}
                >
                    group by campaign
                </button>
                {grouped && <span className={styles.optionHint}>listed under every campaign they appear in</span>}
            </div>

            {matching.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    no beings match that scan
                </p>
            )}

            {groups.map((group) =>
                group.characters.length === 0 ? null : (
                    <section key={group.key ?? '_unplaced'}>
                        {grouped && (
                            <h2 className={styles.groupHeading}>
                                {group.label}
                                <span className='pixel-label'>{group.characters.length}</span>
                            </h2>
                        )}
                        <ul className={styles.grid}>
                            {group.characters.map((character) => (
                                <li key={character.id}>
                                    <CharacterCard
                                        character={{
                                            id: character.id,
                                            name: character.name,
                                            color: character.color,
                                            colorLight: character.colorLight,
                                            image: character.image,
                                            slug: character.slug,
                                        }}
                                        note={note(character, group.key)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>
                )
            )}
        </div>
    );
}
