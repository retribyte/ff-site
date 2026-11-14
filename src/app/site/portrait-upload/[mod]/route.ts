import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth';
import { API_URL } from '@/lib/api';

// One piece of a member's mod upload, passed on to ff-server with the JWT from the httpOnly
// cookie. The generic /site/ff proxy sends JSON only; a piece is raw bytes (2 MB at most,
// so it fits in memory here and under any proxy's body limit).

export async function PUT(request: NextRequest, { params }: { params: Promise<{ mod: string }> }) {
    const token = await getToken();
    if (!token) return NextResponse.json({ status: 'error', message: 'Log in to add a mod' }, { status: 401 });
    const { mod } = await params;
    let response: Response;
    try {
        response = await fetch(`${API_URL}/portrait/mods/${encodeURIComponent(mod)}/upload${request.nextUrl.search}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
            body: await request.arrayBuffer(),
        });
    } catch {
        return NextResponse.json({ status: 'error', message: 'The lore server is not answering' }, { status: 502 });
    }
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' } });
}
