'use client';

import { useEffect, useState } from 'react';
import DeleteControl from '@/components/DeleteControl';
import { EIGHTBALL_TYPE_META } from '@/lib/lore';
import type { EightBallAnswer, EightBallAnswerType } from '@/lib/types';
import styles from './answerEditor.module.scss';

// Maintenance panel for the oracle's answer pool, grouped into the three
// columns the server always returns answers sorted by (YES/NO/MAYBE). Any
// logged-in user can add answers; deletion is restricted to ADMIN via the
// isAdmin prop (the server enforces the role on every write regardless).

interface ListEnvelope {
    status: 'success' | 'error';
    message?: string;
    data?: EightBallAnswer[];
}

interface ItemEnvelope {
    status: 'success' | 'error';
    message?: string;
    data?: EightBallAnswer;
}

const TYPES: EightBallAnswerType[] = ['YES', 'NO', 'MAYBE'];

export default function AnswerEditor({ isAdmin }: { isAdmin: boolean }) {
    const [answers, setAnswers] = useState<EightBallAnswer[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<EightBallAnswerType, string>>({ YES: '', NO: '', MAYBE: '' });
    const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
    const [addBusy, setAddBusy] = useState<EightBallAnswerType | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/ff/8ball/answers')
            .then((res) => res.json() as Promise<ListEnvelope>)
            .then((envelope) => {
                if (cancelled) return;
                if (envelope.status === 'error' || !envelope.data) {
                    setLoadError(envelope.message ?? 'Failed to load answers');
                    return;
                }
                setAnswers(envelope.data);
            })
            .catch(() => {
                if (!cancelled) setLoadError('The lore server is not answering');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const addAnswer = async (type: EightBallAnswerType) => {
        const text = drafts[type].trim();
        if (!text) return;
        setAddBusy(type);
        setActionError(null);
        try {
            const res = await fetch('/api/ff/8ball/answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, text }),
            });
            const envelope = (await res.json()) as ItemEnvelope;
            if (!res.ok || envelope.status === 'error' || !envelope.data) {
                setActionError(envelope.message ?? 'Add failed');
                return;
            }
            const created = envelope.data;
            setAnswers((prev) => (prev ? [...prev, created] : [created]));
            setDrafts((prev) => ({ ...prev, [type]: '' }));
        } catch {
            setActionError('The lore server is not answering');
        } finally {
            setAddBusy(null);
        }
    };

    const deleteAnswer = async (id: number) => {
        setBusyIds((prev) => new Set(prev).add(id));
        setActionError(null);
        try {
            const res = await fetch(`/api/ff/8ball/answers/${id}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = (await res.json().catch(() => null)) as { message?: string } | null;
                setActionError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            setAnswers((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
        } catch {
            setActionError('The lore server is not answering');
        } finally {
            setBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    return (
        <section className={`pixel-panel ${styles.panel}`}>
            <h2 className={styles.title}>answer maintenance</h2>
            <p className='pixel-label'>submit new responses to the oracle&apos;s pool</p>

            {loadError && (
                <p className={styles.error} role='alert'>
                    ✖ {loadError}
                </p>
            )}
            {actionError && (
                <p className={styles.error} role='alert'>
                    ✖ {actionError}
                </p>
            )}

            {answers === null && !loadError ? (
                <p className='pixel-label'>loading…</p>
            ) : (
                <div className={styles.columns}>
                    {TYPES.map((type) => {
                        const meta = EIGHTBALL_TYPE_META[type];
                        const list = (answers ?? []).filter((a) => a.type === type);
                        return (
                            <div
                                key={type}
                                className={styles.column}
                                style={{ '--type': meta.color } as React.CSSProperties}
                            >
                                <h3 className={styles.columnTitle}>
                                    {type} <span className={styles.count}>({list.length})</span>
                                </h3>

                                <ul className={styles.list}>
                                    {list.map((a) => (
                                        <li key={a.id} className={styles.row}>
                                            <span className={styles.text}>{a.text}</span>
                                            {isAdmin && (
                                                <DeleteControl
                                                    onConfirm={() => deleteAnswer(a.id)}
                                                    busy={busyIds.has(a.id)}
                                                    prompt='eject this answer?'
                                                />
                                            )}
                                        </li>
                                    ))}
                                    {list.length === 0 && <li className='pixel-label'>none on file</li>}
                                </ul>

                                <form
                                    className={styles.addRow}
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void addAnswer(type);
                                    }}
                                >
                                    <input
                                        type='text'
                                        value={drafts[type]}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [type]: e.target.value }))}
                                        placeholder={`new ${type.toLowerCase()} answer…`}
                                        aria-label={`New ${type} answer`}
                                    />
                                    <button type='submit' className={styles.addButton} disabled={addBusy === type || !drafts[type].trim()}>
                                        {addBusy === type ? '…' : 'add'}
                                    </button>
                                </form>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
