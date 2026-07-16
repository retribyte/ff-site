'use client';

import { useMemo, useState } from 'react';
import CharacterCard from './CharacterCard';
import IndexScan from '@/components/IndexScan';
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
    const [query, setQuery] = useState('');
    const [speciesId, setSpeciesId] = useState<number | ''>('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return characters.filter((c) => {
            if (speciesId !== '' && c.speciesId !== speciesId) return false;
            if (!q) return true;
            return c.name.toLowerCase().includes(q);
        });
    }, [characters, query, speciesId]);

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

            {visible.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    no beings match that scan
                </p>
            )}

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
