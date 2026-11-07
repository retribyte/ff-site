'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminJob, JobRun } from '@/lib/types';
import { adminCall, formatWhen } from './adminApi';
import RunResult from './RunResult';
import styles from './admin.module.scss';

// The server's maintenance jobs: each can dry-run (rolled back) or run for real.
export default function MaintenanceJobs({ jobs }: { jobs: AdminJob[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, JobRun>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const run = async (name: string, dryRun: boolean) => {
        setBusy(name);
        setErrors((e) => ({ ...e, [name]: '' }));
        try {
            const result = await adminCall<JobRun>(`jobs/${encodeURIComponent(name)}/run`, { dryRun });
            setResults((r) => ({ ...r, [name]: result }));
            router.refresh();
        } catch (err) {
            setErrors((e) => ({ ...e, [name]: err instanceof Error ? err.message : 'The job failed to start' }));
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className={styles.panel} aria-labelledby='maintenance-jobs'>
            <h2 id='maintenance-jobs' className={styles.panelTitle}>
                Maintenance jobs
            </h2>
            <p className={styles.help}>Safe to run any number of times. A dry run does the work and then undoes it.</p>
            <ul className={styles.jobs}>
                {jobs.map((job) => (
                    <li key={job.name} className={styles.job}>
                        <div className={styles.jobHead}>
                            <strong>{job.title}</strong>
                            <span className={styles.actions}>
                                <button
                                    type='button'
                                    className={styles.ghost}
                                    onClick={() => void run(job.name, true)}
                                    disabled={busy !== null}
                                >
                                    dry run
                                </button>
                                <button
                                    type='button'
                                    className={styles.go}
                                    onClick={() => void run(job.name, false)}
                                    disabled={busy !== null}
                                >
                                    {busy === job.name ? 'running…' : 'run'}
                                </button>
                            </span>
                        </div>
                        <p className={styles.help}>{job.description}</p>
                        {job.lastRun && (
                            <p className={styles.lastRun}>
                                last run {formatWhen(job.lastRun.startedAt)}
                                {job.lastRun.user && <> by {job.lastRun.user.username}</>}:{' '}
                                <span className={styles.status} data-status={job.lastRun.status}>
                                    {job.lastRun.dryRun ? 'dry run' : job.lastRun.status.toLowerCase()}
                                </span>
                            </p>
                        )}
                        {errors[job.name] && (
                            <p className={styles.error} role='alert'>
                                ✖ {errors[job.name]}
                            </p>
                        )}
                        {results[job.name] && <RunResult run={results[job.name]} />}
                    </li>
                ))}
            </ul>
        </section>
    );
}
