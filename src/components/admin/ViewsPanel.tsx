'use client';

import { useEffect, useState } from 'react';
import type { ViewTotal } from '@/lib/types';
import { adminCall } from './adminApi';
import styles from './admin.module.scss';

const WINDOWS = [7, 30, 90] as const;

// Page views per episode and story (counts only: ff-server keeps no record of who read what).
export default function ViewsPanel() {
    const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
    const [rows, setRows] = useState<ViewTotal[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stale = false;
        adminCall<ViewTotal[]>(`views?days=${days}&limit=25`)
            .then((data) => {
                if (stale) return;
                setRows(data);
                setError(null);
            })
            .catch((err) => {
                if (!stale) setError(err instanceof Error ? err.message : 'Could not load the views');
            });
        return () => {
            stale = true;
        };
    }, [days]);

    const sum = (pick: (r: ViewTotal) => number) => (rows ?? []).reduce((n, r) => n + pick(r), 0);

    return (
        <section className={styles.panel} aria-labelledby='views'>
            <h2 id='views' className={styles.panelTitle}>
                Views
            </h2>
            <div className={styles.actions}>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) as (typeof WINDOWS)[number])}
                    aria-label='Time window'
                    className={styles.select}
                >
                    {WINDOWS.map((d) => (
                        <option key={d} value={d}>
                            last {d} days
                        </option>
                    ))}
                </select>
            </div>
            <p className={styles.help}>
                Episode page loads, and story or chapter page loads. Signed-in and anonymous views are counted separately; a refresh counts again.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            {rows === null ? (
                !error && <p className={styles.help}>loading…</p>
            ) : rows.length === 0 ? (
                <p className={styles.help}>No views in this window yet.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>title</th>
                            <th>kind</th>
                            <th>signed in</th>
                            <th>anonymous</th>
                            <th>total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={`${r.kind}-${r.slug}`}>
                                <td>{r.title}</td>
                                <td>{r.kind === 'EPISODE' ? 'episode' : 'story'}</td>
                                <td>{r.member.toLocaleString('en-US')}</td>
                                <td>{r.anonymous.toLocaleString('en-US')}</td>
                                <td>{(r.member + r.anonymous).toLocaleString('en-US')}</td>
                            </tr>
                        ))}
                        <tr>
                            <th scope='row'>shown above</th>
                            <td />
                            <td>{sum((r) => r.member).toLocaleString('en-US')}</td>
                            <td>{sum((r) => r.anonymous).toLocaleString('en-US')}</td>
                            <td>{sum((r) => r.member + r.anonymous).toLocaleString('en-US')}</td>
                        </tr>
                    </tbody>
                </table>
            )}
        </section>
    );
}
