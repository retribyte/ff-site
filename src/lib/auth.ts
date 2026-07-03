import { cookies } from 'next/headers';
import { api } from './api';

// Server-side session helpers. The ff-server JWT lives in an httpOnly cookie
// set by the /api/auth/* route handlers; browser JS never sees it.

export const SESSION_COOKIE = 'ff_token';

export interface SessionUser {
    id: number;
    username: string;
    email: string | null;
    role: 'USER' | 'ADMIN';
    icon: string | null;
    bio: string | null;
}

export async function getToken(): Promise<string | null> {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Validates the cookie against ff-server; null when logged out or expired. */
export async function getSessionUser(): Promise<SessionUser | null> {
    const token = await getToken();
    if (!token) return null;
    try {
        return await api<SessionUser>('/user', { token, cache: 'no-store' });
    } catch {
        return null;
    }
}

/** Seconds until the JWT expires (for cookie maxAge); falls back to 1h. */
export function tokenMaxAge(token: string): number {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { exp?: number };
        if (payload.exp) {
            const remaining = payload.exp - Math.floor(Date.now() / 1000);
            if (remaining > 0) return remaining;
        }
    } catch {
        // unparseable token — use the fallback
    }
    return 3600;
}
