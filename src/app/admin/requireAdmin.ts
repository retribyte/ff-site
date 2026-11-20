import { notFound } from 'next/navigation';
import { getSessionUser, getToken } from '@/lib/auth';

// Every /admin page calls this itself rather than trusting the layout: members get a 404.
// ff-server checks the role on every call as well. Returns the token for API calls.
export async function requireAdmin(): Promise<string | undefined> {
    const user = await getSessionUser();
    if (user?.role !== 'ADMIN') notFound();
    return (await getToken()) ?? undefined;
}
