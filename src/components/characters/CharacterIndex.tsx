'use client';

import { useState } from 'react';
import CharacterCard from './CharacterCard';
import IndexScan from '@/components/IndexScan';
import EmptyState from '@/components/EmptyState';
import { useIndexFilter } from '@/hooks/useIndexFilter';
import scanStyles from '@/components/indexScan.module.scss';
import styles from './characterIndex.module.scss';

export interface IndexCharacter {
    id: number;
    name: string;
    color: string | null;
    image: string | null;
    speciesId: number;
    slug: string;
}

export default function CharacterIndex({
    characters,
    species,
}: {
    characters: IndexCharacter[];
    species: { id: number; name: string }[];
}) {
    const [speciesId, setSpeciesId] = useState<number | ''>('');

    const { query, setQuery, visible } = useIndexFilter(
        characters,
        (c, q) => (speciesId === '' || c.speciesId === speciesId) && (!q || c.name.toLowerCase().includes(q))
    );

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name…'
                label='Search characters by name'
                count={visible.length}
            >
                <select
                    className={scanStyles.filterSelect}
                    value={speciesId}
                    onChange={(e) => setSpeciesId(e.target.value === '' ? '' : parseInt(e.target.value))}
                    aria-label='Filter by species'
                >
                    <option value=''>all species</option>
                    {species.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </IndexScan>

            {visible.length === 0 && <EmptyState>no beings match that scan</EmptyState>}

            <ul className={styles.grid}>
                {visible.map((character) => (
                    <li key={character.id}>
                        <CharacterCard
                            character={{
                                id: character.id,
                                name: character.name,
                                color: character.color,
                                image: character.image,
                                slug: character.slug,
                            }}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
