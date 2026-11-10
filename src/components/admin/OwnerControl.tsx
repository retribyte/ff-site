'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './ownerControl.module.scss';

type Kind = 'character' | 'item' | 'story';

const LABELS: Record<Kind, { toggle: string; field: string }> = {
    character: { toggle: 'played by…', field: 'played by' },
    item: { toggle: 'owner…', field: 'owner' },
    story: { toggle: 'authors…', field: 'authors' },
};

interface User {
    id: number;
    username: string;
}

// Admin-only: who plays a character, owns an item, or wrote a story.
// ff-server POST /admin/owner runs it as a job, so every change is a row in
// the /admin History table with the old and new names. Renders nothing for
// non-admins. `inline` drops the toggle button (for a panel that already has
// its own tabs, like SpeakerAdmin).
export default function OwnerControl({
    kind,
    id,
    ownerIds,
    inline = false,
}: {
    kind: Kind;
    id: number;
    /** Current owner (character, item) or authors (story) */
    ownerIds: number[];
    inline?: boolean;
}) {
    const { user } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(inline);
    const [users, setUsers] = useState<User[] | null>(null);
    const [picked, setPicked] = useState<number[]>(ownerIds);
    const [adding, setAdding] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    useEffect(() => {
        if (!open || users) return;
        fetch('/site/ff/users')
            .then((res) => res.json())
            .then((envelope: { data?: User[] }) =>
                setUsers([...(envelope.data ?? [])].sort((a, b) => a.username.localeCompare(b.username)))
            )
            .catch(() => setUsers([]));
    }, [open, users]);

    if (user?.role !== 'ADMIN') return null;

    const name = (uid: number) => users?.find((u) => u.id === uid)?.username ?? `user #${uid}`;
    const changed = picked.length !== ownerIds.length || picked.some((p) => !ownerIds.includes(p));
    const many = kind === 'story';

    const save = async () => {
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch('/site/ff/admin/owner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, id, userIds: picked }),
            });
            const envelope = (await res.json().catch(() => null)) as { message?: string; data?: { summary?: string } } | null;
            if (!res.ok) {
                setError(envelope?.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            setResult(envelope?.data?.summary ?? 'Saved.');
            if (!inline) setOpen(false);
            router.refresh();
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const form = (
        <div className={styles.panel}>
            <div className={styles.field}>
                <span className='pixel-label'>{LABELS[kind].field}</span>
                {many ? (
                    <div className={styles.authors}>
                        {picked.map((uid) => (
                            <span key={uid} className={styles.author}>
                                {name(uid)}
                                <button
                                    type='button'
                                    onClick={() => setPicked(picked.filter((p) => p !== uid))}
                                    disabled={busy || picked.length === 1}
                                    aria-label={`remove ${name(uid)}`}
                                    title={picked.length === 1 ? 'a story needs at least one author' : `remove ${name(uid)}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <select
                            value={adding}
                            onChange={(e) => {
                                const uid = Number(e.target.value);
                                if (uid && !picked.includes(uid)) setPicked([...picked, uid]);
                                setAdding('');
                            }}
                            disabled={busy || !users}
                            aria-label='add an author'
                        >
                            <option value=''>+ add author</option>
                            {(users ?? [])
                                .filter((u) => !picked.includes(u.id))
                                .map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.username}
                                    </option>
                                ))}
                        </select>
                    </div>
                ) : (
                    <select
                        value={picked[0] ?? ''}
                        onChange={(e) => setPicked([Number(e.target.value)])}
                        disabled={busy || !users}
                    >
                        {/* the current owner stays listed while the list loads */}
                        {(users ?? ownerIds.map((uid) => ({ id: uid, username: name(uid) }))).map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.username}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <div className={styles.actions}>
                <button type='button' className={styles.save} onClick={save} disabled={busy || !changed || picked.length === 0}>
                    {busy ? 'saving…' : 'save'}
                </button>
                {!inline && (
                    <button
                        type='button'
                        className={styles.toggle}
                        onClick={() => {
                            setOpen(false);
                            setPicked(ownerIds);
                            setError(null);
                        }}
                        disabled={busy}
                    >
                        cancel
                    </button>
                )}
            </div>
            <p className={styles.help}>Recorded in the admin History.</p>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            {result && inline && <p className={styles.help}>{result}</p>}
        </div>
    );

    if (inline) return form;
    return (
        <>
            <button type='button' className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {LABELS[kind].toggle}
            </button>
            {open && <div className={styles.panelRow}>{form}</div>}
        </>
    );
}
