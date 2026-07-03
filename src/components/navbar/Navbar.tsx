'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme/ThemeProvider';
import styles from './navbar.module.scss';

const links = [
    { href: '/archives', label: 'Archives' },
    { href: '/cyoa', label: 'CYOA' },
];

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
