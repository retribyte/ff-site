import Link from 'next/link';
import { api } from '@/lib/api';
import type { AdminMetrics, JobRun, LogEntry, ViewTotal } from '@/lib/types';
import type { PortraitSettings } from '@/components/portrait/PortraitCreator';
import BarChart from '@/components/admin/BarChart';
import { requireAdmin } from './requireAdmin';
import styles from './admin.module.scss';

export const dynamic = 'force-dynamic';

const DAYS = 30;
const n = (x: number) => x.toLocaleString('en-US');

// Every date here is UTC, as ff-server counts views by UTC day
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' });
const when = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
// The narrow list cards: "Nov 10 20:34", short enough to stay on one line
const stamp = (iso: string) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `${day} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`;
};

// Each call settles on its own, so one failing leaves the rest of the dashboard standing
async function loadDashboard(token: string | undefined) {
    const [metrics, topViews, runs, problems, portraits] = await Promise.allSettled([
        api<AdminMetrics>(`/admin/metrics?days=${DAYS}`, { token }),
        api<ViewTotal[]>(`/admin/views?days=${DAYS}&limit=8`, { token }),
        // As many rows as the most-viewed list, so the bottom row's cards end together
        api<JobRun[]>('/admin/job-runs?limit=8', { token }),
        api<LogEntry[]>('/admin/logs?level=warn&limit=8', { token }),
        api<PortraitSettings>('/portrait/settings', { token, cache: 'no-store' }),
    ]);
    const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null);
    return { now: Date.now(), metrics: ok(metrics), topViews: ok(topViews), runs: ok(runs), problems: ok(problems), portraits: ok(portraits) };
}

type Tone = 'good' | 'bad' | undefined;

function Kpi({ href, label, value, note, tone }: { href: string; label: string; value: string; note: string; tone?: Tone }) {
    return (
        <Link href={href} className={styles.kpi} data-tone={tone === 'bad' ? 'bad' : undefined}>
            <span className={`pixel-label ${styles.kpiLabel}`}>{label}</span>
            <span className={styles.kpiValue}>{value}</span>
            <span className={styles.kpiNote} data-tone={tone}>
                {note}
            </span>
        </Link>
    );
}

function Card({ title, href, linkText, className, children }: { title: string; href?: string; linkText?: string; className: string; children: React.ReactNode }) {
    return (
        <section className={`${styles.card} ${className}`}>
            <div className={styles.cardHead}>
                <h2>{title}</h2>
                {href && <Link href={href}>{linkText ?? 'open'}</Link>}
            </div>
            {children}
        </section>
    );
}

const Unreachable = () => <p className={styles.unreachable}>The lore server did not answer this one.</p>;

