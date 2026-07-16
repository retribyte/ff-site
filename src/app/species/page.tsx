import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Species } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import ActionChip from '@/components/editor/ActionChip';
import SpeciesIndex from '@/components/species/SpeciesIndex';
import styles from './species.module.scss';

export const metadata: Metadata = {
    title: 'Species',
};

export const dynamic = 'force-dynamic';

export default async function SpeciesIndexPage() {
    const user = await getSessionUser();
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
                {user && <ActionChip href='/species/new' label='+ catalogue a taxon' />}
            </header>
            <SpeciesIndex
                species={sorted.map((s) => ({
                    id: s.id,
                    name: s.name,
                    slug: s.slug,
                    class: s.class,
                    members: s.Character?.length ?? 0,
                }))}
            />
        </main>
    );
}
