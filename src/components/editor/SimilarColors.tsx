'use client';

import { useEffect, useMemo, useState } from 'react';
import ThemedAvatar from '@/components/characters/ThemedAvatar';
import { characterThemeColors } from '@/lib/characterColors';
import { BACKGROUNDS, SIMILAR_COLOR_DISTANCE, colorDistance } from '@/lib/colorContrast';
import styles from './recordEditor.module.scss';

/** A character with at least one color set by hand, and what both themes show for it. */
export interface ColoredCharacter {
    id: number;
    name: string;
    slug: string | null;
    image: string | null;
    color: string | null;
    colorLight: string | null;
    resolved: { dark: string; light: string };
}

const MAX_MATCHES = 5;

/**
 * The cast to compare a character's colors against: everyone (but `excludeId`,
 * the character being edited) who has a dark or light color set. Characters
 * left on auto (legacy table / name hash) aren't anyone's pick, so they're out.
 */
export function useColoredCharacters(enabled: boolean, excludeId?: number): ColoredCharacter[] {
    const [cast, setCast] = useState<ColoredCharacter[]>([]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        fetch('/site/ff/characters')
            .then((res) => res.json())
            .then((envelope: { data?: Omit<ColoredCharacter, 'resolved'>[] }) => {
                if (cancelled || !envelope.data) return;
                setCast(
                    envelope.data
                        .filter((c) => c.id !== excludeId && (c.color || c.colorLight))
                        .map((c) => ({
                            id: c.id,
                            name: c.name,
                            slug: c.slug,
                            image: c.image,
                            color: c.color,
                            colorLight: c.colorLight,
                            resolved: characterThemeColors(c.name, c.color, c.colorLight),
                        }))
                );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [enabled, excludeId]);

    return cast;
}

/**
 * Characters whose `theme` color is perceptually close to `color` (OKLab
 * distance under SIMILAR_COLOR_DISTANCE), closest first. Renders nothing when
 * no one is close.
 */
export default function SimilarColors({
    theme,
    color,
    cast,
}: {
    theme: 'dark' | 'light';
    color: string;
    cast: ColoredCharacter[];
}) {
    const matches = useMemo(
        () =>
            cast
                .map((c) => ({ c, distance: colorDistance(color, c.resolved[theme]) }))
                .filter((m) => m.distance < SIMILAR_COLOR_DISTANCE)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, MAX_MATCHES),
        [cast, color, theme]
    );

    if (matches.length === 0) return null;

    return (
        <div className={styles.similar}>
            <span className={styles.similarLabel}>similar {theme}-mode colors</span>
            <div className={styles.similarList}>
                {matches.map(({ c, distance }) => (
                    <a
                        key={c.id}
                        className={styles.similarItem}
                        href={`/characters/${c.slug ?? c.id}`}
                        target='_blank'
                        rel='noopener'
                        aria-label={c.name}
                        title={`${c.name}: ${c.resolved[theme]} (distance ${distance.toFixed(3)})`}
                        style={{ background: BACKGROUNDS[theme][1] }}
                    >
                        <ThemedAvatar src={c.image} name={c.name} color={c.color} colorLight={c.colorLight} size={32} />
                        <span
                            className={styles.similarSwatch}
                            aria-label={`${theme} mode ${c.resolved[theme]}`}
                        >
                            <span style={{ background: c.resolved[theme] }} />
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}
