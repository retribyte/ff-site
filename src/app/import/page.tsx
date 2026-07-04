import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import EpisodeImporter from '@/components/import/EpisodeImporter';
import styles from './import.module.scss';

export const metadata: Metadata = { title: 'Import transcripts' };

export default async function ImportPage() {
    const user = await getSessionUser();

    if (!user || user.role !== 'ADMIN') {
        return (
            <main className={styles.main}>
                <div className={`pixel-panel ${styles.restricted}`}>
                    <p className='pixel-label'>⚠ restricted frequency</p>
                    <p>
                        Transcript import needs archivist (admin) clearance.{' '}
                        {!user && <Link href='/login'>Log in</Link>}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Transcript import</h1>
                <p className={styles.tagline}>
                    Feed an episode JSON from <code>archive-to-markdown/md-to-api.py</code> into the archive.
                </p>
            </header>
            <EpisodeImporter />
        </main>
    );
}
