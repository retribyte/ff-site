import { seasonOrder } from './seasons';

type Sortable = {
    name: string;
    image: string | null;
    color: string | null;
    seasons?: string[];
};

// Earliest season a character speaks in, by campaign order (FF1 before FF2…).
function firstSeason(seasons: string[] | undefined): readonly [number, string] {
    const orders = (seasons ?? []).map(seasonOrder);
    if (orders.length === 0) return seasonOrder(null);
    return orders.reduce((a, b) => (a[0] - b[0] || a[1].localeCompare(b[1]) <= 0 ? a : b));
}

/**
 * Portraited first, then color-only, then the rest; within each group by the
 * season of first appearance, then alphabetical.
 */
export function compareCharacters(a: Sortable, b: Sortable): number {
    const rank = (c: Sortable) => (c.image ? 0 : c.color ? 1 : 2);
    const [sa, sb] = [firstSeason(a.seasons), firstSeason(b.seasons)];
    return rank(a) - rank(b) || sa[0] - sb[0] || sa[1].localeCompare(sb[1]) || a.name.localeCompare(b.name);
}
