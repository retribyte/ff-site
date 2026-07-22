'use client';

import { useState } from 'react';

/**
 * Search-box state + client-side filtering shared by the category index
 * components (characters, species, items, stories, episodes). Owns the query
 * string; `matches` decides membership given an item and the normalized
 * (trimmed, lowercased) query — `q` is '' when the box is empty. Any secondary
 * filter (species, class, item type…) stays in the component and is folded
 * into the `matches` closure. The lists are small (tens of rows), so filtering
 * runs inline on each render rather than being memoized.
 */
export function useIndexFilter<T>(
    items: T[],
    matches: (item: T, q: string) => boolean
): { query: string; setQuery: (query: string) => void; visible: T[] } {
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const visible = items.filter((item) => matches(item, q));
    return { query, setQuery, visible };
}
