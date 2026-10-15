'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useSession } from '@/components/auth/SessionProvider';
import SiteSearch from './SiteSearch';
import styles from './navbar.module.scss';

const links = [
    { href: '/archives', label: 'Archives' },
    { href: '/stories', label: 'Stories' },
    { href: '/characters', label: 'Characters' },
    { href: '/species', label: 'Species' },
    { href: '/items', label: 'Items' },
    { href: '/convert', label: 'Convert' },
    { href: '/8ball', label: '8-Ball' },
];

function SessionArea() {
    const { user, loading, logout } = useSession();

    if (loading) {
        return <span className={styles.sessionSlot} aria-hidden />;
    }

    if (!user) {
        return (
            <Link href='/login' className={styles.link}>
                Log in
            </Link>
        );
    }

    return (
        <span className={styles.session}>
            <Link href='/account' className={styles.sessionLink} title='Your account'>
                {user.icon && (
                    <Image src={user.icon} alt='' width={22} height={22} className={styles.sessionIcon} unoptimized />
                )}
                <span className={styles.sessionName}>{user.username}</span>
            </Link>
            <button type='button' className={styles.logout} onClick={() => void logout()} title='Log out'>
                ⏻
            </button>
        </span>
    );
}

export default function Navbar() {
    const pathname = usePathname();
    const { colorMode, toggleColorMode } = useTheme();
    const { user } = useSession();
    const navLinks = user?.role === 'ADMIN' ? [...links, { href: '/import', label: 'Import' }] : links;
    // The small-screen menu remembers the page it was opened on, so any
    // navigation (link, search result, back button) closes it without an effect
    const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
    const menuOpen = menuOpenAt === pathname;

    return (
        <header className={styles.navbar}>
            <button
                type='button'
                className={styles.menuToggle}
                onClick={() => setMenuOpenAt(menuOpen ? null : pathname)}
                aria-expanded={menuOpen}
                aria-controls='primary-nav'
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
                {menuOpen ? '✕' : '☰'}
            </button>

            <Link href='/' className={styles.brand}>
                <img src='/images/logo.svg' width={32} height={32} alt='Final Frontier' className={styles.brandMark} />
                <span className={styles.brandText}>Final Frontier</span>
            </Link>

            <nav id='primary-nav' className={styles.links} aria-label='Primary' data-open={menuOpen || undefined}>
                {navLinks.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className={styles.link}
                        data-active={pathname.startsWith(href) || undefined}
                    >
                        {label}
                    </Link>
                ))}
            </nav>

            <SiteSearch />

            <SessionArea />

            <button
                type='button'
                className={styles.themeToggle}
                onClick={toggleColorMode}
                aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} theme`}
            >
                {colorMode === 'dark' ? '☾' : '☀'}
            </button>
        </header>
    );
}
