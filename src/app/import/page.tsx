import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import StoryImporter from '@/components/import/StoryImporter';
import styles from './import.module.scss';

export const metadata: Metadata = { title: 'Import a story' };

export default async function ImportPage() {
    const user = await getSessionUser();

    if (!user || user.role !== 'ADMIN') {
        return (
            <main className={styles.main}>
                <div className={`pixel-panel ${styles.restricted}`}>
                    <p className='pixel-label'>⚠ restricted frequency</p>
                    <p>
                        Story import needs archivist (admin) clearance.{' '}
                        {!user && <Link href='/login'>Log in</Link>}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Story import</h1>
                <p className={styles.tagline}>
                    Put a story from a Google Doc onto the shelf, or replace the text of one already there with a
                    revised draft.
                </p>
            </header>
            {/* Episode import was retired from the web app — the archive is seeded; re-imports go through archive-to-markdown/api-import.py */}
            <StoryImporter />
        </main>
    );
}
