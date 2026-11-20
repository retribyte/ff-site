import type { Metadata } from 'next';
import Link from 'next/link';
import ModUploader from '@/components/portrait/ModUploader';
import type { PortraitSettings } from '@/components/portrait/PortraitCreator';
import { api } from '@/lib/api';
import { getSessionUser, getToken } from '@/lib/auth';
import styles from './mods.module.scss';

export const metadata: Metadata = {
    title: 'Add mods to the portrait creator',
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

// Any member can add a mod's races and clothing to the portrait creator from their own copy
// of Starbound. The reading happens in their browser (ModUploader).
export default async function PortraitModsPage() {
    const user = await getSessionUser();
    if (!user) {
        return (
            <main className={styles.main}>
                <div className={`pixel-panel ${styles.gate}`}>
                    <p className='pixel-label'>⚠ restricted frequency</p>
                    <p>
                        Adding mods is for members. <Link href='/login'>Log in</Link>
                    </p>
                </div>
            </main>
        );
    }
    // Mods an admin switched off are left out of the reading; if the list cannot be had, none are
    const settings = await api<PortraitSettings>('/portrait/settings', { token: (await getToken()) ?? undefined, cache: 'no-store' }).catch(() => null);
    const off = (settings?.mods ?? []).filter((m) => !m.enabled).map((m) => ({ id: m.id, name: m.name }));

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Add mods</h1>
                <p>
                    <Link href='/portraits'>Back to the portrait creator</Link>
                </p>
            </header>
            <section className={`pixel-panel ${styles.panel}`}>
                <ModUploader switchedOff={off} />
            </section>
        </main>
    );
}
