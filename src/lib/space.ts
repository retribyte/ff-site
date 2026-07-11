// Derived stats for the space builder — UI-only, nothing here persists.
// Port of the legacy space-builder/src/utils/calc.js: starColor() is kept
// verbatim (it works). The physics functions were wrong in the source
// (e.g. calcMass computed size/7926 + 5.97e24 — an addition, so every body
// "weighed" one Earth) and are reimplemented honestly below.

import type { BodyComposition } from './types';

// ---------- Reference constants ----------

/** Earth radius, km. */
export const EARTH_RADIUS_KM = 6371;
/** Earth mass, kg. */
export const EARTH_MASS_KG = 5.97219e24;
/** Earth surface gravity, m/s². */
export const EARTH_GRAVITY_MS2 = 9.8;
/** Earth's average surface temperature, K (used as the habitability target). */
export const EARTH_SURFACE_TEMP_K = 288;
/** The sun's effective temperature, K (used as the luminosity reference). */
export const SUN_TEMPERATURE_K = 5772;
/** Newtonian gravitational constant, m³·kg⁻¹·s⁻². */
export const GRAVITATIONAL_CONSTANT = 6.674e-11;

/** Reference bulk densities, kg/m³, by composition (Earth / Jupiter / icy-body average). */
export const COMPOSITION_DENSITY_KG_M3: Record<BodyComposition, number> = {
    TERRESTRIAL: 5514,
    GAS: 1326,
    ICE: 1850,
};

// ---------- Star color ----------

/**
 * Approximates a star's rendered color from its temperature in Kelvin.
 * Ported verbatim from the legacy calc.js — the algorithm normalizes the
 * temperature to a 3500–10000K range, branches at the 6600K white point,
 * and clamps each channel to [0, 255]. Kept byte-for-byte in spirit because
 * it already produces the right look (warm red → white → blue).
 */
export function starColor(temperatureK: number): string {
    let red: number;
    let green: number;
    let blue: number;

    // Normalize temperature to 0-1 for the algorithm
    const normalizedTemp = (temperatureK - 3500) / (10000 - 3500);

    if (temperatureK < 6600) {
        // Enhance red for cooler stars
        red = 255;
        green = 750 * normalizedTemp;
        blue = 50 + 180 * normalizedTemp;
    } else {
        // For hotter stars, reduce red and green to make blue more prominent
        red = 255 * (1 - (normalizedTemp - 0.5) * 2);
        green = 255 * (1 - normalizedTemp);
        blue = 255;
    }

    // Clamp values to within [0, 255]
    red = Math.min(255, Math.max(0, Math.round(red)));
    green = Math.min(255, Math.max(0, Math.round(green)));
    blue = Math.min(255, Math.max(0, Math.round(blue)));

    return `rgb(${red}, ${green}, ${blue})`;
}

// ---------- Mass / gravity ----------

/**
 * Body mass in kg: Earth mass scaled by volume ratio (r/r⊕)³ and by the
 * composition's density relative to Earth's.
 */
export function bodyMass(radiusKm: number, composition: BodyComposition): number {
    const densityRatio = COMPOSITION_DENSITY_KG_M3[composition] / COMPOSITION_DENSITY_KG_M3.TERRESTRIAL;
    return EARTH_MASS_KG * Math.pow(radiusKm / EARTH_RADIUS_KM, 3) * densityRatio;
}

/** Surface gravity in m/s², from Newton's law of gravitation: g = GM/r². */
export function surfaceGravity(radiusKm: number, composition: BodyComposition): number {
    const massKg = bodyMass(radiusKm, composition);
    const radiusM = radiusKm * 1000;
    return (GRAVITATIONAL_CONSTANT * massKg) / (radiusM * radiusM);
}

// ---------- Orbital period ----------

/**
 * Orbital period from Kepler's third law: P (Earth years) = a^1.5 for a in
 * AU, converted to days at 365.25 d/yr. `equinoxes` mirrors `days` exactly —
 * 1 GUY equinox is defined as exactly 1 Earth day (see lib/guy-time.ts) — so
 * a year-length figure doubles as the in-universe GUY reading.
 */
export function yearLength(distanceAu: number): { days: number; equinoxes: number } {
    const days = Math.round(Math.pow(distanceAu, 1.5) * 365.25);
    return { days, equinoxes: days };
}

// ---------- Habitability ----------

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * 0–100 habitability score for an 8-segment LED-style meter. Keeps the
 * legacy spirit (temperature + gravity heuristic) but on real units:
 *
 * - Estimates stellar luminosity relative to the Sun via L ∝ (T/5772)⁴
 *   (planet radius/albedo aren't known at call time, so this is a
 *   simplification, not a rigorous flux calculation).
 * - Estimates the planet's equilibrium temperature from that luminosity:
 *   T_eq = 278.5 K × L^0.25 / √a (a in AU).
 * - Scores temperature proximity to Earth's ~288 K and gravity proximity to
 *   9.8 m/s², each as a relative closeness in [0, 1], then multiplies the
 *   two so a body that's badly wrong on either axis (scorched, airless
 *   moon-scale gravity) reads as clearly hostile rather than averaging out.
 * - Gas giants have no solid surface to inhabit and always score 0.
 */
export function habitability(
    starTemperatureK: number,
    distanceAu: number,
    radiusKm: number,
    composition: BodyComposition
): number {
    if (composition === 'GAS') return 0;

    const luminosityRatio = Math.pow(starTemperatureK / SUN_TEMPERATURE_K, 4);
    const equilibriumTempK = (278.5 * Math.pow(luminosityRatio, 0.25)) / Math.sqrt(distanceAu);
    const tempScore = clamp01(1 - Math.abs(equilibriumTempK - EARTH_SURFACE_TEMP_K) / EARTH_SURFACE_TEMP_K);

    const gravity = surfaceGravity(radiusKm, composition);
    const gravScore = clamp01(1 - Math.abs(gravity - EARTH_GRAVITY_MS2) / EARTH_GRAVITY_MS2);

    return Math.round(100 * tempScore * gravScore);
}

// ---------- Formatting ----------

const SUPERSCRIPT_DIGITS: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '-': '⁻',
};

const toSuperscript = (n: number): string =>
    String(n)
        .split('')
        .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
        .join('');

/** Scientific-notation display for the telemetry spec sheet, e.g. "2.4×10²⁴ kg". */
export function formatMass(kg: number): string {
    if (kg === 0) return '0 kg';
    const exponent = Math.floor(Math.log10(Math.abs(kg)));
    const mantissa = kg / Math.pow(10, exponent);
    return `${mantissa.toFixed(1)}×10${toSuperscript(exponent)} kg`;
}

/** "9.82 m/s²" — trivial fixed-point display, included alongside formatMass for symmetry. */
export function formatGravity(gravityMs2: number): string {
    return `${gravityMs2.toFixed(2)} m/s²`;
}
