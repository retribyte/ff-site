import type { Metadata } from 'next';
import { api } from '@/lib/api';
import SignalLost from '@/components/SignalLost';
import GalaxyConsole from '@/components/space/GalaxyConsole';
import type { GalaxyDetail } from '@/components/space/types';
import styles from './galaxy.module.scss';

export const metadata: Metadata = {
    title: 'Galaxy',
};

export const dynamic = 'force-dynamic';

export default async function GalaxyPage() {
    let galaxy: GalaxyDetail;
    try {
        galaxy = await api<GalaxyDetail>('/galaxies/ff');
    } catch {
        return (
            <main className={`${styles.main} ${styles.mainError}`}>
                <SignalLost />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <GalaxyConsole galaxy={galaxy} />
        </main>
    );
}
