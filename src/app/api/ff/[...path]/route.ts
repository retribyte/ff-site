import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getToken } from '@/lib/auth';
import { cacheTags } from '@/lib/cache';

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

    // A successful mutation may change cached reader content — bust the tags so
    // the ISR pages re-render on next visit instead of serving stale data.
    if (request.method !== 'GET' && response.ok) {
        invalidateForPath(path);
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

// Map a mutated upstream path to the reader cache tags it can affect.
// Commentary edits/deletes hit `/commentaries/:id` (no episode in the path),
// so any commentary or episode write busts the shared `episodes` tag.
function invalidateForPath(path: string[]) {
    const [root, second] = path;
    // { expire: 0 } = expire immediately, so the next read is a fresh miss
    // (read-your-writes). Authored changes here are rare, so we prefer the
    // one slower post-mutation render over serving a stale note/story.
    const now = { expire: 0 };
    if (root === 'episodes' || root === 'commentaries') {
        revalidateTag(cacheTags.episodes, now);
    }
    if (root === 'episodes' || root === 'seasons') {
        revalidateTag(cacheTags.seasons, now);
    }
    if (root === 'stories') {
        revalidateTag(cacheTags.stories, now);
        if (second) revalidateTag(cacheTags.story(second), now);
    }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
