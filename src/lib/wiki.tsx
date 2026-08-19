import { Fragment, type ReactNode } from 'react';

// Wiki text fields occasionally carry a literal `<br>`/`<br />` (ff-server's
// sanitizer allows it through for HTML-rendered fields like blurb) plus real
// embedded newlines. These render as plain React text here, not HTML, so
// split on both and rejoin as real <br /> elements — otherwise the tag shows
// up as literal visible text instead of a line break.
export function renderWikiText(value: string | undefined): ReactNode {
    if (!value) return undefined;
    const lines = value
        .split(/<br\s*\/?>|\n/gi)
        .map((line) => line.trim())
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
