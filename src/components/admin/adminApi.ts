// Admin job calls through the authenticated /site/ff proxy (ff-server checks the role)

interface Envelope<T> {
    status: string;
    data?: T;
    message?: string;
}

export async function adminCall<T>(path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`/site/ff/admin/${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error('The lore server is not answering');
    }
    const envelope = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !envelope || envelope.status !== 'success') {
        throw new Error(envelope?.message ?? `Request failed (HTTP ${res.status})`);
    }
    return envelope.data as T;
}

export function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
