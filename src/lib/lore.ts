import type { EightBallAnswerType, ItemType, SentienceClass } from './types';

export const SENTIENCE_LABELS: Record<SentienceClass, string> = {
    BLACK: 'class black',
    HIGHER_SENTIENT: 'higher sentient',
    LOWER_SENTIENT: 'lower sentient',
    NON_SENTIENT: 'non-sentient',
};

// Each item type gets a season-token color so the lore pages stay in-system
export const ITEM_TYPE_META: Record<ItemType, { label: string; color: string; glyph: string }> = {
    WEAPON: { label: 'weapon', color: 'var(--ff1)', glyph: '⚔' },
    EQUIPMENT: { label: 'equipment', color: 'var(--ff2)', glyph: '⚙' },
    ARTIFACT: { label: 'artifact', color: 'var(--vm)', glyph: '◈' },
    OTHER: { label: 'other', color: 'var(--accent)', glyph: '✦' },
};

// FF 8-Ball oracle transmissions get the same season-token tinting.
export const EIGHTBALL_TYPE_META: Record<EightBallAnswerType, { label: string; color: string }> = {
    YES: { label: 'affirmative', color: 'var(--ff3)' },
    NO: { label: 'negative', color: 'var(--ff1)' },
    MAYBE: { label: 'uncertain', color: 'var(--vm)' },
};
