'use client';

import { Fragment, useState } from 'react';
import type { JobRun } from '@/lib/types';
import { adminCall, formatWhen } from './adminApi';
import styles from './admin.module.scss';

// Recent job runs, newest first; a run's log loads when it's opened.
export default function JobHistory({ runs }: { runs: JobRun[] }) {
    const [open, setOpen] = useState<number | null>(null);
    const [logs, setLogs] = useState<Record<number, string>>({});

    const toggle = async (id: number) => {
        if (open === id) return setOpen(null);
        setOpen(id);
        if (logs[id] === undefined) {
            try {
                const run = await adminCall<JobRun>(`job-runs/${id}`);
                setLogs((l) => ({ ...l, [id]: run.log || '(no log)' }));
            } catch (err) {
                setLogs((l) => ({ ...l, [id]: err instanceof Error ? err.message : 'Could not load the log' }));
            }
        }
    };

    return (
        <section className={styles.panel} aria-labelledby='job-history'>
            <h2 id='job-history' className={styles.panelTitle}>
                History
            </h2>
            {runs.length === 0 ? (
                <p className={styles.help}>No jobs have run yet.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>when</th>
                            <th>job</th>
                            <th>result</th>
                            <th>by</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run) => (
                            <Fragment key={run.id}>
                                <tr>
                                    <td className={styles.nowrap}>{formatWhen(run.startedAt)}</td>
                                    <td>{run.job}</td>
                                    <td>
                                        <span className={styles.status} data-status={run.status}>
                                            {run.dryRun ? `dry run · ${run.status.toLowerCase()}` : run.status.toLowerCase()}
                                        </span>{' '}
                                        {run.summary}
                                    </td>
                                    <td>{run.user?.username ?? '—'}</td>
                                    <td>
                                        <button
                                            type='button'
                                            className={styles.ghost}
                                            onClick={() => void toggle(run.id)}
                                            aria-expanded={open === run.id}
                                        >
                                            log
                                        </button>
                                    </td>
                                </tr>
                                {open === run.id && (
                                    <tr>
                                        <td colSpan={5}>
                                            <pre className={styles.log}>{logs[run.id] ?? 'loading…'}</pre>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
