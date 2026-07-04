'use client';

import styles from './indexScan.module.scss';

// The category search bar (FR-SR-1): a terminal-prompt search input with an
// optional filter widget and a live result count. Pages themed with a season
// color can tint it by setting --scan-accent.

interface Props {
    query: string;
    onQueryChange: (query: string) => void;
    placeholder: string;
    label: string;
    count: number;
    /** extra filter controls rendered between the input and the count */
    children?: React.ReactNode;
}

export default function IndexScan({ query, onQueryChange, placeholder, label, count, children }: Props) {
    return (
        <div className={styles.controls}>
            <span className={styles.prompt} aria-hidden>
                ❯
            </span>
            <input
                type='search'
                className={styles.search}
                placeholder={placeholder}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                aria-label={label}
            />
            {children}
            <span className={styles.count}>{count}</span>
        </div>
    );
}
