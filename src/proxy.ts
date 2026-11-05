import { NextResponse, type NextRequest } from 'next/server';
import { canonicalRedirectUrl, requestHost } from '@/lib/canonicalHost';

// Runs before every request (no matcher: static files and public/ too, so the
// NFSN default name serves nothing at all). See lib/canonicalHost.ts.
export function proxy(request: NextRequest) {
    const host = requestHost(request.headers.get('x-forwarded-host'), request.headers.get('host'));
    const target = canonicalRedirectUrl(
        process.env.CANONICAL_HOST,
        host,
        request.nextUrl.pathname + request.nextUrl.search
    );
    return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}
