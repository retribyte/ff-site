// Shared between the navbar dropdown (SiteSearch.tsx) and the dedicated
// /search results page — kept as a plain module (no 'use client') since the
// results page is a server component and can't import functions (only
// render components) from a 'use client'-marked file.

export interface Embed {
    title?: string;
    description?: string[];
    footer?: string;
}

// An EMBED message's `text` is a JSON string ({title?, description[], footer?}).
export function parseEmbed(text: string): Embed | null {
    try {
        const parsed = JSON.parse(text);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Embed) : null;
    } catch {
        return null;
    }
}

// The raw text isn't readable as a snippet for EMBED hits. Preview whichever
// field actually contains the query instead — same literal-substring caveat
// `Highlighted` already has for stemmed FTS matches elsewhere, so this falls
// back to the first available field rather than showing nothing.
export function messageSnippet(text: string, type: string, query: string): string {
    if (type !== 'EMBED') return text;
    const embed = parseEmbed(text);
    if (!embed) return text;
    const q = query.toLowerCase();
    const fields = [embed.title, ...(embed.description ?? []), embed.footer].filter(
        (s): s is string => typeof s === 'string'
    );
    return fields.find((f) => f.toLowerCase().includes(q)) ?? fields[0] ?? text;
}

// EMBED hits read worse than plain-text message types even after
// messageSnippet's best-effort field pick, so push them to the end of the
// list rather than wherever ts_rank happened to rank them. A stable sort
// (guaranteed by the spec since ES2019), so ties keep the server's order.
export function embedLast<T extends { type: string }>(a: T, b: T): number {
    return (a.type === 'EMBED' ? 1 : 0) - (b.type === 'EMBED' ? 1 : 0);
}
