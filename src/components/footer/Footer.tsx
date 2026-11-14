'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_URL } from '@/lib/api';
import styles from './footer.module.scss';

// Pages whose main view fills the window and scrolls inside itself: a footer under one only
// adds a stray page scroll (on a phone, a swipe meant for a list drags the whole page down).
const FULL_SCREEN_PAGES = ['/portraits'];

// Which build is this? The site's version is inlined at build time
// (next.config.ts); the API's is asked for. If your local numbers differ from
// vortox.space's, your checkout is behind (or ahead of) production.
export default function Footer() {
    const pathname = usePathname();
    const [api, setApi] = useState<{ version: string; commit: string } | null | undefined>(undefined);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/version`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
            .then((body) => setApi(body?.data ?? null))
            .catch(() => {
                if (!controller.signal.aborted) setApi(null);
            });
        return () => controller.abort();
    }, []);

    if (FULL_SCREEN_PAGES.includes(pathname)) return null;

    const site = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';
    const siteCommit = process.env.NEXT_PUBLIC_APP_COMMIT ?? 'unknown';

    return (
        <footer className={styles.footer}>
            <span className='pixel-label'>est. 981 GUY ★ best viewed on any holodevice</span>
            <br />
            <span className='pixel-label' title={`ff-site commit ${siteCommit}`}>Site v{site}</span>
            <span className='pixel-label' aria-hidden> / </span>
            <span className='pixel-label' title={api ? `ff-server commit ${api.commit}` : undefined}>
                API v{api === undefined ? '…' : (api?.version ?? 'unreachable')}
            </span>
        </footer>
    );
}
