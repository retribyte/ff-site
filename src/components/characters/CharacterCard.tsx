'use client';

import Link from 'next/link';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import styles from './characterCard.module.scss';

export interface CardCharacter {
    id: number;
    name: string;
    themeColor: string | null;
    image: string | null;
    alias?: string | null;
}

export default function CharacterCard({ character }: { character: CardCharacter }) {
    const { colorMode } = useTheme();
    const color = characterColor(character.name, character.themeColor, colorMode);

    return (
        <Link
            href={`/characters/${character.id}`}
            className={styles.card}
            style={{ '--char': color } as React.CSSProperties}
        >
            <PixelAvatar src={character.image} name={character.name} color={color} size={56} />
            <span className={styles.cardName}>{character.name}</span>
            {character.alias && <span className={styles.cardAlias}>a.k.a. {character.alias}</span>}
        </Link>
    );
}
