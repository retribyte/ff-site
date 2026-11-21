import type { Metadata } from 'next';
import LogPanel from '@/components/admin/LogPanel';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Server log' };

export default async function AdminLogPage() {
    await requireAdmin();
    return (
        <>
            <h1 className={styles.srOnly}>Server log</h1>
            <LogPanel />
        </>
    );
}
