'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import { dateOnly, formatDateOnly } from '@/lib/dates';
import styles from './storyPublishedDate.module.scss';

// The story's real-world publication date. Everyone sees it; its authors and
// admins also get an edit button (PATCH /stories/:slug/published-date through
// the proxy; the server enforces who may). A story with no date (still in
// progress) shows nothing to readers, and "no published date" to editors.
export default function StoryPublishedDate({
    slug,
    publishedDate,
    authorIds,
}: {
    slug: string;
    publishedDate: string | null;
    authorIds: number[];
}) {
    const { user } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(dateOnly(publishedDate) ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canEdit = !!user && (user.role === 'ADMIN' || authorIds.includes(user.id));
    const shown = formatDateOnly(publishedDate);
    if (!shown && !canEdit) return null;

    const save = async (next: string | null) => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/site/ff/stories/${encodeURIComponent(slug)}/published-date`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publishedDate: next }),
            });
            if (!res.ok) {
                const envelope = (await res.json().catch(() => null)) as { message?: string } | null;
                setError(envelope?.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            setValue(next ?? '');
            setOpen(false);
            router.refresh();
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.wrap}>
            <p className='pixel-label'>
                {shown ? <>published {shown}</> : <>no published date</>}
                {canEdit && (
                    <>
                        {' '}
                        <button
                            type='button'
                            className={styles.edit}
                            aria-expanded={open}
                            onClick={() => {
                                setValue(dateOnly(publishedDate) ?? '');
                                setError(null);
                                setOpen((o) => !o);
                            }}
                        >
                            {open ? 'cancel' : 'edit'}
                        </button>
                    </>
                )}
            </p>
            {open && canEdit && (
                <div className={styles.panel}>
                    <label className={styles.field}>
                        <span className='pixel-label'>published</span>
                        <input type='date' value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} />
                    </label>
                    <button type='button' className={styles.save} disabled={busy || !value || value === dateOnly(publishedDate)} onClick={() => void save(value)}>
                        {busy ? 'saving…' : 'save'}
                    </button>
                    {publishedDate && (
                        <button type='button' className={styles.clear} disabled={busy} onClick={() => void save(null)}>
                            clear date
                        </button>
                    )}
                    {error && (
                        <p role='alert' className={styles.error}>
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
