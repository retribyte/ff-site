// Client-side counterpart to lib/api.ts, for use in 'use client' components.
//
// Browser code can't reach ff-server directly — the JWT lives in an httpOnly
// cookie — so it goes through the same-origin proxy at /api/ff/<path>, which
// attaches the Bearer token. The response uses the same envelope as the API
// ({ status, data | message }); this unwraps it and normalizes every failure
// (transport error, error envelope, non-JSON) into a thrown ApiError so
// callers can do one `catch`.

export const OFFLINE_MESSAGE = 'The lore server is not answering';

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly httpStatus: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** ApiError.message when caught, else the canned offline message. */
export function errorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : OFFLINE_MESSAGE;
}

interface Envelope {
    status: 'success' | 'error';
    message?: string;
    data?: unknown;
    total?: number;
    page?: number;
    limit?: number;
}

interface ClientRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
}

async function request(path: string, options: ClientRequestOptions): Promise<Envelope | undefined> {
    const { method = 'GET', body, signal } = options;

    let res: Response;
    try {
        res = await fetch(`/api/ff${path}`, {
            method,
            headers: {
                Accept: 'application/json',
                ...(body !== undefined && { 'Content-Type': 'application/json' }),
            },
            ...(body !== undefined && { body: JSON.stringify(body) }),
            ...(signal && { signal }),
        });
    } catch {
        // Same-origin request itself failed (offline, aborted). The proxy
        // returns a 502 error envelope when it's ff-server that's down, so
        // that case falls through to the envelope handling below.
        throw new ApiError(OFFLINE_MESSAGE, 0);
    }

    if (res.status === 204) return undefined;

    let envelope: Envelope;
    try {
        envelope = (await res.json()) as Envelope;
    } catch {
        throw new ApiError(OFFLINE_MESSAGE, res.status);
    }

    if (!res.ok || envelope.status === 'error') {
        throw new ApiError(envelope.message ?? `Request failed (HTTP ${res.status})`, res.status);
    }

    return envelope;
}

/** Unwrap `data` from the envelope. `undefined` for 204 responses. */
export async function apiClient<T>(path: string, options: ClientRequestOptions = {}): Promise<T> {
    const envelope = await request(path, options);
    return envelope?.data as T;
}

/**
 * The whole envelope, for endpoints carrying extra top-level fields beyond
 * {status, data} (e.g. paginated `total/page/limit`, or story lines' extra
 * `characters` array). Mirrors apiRaw in lib/api.ts.
 */
export async function apiClientRaw<T extends object>(path: string, options: ClientRequestOptions = {}): Promise<T> {
    const envelope = await request(path, options);
    return (envelope ?? {}) as unknown as T;
}
