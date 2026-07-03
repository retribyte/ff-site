import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { SESSION_COOKIE, tokenMaxAge, type SessionUser } from '@/lib/auth';

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as {
        username?: string;
        email?: string;
        password?: string;
    } | null;
    if (!body?.username || !body?.email || !body?.password) {
        return NextResponse.json({ error: 'Enter a username, email, and password' }, { status: 400 });
    }

    try {
        await api('/register', {
            method: 'POST',
            body: { username: body.username, email: body.email, password: body.password },
        });

        // Registration doesn't return a token — log the new account in
        const { token } = await api<{ token: string }>('/login', {
            method: 'POST',
            body: { username: body.username, password: body.password },
        });
        const user = await api<SessionUser>('/user', { token });

        const response = NextResponse.json({ user }, { status: 201 });
        response.cookies.set(SESSION_COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: tokenMaxAge(token),
        });
        return response;
    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json({ error: error.message }, { status: error.httpStatus });
        }
        return NextResponse.json({ error: 'The lore server is not answering' }, { status: 502 });
    }
}
