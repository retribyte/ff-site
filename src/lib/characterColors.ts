import characterColors from '@/data/characterColors.json';
import type { ColorMode } from '@/components/theme/ThemeProvider';

const COLORS = characterColors as { dark: Record<string, string>; light: Record<string, string> };

// Deterministic fallback color from a name (ported from the legacy site),
// so uncolored NPCs like "Toll Station Operator" still get a stable identity.
export function stringToColor(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = input.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
}

/**
 * Resolve a character's display color.
 * DB color holds the dark-mode color; the legacy color table supplies
 * hand-tuned light-mode variants for the main cast.
 */
export function characterColor(name: string, color: string | null, mode: ColorMode): string {
    if (mode === 'light') {
        return COLORS.light[name] ?? color ?? stringToColor(name);
    }
    return color ?? COLORS.dark[name] ?? stringToColor(name);
}
