import type { Episode, Season } from './types';
import { normalizeSlug } from './slug';

// Season/Episode slugs are now canonical, server-derived fields (see
// ff-server/src/utils/slug.ts) — lowercase, runs of spaces/hyphens collapse
// to a single underscore, other punctuation drops. Prefer `season.slug` /
// `episode.slug` wherever the object is in hand; the derivation helpers
// below exist only as fallbacks for call sites that have nothing but a
// title, and for resolving legacy hyphenated URLs from before the migration.

const KNOWN_SLUGS: Record<string, string> = {
    FF1: 'ff1',
    FF2: 'ff2',
    FF3: 'ff3',
    FF4: 'ff4',
};

const DISPLAY_NAMES: Record<string, string> = {
    ff1: 'Final Frontier 1',
    ff2: 'Final Frontier 2',
    ff3: 'Final Frontier 3',
    ff4: 'Final Frontier 4',
};

// Season slugs with dedicated color tokens in _tokens.scss ("ff2" → --ff2/--ff2-2)
const THEMED_SLUGS = new Set(['ff1', 'ff2', 'ff3', 'ff4']);

/** Mirrors ff-server/src/utils/slug.ts's slugify exactly. */
function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]+/g, '')
        .replace(/_+/g, '_')
        .replace(/(^_|_$)/g, '');
}

/** Pre-migration hyphenated derivation — kept only to resolve legacy bookmarks. */
function legacySeasonSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/** Fallback for call sites that only have a title, not the Season object. */
export function seasonSlug(title: string): string {
    return KNOWN_SLUGS[title] ?? slugify(title);
}

/** Matches on the server-provided slug first; falls back to legacy hyphenated bookmarks. */
export function findSeasonBySlug(seasons: Season[], slug: string): Season | undefined {
    return seasons.find((s) => s.slug === slug) ?? seasons.find((s) => legacySeasonSlug(s.title) === slug);
}

export function seasonDisplayName(title: string): string {
    return DISPLAY_NAMES[seasonSlug(title)] ?? title;
}

/** CSS color values for a season's primary/secondary identity colors. */
export function seasonColors(title: string): { primary: string; secondary: string } {
    const slug = seasonSlug(title);
    if (THEMED_SLUGS.has(slug)) {
        return { primary: `var(--${slug})`, secondary: `var(--${slug}-2)` };
    }
    return { primary: 'var(--accent)', secondary: 'var(--accent-soft)' };
}

// `slug` is optional here even though Episode.slug is required, so call sites
// that only have {title, episode_no} (e.g. an unsaved import payload) still typecheck.
type EpisodeSlugInput = Pick<Episode, 'title' | 'episode_no'> & Partial<Pick<Episode, 'slug'>>;

/** "shady_business" for /archives/ff2/shady_business — the API slug has no episode number. */
export function episodeSlug(episode: EpisodeSlugInput): string {
    return episode.slug || `${slugify(episode.title)}`;
}

/**
 * Resolves an episode URL segment against a season's episodes. Matches the
 * bare slug first; also strips a leading "N_"/"N-" so old bookmarks (or any
 * client-constructed numbered URL) still resolve, but always validates
 * against the real slug rather than trusting the number alone. A segment
 * that's a bare number (oldest-style legacy URLs, pre-dating slugs entirely)
 * resolves directly by `episode_no`.
 */
export function findEpisodeBySlug(episodes: Episode[], slug: string): Episode | undefined {
    return (
        episodes.find((e) => e.slug === slug) ??
        episodes.find((e) => e.slug === normalizeSlug(slug.replace(/^\d+[_-]/, ''))) ??
        (/^\d+$/.test(slug) ? episodes.find((e) => e.episode_no === parseInt(slug, 10)) : undefined)
    );
}

/** Deep link to one line of an episode. */
export function lineUrl(
    episode: EpisodeSlugInput & Pick<Episode, 'seasonTitle'>,
    messageNo: number
): string {
    return `/archives/${seasonSlug(episode.seasonTitle)}/${episodeSlug(episode)}?line=${messageNo}`;
}
