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
// one entry per line, via renderWikiText, which also handles a stray <br>
// inside any entry.
export function renderWikiList(values: string[] | undefined): ReactNode {
    if (!values?.length) return undefined;
    return renderWikiText(values.join('\n'));
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

/**
 * A wiki field a page pins to the top of its infobox, optionally under its
 * own label (else wikiLabel's). A bare string pins it with the generated one.
 */
export type WikiFieldSpec = string | { field: string; label?: string };

function renderWikiValue(value: WikiValue): ReactNode {
    if (Array.isArray(value)) return renderWikiList(value.map(String));
    if (typeof value === 'string') return renderWikiText(value);
    if (value === null) return undefined;
    return String(value);
}

/**
 * Infobox rows for a record's wiki data. Every field the wiki has is shown,
 * so a field added on the wiki appears with no site change: `order` only
 * pins fields to the top (see WikiFieldSpec); the rest follow
 * alphabetically with labels made by wikiLabel. A field whose label matches one of `taken`
 * (rows the page already shows from its own data, e.g. "species") is
 * skipped rather than shown twice.
 */
export function wikiFacts(
    wiki: WikiData | null | undefined,
    order: WikiFieldSpec[] = [],
    taken: string[] = []
): [string, ReactNode][] {
    if (!wiki) return [];
    const specs = new Map(
        order.map((entry) => {
            const spec = typeof entry === 'string' ? { field: entry } : entry;
            return [spec.field, spec];
        })
    );
    const rest = Object.keys(wiki)
        .filter((field) => !specs.has(field))
        .sort();
    const shown = new Set(taken.map((label) => label.toLowerCase()));

    const facts: [string, ReactNode][] = [];
    for (const field of [...specs.keys(), ...rest]) {
        if (HIDDEN_FIELDS.has(field)) continue;
        const spec = specs.get(field);
        const label = spec?.label ?? wikiLabel(field);
        if (shown.has(label.toLowerCase())) continue;
        const value = renderWikiValue(wiki[field] ?? null);
        if (value === undefined || value === '') continue;
        shown.add(label.toLowerCase());
        facts.push([label, value]);
    }
    return facts;
}
