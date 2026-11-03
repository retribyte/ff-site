// Copy 2 of the canonical slug rule. Copy 1 is ff-server's
// `src/utils/slug.ts`; the docx CLI (`archive-to-markdown/story-docx-to-md.py`)
// and the wiki (`Final Frontier Wiki:Slugs`) follow the same rule. Keep them
// identical. Accented letters are transliterated to plain Latin (à→a, é→e,
// ß→ss, æ→ae, ø→o, ł→l), not dropped; lowercase; each run of spaces or hyphens
// becomes a single underscore; apostrophes, periods and other punctuation
// (plus anything with no Latin form, e.g. CJK or emoji) are dropped; doubled
// underscores collapse.

export const SLUG_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;

// Latin letters that NFKD doesn't decompose into a base letter + mark.
const TRANSLITERATIONS: Record<string, string> = {
    ß: 'ss',
    æ: 'ae',
    œ: 'oe',
    ø: 'o',
    ł: 'l',
    đ: 'd',
    ð: 'd',
    þ: 'th',
    ı: 'i',
};

export function slugify(input: string): string {
    return input
        .normalize('NFKD') // à -> a + U+0300; ligatures like ﬁ -> fi
        .replace(/\p{M}+/gu, '') // drop the combining marks
        .toLowerCase()
        .replace(/[ßæœøłđðþı]/g, (c) => TRANSLITERATIONS[c])
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]+/g, '')
        .replace(/_+/g, '_')
        .replace(/(^_|_$)/g, '');
}

export function isValidSlug(input: string): boolean {
    return SLUG_PATTERN.test(input);
}

/**
 * Normalizes a legacy hyphenated slug segment (pre-migration bookmark style)
 * to the current underscore convention, e.g. "shady-business" ->
 * "shady_business". Shared by any slug-identified entity resolver that
 * needs to accept old hyphenated URLs alongside the canonical slug.
 */
export function normalizeSlug(slug: string): string {
    return slug.replace(/-/g, '_');
}
