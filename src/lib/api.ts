// Thin typed client for the ff-server API.
// Standard envelope: { status: 'success', data: T } | { status: 'error', message: string }
// Paginated endpoints spread extra fields onto the envelope:
//   { status: 'success', data: T[], total, page, limit }

import type { MessageType } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly httpStatus: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface Paged<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    token?: string;
    /** Next.js fetch cache options, e.g. { revalidate: 60 } */
    next?: NextFetchRequestConfig;
    cache?: RequestCache;
    /** Lets a caller (e.g. a debounced search box) cancel a stale in-flight request. */
    signal?: AbortSignal;
}

interface Envelope {
    status: 'success' | 'error';
    message?: string;
    data?: unknown;
    total?: number;
    page?: number;
    limit?: number;
}

async function request(path: string, options: RequestOptions): Promise<Envelope | undefined> {
    const { method = 'GET', body, token, next, cache, signal } = options;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        ...(next && { next }),
        ...(cache && { cache }),
        ...(signal && { signal }),
    });

    if (res.status === 204) return undefined;

    let envelope: Envelope;
    try {
        envelope = (await res.json()) as Envelope;
    } catch {
        throw new ApiError(`Unexpected non-JSON response (HTTP ${res.status})`, res.status);
    }

    if (envelope.status === 'error') {
        throw new ApiError(envelope.message ?? 'Unknown API error', res.status);
    }
    if (!res.ok) {
        throw new ApiError(`Request failed (HTTP ${res.status})`, res.status);
    }

    return envelope;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const envelope = await request(path, options);
    return envelope?.data as T;
}

/**
 * The raw response envelope, for endpoints that carry extra top-level fields
 * beyond {status, data, total, page, limit} (e.g. story lines also return a
 * `characters` array). Caller supplies the envelope shape it expects.
 */
export async function apiRaw<T extends object>(path: string, options: RequestOptions = {}): Promise<T> {
    const envelope = await request(path, options);
    return (envelope ?? {}) as unknown as T;
}

export async function apiPaged<T>(path: string, options: RequestOptions = {}): Promise<Paged<T>> {
    const envelope = await request(path, options);
    const data = (envelope?.data ?? []) as T[];
    return {
        data,
        total: envelope?.total ?? data.length,
        page: envelope?.page ?? 1,
        limit: envelope?.limit ?? data.length,
    };
}

// GET /search — grouped by category, not a single merged ranked list (a
// message's keyword-relevance rank and a character's name match aren't
// comparable scores). See ff-server's src/search/ for the backing endpoint.
export interface SearchResults {
    characters: { id: number; name: string; slug: string; image: string | null }[];
    species: { id: number; name: string; slug: string }[];
    items: { id: number; name: string; slug: string; image: string | null }[];
    // `type` lets the UI preview the matched field of an EMBED message's JSON
    // body, rather than the raw JSON string, for non-EMBED types.
    messages: { episodeTitle: string; messageNo: number; text: string; type: MessageType }[];
    storyLines: { storySlug: string; chapterNo: number; lineNo: number; text: string }[];
}

export async function searchSite(q: string, options: RequestOptions = {}): Promise<SearchResults> {
    return api<SearchResults>(`/search?q=${encodeURIComponent(q)}`, options);
}
