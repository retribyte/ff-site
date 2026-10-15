import { Fragment, type ReactNode } from 'react';
import { decodeEntities } from '@/lib/html';
import type { WikiData, WikiValue } from '@/lib/types';

// Wiki text fields occasionally carry a literal `<br>`/`<br />` (ff-server's
// sanitizer allows it through for HTML-rendered fields like blurb) plus real
// embedded newlines. These render as plain React text here, not HTML, so
// split on both and rejoin as real <br /> elements — otherwise the tag shows
// up as literal visible text instead of a line break. Values are stored
// entity-encoded (ff-server sanitizes at cache-write time), so decode them —
// a text node would otherwise show `t&amp;l`.
export function renderWikiText(value: string | undefined): ReactNode {
    if (!value) return undefined;
    const lines = value
        .split(/<br\s*\/?>|\n/gi)
        .map((line) => decodeEntities(line).trim())
        .filter(Boolean);
    if (lines.length <= 1) return lines[0] ?? undefined;
    return lines.map((line, i) => (
        <Fragment key={i}>
            {i > 0 && <br />}
            {line}
        </Fragment>
    ));
}

// Repeated wiki fields (aliases, relationship, planet) arrive as string[];
// join for display, then run through renderWikiText in case any entry
// itself carries a stray <br>.
export function renderWikiList(values: string[] | undefined): ReactNode {
    if (!values?.length) return undefined;
    return renderWikiText(values.join(', '));
}

// Bookkeeping columns, never facts about the record
const HIDDEN_FIELDS = new Set(['page_name', 'slug']);

/** `procreation_method` → `Procreation Method` */
export function wikiLabel(field: string): string {
    return field
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function renderWikiValue(value: WikiValue): ReactNode {
    if (Array.isArray(value)) return renderWikiList(value.map(String));
    if (typeof value === 'string') return renderWikiText(value);
    if (value === null) return undefined;
    return String(value);
}

/**
 * Infobox rows for a record's wiki data. Every field the wiki has is shown,
 * so a field added on the wiki appears with no site change: `order` only
 * pins fields to the top, optionally under a site-chosen label (a bare
 * string keeps the generated one); the rest follow alphabetically with
 * labels made by wikiLabel. A field whose label matches one of `taken`
 * (rows the page already shows from its own data, e.g. "species") is
 * skipped rather than shown twice.
 */
export function wikiFacts(
    wiki: WikiData | null | undefined,
    order: (string | [field: string, label: string])[] = [],
    taken: string[] = []
): [string, ReactNode][] {
    if (!wiki) return [];
    const labels = new Map(order.map((entry) => (typeof entry === 'string' ? [entry, wikiLabel(entry)] : entry)));
    const rest = Object.keys(wiki)
        .filter((field) => !labels.has(field))
        .sort();
    const shown = new Set(taken.map((label) => label.toLowerCase()));

    const facts: [string, ReactNode][] = [];
    for (const field of [...labels.keys(), ...rest]) {
        if (HIDDEN_FIELDS.has(field)) continue;
        const label = labels.get(field) ?? wikiLabel(field);
        if (shown.has(label.toLowerCase())) continue;
        const value = renderWikiValue(wiki[field] ?? null);
        if (value === undefined || value === '') continue;
        shown.add(label.toLowerCase());
        facts.push([label, value]);
    }
    return facts;
}
