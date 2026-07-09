'use client';

import { useState } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import { EIGHTBALL_TYPE_META } from '@/lib/lore';
import type { EightBallAnswer } from '@/lib/types';
import AnswerEditor from './AnswerEditor';
import styles from './eightBall.module.scss';

// FF 8-Ball — the archive's in-universe oracle. Shake produces a weighted
// random answer from the server; the "shake" delay is purely cosmetic
// suspense layered on top of the real request via Promise.all.

interface ShakeEnvelope {
    status: 'success' | 'error';
    message?: string;
    data?: EightBallAnswer;
}

const SHAKE_MS = 900;

export default function EightBall() {
    const { user } = useSession();
    const [question, setQuestion] = useState('');
    const [shaking, setShaking] = useState(false);
    const [result, setResult] = useState<EightBallAnswer | null>(null);
    const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showMaintenance, setShowMaintenance] = useState(false);

    const canAsk = question.trim().length > 0 && !shaking;

    const ask = async () => {
        if (!canAsk) return;
        const asked = question.trim();
        setShaking(true);
        setError(null);

        try {
            const [envelope] = await Promise.all([
                fetch('/api/ff/8ball').then((res) => res.json() as Promise<ShakeEnvelope>),
                new Promise((resolve) => setTimeout(resolve, SHAKE_MS)),
            ]);
            if (envelope.status === 'error' || !envelope.data) {
                setError(envelope.message ?? 'The oracle did not answer');
                setResult(null);
                return;
            }
            setResult(envelope.data);
            setAskedQuestion(asked);
        } catch {
            setError('The lore server is not answering');
            setResult(null);
        } finally {
            setShaking(false);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void ask();
    };

    const tint = result ? EIGHTBALL_TYPE_META[result.type].color : undefined;

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.title}>FF 8-Ball</h1>
                <p className='pixel-label'>transmit a question to the oracle</p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div
                    className={styles.ball}
                    data-shaking={shaking || undefined}
                    style={tint ? ({ '--type': tint } as React.CSSProperties) : undefined}
                >
                    <div className={styles.window} data-answered={(!shaking && result) || undefined}>
                        {shaking ? (
                            <span className={styles.pending} aria-hidden>
                                ⋯
                            </span>
                        ) : result ? (
                            <span className={styles.answerText}>{result.text}</span>
                        ) : (
                            <span className={styles.pending} aria-hidden>
                                ?
                            </span>
                        )}
                    </div>
                </div>

                <label className={styles.field}>
                    <span className='pixel-label'>your question</span>
                    <input
                        type='text'
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder='will the union hold?'
                        maxLength={280}
                        required
                        aria-label='your question'
                    />
                </label>

                <div className={styles.buttonRow}>
                    <button type='submit' className={styles.ask} disabled={!canAsk}>
                        {shaking ? 'shaking…' : 'shake'}
                    </button>

                    {user && (
                        <button
                            type='button'
                            className={styles.maintenanceToggle}
                            onClick={() => setShowMaintenance((prev) => !prev)}
                            aria-expanded={showMaintenance}
                        >
                            {showMaintenance ? 'close' : 'edit'}
                        </button>
                    )}
                </div>

                {error && (
                    <p className={styles.error} role='alert'>
                        ✖ {error}
                    </p>
                )}

                {!shaking && result && askedQuestion && (
                    <p className={styles.echo}>
                        “{askedQuestion}”{user && ` — asked by ${user.username}`}
                    </p>
                )}
            </form>

            {user && showMaintenance && <AnswerEditor isAdmin={user.role === 'ADMIN'} />}
        </main>
    );
}
