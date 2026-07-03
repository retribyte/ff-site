'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/SessionProvider';
import styles from './login.module.scss';

type Mode = 'login' | 'register';

export default function LoginPage() {
    const router = useRouter();
    const { refresh } = useSession();
    const [mode, setMode] = useState<Mode>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/auth/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'login' ? { username, password } : { username, email, password }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error ?? 'Something went wrong');
                return;
            }
            await refresh();
            router.push('/');
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
    };

    return (
        <main className={styles.main}>
            <form className={`pixel-panel ${styles.terminal}`} onSubmit={submit}>
                <p className='pixel-label'>⌁ vortox access terminal ⌁</p>

                <div className={styles.tabs} role='tablist'>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={mode === 'login'}
                        className={styles.tab}
                        data-active={mode === 'login' || undefined}
                        onClick={() => switchMode('login')}
                    >
                        Log in
                    </button>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={mode === 'register'}
                        className={styles.tab}
                        data-active={mode === 'register' || undefined}
                        onClick={() => switchMode('register')}
                    >
                        Register
                    </button>
                </div>

                <label className={styles.field}>
                    <span className='pixel-label'>username</span>
                    <input
                        type='text'
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete='username'
                        required
                    />
                </label>

                {mode === 'register' && (
                    <label className={styles.field}>
                        <span className='pixel-label'>email</span>
                        <input
                            type='email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete='email'
                            required
                        />
                    </label>
                )}

                <label className={styles.field}>
                    <span className='pixel-label'>password</span>
                    <input
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        required
                    />
                </label>

                {error && (
                    <p className={styles.error} role='alert'>
                        ✖ {error}
                    </p>
                )}

                <button type='submit' className={styles.submit} disabled={busy}>
                    {busy ? 'transmitting…' : mode === 'login' ? 'Authenticate' : 'Join the crew'}
                </button>

                <p className={styles.hint}>
                    {mode === 'login' ? 'New around this sector?' : 'Already registered?'}{' '}
                    <button
                        type='button'
                        className={styles.hintLink}
                        onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    >
                        {mode === 'login' ? 'Register' : 'Log in'}
                    </button>
                </p>
            </form>
        </main>
    );
}
