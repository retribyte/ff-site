import type { Persona } from './types';

// The voices a story fragment can be given by id: a character, or a character
// speaking as one of its personas ("Vec as Sascha"). The importer's speaker
// picks, its NPC namer and the reader's voice popover all list these, by label.

export interface VoiceOption {
    label: string;
    characterId: number;
    personaId: number | null;
}

/** "Vec", then "Vec as Sascha" for each of Vec's personas (a look-only one by its label), sorted by character. */
export function voiceOptions(
    characters: { id: number; name: string }[],
    personas: Pick<Persona, 'id' | 'name' | 'label' | 'characterId'>[],
): VoiceOption[] {
    const byCharacter = new Map<number, Pick<Persona, 'id' | 'name' | 'label' | 'characterId'>[]>();
    for (const p of personas) {
        if (p.characterId === null) continue;
        const list = byCharacter.get(p.characterId) ?? [];
        list.push(p);
        byCharacter.set(p.characterId, list);
    }
    const options: VoiceOption[] = [];
    for (const c of [...characters].sort((a, b) => a.name.localeCompare(b.name))) {
        options.push({ label: c.name, characterId: c.id, personaId: null });
        for (const p of byCharacter.get(c.id) ?? []) {
            const as = p.name ?? p.label;
            if (as) options.push({ label: `${c.name} as ${as}`, characterId: c.id, personaId: p.id });
        }
    }
    return options;
}

/** The option a typed label names (case-insensitive), or null. */
export function findVoiceOption(options: VoiceOption[], label: string): VoiceOption | null {
    const key = label.trim().toLowerCase();
    return key ? (options.find((o) => o.label.toLowerCase() === key) ?? null) : null;
}

/** Loads characters and personas through the site proxy and builds the options. */
export async function loadVoiceOptions(): Promise<VoiceOption[]> {
    const get = async <T,>(path: string): Promise<T[]> => {
        const res = await fetch(`/site/ff${path}`);
        const envelope = (await res.json().catch(() => null)) as { data?: T[] } | null;
        return envelope?.data ?? [];
    };
    const [characters, personas] = await Promise.all([
        get<{ id: number; name: string }>('/characters'),
        get<Pick<Persona, 'id' | 'name' | 'label' | 'characterId'>>('/personas?npc=false'),
    ]);
    return voiceOptions(characters, personas);
}
