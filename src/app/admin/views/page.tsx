import type { Metadata } from 'next';
import ViewsPanel from '@/components/admin/ViewsPanel';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Views' };

export default async function AdminViewsPage() {
    await requireAdmin();
    return (
        <>
            <h1 className={styles.srOnly}>Views</h1>
            <ViewsPanel />
        </>
    );
}
