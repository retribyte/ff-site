import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getSessionUser, getToken } from '@/lib/auth';
import type { AdminJob, JobRun } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import EpisodeImportPanel from '@/components/admin/EpisodeImportPanel';
import MaintenanceJobs from '@/components/admin/MaintenanceJobs';
import JobHistory from '@/components/admin/JobHistory';
import LogPanel from '@/components/admin/LogPanel';
import styles from './admin.module.scss';

export const metadata: Metadata = {
    title: 'Admin',
};

export const dynamic = 'force-dynamic';

// Admin-only jobs: episode import, maintenance jobs and their history.
// Members get a 404; ff-server checks the role on every call as well.
export default async function AdminPage() {
    const user = await getSessionUser();
    if (user?.role !== 'ADMIN') notFound();

    const token = await getToken();
    let jobs: AdminJob[];
    let runs: JobRun[];
    try {
        [jobs, runs] = await Promise.all([
            api<AdminJob[]>('/admin/jobs', { token: token ?? undefined }),
            api<JobRun[]>('/admin/job-runs?limit=25', { token: token ?? undefined }),
        ]);
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
                <h1>Admin</h1>
                <p className='pixel-label'>jobs that change the archive, and what the server has been up to</p>
            </header>
            <EpisodeImportPanel />
            <MaintenanceJobs jobs={jobs} />
            <JobHistory runs={runs} />
            <LogPanel />
        </main>
    );
}
