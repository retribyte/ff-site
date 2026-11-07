'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import { seasonDisplayName } from '@/lib/seasons';
import styles from './storyShelfControl.module.scss';

// Admin-only: where a story sits on the /stories shelf. Its campaign
// (which decides mainline vs spin-off) and whether it's canon.
// PUT /stories/:slug through the proxy. Renders nothing for non-admins.
export default function StoryShelfControl({
    slug,
    canon,
    seasonTitle,
}: {
    slug: string;
    canon: boolean;
    seasonTitle: string | null;
}) {
    const { user } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [seasons, setSeasons] = useState<string[] | null>(null);
    const [season, setSeason] = useState(seasonTitle ?? '');
    const [isCanon, setCanon] = useState(canon);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || seasons) return;
        fetch('/site/ff/seasons')
            .then((res) => res.json())
            .then((envelope: { data?: { title: string }[] }) => setSeasons((envelope.data ?? []).map((s) => s.title)))
            .catch(() => setSeasons([]));
    }, [open, seasons]);

    if (user?.role !== 'ADMIN') return null;

    const changed = season !== (seasonTitle ?? '') || isCanon !== canon;

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/site/ff/stories/${encodeURIComponent(slug)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ season: season || null, canon: isCanon }),
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

    if (!open) {
        return (
            <button type='button' className={styles.toggle} onClick={() => setOpen(true)}>
                shelf settings
            </button>
        );
    }

    return (
        <div className={styles.panel}>
            <label className={styles.field}>
                <span className='pixel-label'>campaign</span>
                <select value={season} onChange={(e) => setSeason(e.target.value)} disabled={busy || !seasons}>
                    <option value=''>none</option>
                    {/* the current campaign stays listed while the list loads */}
                    {(seasons ?? (seasonTitle ? [seasonTitle] : [])).map((title) => (
                        <option key={title} value={title}>
                            {seasonDisplayName(title)}
                        </option>
                    ))}
                </select>
            </label>
            <label className={styles.check}>
                <input type='checkbox' checked={isCanon} onChange={(e) => setCanon(e.target.checked)} disabled={busy} />
                <span className='pixel-label'>canon</span>
            </label>
            <div className={styles.actions}>
                <button type='button' className={styles.save} onClick={save} disabled={busy || !changed}>
                    {busy ? 'saving…' : 'save'}
                </button>
                <button
                    type='button'
                    className={styles.toggle}
                    onClick={() => {
                        setOpen(false);
                        setSeason(seasonTitle ?? '');
                        setCanon(canon);
                        setError(null);
                    }}
                    disabled={busy}
                >
                    cancel
                </button>
            </div>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </div>
    );
}
