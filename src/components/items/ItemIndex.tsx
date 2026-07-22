'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { ItemType } from '@/lib/types';
import { ITEM_TYPE_META } from '@/lib/lore';
import IndexScan from '@/components/IndexScan';
import EmptyState from '@/components/EmptyState';
import { useIndexFilter } from '@/hooks/useIndexFilter';
import styles from './itemIndex.module.scss';

export interface IndexItem {
    id: number;
    name: string;
    itemType: ItemType;
    image: string | null;
    slug: string;
}

const TYPES = Object.keys(ITEM_TYPE_META) as ItemType[];

export default function ItemIndex({ items }: { items: IndexItem[] }) {
    const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);

    const { query, setQuery, visible } = useIndexFilter(
        items,
        (i, q) => (!typeFilter || i.itemType === typeFilter) && (!q || i.name.toLowerCase().includes(q))
    );

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name…'
                label='Search items by name'
                count={visible.length}
            />
            <div className={styles.filters} role='group' aria-label='Filter by item type'>
                <button
                    type='button'
                    className={styles.filter}
                    data-active={typeFilter === null || undefined}
                    onClick={() => setTypeFilter(null)}
                >
                    all
                </button>
                {TYPES.map((type) => (
                    <button
                        key={type}
                        type='button'
                        className={styles.filter}
                        style={{ '--type': ITEM_TYPE_META[type].color } as React.CSSProperties}
                        data-active={typeFilter === type || undefined}
                        onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                    >
                        {ITEM_TYPE_META[type].glyph} {ITEM_TYPE_META[type].label}
                    </button>
                ))}
            </div>

            {visible.length === 0 && (
                <EmptyState>
                    {query.trim()
                        ? 'nothing in the vault matches that scan'
                        : `the vault is empty — nothing ${
                              typeFilter ? `of type ${ITEM_TYPE_META[typeFilter].label} ` : ''
                          }recovered yet`}
                </EmptyState>
            )}

            <ul className={styles.grid}>
                {visible.map((item) => {
                    const meta = ITEM_TYPE_META[item.itemType];
                    return (
                        <li key={item.id}>
                            <Link
                                href={`/items/${item.slug}`}
                                className={styles.card}
                                style={{ '--type': meta.color } as React.CSSProperties}
                            >
                                <span className={styles.cardArt} aria-hidden>
                                    {item.image ? (
                                        <Image src={item.image} alt='' width={56} height={56} unoptimized />
                                    ) : (
                                        meta.glyph
                                    )}
                                </span>
                                <span className={styles.cardName}>{item.name}</span>
                                <span className={styles.cardType}>{meta.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
