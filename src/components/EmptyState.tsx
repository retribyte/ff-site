import styles from './emptyState.module.scss';

/**
 * Centered pixel-label placeholder for empty / no-match states (index lists,
 * empty logs). Replaces the inline-styled `<p>` that was copy-pasted across
 * the category index components.
 */
export default function EmptyState({ children }: { children: React.ReactNode }) {
    return <p className={`pixel-label ${styles.empty}`}>{children}</p>;
}
