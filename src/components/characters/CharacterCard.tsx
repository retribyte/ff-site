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
    colorLight?: string | null;
    image: string | null;
    slug: string;
}

export default function CharacterCard({ character, note }: { character: CardCharacter; note?: string | null }) {
    const { colorMode } = useTheme();
    const color = characterColor(character.name, character.color, colorMode, character.colorLight ?? null);

    return (
        <Link
            href={`/characters/${character.slug}`}
            className={styles.card}
            style={{ '--char': color } as React.CSSProperties}
        >
            <PixelAvatar src={character.image} name={character.name} color={color} size={56} />
            <span className={styles.cardName}>{character.name}</span>
            {note && <span className={styles.cardNote}>{note}</span>}
        </Link>
    );
}
