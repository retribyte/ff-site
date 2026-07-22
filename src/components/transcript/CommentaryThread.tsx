'use client';

import { useState } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import { apiClient, errorMessage } from '@/lib/apiClient';
import type { SlimCommentary } from '@/lib/transcript';
import styles from './commentary.module.scss';

interface Props {
    episodeTitle: string;
    messageNo: number;
    initial?: SlimCommentary[];
}

type CommentaryRecord = { id: number; content: string; creatorId: number; creator?: { username: string } };

// Margin notes on a transcript line. Reads come with the transcript;
// after that the thread owns its own state via the authenticated proxy.
export default function CommentaryThread({ episodeTitle, messageNo, initial }: Props) {
    const { user } = useSession();
    const [notes, setNotes] = useState<SlimCommentary[]>(initial ?? []);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Nothing to show: no notes, and no one logged in to add one
    if (notes.length === 0 && !user) return null;

    const collectionPath = `/episodes/${encodeURIComponent(episodeTitle)}/messages/${messageNo}/commentaries`;

    const add = async () => {
        if (!draft.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const created = await apiClient<CommentaryRecord>(collectionPath, {
                method: 'POST',
                body: { content: draft.trim() },
            });
            setNotes((prev) => [
                ...prev,
                {
                    id: created.id,
                    content: created.content,
                    creatorId: created.creatorId,
                    creatorName: created.creator?.username ?? (user?.username ?? 'you'),
                },
            ]);
            setDraft('');
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const saveEdit = async (id: number) => {
        if (!editDraft.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const updated = await apiClient<CommentaryRecord>(`/commentaries/${id}`, {
                method: 'PUT',
                body: { content: editDraft.trim() },
            });
            setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: updated.content } : n)));
            setEditingId(null);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: number) => {
        setBusy(true);
        setError(null);
        try {
            await apiClient(`/commentaries/${id}`, { method: 'DELETE' });
            setNotes((prev) => prev.filter((n) => n.id !== id));
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.thread}>
            <button
                type='button'
                className={styles.chip}
                data-empty={notes.length === 0 || undefined}
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                ✎ {notes.length > 0 ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : ''}
            </button>

            {open && (
                <div className={styles.panel}>
                    {notes.map((note) => (
                        <div key={note.id} className={styles.note}>
                            <span className={styles.noteAuthor}>{note.creatorName}</span>
                            {editingId === note.id ? (
                                <span className={styles.editRow}>
                                    <textarea
                                        value={editDraft}
                                        onChange={(e) => setEditDraft(e.target.value)}
                                        rows={2}
                                        aria-label='Edit note'
                                    />
                                    <span className={styles.noteActions}>
                                        <button type='button' onClick={() => saveEdit(note.id)} disabled={busy}>
                                            save
                                        </button>
                                        <button type='button' onClick={() => setEditingId(null)}>
                                            cancel
                                        </button>
                                    </span>
                                </span>
                            ) : (
                                <>
                                    <p className={styles.noteContent}>{note.content}</p>
                                    {user && (user.id === note.creatorId || user.role === 'ADMIN') && (
                                        <span className={styles.noteActions}>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setEditingId(note.id);
                                                    setEditDraft(note.content);
                                                }}
                                            >
                                                edit
                                            </button>
                                            <button type='button' onClick={() => remove(note.id)} disabled={busy}>
                                                ✕
                                            </button>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {user ? (
                        <div className={styles.addRow}>
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder='add a margin note…'
                                rows={2}
                                aria-label='New note'
                            />
                            <button type='button' onClick={add} disabled={busy || !draft.trim()}>
                                {busy ? '…' : 'save note'}
                            </button>
                        </div>
                    ) : (
                        <p className='pixel-label'>log in to add notes</p>
                    )}

                    {error && (
                        <p className={styles.error} role='alert'>
                            ✖ {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
