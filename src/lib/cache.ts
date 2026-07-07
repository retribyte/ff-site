// Server-side caching for the archive/story reader content. These records are
// effectively immutable (historical transcripts, imported stories), so the
// expensive API reads are cached and revalidated on a long window. The mutation
// proxy invalidates the relevant tags on demand (see app/api/ff/[...path]/route.ts),
// so authored changes (margin notes, story edits/deletes) show up immediately.

/** Safety-net revalidation window, in seconds. On-demand tags do the real work. */
export const CONTENT_REVALIDATE = 3600; // 1 hour

export const cacheTags = {
    /** Season/episode listing (titles, summaries, dates). */
    seasons: 'seasons',
    /** Every episode transcript — commentaries live here, so any note mutation busts it. */
    episodes: 'episodes',
    /** Every story's listing and content. */
    stories: 'stories',
    /** A single story's chapters + lines. */
    story: (slug: string) => `story:${slug}`,
};

/** Fetch cache options for a tagged, revalidating read. */
export function cached(tags: string[]) {
    return { next: { revalidate: CONTENT_REVALIDATE, tags } };
}
