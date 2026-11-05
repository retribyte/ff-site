import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Character } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import ActionChip from '@/components/editor/ActionChip';
import CharacterIndex from '@/components/characters/CharacterIndex';
import { compareCharacters } from '@/lib/characterSort';
import styles from './characters.module.scss';

export const metadata: Metadata = {
    title: 'Characters',
};

export const dynamic = 'force-dynamic';

export default async function CharactersPage() {
    const user = await getSessionUser();
    let characters: Character[];
    try {
        characters = await api<Character[]>('/characters');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    // Portraited main cast up front (earliest season first), then the named masses
    const sorted = [...characters].sort(compareCharacters);

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Dramatis Personae</h1>
                <p className='pixel-label'>{characters.length} beings on record</p>
                {user && <ActionChip href='/characters/new' label='+ record a new being' />}
                {user?.role === 'ADMIN' && <ActionChip href='/characters/npcs' label='NPC voices' />}
            </header>
            <CharacterIndex
                characters={sorted.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                    image: c.image,
                    slug: c.slug,
                }))}
            />
        </main>
    );
}
