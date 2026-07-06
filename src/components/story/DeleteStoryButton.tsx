'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import DeleteControl from '@/components/DeleteControl';
import styles from './deleteStoryButton.module.scss';

// Admin-only "eject" control for a whole story. Wraps the shared DeleteControl
// so story deletion reads the same as deleting any other record. Renders
// nothing for non-admins.
export default function DeleteStoryButton({ slug, redirectTo }: { slug: string; redirectTo?: string }) {
    const { user } = useSession();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (user?.role !== 'ADMIN') return null;

    const destroy = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/ff/stories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = (await res.json().catch(() => null)) as { message?: string } | null;
                setError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            if (redirectTo) router.push(redirectTo);
            router.refresh();
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
            <DeleteControl onConfirm={destroy} busy={busy} />
        </div>
    );
}
