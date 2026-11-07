import type { JobRun } from '@/lib/types';
import styles from './admin.module.scss';

/** A finished run: its status, summary and log. */
export default function RunResult({ run }: { run: JobRun }) {
    return (
        <div className={styles.result} data-status={run.status}>
            <p className={styles.resultLine}>
                <span className={styles.status} data-status={run.status}>
                    {run.dryRun ? `dry run · ${run.status.toLowerCase()}` : run.status.toLowerCase()}
                </span>{' '}
                {run.summary}
            </p>
            {run.log && <pre className={styles.log}>{run.log}</pre>}
        </div>
    );
}
