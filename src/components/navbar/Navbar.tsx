'use client';

import Link from 'next/link';
import Image from 'next/image';
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
            {user.icon && (
                <Image src={user.icon} alt='' width={22} height={22} className={styles.sessionIcon} unoptimized />
            )}
            <span className={styles.sessionName}>{user.username}</span>
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

    return (
        <header className={styles.navbar}>
            <Link href='/' className={styles.brand}>
                <img src='/images/logo.svg' width={32} height={32} alt='Final Frontier' className={styles.brandMark} />
                Final Frontier
            </Link>

            <nav className={styles.links} aria-label='Primary'>
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
