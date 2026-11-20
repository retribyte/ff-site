import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth';
import { API_URL } from '@/lib/api';

// The portrait creator's sprites, for signed-in members only. ff-server holds the files and
// checks the token; this passes the browser's request on with the JWT from the httpOnly
// cookie. Unlike the generic /site/ff proxy it forwards Range (sprites are fetched as byte
// ranges of each mod's pack) and the cache validators, and streams the body through.
//
// It uses node:http, not fetch: fetch unzips a gzipped body, and the two index files (3 to
// 4 MB of JSON) must reach the browser as the gzip ff-server already made and keeps.

const PASS_UP = ['range', 'if-none-match', 'if-range', 'accept-encoding'];
const PASS_DOWN = ['content-type', 'content-length', 'content-range', 'content-encoding', 'accept-ranges', 'etag', 'cache-control', 'vary'];
// Never for search engines, whatever the status
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow' };

const fail = (status: number, message: string) => NextResponse.json({ status: 'error', message }, { status, headers: NO_INDEX });

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const token = await getToken();
    if (!token) return fail(401, 'Log in to use the portrait creator');

    const { path } = await params;
    const url = new URL(`${API_URL}/portrait/bundle/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`);
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    for (const name of PASS_UP) {
        const value = request.headers.get(name);
        if (value) headers[name] = value;
    }

    let upstream: http.IncomingMessage;
    try {
        upstream = await new Promise<http.IncomingMessage>((resolve, reject) => {
            const sent = (url.protocol === 'https:' ? https : http).get(url, { headers, signal: request.signal }, resolve);
            sent.on('error', reject);
        });
    } catch {
        return fail(502, 'The lore server is not answering');
    }

    const status = upstream.statusCode ?? 502;
    const out = new Headers(NO_INDEX);
    for (const name of PASS_DOWN) {
        const value = upstream.headers[name];
        if (typeof value === 'string') out.set(name, value);
    }
    if (status === 304) {
        upstream.resume();
        return new NextResponse(null, { status, headers: out });
    }
    return new NextResponse(Readable.toWeb(upstream) as ReadableStream<Uint8Array>, { status, headers: out });
}
