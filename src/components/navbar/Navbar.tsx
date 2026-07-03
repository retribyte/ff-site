'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './navbar.module.scss';

const links = [
    { href: '/archives', label: 'Archives' },
    { href: '/cyoa', label: 'CYOA' },
    { href: '/characters', label: 'Characters' },
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

    return (
        <header className={styles.navbar}>
            <Link href='/' className={styles.brand}>
                <span className={styles.brandMark}>✦</span>
                Final Frontier
            </Link>

            <nav className={styles.links} aria-label='Primary'>
                {links.map(({ href, label }) => (
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
