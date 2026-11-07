import { seasonOrder } from './seasons';
import type { CharacterAppearance } from './types';

/**
 * Most quoted first, then by name: the default character order (/characters,
 * a player's profile). How much a character speaks is the archive's best
 * measure of who the leads are; there's no "main character" field.
 */
export function compareByQuotes(
    a: { name: string; quoteCount?: number },
    b: { name: string; quoteCount?: number }
): number {
    return (b.quoteCount ?? 0) - (a.quoteCount ?? 0) || a.name.localeCompare(b.name);
}

/**
 * Compares two appearances in reading order: campaign order (seasonOrder),
 * then episode, then message. A story-only appearance (no episode) sorts
 * after the campaign's episodes, since a story has no place among them.
 */
export function compareAppearances(a: CharacterAppearance, b: CharacterAppearance): number {
    const [ra, ka] = seasonOrder(a.season);
    const [rb, kb] = seasonOrder(b.season);
    const last = Number.POSITIVE_INFINITY;
    return (
        ra - rb ||
        ka.localeCompare(kb) ||
        (a.episodeNo ?? last) - (b.episodeNo ?? last) ||
        (a.messageNo ?? last) - (b.messageNo ?? last)
    );
}

/** A character's earliest appearance across every campaign, or null if it has none on record. */
export function firstAppearance(appearances: CharacterAppearance[] | undefined): CharacterAppearance | null {
    if (!appearances || appearances.length === 0) return null;
    return appearances.reduce((a, b) => (compareAppearances(a, b) <= 0 ? a : b));
}
