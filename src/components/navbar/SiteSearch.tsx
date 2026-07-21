'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, searchSite, type SearchResults } from '@/lib/api';
import { episodesByTitle, lineUrl } from '@/lib/seasons';
import { storyQuoteUrl } from '@/lib/stories';
import { characterColor } from '@/lib/characterColors';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Highlighted } from '@/components/transcript/ScanBar';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import { parseEmbed } from '@/components/transcript/StoryBlock';
import type { Season, Episode } from '@/lib/types';
import styles from './siteSearch.module.scss';

const MIN_QUERY_LENGTH = 2;

// An EMBED message's `text` is a JSON string ({title?, description[], footer?}
// — see StoryBlock.tsx's parseEmbed), so the raw text isn't readable as a
// snippet. Preview whichever field actually contains the query instead —
// same literal-substring caveat `Highlighted` already has for stemmed FTS
// matches elsewhere, so this falls back to the first available field rather
// than showing nothing.
function messageSnippet(text: string, type: string, query: string): string {
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
function embedLast<T extends { type: string }>(a: T, b: T): number {
    return (a.type === 'EMBED' ? 1 : 0) - (b.type === 'EMBED' ? 1 : 0);
}

// One settled outcome, tagged with the query it answers — lets loading/
// results/error all be *derived* from comparing `settled.query` against the
// current debouncedQuery (see below), rather than tracked as separate flags
// that would need a synchronous setState at the top of the fetch effect.
type Settled = { query: string; data: SearchResults } | { query: string; error: true };

// Site-wide search (distinct from the per-page "scan" bars on transcripts/
// story chapters, which search only what's already loaded for that one
// episode/chapter — this searches the whole archive via GET /api/search).
export default function SiteSearch() {
    const { colorMode } = useTheme();
    const pathname = usePathname();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    // Collapsed to an icon by default so the bar doesn't reserve navbar width
    // (it used to be a fixed 13rem, which overflowed once SessionArea's
    // avatar+username+logout added enough width on top of it). Expanding
    // overlays the input on top of `.links` instead of reflowing the row.
    const [expanded, setExpanded] = useState(false);
    const [settled, setSettled] = useState<Settled | null>(null);
    const [episodeMap, setEpisodeMap] = useState<Map<string, Episode> | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debouncedQuery = useDebouncedValue(query.trim(), 250);

    // Navbar persists across client-side navigation (rendered once in
    // src/app/layout.tsx) — the panel won't close on its own via unmount, so
    // detect a route change during render and close it, mirroring the same
    // derived-state-reset pattern ScanBar's useScan uses for query changes.
    const [pathnameAtLastOpen, setPathnameAtLastOpen] = useState(pathname);
    if (pathname !== pathnameAtLastOpen) {
        setPathnameAtLastOpen(pathname);
        setOpen(false);
        setExpanded(false);
        setQuery('');
    }

    // Focus the input as soon as it appears — this is a plain imperative DOM
    // sync, not a setState call, so it isn't subject to the same-effect lint
    // restriction as the fetch/reset effects below.
    useEffect(() => {
        if (expanded) inputRef.current?.focus();
    }, [expanded]);

    // Fetch on debounced query. Below the threshold, do nothing — the panel
    // render already gates on debouncedQuery's length. All setState calls
    // below happen inside the async .then/.catch continuations, never
    // synchronously in the effect body itself.
    useEffect(() => {
        if (debouncedQuery.length < MIN_QUERY_LENGTH) return;
        const controller = new AbortController();
        searchSite(debouncedQuery, { signal: controller.signal })
            .then((data) => setSettled({ query: debouncedQuery, data }))
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setSettled({ query: debouncedQuery, error: true });
            });
        return () => controller.abort();
    }, [debouncedQuery]);

    // Derived, not stored: `settled` only ever answers for the query it was
    // fetched for, so a still-in-flight or just-changed query naturally reads
    // as "loading" without needing its own synchronously-toggled flag.
    const current = settled && settled.query === debouncedQuery ? settled : null;
    const results = current && 'data' in current ? current.data : null;
    const errored = current ? 'error' in current : false;
    const loading = debouncedQuery.length >= MIN_QUERY_LENGTH && !current;

    // Lazily resolve episodeTitle -> Episode (for message deep links), only
    // once, only if a message hit ever actually needs it.
    useEffect(() => {
        if (episodeMap || !results || results.messages.length === 0) return;
        api<Season[]>('/seasons')
            .then((seasons) => setEpisodeMap(episodesByTitle(seasons)))
            .catch(() => {
                /* deep links for message hits just won't resolve; not fatal */
            });
    }, [results, episodeMap]);

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // Inlined rather than calling close() (which isn't a stable
                // reference this effect could safely depend on) — these
                // setters are.
                setOpen(false);
                setExpanded(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, []);

    function close() {
        setOpen(false);
        setExpanded(false);
        setQuery('');
        inputRef.current?.blur();
    }

    const hasAnyResults =
        !!results &&
        (results.characters.length > 0 ||
            results.species.length > 0 ||
            results.items.length > 0 ||
            results.messages.length > 0 ||
            results.storyLines.length > 0);

    const sortedMessages = results ? [...results.messages].sort(embedLast) : [];

    return (
        <div className={styles.wrap} ref={containerRef}>
            {expanded ? (
                <div className={styles.expandedBar}>
                    <span className={styles.prompt} aria-hidden>
                        &#x276F;
                    </span>
                    <input
                        ref={inputRef}
                        type='search'
                        className={styles.input}
                        placeholder='search'
                        value={query}
                        onChange={(e) => {
                            const value = e.target.value;
                            setQuery(value);
                            if (value.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
                        }}
                        onFocus={() => {
                            if (query.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') close();
                        }}
                        aria-label='Search the archive'
                        role='combobox'
                        aria-expanded={open}
                        aria-haspopup='listbox'
                        aria-controls='site-search-panel'
                    />
                </div>
            ) : (
                <button
                    type='button'
                    className={styles.iconButton}
                    onClick={() => setExpanded(true)}
                    aria-label='Open search'
                    aria-expanded={false}
                >
                    &#x2315;
                </button>
            )}

            {expanded && open && debouncedQuery.length >= MIN_QUERY_LENGTH && (
                <div id='site-search-panel' className={styles.panel} role='listbox'>
                    {loading && !results && <p className={styles.status}>scanning…</p>}
                    {errored && <p className={styles.status}>⚠ signal lost</p>}

                    {results && !errored && (
                        <>
                            {results.characters.length > 0 && (
                                <section className={styles.section}>
                                    <span className={styles.sectionLabel}>characters</span>
                                    {results.characters.map((c) => (
                                        <Link
                                            key={`char-${c.id}`}
                                            href={`/characters/${c.slug}`}
                                            className={styles.row}
                                            onClick={close}
                                        >
                                            <PixelAvatar
                                                src={c.image}
                                                name={c.name}
                                                color={characterColor(c.name, null, colorMode)}
                                                size={22}
                                            />
                                            <span>{c.name}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {results.species.length > 0 && (
                                <section className={styles.section}>
                                    <span className={styles.sectionLabel}>species</span>
                                    {results.species.map((s) => (
                                        <Link
                                            key={`species-${s.id}`}
                                            href={`/species/${s.slug}`}
                                            className={styles.row}
                                            onClick={close}
                                        >
                                            <span>{s.name}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {results.items.length > 0 && (
                                <section className={styles.section}>
                                    <span className={styles.sectionLabel}>items</span>
                                    {results.items.map((i) => (
                                        <Link
                                            key={`item-${i.id}`}
                                            href={`/items/${i.slug}`}
                                            className={styles.row}
                                            onClick={close}
                                        >
                                            <span>{i.name}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {results.messages.length > 0 && (
                                <section className={styles.section}>
                                    <span className={styles.sectionLabel}>transcripts</span>
                                    {sortedMessages.map((m) => {
                                        const episode = episodeMap?.get(m.episodeTitle);
                                        const text = messageSnippet(m.text, m.type, debouncedQuery);
                                        const snippet = (
                                            <>
                                                <span className={styles.rowMeta}>{m.episodeTitle}</span>
                                                <span className={styles.rowSnippet}>
                                                    <Highlighted text={text} query={debouncedQuery} />
                                                </span>
                                            </>
                                        );
                                        return episode ? (
                                            <Link
                                                key={`msg-${m.episodeTitle}-${m.messageNo}`}
                                                href={lineUrl(episode, m.messageNo)}
                                                className={styles.row}
                                                onClick={close}
                                            >
                                                {snippet}
                                            </Link>
                                        ) : (
                                            <span
                                                key={`msg-${m.episodeTitle}-${m.messageNo}`}
                                                className={`${styles.row} ${styles.rowPending}`}
                                            >
                                                {snippet}
                                            </span>
                                        );
                                    })}
                                </section>
                            )}

                            {results.storyLines.length > 0 && (
                                <section className={styles.section}>
                                    <span className={styles.sectionLabel}>stories</span>
                                    {results.storyLines.map((sl) => (
                                        <Link
                                            key={`line-${sl.storySlug}-${sl.chapterNo}-${sl.lineNo}`}
                                            href={storyQuoteUrl({
                                                storySlug: sl.storySlug,
                                                chapterNo: sl.chapterNo,
                                                line_no: sl.lineNo,
                                            })}
                                            className={styles.row}
                                            onClick={close}
                                        >
                                            <span className={styles.rowMeta}>chapter {sl.chapterNo}</span>
                                            <span className={styles.rowSnippet}>
                                                <Highlighted text={sl.text} query={debouncedQuery} />
                                            </span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {!loading && !hasAnyResults && (
                                <p className={styles.status}>no signal — nothing matches that scan</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
