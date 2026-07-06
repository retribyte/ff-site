import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import ImportConsole from '@/components/import/ImportConsole';
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
                <h1>Archive import</h1>
                <p className={styles.tagline}>
                    Feed episode or story JSON from the <code>archive-to-markdown</code> pipeline into the archive.
                </p>
            </header>
            <ImportConsole />
        </main>
    );
}
