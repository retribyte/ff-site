import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { StarSystem } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import SystemConsole from '@/components/space/SystemConsole';
import styles from './system.module.scss';

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
        return { title: system ? system.name : 'System' };
    } catch {
        return { title: 'System' };
    }
}

export const dynamic = 'force-dynamic';

export default async function SystemPage({ params }: Props) {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) notFound();

    let system: StarSystem | null;
    try {
        system = await getSystem(id);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!system) notFound();

    return (
        <main className={styles.main}>
            <SystemConsole system={system} />
        </main>
    );
}
