'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';
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
    const { colorMode } = useTheme();
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
                {visible.map((character) => {
                    const color = characterColor(character.name, character.themeColor, colorMode);
                    return (
                        <li key={character.id}>
                            <Link
                                href={`/characters/${character.id}`}
                                className={styles.card}
                                style={{ '--char': color } as React.CSSProperties}
                            >
                                <PixelAvatar src={character.image} name={character.name} color={color} size={56} />
                                <span className={styles.cardName}>{character.name}</span>
                                {character.aliases.length > 0 && (
                                    <span className={styles.cardAlias}>a.k.a. {character.aliases[0]}</span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
