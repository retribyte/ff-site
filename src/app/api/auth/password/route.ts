import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { getToken, setSessionCookie, type SessionUser } from '@/lib/auth';

// Password change goes through here rather than the generic /api/ff proxy:
// ff-server revokes every token issued before the change and hands back a
// fresh one, which has to replace the cookie or this session logs out too.
export async function PUT(request: Request) {
    const token = await getToken();
    if (!token) {
        return NextResponse.json({ error: 'Log in first' }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as {
        currentPassword?: string;
        newPassword?: string;
    } | null;
    if (!body?.currentPassword || !body?.newPassword) {
        return NextResponse.json({ error: 'Enter your current and new password' }, { status: 400 });
    }

    try {
        const { token: fresh } = await api<{ token: string }>('/user/password', {
            method: 'PUT',
            token,
            body: { currentPassword: body.currentPassword, newPassword: body.newPassword },
        });
        const user = await api<SessionUser>('/user', { token: fresh });

        const response = NextResponse.json({ user });
        setSessionCookie(response, fresh);
        return response;
    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json({ error: error.message }, { status: error.httpStatus });
        }
        return NextResponse.json({ error: 'The lore server is not answering' }, { status: 502 });
    }
}
