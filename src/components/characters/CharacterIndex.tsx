'use client';

import { useMemo, useState } from 'react';
import CharacterCard from './CharacterCard';
import styles from './characterIndex.module.scss';

export interface IndexCharacter {
    id: number;
    name: string;
    themeColor: string | null;
    image: string | null;
    speciesId: number;
    aliases: string[];
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
            return c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q));
        });
    }, [characters, query, speciesId]);

    return (
        <div>
            <div className={styles.controls}>
                <span className={styles.prompt} aria-hidden>
                    ❯
                </span>
                <input
                    type='search'
                    className={styles.search}
                    placeholder='search by name or alias…'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label='Search characters by name or alias'
                />
                <select
                    className={styles.speciesFilter}
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
                <span className={styles.count}>{visible.length}</span>
            </div>

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
                                themeColor: character.themeColor,
                                image: character.image,
                                alias: character.aliases[0] ?? null,
                            }}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
