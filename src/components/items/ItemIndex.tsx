'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { ItemType } from '@/lib/types';
import { ITEM_TYPE_META } from '@/lib/lore';
import IndexScan from '@/components/IndexScan';
import styles from './itemIndex.module.scss';

export interface IndexItem {
    id: number;
    name: string;
    itemType: ItemType;
    image: string | null;
    bearer: { id: number; name: string } | null;
}

const TYPES = Object.keys(ITEM_TYPE_META) as ItemType[];

export default function ItemIndex({ items }: { items: IndexItem[] }) {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((i) => {
            if (typeFilter && i.itemType !== typeFilter) return false;
            if (!q) return true;
            return i.name.toLowerCase().includes(q) || (i.bearer?.name ?? '').toLowerCase().includes(q);
        });
    }, [items, query, typeFilter]);

    return (
        <div>
            <IndexScan
                query={query}
                onQueryChange={setQuery}
                placeholder='search by name or bearer…'
                label='Search items by name or bearer'
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
                <p className='pixel-label' style={{ textAlign: 'center', padding: '3rem 0' }}>
                    {query.trim()
                        ? 'nothing in the vault matches that scan'
                        : `the vault is empty — nothing ${
                              typeFilter ? `of type ${ITEM_TYPE_META[typeFilter].label} ` : ''
                          }recovered yet`}
                </p>
            )}

            <ul className={styles.grid}>
                {visible.map((item) => {
                    const meta = ITEM_TYPE_META[item.itemType];
                    return (
                        <li key={item.id}>
                            <Link
                                href={`/items/${item.id}`}
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
                                {item.bearer && <span className='pixel-label'>held by {item.bearer.name}</span>}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
