'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SentienceClass } from '@/lib/types';
import { SENTIENCE_LABELS } from '@/lib/lore';
import IndexScan from '@/components/IndexScan';
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
    const [query, setQuery] = useState('');
    const [classFilter, setClassFilter] = useState<SentienceClass | ''>('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return species.filter((s) => {
            if (classFilter !== '' && s.class !== classFilter) return false;
            if (!q) return true;
            return s.name.toLowerCase().includes(q);
        });
    }, [species, query, classFilter]);

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
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {species.length === 0 ? 'no taxa catalogued yet' : 'no taxa match that scan'}
                </p>
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
