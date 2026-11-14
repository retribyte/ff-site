import type { Metadata } from 'next';
import Link from 'next/link';
import PortraitCreator, { type PortraitSettings } from '@/components/portrait/PortraitCreator';
import { api } from '@/lib/api';
import { getSessionUser, getToken } from '@/lib/auth';
import styles from '@/components/portrait/portrait.module.scss';

export const metadata: Metadata = {
    title: 'Portrait Creator',
    description: 'Build a character portrait from Starbound sprites: race, colours, wardrobe and pose.',
    // Members only, and the sprites are not ours to publish
    robots: { index: false, follow: false },
};

export default async function PortraitsPage() {
    const user = await getSessionUser();
    if (!user) {
        return (
            <main className={styles.page}>
                <div className={`pixel-panel ${styles.gate}`}>
                    <p className='pixel-label'>⚠ restricted frequency</p>
                    <p>
                        The portrait creator is for members. <Link href='/login'>Log in</Link>
                    </p>
                </div>
            </main>
        );
    }

    let settings: PortraitSettings;
    try {
        settings = await api<PortraitSettings>('/portrait/settings', { token: (await getToken()) ?? undefined, cache: 'no-store' });
    } catch {
        return (
            <main className={styles.page}>
                <p className={styles.error}>The portrait creator’s settings could not be loaded. Try again in a moment.</p>
            </main>
        );
    }
    return <PortraitCreator settings={settings} user={{ id: user.id, role: user.role }} />;
}
