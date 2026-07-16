/**
 * Normalizes a legacy hyphenated slug segment (pre-migration bookmark style)
 * to the current underscore convention, e.g. "shady-business" ->
 * "shady_business". Shared by any slug-identified entity resolver that
 * needs to accept old hyphenated URLs alongside the canonical slug.
 */
export function normalizeSlug(slug: string): string {
    return slug.replace(/-/g, '_');
}
