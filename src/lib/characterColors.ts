import legacyColors from '@/data/characterColors.json';
import type { ColorMode } from '@/components/theme/ThemeProvider';
import { suggestColorFor } from './colorContrast';

const COLORS = legacyColors as { dark: Record<string, string>; light: Record<string, string> };

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
 * Resolve a character's display color for a theme. `color` is the dark-mode
 * color, `colorLight` an optional light-mode override. Each theme takes its
 * own color first, then the legacy color table, then a version of the other
 * theme's color made readable (suggestColorFor), so a character colored for
 * one theme never shows a washed-out color in the other. With no color at
 * all, the name hash stands in (made readable too).
 */
export function characterColor(
    name: string,
    color: string | null,
    mode: ColorMode,
    colorLight: string | null = null
): string {
    if (mode === 'light') {
        return (
            colorLight ??
            COLORS.light[name] ??
            suggestColorFor(color ?? COLORS.dark[name] ?? stringToColor(name), 'light')
        );
    }
    return color ?? COLORS.dark[name] ?? suggestColorFor(colorLight ?? stringToColor(name), 'dark');
}

/** Both themes' colors for a character: what the editor suggests and the site shows. */
export function characterThemeColors(
    name: string,
    color: string | null,
    colorLight: string | null
): { dark: string; light: string } {
    return { dark: characterColor(name, color, 'dark', colorLight), light: characterColor(name, color, 'light', colorLight) };
}
