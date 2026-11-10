'use client';

import Link from 'next/link';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import styles from './castAvatar.module.scss';

export interface CastCharacter {
    name: string;
    slug: string;
    color: string | null;
    colorLight?: string | null;
    image: string | null;
}

/**
 * A character as just its sprite (or letter tile), linking to its page, with
 * the name on hover or keyboard focus. For compact rosters: a campaign's or
 * an episode's player characters. Sizes are whole multiples of 16 (the
 * 14px sprite plus its 1px outline: 64 = 4x), so every pixel scales evenly.
 */
export default function CastAvatar({ character, size = 48 }: { character: CastCharacter; size?: number }) {
    const { colorMode } = useTheme();
    const color = characterColor(character.name, character.color, colorMode, character.colorLight ?? null);

    return (
        <Link
            href={`/characters/${character.slug}`}
            className={styles.avatar}
            style={{ '--char': color } as React.CSSProperties}
            aria-label={character.name}
            data-name={character.name}
        >
            <PixelAvatar src={character.image} name={character.name} color={color} size={size} />
        </Link>
    );
}
