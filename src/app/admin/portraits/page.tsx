import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getSessionUser, getToken } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import PortraitAdmin from '@/components/admin/PortraitAdmin';
import type { PortraitSettings } from '@/components/portrait/PortraitCreator';
import styles from '../admin.module.scss';

export const metadata: Metadata = {
    title: 'Portrait creator settings',
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

// Admin-only: what the portrait creator offers. Members get a 404; ff-server checks the
// role on every change as well.
export default async function PortraitAdminPage() {
    const user = await getSessionUser();
    if (user?.role !== 'ADMIN') notFound();

    let settings: PortraitSettings;
    try {
        settings = await api<PortraitSettings>('/portrait/settings', { token: (await getToken()) ?? undefined, cache: 'no-store' });
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Portrait creator settings</h1>
                <p>
                    <Link href='/admin'>Admin</Link> · <Link href='/portraits'>Open the creator</Link>
                </p>
            </header>
            <PortraitAdmin initial={settings} />
        </main>
    );
}
