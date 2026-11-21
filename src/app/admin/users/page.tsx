import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { booruPostUrl } from '@/lib/booru';
import { imageSrc } from '@/lib/images';
import SignalLost from '@/components/SignalLost';
import { requireAdmin } from '../requireAdmin';
import admin from '../admin.module.scss';
import styles from './users.module.scss';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

const n = (x: number) => x.toLocaleString('en-US');
const joined = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const profileHref = (u: AdminUser) => `/users/${encodeURIComponent(u.username)}`;

// Admins first, then by name
const order = (a: AdminUser, b: AdminUser) =>
    Number(b.role === 'ADMIN') - Number(a.role === 'ADMIN') || a.username.localeCompare(b.username, 'en', { sensitivity: 'base' });

// Every account with the badges its profile shows (admin, inactive), plus whether it can
// sign in at all. Each row opens that user's profile.
export default async function AdminUsersPage() {
    const token = await requireAdmin();
    let users: AdminUser[];
    try {
        users = await api<AdminUser[]>('/users', { token, cache: 'no-store' });
    } catch {
        return <SignalLost />;
    }
    users.sort(order);
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    const inactive = users.filter((u) => u.inactive).length;
    const disabled = users.filter((u) => u.loginDisabled).length;

    return (
        <>
            <div className={admin.header}>
                <h1>Users</h1>
                <p>
                    {n(users.length)} accounts: {n(admins)} admin{admins === 1 ? '' : 's'}, {n(inactive)} inactive, {n(disabled)} unable to sign in
                </p>
            </div>
            <section className={admin.card}>
                <div className={styles.scroll}>
                    <table className={`${admin.mini} ${styles.table}`}>
                        <thead>
                            <tr>
                                <th>user</th>
                                <th>badges</th>
                                <th className={admin.num}>characters</th>
                                <th className={admin.num}>transmissions</th>
                                <th className={admin.num}>stories</th>
                                <th className={admin.num}>notes</th>
                                <th>wiki</th>
                                <th>avatar</th>
                                <th>joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className={styles.row}>
                                    <td>
                                        <Link href={profileHref(u)} className={styles.who}>
                                            {u.icon ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={imageSrc(u.icon)} alt='' width={32} height={32} className={styles.icon} />
                                            ) : (
                                                <span className={styles.glyph} aria-hidden>
                                                    {u.username.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                            <span className={styles.name}>{u.username}</span>
                                        </Link>
                                    </td>
                                    <td>
                                        <span className={styles.badges}>
                                            {!u.inactive && !u.loginDisabled && (
                                                <span className={`${styles.chip} ${styles.success}`} title='Has signed in with a password of their own; not shown on the profile'>
                                                    active
                                                </span>
                                            )}
                                            {u.role === 'ADMIN' && <span className={styles.chip}>admin</span>}
                                            {u.inactive && (
                                                <span className={`${styles.chip} ${styles.muted}`} title='Still on the starting password, so they have never signed in'>
                                                    inactive
                                                </span>
                                            )}
                                            {u.loginDisabled && (
                                                <span className={`${styles.chip} ${styles.error}`} title='Sign-in is turned off (system account or suspended); not shown on the profile'>
                                                    disabled
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className={admin.num}>{n(u._count.characters)}</td>
                                    <td className={admin.num}>{n(u._count.messages)}</td>
                                    <td className={admin.num}>{n(u._count.stories)}</td>
                                    <td className={admin.num}>{n(u._count.commentaries)}</td>
                                    <td>
                                        {u.wikiUser && (
                                            <a
                                                href={`https://wiki.vortox.space/wiki/User:${encodeURIComponent(u.wikiUser)}`}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className={styles.external}
                                            >
                                                {u.wikiUser} ↗
                                            </a>
                                        )}
                                    </td>
                                    <td>
                                        {u.iconBooruId && (
                                            <a href={booruPostUrl(u.iconBooruId)} target='_blank' rel='noopener noreferrer' className={styles.external}>
                                                #{u.iconBooruId} ↗
                                            </a>
                                        )}
                                    </td>
                                    <td className={admin.nowrap}>{joined(u.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
