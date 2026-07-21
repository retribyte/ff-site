import Link from 'next/link';
import styles from './pager.module.scss';

interface PagerProps {
    page: number;
    total: number;
    limit: number;
    /** Query param this pager writes to, e.g. 'messagesPage' — distinct per
     * section so paging one doesn't reset another on the same page. */
    paramName: string;
    /** The current full query string, so sibling params (q, the other
     * section's page) survive when this pager builds a link. */
    searchParams: URLSearchParams;
}

// Plain <Link>-based, no client state — a numbered-pagination link just
// points at the same page with one query param changed, so no JS is needed.
export default function Pager({ page, total, limit, paramName, searchParams }: PagerProps) {
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    if (totalPages <= 1) return null;

    function hrefForPage(p: number): string {
        const params = new URLSearchParams(searchParams);
        params.set(paramName, String(p));
        return `?${params.toString()}`;
    }

    const windowStart = Math.max(page - 2, 1);
    const windowEnd = Math.min(page + 2, totalPages);
    const pages: number[] = [];
    for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p);

    return (
        <nav className={styles.pager} aria-label="Pagination">
            <span className={styles.side}>
                {page > 1 && <Link href={hrefForPage(page - 1)}>&larr; prev</Link>}
            </span>
            <span className={styles.pages}>
                {pages.map((p) => (
                    <Link
                        key={p}
                        href={hrefForPage(p)}
                        className={p === page ? styles.current : undefined}
                        aria-current={p === page ? 'page' : undefined}
                    >
                        {p}
                    </Link>
                ))}
            </span>
            <span className={styles.side}>
                {page < totalPages && <Link href={hrefForPage(page + 1)}>next &rarr;</Link>}
            </span>
        </nav>
    );
}
