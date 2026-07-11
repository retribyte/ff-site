import type { BodyComposition } from '@/lib/types';

// Tasteful per-composition fill colors for the system diagram, near the
// design mockup's orrery (terrestrial brownish, gas violet, ice cyan).
// Always overridden by an explicit body.color when the record has one.
export const COMPOSITION_COLORS: Record<BodyComposition, string> = {
    TERRESTRIAL: '#b8683f',
    GAS: '#b98add',
    ICE: '#8fd8e8',
};

export function compositionColor(composition: BodyComposition | null, override: string | null): string {
    if (override) return override;
    return COMPOSITION_COLORS[composition ?? 'TERRESTRIAL'];
}
