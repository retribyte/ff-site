'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SessionUser } from '@/lib/auth';

interface Session {
    user: SessionUser | null;
    /** true until the first /api/auth/me round trip settles */
    loading: boolean;
    /** Re-fetch the session (call after login/register) */
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

const SessionContext = createContext<Session>({
    user: null,
    loading: true,
    refresh: async () => {},
    logout: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = (await res.json()) as { user: SessionUser | null };
            setUser(data.user);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const logout = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
    }, []);

    return <SessionContext.Provider value={{ user, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
    return useContext(SessionContext);
}
