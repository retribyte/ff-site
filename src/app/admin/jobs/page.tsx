import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { AdminJob } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import MaintenanceJobs from '@/components/admin/MaintenanceJobs';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Maintenance jobs' };
export const dynamic = 'force-dynamic';

export default async function AdminJobsPage() {
    const token = await requireAdmin();
    let jobs: AdminJob[];
    try {
        jobs = await api<AdminJob[]>('/admin/jobs', { token });
    } catch {
        return <SignalLost />;
    }
    return (
        <>
            <h1 className={styles.srOnly}>Maintenance jobs</h1>
            <MaintenanceJobs jobs={jobs} />
        </>
    );
}
