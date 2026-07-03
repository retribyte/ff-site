import type { Episode, Season } from './types';

// Season titles in the DB are short codes ("FF2", "Vortox Machina").
// These maps give them URLs and display flavor. Unknown seasons fall back
// to a generic slugify so newly authored seasons still get a page.

const KNOWN_SLUGS: Record<string, string> = {
    FF1: 'ff1',
    FF2: 'ff2',
    FF3: 'ff3',
    FF4: 'ff4',
    'Vortox Machina': 'vm',
};

const DISPLAY_NAMES: Record<string, string> = {
    ff1: 'Final Frontier 1',
    ff2: 'Final Frontier 2',
    ff3: 'Final Frontier 3',
    ff4: 'Final Frontier 4',
    vm: 'Vortox Machina',
};

// Season slugs with dedicated color tokens in _tokens.scss ("vm" → --vm/--vm-2)
const THEMED_SLUGS = new Set(['ff1', 'ff2', 'ff3', 'ff4', 'vm']);

export function seasonSlug(title: string): string {
    return (
        KNOWN_SLUGS[title] ??
        title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
    );
}

export function findSeasonBySlug(seasons: Season[], slug: string): Season | undefined {
    return seasons.find((s) => seasonSlug(s.title) === slug);
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

/** "3-shady-business" for /archives/ff2/3-shady-business; resolved by number prefix. */
export function episodeSlug(episode: Pick<Episode, 'title' | 'episode_no'>): string {
    const titlePart = episode.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return `${episode.episode_no}-${titlePart}`;
}

/** Parses the leading episode number out of an episode URL segment (legacy-compatible). */
export function episodeNoFromSlug(slug: string): number | null {
    const match = slug.match(/^(\d+)(-|$)/);
    return match ? parseInt(match[1]) : null;
}

/** Deep link to one line of an episode; the chronicle reads at /cyoa. */
export function lineUrl(episode: Pick<Episode, 'title' | 'episode_no' | 'seasonTitle'>, messageNo: number): string {
    if (episode.seasonTitle === 'Vortox Machina') {
        return `/cyoa?line=${messageNo}`;
    }
    return `/archives/${seasonSlug(episode.seasonTitle)}/${episodeSlug(episode)}?line=${messageNo}`;
}
