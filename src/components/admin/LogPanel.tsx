'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import type { LogEntry } from '@/lib/types';
import { adminCall } from './adminApi';
import styles from './admin.module.scss';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
// Quick filters: an event prefix ('' = everything)
const AREAS = [
    ['', 'everything'],
    ['http', 'requests'],
    ['auth', 'sign-ins'],
    ['admin', 'admin actions'],
    ['user', 'accounts'],
    ['app', 'errors caught'],
    ['wiki', 'wiki'],
    ['process', 'crashes'],
] as const;

// Fields shown elsewhere in the row, not repeated in the detail
const SHOWN = new Set(['time', 'level', 'event', 'msg', 'reqId', 'userId', 'username', 'method', 'url', 'status', 'ms', 'stack']);

function detail(e: LogEntry): string {
    if (e.event === 'http') return `${e.method} ${e.url} → ${e.status} · ${e.ms}ms`;
    const rest = Object.entries(e)
        .filter(([k]) => !SHOWN.has(k))
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' ');
    return [e.msg, rest].filter(Boolean).join(' · ');
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// The server's recent log: the last couple of thousand entries it holds in memory
// (a restart reloads the last day from its log file). Click a row for everything it recorded.
export default function LogPanel() {
    const [entries, setEntries] = useState<LogEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [level, setLevel] = useState<(typeof LEVELS)[number]>('info');
    const [area, setArea] = useState('');
    const [q, setQ] = useState('');
    const [live, setLive] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        const params = new URLSearchParams({ level, limit: '200' });
        if (area) params.set('event', area);
        if (q.trim()) params.set('q', q.trim());
        try {
            setEntries(await adminCall<LogEntry[]>(`logs?${params}`));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the log');
        }
    }, [level, area, q]);

    useEffect(() => {
        const t = setTimeout(() => void load(), q ? 300 : 0); // let typing settle
        return () => clearTimeout(t);
    }, [load, q]);

    useEffect(() => {
        if (!live) return;
        const t = setInterval(() => void load(), 10_000);
        return () => clearInterval(t);
    }, [live, load]);

    // An entry's identity: time + request + event is unique enough for a row key
    const key = (e: LogEntry, i: number) => `${e.time}-${e.reqId ?? ''}-${e.event}-${i}`;

    return (
        <section className={styles.panel} aria-labelledby='server-log'>
            <h2 id='server-log' className={styles.panelTitle}>
                Server log
            </h2>
            <div className={styles.actions}>
                <select value={area} onChange={(e) => setArea(e.target.value)} aria-label='Kind of entry' className={styles.select}>
                    {AREAS.map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <select value={level} onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])} aria-label='Minimum level' className={styles.select}>
                    {LEVELS.map((l) => (
                        <option key={l} value={l}>
                            {l === 'debug' ? 'all levels' : `${l} and up`}
                        </option>
                    ))}
                </select>
                <input
                    type='search'
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder='search (user, path, request id…)'
                    aria-label='Search the log'
                    className={styles.select}
                />
                <button type='button' className={styles.ghost} onClick={() => void load()}>
                    refresh
                </button>
                <label className={styles.help}>
                    <input type='checkbox' checked={live} onChange={(e) => setLive(e.target.checked)} /> every 10s
                </label>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {entries === null ? (
                !error && <p className={styles.help}>loading…</p>
            ) : entries.length === 0 ? (
                <p className={styles.help}>Nothing matches.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>when</th>
                            <th>level</th>
                            <th>event</th>
                            <th>detail</th>
                            <th>user</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e, i) => {
                            const k = key(e, i);
                            return (
                                <Fragment key={k}>
                                    <tr className={styles.clickRow} onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
                                        <td className={styles.nowrap}>{formatTime(e.time)}</td>
                                        <td>
                                            <span className={styles.level} data-level={e.level}>
                                                {e.level}
                                            </span>
                                        </td>
                                        <td className={styles.nowrap}>{e.event}</td>
                                        <td className={styles.wrap}>{detail(e)}</td>
                                        <td>{e.username ?? '—'}</td>
                                    </tr>
                                    {open === k && (
                                        <tr>
                                            <td colSpan={5}>
                                                <pre className={styles.log}>{JSON.stringify(e, null, 2)}</pre>
                                                {e.reqId && (
                                                    <button type='button' className={styles.ghost} onClick={() => setQ(e.reqId as string)}>
                                                        everything from this request
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </section>
    );
}