function change(now: number, before: number): string {
    if (before === 0) return now === 0 ? 'none in the 30 days before either' : 'none in the 30 days before';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct)}% on the 30 days before`;
}

const runTone = (r: JobRun): Tone => (r.status === 'FAILED' ? 'bad' : r.status === 'SUCCEEDED' && !r.dryRun ? 'good' : undefined);
const runResult = (r: JobRun) => (r.status === 'FAILED' ? 'failed' : r.status === 'RUNNING' ? 'running' : r.dryRun ? 'dry run' : 'ok');

// The admin dashboard: headline numbers, then views and traffic over time, then what
// ran and what went wrong lately.
export default async function AdminPage() {
    const { now, metrics: m, topViews, runs, problems, portraits } = await loadDashboard(await requireAdmin());
    const t = m?.traffic;
    const viewTotal = m ? m.views.reduce((s, d) => s + d.member + d.anonymous, 0) : 0;
    const runTotal = m ? m.runs.succeeded + m.runs.failed + m.runs.running + m.runs.dryRuns : 0;
    const mods = portraits?.mods ?? [];
    const modsOn = mods.filter((x) => x.enabled).length;
    const modsMissing = mods.filter((x) => x.enabled && !x.present).length;
    // The buffer holds the last 2000 entries; on a busy day it reaches back less than 24 hours
    const partial = t?.coveredSince && Date.parse(t.coveredSince) > now - 24 * 3_600_000 ? t.coveredSince : null;
    const routeTop = Math.max(1, ...(t?.topRoutes.map((r) => r.count) ?? []));

    return (
        <>
            <h1 className={styles.srOnly}>Admin dashboard</h1>
            <div className={styles.dash}>
                <div className={styles.kpis}>
                    {m ? (
                        <>
                            <Kpi href='/admin/views' label={`Views, last ${DAYS} days`} value={n(viewTotal)} note={change(viewTotal, m.previousViews)} />
                            <Kpi href='/admin/log' label='Requests, last 24 hours' value={t ? n(t.requests) : '?'} note={partial ? `log only reaches back to ${when(partial)}` : 'from the server log'} />
                            <Kpi
                                href='/admin/log'
                                label='Response time, p95'
                                value={t?.p95 != null ? `${n(t.p95)} ms` : 'n/a'}
                                note={t?.p50 != null ? `median ${n(t.p50)} ms` : 'no requests yet'}
                            />
                            <Kpi
                                href='/admin/log'
                                label='Server errors, 24 hours'
                                value={t ? n(t.serverErrors + t.errors) : '?'}
                                note={t ? `${n(t.clientErrors)} client errors, ${n(t.warnings)} warnings` : ''}
                                tone={t && t.serverErrors + t.errors > 0 ? 'bad' : undefined}
                            />
                            <Kpi
                                href='/admin/history'
                                label={`Job runs, last ${DAYS} days`}
                                value={n(runTotal)}
                                note={`${n(m.runs.failed)} failed, ${n(m.runs.dryRuns)} dry runs`}
                                tone={m.runs.failed > 0 ? 'bad' : undefined}
                            />
                        </>
                    ) : (
                        <Unreachable />
                    )}
                    <Kpi
                        href='/admin/portraits'
                        label='Portrait mods'
                        value={portraits ? `${modsOn} of ${mods.length} on` : '?'}
                        note={!portraits ? 'no answer' : modsMissing ? `${modsMissing} on but missing from the bundle` : `${portraits.races.length} races listed`}
                        tone={modsMissing ? 'bad' : undefined}
                    />
                </div>

                <Card title={`Views per day, last ${DAYS} days`} href='/admin/views' linkText='all views' className={styles.span6}>
                    {m ? (
                        <BarChart
                            title={`Views per day, last ${DAYS} days`}
                            series={[
                                { name: 'signed in', color: 'var(--chart-1)' },
                                { name: 'anonymous', color: 'var(--chart-2)' },
                            ]}
                            bars={m.views.map((d) => ({ label: dayLabel(d.day), values: [d.member, d.anonymous] }))}
                            ticks={[0, 7, 14, 21, m.views.length - 1]}
                        />
                    ) : (
                        <Unreachable />
                    )}
                </Card>

                <Card title='Requests per hour, last 24 hours' href='/admin/log' linkText='server log' className={styles.span6}>
                    {t ? (
                        <>
                            <BarChart
                                title='Requests per hour, last 24 hours'
                                series={[
                                    { name: 'answered', color: 'var(--chart-1)' },
                                    { name: 'errors (4xx and 5xx)', color: 'color-mix(in srgb, var(--ff1) 70%, var(--text))' },
                                ]}
                                bars={t.hours.map((h) => ({ label: hourLabel(h.hour), values: [h.ok, h.clientErrors + h.serverErrors] }))}
                                ticks={[0, 6, 12, 18, t.hours.length - 1]}
                            />
                        </>
                    ) : (
                        <Unreachable />
                    )}
                </Card>

                <Card title='Busiest routes, last 24 hours' className={styles.span3}>
                    {!t ? (
                        <Unreachable />
                    ) : t.topRoutes.length === 0 ? (
                        <p className={styles.cardNote}>No requests in the log yet.</p>
                    ) : (
                        <ol className={styles.ranked}>
                            {t.topRoutes.map((r) => (
                                <li key={r.route}>
                                    <span className={styles.rankedName}>{r.route}</span>
                                    <span className={styles.mono}>{n(r.count)}</span>
                                    <span className={styles.rankedBar} style={{ width: `${(r.count / routeTop) * 100}%` }} aria-hidden='true' />
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>

                <Card title={`Most viewed, last ${DAYS} days`} href='/admin/views' linkText='all views' className={styles.span3}>
                    {!topViews ? (
                        <Unreachable />
                    ) : topViews.length === 0 ? (
                        <p className={styles.cardNote}>No views in this window yet.</p>
                    ) : (
                        <table className={styles.mini}>
                            <thead>
                                <tr>
                                    <th>title</th>
                                    <th className={styles.num}>views</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topViews.map((v) => (
                                    <tr key={`${v.kind}-${v.slug}`}>
                                        <td>{v.title}</td>
                                        <td className={styles.num}>{n(v.member + v.anonymous)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                <Card title='Recent job runs' href='/admin/history' linkText='history' className={styles.span3}>
                    {!runs ? (
                        <Unreachable />
                    ) : runs.length === 0 ? (
                        <p className={styles.cardNote}>No jobs have run yet.</p>
                    ) : (
                        <table className={styles.mini}>
                            <thead>
                                <tr>
                                    <th>when</th>
                                    <th>job</th>
                                    <th>result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((r) => (
                                    <tr key={r.id}>
                                        <td className={`${styles.mono} ${styles.nowrap}`}>{stamp(r.startedAt)}</td>
                                        <td>{r.job}</td>
                                        <td>
                                            <span className={styles.status} data-tone={runTone(r)}>
                                                {runResult(r)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                <Card title='Warnings and errors' href='/admin/log' linkText='server log' className={styles.span3}>
                    {!problems ? (
                        <Unreachable />
                    ) : problems.length === 0 ? (
                        <p className={styles.cardNote}>Nothing in the log buffer.</p>
                    ) : (
                        <table className={styles.mini}>
                            <thead>
                                <tr>
                                    <th>when</th>
                                    <th>level</th>
                                    <th>what</th>
                                </tr>
                            </thead>
                            <tbody>
                                {problems.map((e, i) => (
                                    <tr key={`${e.time}-${i}`}>
                                        <td className={`${styles.mono} ${styles.nowrap}`}>{stamp(e.time)}</td>
                                        <td>
                                            <span className={styles.status} data-tone={e.level === 'error' ? 'bad' : undefined}>
                                                {e.level}
                                            </span>
                                        </td>
                                        <td className={styles.mono}>
                                            {e.event === 'http' ? `${String(e.status)} ${String(e.method)} ${String(e.url).split('?')[0]}` : e.msg ? `${e.event}: ${e.msg}` : e.event}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>
        </>
    );
}
