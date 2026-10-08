'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './accountForms.module.scss';

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'saved' };

/**
 * Change-password form. `setup` is the forced first-login variant for seeded
 * accounts: on success it sends the user on into the archive.
 */
export default function PasswordForm({ setup = false }: { setup?: boolean }) {
    const router = useRouter();
    const { refresh } = useSession();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const [busy, setBusy] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword !== confirm) {
            setStatus({ kind: 'error', message: "The new passwords don't match" });
            return;
        }

        setBusy(true);
        setStatus({ kind: 'idle' });
        try {
            // Own route handler, not the /api/ff proxy: it swaps in the fresh
            // token ff-server issues, since the old one is now revoked
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setStatus({ kind: 'error', message: data.error ?? 'Something went wrong' });
                return;
            }
            setCurrentPassword('');
            setNewPassword('');
            setConfirm('');
            setStatus({ kind: 'saved' });
            await refresh();
            if (setup) router.push('/');
            else router.refresh();
        } catch {
            setStatus({ kind: 'error', message: 'The lore server is not answering' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={`pixel-panel ${styles.panel}`} onSubmit={submit}>
            <h2 className={styles.heading}>{setup ? 'Choose your password' : 'Change password'}</h2>

            <label className={styles.field}>
                <span className='pixel-label'>{setup ? 'temporary password' : 'current password'}</span>
                <input
                    type='password'
                    autoComplete='current-password'
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                />
            </label>

            <label className={styles.field}>
                <span className='pixel-label'>new password</span>
                <input
                    type='password'
                    autoComplete='new-password'
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
                <span className={styles.fieldHint}>At least 8 characters.</span>
            </label>

            <label className={styles.field}>
                <span className='pixel-label'>confirm new password</span>
                <input
                    type='password'
                    autoComplete='new-password'
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                />
            </label>

            <div className={styles.actions}>
                <button type='submit' className={styles.submit} disabled={busy}>
                    {busy ? 'Saving…' : setup ? 'Set password' : 'Change password'}
                </button>
                {status.kind === 'saved' && (
                    <p className={styles.success} role='status'>
                        password changed — other sessions logged out
                    </p>
                )}
                {status.kind === 'error' && (
                    <p className={styles.error} role='alert'>
                        {status.message}
                    </p>
                )}
            </div>
        </form>
    );
}
