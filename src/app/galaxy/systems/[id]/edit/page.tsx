import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import type { StarSystem } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import SystemBuilder from '@/components/space/SystemBuilder';
import styles from './builder.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

async function getSystem(id: number): Promise<StarSystem | null> {
    try {
        return await api<StarSystem>(`/systems/${id}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const system = await getSystem(parseInt(id));
        return { title: system ? `Edit ${system.name}` : 'Edit system' };
    } catch {
        return { title: 'Edit system' };
    }
}

export const dynamic = 'force-dynamic';

// Server-gated like EditorPage (the site's precedent for /new and /[id]/edit
// routes): redirect logged-out visitors to /login, and non-creator/non-admin
// visitors back to the read-only page, before the client builder ever mounts.
// Doing this server-side (rather than gating in the client SystemBuilder via
// useSession) avoids a loading-state race — useSession().loading stays true
// until the first /api/auth/me round trip settles, so a client-only gate can
// flash an "unauthorized" state (or worse, briefly render the editor) for an
// authorized user on first paint.
export default async function EditSystemPage({ params }: Props) {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) notFound();

    const user = await getSessionUser();
    if (!user) redirect('/login');

    let system: StarSystem | null;
    try {
        system = await getSystem(id);
    } catch {
        return (
            <main className={`${styles.main} ${styles.mainCenter}`}>
                <SignalLost />
            </main>
        );
    }
    if (!system) notFound();

    const canEdit = system.creatorId === user.id || user.role === 'ADMIN';
    if (!canEdit) redirect(`/galaxy/systems/${id}`);

    return (
        <main className={styles.main}>
            <SystemBuilder system={system} />
        </main>
    );
}
