'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SentienceClass } from '@/lib/types';
import { SENTIENCE_LABELS } from '@/lib/lore';
import IndexScan from '@/components/IndexScan';
import EmptyState from '@/components/EmptyState';
import { useIndexFilter } from '@/hooks/useIndexFilter';
import scanStyles from '@/components/indexScan.module.scss';
import styles from './speciesIndex.module.scss';

export interface IndexSpecies {
    id: number;
    name: string;
    slug: string;
    class: SentienceClass;
    members: number;
}

export default function SpeciesIndex({ species }: { species: IndexSpecies[] }) {
    const [classFilter, setClassFilter] = useState<SentienceClass | ''>('');

    const { query, setQuery, visible } = useIndexFilter(
        species,
        (s, q) => (classFilter === '' || s.class === classFilter) && (!q || s.name.toLowerCase().includes(q))
    );

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name…'
                label='Search species by name'
                count={visible.length}
            >
                <select
                    className={scanStyles.filterSelect}
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value as SentienceClass | '')}
                    aria-label='Filter by sentience class'
                >
                    <option value=''>all classes</option>
                    {Object.entries(SENTIENCE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </IndexScan>

            {visible.length === 0 && (
                <EmptyState>
                    {species.length === 0 ? 'no taxa catalogued yet' : 'no taxa match that scan'}
                </EmptyState>
            )}

            <ul className={styles.grid}>
                {visible.map((s) => (
                    <li key={s.id}>
                        <Link href={`/species/${s.slug}`} className={styles.card}>
                            <span className={styles.cardName}>{s.name}</span>
                            <span className={styles.cardMeta}>
                                <span className={styles.classChip}>{SENTIENCE_LABELS[s.class]}</span>
                                <span className='pixel-label'>
                                    {s.members} member{s.members === 1 ? '' : 's'}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
