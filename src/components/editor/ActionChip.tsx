import Link from 'next/link';
import styles from './actionChip.module.scss';

// Small pixel-chip link for authoring actions ("+ new character", "edit ✎").
export default function ActionChip({ href, label }: { href: string; label: string }) {
    return (
        <Link href={href} className={styles.chip}>
            {label}
        </Link>
    );
}
