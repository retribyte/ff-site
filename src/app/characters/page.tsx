import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Character } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import ActionChip from '@/components/editor/ActionChip';
import CharacterIndex from '@/components/characters/CharacterIndex';
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

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Characters</h1>
                <p className='pixel-label'>{characters.length} beings on record</p>
                {user && <ActionChip href='/characters/new' label='+ record a new being' />}
                {user?.role === 'ADMIN' && <ActionChip href='/characters/npcs' label='NPC voices' />}
            </header>
            <CharacterIndex
                characters={characters.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                    colorLight: c.colorLight ?? null,
                    image: c.image,
                    slug: c.slug,
                    quoteCount: c.quoteCount ?? 0,
                    quoteWordCount: c.quoteWordCount ?? 0,
                    appearances: c.appearances ?? [],
                }))}
            />
        </main>
    );
}
