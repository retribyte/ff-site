import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import SignalLost from '@/components/SignalLost';
import PortraitAdmin from '@/components/admin/PortraitAdmin';
import type { PortraitSettings } from '@/components/portrait/PortraitCreator';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Portrait creator settings' };
export const dynamic = 'force-dynamic';

// What the portrait creator offers: mods, races, categories, hidden clothing.
export default async function PortraitAdminPage() {
    const token = await requireAdmin();
    let settings: PortraitSettings;
    try {
        settings = await api<PortraitSettings>('/portrait/settings', { token, cache: 'no-store' });
    } catch {
        return <SignalLost />;
    }

    return (
        <>
            <header className={styles.header}>
                <h1>Portrait creator settings</h1>
                <p>
                    <Link href='/portraits'>Open the creator</Link>
                </p>
            </header>
            <PortraitAdmin initial={settings} />
        </>
    );
}
