import Link from 'next/link';
import { imageSrc } from '@/lib/images';
import styles from './userLink.module.scss';

/**
 * Inline link to a user's public profile. Inherits the surrounding text
 * style. Pass `icon` (the user's booru avatar URL) to show it before the name.
 */
export default function UserLink({
    username,
    icon,
    className,
}: {
    username: string;
    icon?: string | null;
    className?: string;
}) {
    const href = `/users/${encodeURIComponent(username)}`;
    if (!icon) {
        return (
            <Link href={href} className={`${styles.userLink} ${className ?? ''}`}>
                {username}
            </Link>
        );
    }
    return (
        <Link href={href} className={`${styles.userLink} ${styles.withIcon} ${className ?? ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(icon)} alt='' width={22} height={22} className={styles.icon} />
            <span className={styles.name}>{username}</span>
        </Link>
    );
}
