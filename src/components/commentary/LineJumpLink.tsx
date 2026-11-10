'use client';

// A `?line=N` link on the page that already shows that line. A Next <Link>
// would refetch the whole transcript from the server for the new query string;
// pushState only changes the URL, which the reader's useSearchParams picks up
// to scroll to and highlight the line. The href still works without JS.
export default function LineJumpLink({
    href,
    className,
    children,
}: {
    href: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <a
            href={href}
            className={className}
            onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                window.history.pushState(null, '', href);
            }}
        >
            {children}
        </a>
    );
}
