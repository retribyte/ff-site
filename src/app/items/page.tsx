import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Item } from '@/lib/types';
import SignalLost from '@/components/SignalLost';
import ItemIndex from '@/components/items/ItemIndex';
import styles from './items.module.scss';

export const metadata: Metadata = {
    title: 'Items',
};

export const dynamic = 'force-dynamic';

export default async function ItemsPage() {
    let items: Item[];
    try {
        items = await api<Item[]>('/items');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Recovered Effects</h1>
                <p className='pixel-label'>{items.length} lore entries in the vault</p>
            </header>
            <ItemIndex
                items={sorted.map((item) => ({
                    id: item.id,
                    name: item.name,
                    itemType: item.itemType,
                    image: item.image,
                    bearer: item.character ? { id: item.character.id, name: item.character.name } : null,
                }))}
            />
        </main>
    );
}
