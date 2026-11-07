// Readable color pairs for the two themes. A character's color is picked for
// one theme; for the other, `suggestColorFor` finds the closest color (same
// hue, as much of the chroma as fits) that still reads as text there.
//
// Lightness is adjusted in OKLCH, where it's perceptually even and doesn't
// drift the hue the way HSL does; readability is the WCAG contrast ratio.

export type ThemeMode = 'dark' | 'light';

// The page backgrounds text sits on in each theme (--bg, --surface,
// --surface-2 in src/styles/_tokens.scss; keep in sync). A suggestion must
// read on all of them.
export const BACKGROUNDS: Record<ThemeMode, string[]> = {
    dark: ['#10102c', '#1a1a40', '#24244f'],
    light: ['#f1effa', '#fdfcff', '#e9e5f6'],
};

/** WCAG AA for body text. */
export const MIN_CONTRAST = 4.5;

const HEX = /^#?([0-9a-f]{6})$/i;

type Rgb = [number, number, number]; // 0..1 sRGB

function parseHex(hex: string): Rgb | null {
    const m = HEX.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toHex([r, g, b]: Rgb): string {
    const byte = (v: number) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${byte(r)}${byte(g)}${byte(b)}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function luminance(rgb: Rgb): number {
    const [r, g, b] = rgb.map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
    const [la, lb] = [luminance(a), luminance(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The worst contrast `hex` has against the theme's backgrounds; 0 for a bad hex. */
export function minContrast(hex: string, mode: ThemeMode): number {
    const rgb = parseHex(hex);
    if (!rgb) return 0;
    return Math.min(...BACKGROUNDS[mode].map((bg) => contrast(rgb, parseHex(bg)!)));
}

// ---- OKLab / OKLCH (Björn Ottosson's matrices) ----

type Lch = [number, number, number]; // L 0..1, C, h radians

function rgbToOklch(rgb: Rgb): Lch {
    const [r, g, b] = rgb.map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

/** OKLCH -> linear sRGB, unclamped (may be out of gamut). */
function oklchToLinear([L, C, h]: Lch): Rgb {
    const A = C * Math.cos(h);
    const B = C * Math.sin(h);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** The color at lightness L and hue h, with as much of chroma C as fits in sRGB. */
function fitToGamut(L: number, C: number, h: number): Rgb {
    let lin = oklchToLinear([L, C, h]);
    if (!inGamut(lin)) {
        let lo = 0;
        let hi = C;
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            if (inGamut(oklchToLinear([L, mid, h]))) lo = mid;
            else hi = mid;
        }
        lin = oklchToLinear([L, lo, h]);
    }
    return lin.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
}

const cache = new Map<string, string>();

/**
 * A version of `hex` that reads as text in `mode`: unchanged if it already
 * does, otherwise the same hue moved darker (for light) or lighter (for dark)
 * just far enough to reach MIN_CONTRAST on every background of that theme.
 * Returns `hex` as given when it isn't a #rrggbb color.
 */
export function suggestColorFor(hex: string, mode: ThemeMode): string {
    const key = `${mode}:${hex.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const rgb = parseHex(hex);
    if (!rgb) return hex;
    let result = toHex(rgb);
    if (minContrast(result, mode) < MIN_CONTRAST) {
        const [L0, C, h] = rgbToOklch(rgb);
        // Contrast against the theme grows as L moves away from it, so binary
        // search for the L nearest the original that's readable
        let near = L0;
        let far = mode === 'light' ? 0 : 1;
        for (let i = 0; i < 24; i++) {
            const mid = (near + far) / 2;
            if (minContrast(toHex(fitToGamut(mid, C, h)), mode) >= MIN_CONTRAST) far = mid;
            else near = mid;
        }
        result = toHex(fitToGamut(far, C, h));
    }
    cache.set(key, result);
    return result;
}
