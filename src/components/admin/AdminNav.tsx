'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './adminNav.module.scss';

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
    {
        label: 'Run',
        links: [
            { href: '/admin/episodes', label: 'Episode import' },
            { href: '/admin/voices', label: 'Story voices' },
            { href: '/admin/jobs', label: 'Maintenance jobs' },
        ],
    },
    {
        label: 'Watch',
        links: [
            { href: '/admin/history', label: 'Job history' },
            { href: '/admin/views', label: 'Views' },
            { href: '/admin/log', label: 'Server log' },
        ],
    },
    {
        label: 'Portraits',
        links: [
            { href: '/admin/portraits', label: 'Creator settings' },
        ],
    },
];

// The /admin sidebar. On a phone it becomes rows of chips above the section.
export default function AdminNav() {
    const path = usePathname();
    const link = (href: string, label: string) => (
        <Link href={href} className={styles.link} aria-current={path === href ? 'page' : undefined}>
            {label}
        </Link>
    );

    return (
        <nav className={styles.nav} aria-label='Admin sections'>
            <p className={styles.home}>{link('/admin', 'Dashboard')}</p>
            {GROUPS.map((g) => (
                <div key={g.label} className={styles.group}>
                    <p className={`pixel-label ${styles.groupLabel}`}>{g.label}</p>
                    <ul className={styles.links}>
                        {g.links.map((l) => (
                            <li key={l.href}>{link(l.href, l.label)}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
