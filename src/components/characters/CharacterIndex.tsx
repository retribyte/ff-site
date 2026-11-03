'use client';

import { useMemo, useState } from 'react';
import CharacterCard from './CharacterCard';
import IndexScan from '@/components/IndexScan';
import styles from './characterIndex.module.scss';

export interface IndexCharacter {
    id: number;
    name: string;
    color: string | null;
    image: string | null;
    slug: string;
}

export default function CharacterIndex({ characters }: { characters: IndexCharacter[] }) {
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return characters;
        return characters.filter((c) => c.name.toLowerCase().includes(q));
    }, [characters, query]);

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name…'
                label='Search characters by name'
                count={visible.length}
            />

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
