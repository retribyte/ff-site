import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Species } from '@/lib/types';
import { SENTIENCE_LABELS } from '@/lib/lore';
import SignalLost from '@/components/SignalLost';
import styles from './species.module.scss';

export const metadata: Metadata = {
    title: 'Species',
};

export const dynamic = 'force-dynamic';

export default async function SpeciesIndexPage() {
    let species: Species[];
    try {
        species = await api<Species[]>('/species');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const sorted = [...species].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Xenobiology Index</h1>
                <p className='pixel-label'>{species.length} taxa on record</p>
            </header>

            {sorted.length === 0 && (
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    no taxa catalogued yet
                </p>
            )}

            <ul className={styles.grid}>
                {sorted.map((s) => {
                    const members = s.Character?.length ?? 0;
                    return (
                        <li key={s.id}>
                            <Link href={`/species/${s.id}`} className={styles.card}>
                                <span className={styles.cardName}>{s.name}</span>
                                {s.binomialName && <span className={styles.cardBinomial}>{s.binomialName}</span>}
                                <span className={styles.cardMeta}>
                                    <span className={styles.classChip}>{SENTIENCE_LABELS[s.class]}</span>
                                    <span className='pixel-label'>
                                        {members} member{members === 1 ? '' : 's'}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}
