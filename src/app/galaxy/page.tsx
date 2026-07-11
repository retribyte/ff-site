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
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Galaxy</h1>
                <p className='pixel-label'>
                    {galaxy.systems.length} system{galaxy.systems.length === 1 ? '' : 's'} ·{' '}
                    {galaxy.landmarks.length} landmark{galaxy.landmarks.length === 1 ? '' : 's'} charted
                </p>
            </header>
            <GalaxyConsole galaxy={galaxy} />
        </main>
    );
}
