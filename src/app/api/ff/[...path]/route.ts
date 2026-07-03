import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth';

// Generic authenticated proxy to ff-server. Browser code calls
// /api/ff/<anything> and the JWT from the httpOnly cookie rides along as
// the Bearer token — ff-server remains the enforcement point for roles
// and ownership. Same-origin, so no CORS story either.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const token = await getToken();
    const search = request.nextUrl.search;

    const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
    let response: Response;
    try {
        response = await fetch(`${API_URL}/${path.map(encodeURIComponent).join('/')}${search}`, {
            method: request.method,
            headers: {
                Accept: 'application/json',
                ...(hasBody && { 'Content-Type': 'application/json' }),
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            ...(hasBody && { body: await request.text() }),
        });
    } catch {
        return NextResponse.json({ status: 'error', message: 'The lore server is not answering' }, { status: 502 });
    }

    if (response.status === 204) {
        return new NextResponse(null, { status: 204 });
    }
    const body = await response.text();
    return new NextResponse(body, {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
