import { describe, expect, it } from 'vitest';
import { personaHasName, resolvePersonaIdentity } from './personaIdentity';

const character = { name: 'Vec', color: '#111111', image: 'vec.png' };
const player = { name: 'Zander', icon: 'zander.png' };

describe('resolvePersonaIdentity', () => {
    it('falls through to the player when there is no persona or character', () => {
        expect(resolvePersonaIdentity(null, null, player)).toEqual({
            speaker: 'Zander',
            color: null,
            avatarSrc: 'zander.png',
        });
    });

    it("uses a characterless player's own color (the Vortox bot)", () => {
        const bot = { name: 'Vortox', icon: null, color: '#FFA500' };
        expect(resolvePersonaIdentity(null, null, bot).color).toBe('#FFA500');
    });

    it("doesn't give an uncolored character the voicing player's color", () => {
        const npc = { name: 'Receptionist', color: null, image: null };
        const colored = { ...player, color: '#00ff00' };
        expect(resolvePersonaIdentity(null, npc, colored).color).toBeNull();
    });

    it('falls through to "Unknown" when nothing at all is known', () => {
        expect(resolvePersonaIdentity(null, null, null).speaker).toBe('Unknown');
    });

    it('falls through to the character when there is no persona', () => {
        expect(resolvePersonaIdentity(null, character, player)).toEqual({
            speaker: 'Vec',
            color: '#111111',
            avatarSrc: 'vec.png',
        });
    });

    it('prefers a fully-specified persona over the character and player', () => {
        const persona = { name: 'Marv', color: '#ff0000', image: 'marv.png' };
        expect(resolvePersonaIdentity(persona, character, player)).toEqual({
            speaker: 'Marv',
            color: '#ff0000',
            avatarSrc: 'marv.png',
        });
    });

    it('a look-only (name-less) persona falls through to the character name, per field', () => {
        const persona = { name: null, color: '#00ff00', image: null };
        expect(resolvePersonaIdentity(persona, character, player)).toEqual({
            speaker: 'Vec', // falls through — persona has no name opinion
            color: '#00ff00', // persona's own color wins
            avatarSrc: 'vec.png', // persona has no image, falls through to character
        });
    });

    it('resolves each field independently rather than as an all-or-nothing unit', () => {
        const persona = { name: 'Fungus', color: null, image: null };
        expect(resolvePersonaIdentity(persona, character, player)).toEqual({
            speaker: 'Fungus',
            color: '#111111', // persona has no color, falls through to character
            avatarSrc: 'vec.png', // same
        });
    });
});

describe('personaHasName', () => {
    it('is false for null/undefined and name-less personas', () => {
        expect(personaHasName(null)).toBe(false);
        expect(personaHasName(undefined)).toBe(false);
        expect(personaHasName({ name: null })).toBe(false);
    });

    it('is true for a named persona', () => {
        expect(personaHasName({ name: 'Marv' })).toBe(true);
    });
});
