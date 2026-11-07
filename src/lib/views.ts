import { after } from 'next/server';
import { api } from './api';
import { getToken } from './auth';

/**
 * Counts one view of an episode or story, after the response has gone out so it
 * never slows or breaks the page. ff-server keeps daily totals only, split by
 * signed-in and anonymous, which it tells apart by the token passed along here.
 * Call it once the page is known to exist, from a server component.
 */
export async function recordView(kind: 'episode' | 'story', slug: string): Promise<void> {
    const token = await getToken(); // request APIs can't be read inside after()
    after(async () => {
        try {
            await api('/views', { method: 'POST', body: { kind, slug }, token: token ?? undefined, cache: 'no-store' });
        } catch {
            // a missed count isn't worth an error
        }
    });
}
