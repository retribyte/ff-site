import styles from './richText.module.scss';

/**
 * Renders a user rich-text field (blurbs, descriptions, bios, commentary).
 * ff-server runs these through sanitize-html's allow-list (b, i, em, strong,
 * a[href], p, br, lists) before storage, so the stored value is safe HTML —
 * rendering it as text would show `&amp;` and literal tags instead.
 * A div, not a p: the allow-list includes block tags (p, ul, ol).
 */
export default function RichText({ html, className }: { html: string; className?: string }) {
    return <div className={`${styles.richText} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
