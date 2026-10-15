// Centralizes the one rule the whole persona feature hinges on: `Persona.name`
// is nullable, and a name-less persona (a look-only override — new avatar
// and/or color, same name) has no name opinion and falls through to the
// character's canonical name. Every field (name, color, avatar) falls
// through independently: `persona ?? character ?? player` -- except that a
// player's color and avatar only apply when there's neither a character nor
// a persona (the Vortox bot, table talk): an uncolored NPC doesn't inherit
// the color of whoever voices it, and an image-less character shows its
// letter tile rather than the player's own avatar.

interface PersonaLike {
    name: string | null;
    color: string | null;
    image: string | null;
}

interface CharacterLike {
    name: string;
    color: string | null;
    image: string | null;
}

interface PlayerLike {
    name: string;
    icon: string | null;
    color?: string | null;
}

export interface PersonaIdentity {
    speaker: string;
    color: string | null;
    avatarSrc: string | null;
}

/** Does this persona carry a name opinion, or is it look-only? */
export function personaHasName(persona: Pick<PersonaLike, 'name'> | null | undefined): boolean {
    return persona?.name != null;
}

export function resolvePersonaIdentity(
    persona: PersonaLike | null,
    character: CharacterLike | null,
    player: PlayerLike | null
): PersonaIdentity {
    return {
        speaker: persona?.name ?? character?.name ?? player?.name ?? 'Unknown',
        color: persona?.color ?? character?.color ?? (character ? null : player?.color ?? null),
        avatarSrc: persona?.image ?? character?.image ?? (character || persona ? null : player?.icon ?? null),
    };
}
