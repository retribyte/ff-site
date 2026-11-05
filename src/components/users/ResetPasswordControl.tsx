'use client';

import { useState } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import DeleteControl from '@/components/DeleteControl';
import styles from './resetPasswordControl.module.scss';

// Admin-only: puts a player account back on its default password (ff-server's
// POST /users/:id/password-reset), for when someone else claimed it. The
// player then logs in with the default and must pick a new one; every
// existing session, the claimer's included, is signed out. Renders nothing
// for non-admins and on admin profiles (the server refuses those anyway).
export default function ResetPasswordControl({ userId, targetIsAdmin }: { userId: number; targetIsAdmin: boolean }) {
    const { user } = useSession();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    if (user?.role !== 'ADMIN' || targetIsAdmin) return null;

    const reset = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/ff/users/${userId}/password-reset`, { method: 'POST' });
            if (!res.ok) {
                const envelope = (await res.json().catch(() => null)) as { message?: string } | null;
                setError(envelope?.message ?? `Reset failed (HTTP ${res.status})`);
                return;
            }
            setDone(true);
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.control}>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            {done ? (
                <p className='pixel-label' role='status'>
                    password reset: they log in with the default and pick a new one
                </p>
            ) : (
                <DeleteControl
                    onConfirm={reset}
                    busy={busy}
                    deleteLabel='Reset password'
                    prompt='reset to the default password?'
                    confirmLabel='Reset'
                    cancelLabel='Keep'
                />
            )}
        </div>
    );
}
