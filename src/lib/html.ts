// ff-server stores user rich text (bios, blurbs) through sanitize-html, which
// entity-encodes plain text (`&` → `&amp;`). Decode it back for editing in a
// textarea; the server re-sanitizes on save, and that round trip is stable.
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(html: string): string {
    return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (entity[0] === '#') {
            const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return NAMED[entity.toLowerCase()] ?? match;
    });
}
