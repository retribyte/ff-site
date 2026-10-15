import Link from 'next/link';
import styles from './userLink.module.scss';

/** Inline link to a user's public profile. Inherits the surrounding text style. */
export default function UserLink({ username, className }: { username: string; className?: string }) {
    return (
        <Link href={`/users/${encodeURIComponent(username)}`} className={`${styles.userLink} ${className ?? ''}`}>
            {username}
        </Link>
    );
}
