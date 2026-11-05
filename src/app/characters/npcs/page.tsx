import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { NpcPersona } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import NpcVoiceList from '@/components/characters/NpcVoiceList';
import styles from '../characters.module.scss';

export const metadata: Metadata = {
    title: 'NPC voices',
};

export const dynamic = 'force-dynamic';

// Admin-only: the one-off speakers that are NPC personas rather than
// characters, with Promote for any that turn out to matter. Members never
// see this page (it 404s), and NPC voices have no pages of their own.
export default async function NpcVoicesPage() {
    const user = await getSessionUser();
    if (user?.role !== 'ADMIN') notFound();

    let npcs: NpcPersona[];
    try {
        npcs = await api<NpcPersona[]>('/personas?npc=true');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <nav className={styles.breadcrumb}>
                <Link href='/characters'>← all characters</Link>
            </nav>
            <header className={styles.header}>
                <h1>NPC voices</h1>
                <p className='pixel-label'>{npcs.length} one-off speakers ⭑ admin only</p>
            </header>
            <NpcVoiceList npcs={npcs} />
        </main>
    );
}
