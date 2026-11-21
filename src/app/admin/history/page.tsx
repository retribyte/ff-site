import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { JobRun } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import JobHistory from '@/components/admin/JobHistory';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Job history' };
export const dynamic = 'force-dynamic';

export default async function AdminHistoryPage() {
    const token = await requireAdmin();
    let runs: JobRun[];
    try {
        runs = await api<JobRun[]>('/admin/job-runs?limit=25', { token });
    } catch {
        return <SignalLost />;
    }
    return (
        <>
            <h1 className={styles.srOnly}>Job history</h1>
            <JobHistory runs={runs} />
        </>
    );
}
