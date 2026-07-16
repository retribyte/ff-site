'use client';

import Link from 'next/link';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import styles from './characterCard.module.scss';

export interface CardCharacter {
    id: number;
    name: string;
    color: string | null;
    image: string | null;
    slug: string;
}

export default function CharacterCard({ character }: { character: CardCharacter }) {
    const { colorMode } = useTheme();
    const color = characterColor(character.name, character.color, colorMode);

    return (
        <Link
            href={`/characters/${character.slug}`}
            className={styles.card}
            style={{ '--char': color } as React.CSSProperties}
        >
            <PixelAvatar src={character.image} name={character.name} color={color} size={56} />
            <span className={styles.cardName}>{character.name}</span>
        </Link>
    );
}
