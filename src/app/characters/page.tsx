import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Character, Species } from '@/lib/types';
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
    let species: Species[];
    try {
        [characters, species] = await Promise.all([api<Character[]>('/characters'), api<Species[]>('/species')]);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    // Portraited main cast up front, then the named masses, alphabetical within
    const sorted = [...characters].sort((a, b) => {
        const rank = (c: Character) => (c.image ? 0 : c.themeColor ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Dramatis Personae</h1>
                <p className='pixel-label'>{characters.length} beings on record</p>
                {user && <ActionChip href='/characters/new' label='+ record a new being' />}
            </header>
            <CharacterIndex
                characters={sorted.map((c) => ({
                    id: c.id,
                    name: c.name,
                    themeColor: c.themeColor,
                    image: c.image,
                    speciesId: c.speciesId,
                    aliases: (c.aliases ?? []).map((a) => a.name),
                }))}
                species={species.map((s) => ({ id: s.id, name: s.name }))}
            />
        </main>
    );
}
