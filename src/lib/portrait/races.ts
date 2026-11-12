// The creator's race list: the bundle's species, named and grouped by src/data/portrait/races.json.
// A species the table doesn't mention still appears (uncategorised), so a newly extracted
// race shows up without an edit here.

import { speciesFor } from './species';
import type { Manifest, Species } from './types';

export interface RaceDef {
    id: string;
    /** Starbound species kind; defaults to `id`. */
    species?: string;
    /** Final Frontier name; defaults to the mod's own title. */
    name?: string;
    descriptor?: string;
    category?: string;
    /** Mod ids whose sprites this race does not use. */
    exclude?: string[];
    /** Mod ids whose sprites win over load order, most preferred first. */
    prefer?: string[];
    hidden?: boolean;
    /** Style options this race does not get to choose: each is fixed to the value given ('' for none). */
    lock?: StyleLock;
}

export type StyleLock = Partial<Record<'hair' | 'facialHair' | 'facialMask', string>>;

/** The species with a race's locked styles reduced to their one value, so no picker offers them. */
export function lockStyles(species: Species, lock: StyleLock | undefined): Species {
    if (!lock || !Object.keys(lock).length) return species;
    return { ...species, genders: species.genders.map((g) => ({ ...g, ...Object.fromEntries(Object.entries(lock).map(([k, v]) => [k, [v]])) })) };
}

/** A race's species for a given choice of mods (the Sources tab can change a recipe's). */
export function raceSpecies(manifest: Manifest, race: Pick<Race, 'species' | 'lock'>, exclude: string[]): Species {
    const species = speciesFor(manifest, race.species.kind, exclude);
    return species ? lockStyles(species, race.lock) : race.species;
}

export interface Race {
    id: string;
    species: Species;
    name: string;
    /** The mod's name for the species, when it differs from `name`. */
    modName: string | null;
    descriptor: string;
    category: string;
    exclude: string[];
    prefer?: string[];
    lock?: StyleLock;
    /** Not offered by the game's own creator (NPC-only species). */
    npc: boolean;
}

export const UNCATEGORISED = 'uncategorised';

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

function speciesTitle(species: Species): string {
    const t = species.title || species.kind;
    // Mods disagree on casing ("AVALI", "taurikin"); show them alike.
    return t === t.toUpperCase() || t === t.toLowerCase() ? titleCase(t.toLowerCase()) : t;
}

export function resolveRaces(manifest: Manifest, defs: RaceDef[]): Race[] {
    const kinds = new Map(Object.keys(manifest.species).map((kind) => [kind.toLowerCase(), kind]));
    const used = new Set<string>();
    const races: Race[] = [];
    for (const def of defs) {
        const kind = kinds.get((def.species ?? def.id).toLowerCase());
        const derived = kind && speciesFor(manifest, kind, def.exclude);
        if (!derived) continue; // table entry for a species this bundle doesn't have
        const species = lockStyles(derived, def.lock);
        used.add(species.kind);
        if (def.hidden) continue;
        const title = speciesTitle(species);
        const name = def.name ?? title;
        races.push({
            id: def.id,
            species,
            name,
            modName: name.toLowerCase() === title.toLowerCase() ? null : title,
            descriptor: def.descriptor ?? '',
            category: def.category ?? UNCATEGORISED,
            exclude: def.exclude ?? [],
            ...(def.prefer?.length ? { prefer: def.prefer } : {}),
            ...(def.lock ? { lock: def.lock } : {}),
            npc: !species.playable,
        });
    }
    for (const kind of kinds.values()) {
        const species = speciesFor(manifest, kind);
        if (!species || used.has(kind)) continue;
        races.push({
            id: species.kind.toLowerCase().replace(/\s+/g, '_'),
            species,
            name: speciesTitle(species),
            modName: null,
            descriptor: '',
            category: UNCATEGORISED,
            exclude: [],
            npc: !species.playable,
        });
    }
    return races;
}

/** Mods that ship a different version of any of a species' sprites, with how many each ships. */
export function spriteSources(manifest: Manifest, species: Species): { mod: string; files: number }[] {
    const dir = `/humanoid/${species.kind.toLowerCase()}/`;
    const counts = new Map<string, number>();
    for (const [path, entry] of Object.entries(manifest.images)) {
        if (!path.startsWith(dir) || entry.m.length < 2) continue;
        for (const mod of entry.m) counts.set(mod, (counts.get(mod) ?? 0) + 1);
    }
    const order = manifest.mods.map((m) => m.id);
    return [...counts.entries()].map(([mod, files]) => ({ mod, files })).sort((a, b) => order.indexOf(a.mod) - order.indexOf(b.mod));
}
