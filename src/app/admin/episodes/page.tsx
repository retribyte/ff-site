import type { Metadata } from 'next';
import EpisodeImportPanel from '@/components/admin/EpisodeImportPanel';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Episode import' };

export default async function AdminEpisodesPage() {
    await requireAdmin();
    return (
        <>
            <h1 className={styles.srOnly}>Episode import</h1>
            <EpisodeImportPanel />
        </>
    );
}
