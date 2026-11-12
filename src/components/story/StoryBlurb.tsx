'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './storyPublishedDate.module.scss';

// The story's blurb under its title. Everyone reads it; its authors and
// admins also get an edit button (PATCH /stories/:slug/blurb through the
// proxy; the server enforces who may), as with the published date. A story
// with no blurb shows nothing to readers, and "no blurb" to editors.
export default function StoryBlurb({
    slug,
    blurb,
    authorIds,
    className,
}: {
    slug: string;
    blurb: string | null;
    authorIds: number[];
    /** the blurb's own look on the page */
    className: string;
}) {
    const { user } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(blurb ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canEdit = !!user && (user.role === 'ADMIN' || authorIds.includes(user.id));
    if (!blurb && !canEdit) return null;

    const save = async (next: string | null) => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/site/ff/stories/${encodeURIComponent(slug)}/blurb`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blurb: next }),
            });
            if (!res.ok) {
                const envelope = (await res.json().catch(() => null)) as { message?: string } | null;
                setError(envelope?.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            setOpen(false);
            router.refresh();
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const trimmed = value.trim();
    return (
        <div className={styles.wrap}>
            {blurb && !open && <p className={className}>{blurb}</p>}
            {canEdit && (
                <p className='pixel-label'>
                    {!blurb && !open && <>no blurb </>}
                    <button
                        type='button'
                        className={styles.edit}
                        aria-expanded={open}
                        onClick={() => {
                            setValue(blurb ?? '');
                            setError(null);
                            setOpen((o) => !o);
                        }}
                    >
                        {open ? 'cancel' : blurb ? 'edit blurb' : 'add one'}
                    </button>
                </p>
            )}
            {open && canEdit && (
                <div className={`${styles.panel} ${styles.panelWide}`}>
                    <label className={styles.field}>
                        <span className='pixel-label'>blurb</span>
                        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={2000} disabled={busy} />
                    </label>
                    <button
                        type='button'
                        className={styles.save}
                        disabled={busy || !trimmed || trimmed === (blurb ?? '')}
                        onClick={() => void save(trimmed)}
                    >
                        {busy ? 'saving…' : 'save'}
                    </button>
                    {blurb && (
                        <button type='button' className={styles.clear} disabled={busy} onClick={() => void save(null)}>
                            remove blurb
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
