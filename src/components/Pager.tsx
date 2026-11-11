import Link from 'next/link';
import styles from './pager.module.scss';

interface BasePagerProps {
    page: number;
    total: number;
    limit: number;
}

interface LinkPagerProps extends BasePagerProps {
    /** Query param this pager writes to, e.g. 'messagesPage' — distinct per
     * section so paging one doesn't reset another on the same page. */
    paramName: string;
    /** The current full query string, so sibling params (q, the other
     * section's page) survive when this pager builds a link. */
    searchParams: URLSearchParams;
    onPage?: never;
}

interface ButtonPagerProps extends BasePagerProps {
    /** Client-side paging: called with the page picked, no navigation */
    onPage: (page: number) => void;
    paramName?: never;
    searchParams?: never;
}

// Link mode: plain <Link>s, no client state — a numbered-pagination link just
// points at the same page with one query param changed, so no JS is needed.
// Button mode (onPage): for a list that's already all in the browser, where a
// link would refetch the whole page from the server.
export default function Pager({ page, total, limit, paramName, searchParams, onPage }: LinkPagerProps | ButtonPagerProps) {
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    if (totalPages <= 1) return null;

    function hrefForPage(p: number): string {
        const params = new URLSearchParams(searchParams);
        params.set(paramName!, String(p));
        return `?${params.toString()}`;
    }

    // One page link (or button), labelled `children`
    function to(p: number, children: React.ReactNode, current = false) {
        const props = {
            className: current ? styles.current : undefined,
            'aria-current': current ? ('page' as const) : undefined,
        };
        return onPage ? (
            <button key={p} type='button' onClick={() => onPage(p)} {...props}>
                {children}
            </button>
        ) : (
            <Link key={p} href={hrefForPage(p)} {...props}>
                {children}
            </Link>
        );
    }

    const windowStart = Math.max(page - 2, 1);
    const windowEnd = Math.min(page + 2, totalPages);
    const pages: number[] = [];
    for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p);

    return (
        <nav className={styles.pager} aria-label="Pagination">
            <span className={styles.side}>{page > 1 && to(page - 1, <>&larr; prev</>)}</span>
            <span className={styles.pages}>
                {/* The first and last pages stay reachable from anywhere */}
                {windowStart > 1 && to(1, 1)}
                {windowStart > 2 && <span className={styles.gap}>…</span>}
                {pages.map((p) => to(p, p, p === page))}
                {windowEnd < totalPages - 1 && <span className={styles.gap}>…</span>}
                {windowEnd < totalPages && to(totalPages, totalPages)}
            </span>
            <span className={styles.side}>{page < totalPages && to(page + 1, <>next &rarr;</>)}</span>
        </nav>
    );
}
