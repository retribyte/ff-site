'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import type { SessionUser } from '@/lib/auth';
import { BOORU_URL, booruPostUrl } from '@/lib/booru';
import { decodeEntities } from '@/lib/html';
import styles from './accountForms.module.scss';

interface Preview {
    id: number;
    imageUrl: string;
}

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'saved' };

async function ff<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api/ff${path}`, init);
    const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || envelope?.status === 'error') {
        throw new Error(envelope?.message ?? `HTTP ${res.status}`);
    }
    return envelope?.data as T;
}

function parseBooruId(input: string): number | null {
    return /^\d+$/.test(input.trim()) ? parseInt(input.trim(), 10) : null;
}

export default function ProfileForm({ user }: { user: SessionUser }) {
    const router = useRouter();
    const { refresh } = useSession();
    const [bio, setBio] = useState(decodeEntities(user.bio ?? ''));
    const [wikiUser, setWikiUser] = useState(user.wikiUser ?? '');
    const [booruInput, setBooruInput] = useState(user.iconBooruId ? String(user.iconBooruId) : '');
    const [preview, setPreview] = useState<Preview | null>(
        user.iconBooruId && user.icon ? { id: user.iconBooruId, imageUrl: user.icon } : null
    );
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [looking, setLooking] = useState(false);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const [busy, setBusy] = useState(false);

    const lookUp = async () => {
        const id = parseBooruId(booruInput);
        if (id === null) {
            setLookupError('Enter a booru post number');
            return;
        }
        setLooking(true);
        setLookupError(null);
        try {
            const post = await ff<Preview>(`/booru/${id}`);
            setPreview({ id: post.id, imageUrl: post.imageUrl });
        } catch (error) {
            setPreview(null);
            setLookupError((error as Error).message);
        } finally {
            setLooking(false);
        }
    };

    const removeAvatar = () => {
        setBooruInput('');
        setPreview(null);
        setLookupError(null);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = booruInput.trim();
        const booruId = trimmed ? parseBooruId(trimmed) : null;
        if (trimmed && booruId === null) {
            setStatus({ kind: 'error', message: 'The booru post must be a number' });
            return;
        }

        const body: Record<string, unknown> = { bio: bio.trim() || null, wikiUser: wikiUser.trim() || null };
        // Only send the avatar when it changed — setting it makes the server
        // look the post up on the booru
        if (booruId !== user.iconBooruId) body.iconBooruId = booruId;

        setBusy(true);
        setStatus({ kind: 'idle' });
        try {
            const updated = await ff<SessionUser>('/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            // Show what was actually stored (sanitizing may have dropped markup)
            setBio(decodeEntities(updated.bio ?? ''));
            setWikiUser(updated.wikiUser ?? '');
            setPreview(updated.iconBooruId && updated.icon ? { id: updated.iconBooruId, imageUrl: updated.icon } : null);
            setStatus({ kind: 'saved' });
            await refresh();
            router.refresh();
        } catch (error) {
            setStatus({ kind: 'error', message: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={`pixel-panel ${styles.panel}`} onSubmit={save}>
            <h2 className={styles.heading}>Profile</h2>

            <div className={styles.field}>
                <span className='pixel-label'>avatar</span>
                <div className={styles.avatarRow}>
                    <div className={styles.avatarPreview}>
                        {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview.imageUrl} alt='Avatar preview' />
                        ) : (
                            <span className={styles.avatarEmpty}>no avatar</span>
                        )}
                    </div>
                    <div className={styles.avatarControls}>
                        <div className={styles.inline}>
                            <input
                                type='text'
                                inputMode='numeric'
                                aria-label='Booru post number'
                                placeholder='booru post #'
                                value={booruInput}
                                onChange={(e) => {
                                    setBooruInput(e.target.value);
                                    setLookupError(null);
                                }}
                            />
                            <button type='button' className={styles.ghost} onClick={() => void lookUp()} disabled={looking}>
                                {looking ? 'scanning…' : 'preview'}
                            </button>
                            {(preview || booruInput) && (
                                <button type='button' className={styles.ghost} onClick={removeAvatar}>
                                    remove
                                </button>
                            )}
                        </div>
                        <p className={styles.fieldHint}>
                            Pick an image on{' '}
                            <a href={BOORU_URL} target='_blank' rel='noopener noreferrer' className={styles.hintLink}>
                                the booru
                            </a>{' '}
                            and enter its post number.
                            {preview && (
                                <>
                                    {' '}
                                    <a
                                        href={booruPostUrl(preview.id)}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className={`${styles.hintLink} ${styles.nowrap}`}
                                    >
                                        post #{preview.id} ↗
                                    </a>
                                </>
                            )}
                        </p>
                        {lookupError && <p className={styles.error}>{lookupError}</p>}
                    </div>
                </div>
            </div>

            <label className={styles.field}>
                <span className='pixel-label'>bio</span>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
                <span className={styles.fieldHint}>Basic formatting (&lt;b&gt;, &lt;i&gt;, links) is kept.</span>
            </label>

            <label className={styles.field}>
                <span className='pixel-label'>wiki username</span>
                <input type='text' value={wikiUser} onChange={(e) => setWikiUser(e.target.value)} maxLength={100} />
                <span className={styles.fieldHint}>Your account on wiki.vortox.space, if you have one.</span>
            </label>

            <div className={styles.actions}>
                <button type='submit' className={styles.submit} disabled={busy}>
                    {busy ? 'Saving…' : 'Save profile'}
                </button>
                {status.kind === 'saved' && <p className={styles.success} role='status'>profile saved</p>}
                {status.kind === 'error' && <p className={styles.error} role='alert'>{status.message}</p>}
            </div>
        </form>
    );
}
