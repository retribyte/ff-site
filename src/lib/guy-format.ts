// Site-only helpers layered on guy-time.ts (kept separate because guy-time.ts
// is a verbatim copy shared with ff-server): Arkabilar semester names and
// parsers for the full strings the Chrono Conversion page produces.

import type { GuyDateTime } from './guy-time';

// ---------- Arkabilar form (wiki: Galactic_Union_Year#Arkabilar_form) ----------

const ARKA_PREFIXES = ['Arka', 'Bhensi', 'Dalne', 'Gorjo'];
const ARKA_SUFFIXES = ['Unnos', 'Bilar', 'Terkan', 'Querp', 'Pentan', 'Heksat', 'Sebter', 'Okteg'];

/** Semester 1–32 → "Arka-Unnos" … "Gorjo-Okteg"; null when out of range. */
export function arkabilarName(semester: number): string | null {
    if (!Number.isInteger(semester) || semester < 1 || semester > 32) return null;
    return `${ARKA_PREFIXES[Math.floor((semester - 1) / 8)]}-${ARKA_SUFFIXES[(semester - 1) % 8]}`;
}

/** "Dalne-Bilar" (also "dalne bilar", "DalneBilar") → 18; null if not a name. */
export function parseArkabilar(input: string): number | null {
    // Prefixes are distinct words, so split on the known prefix.
    const lower = input.trim().toLowerCase().replace(/[\s\-_]+/g, '');
    const p = ARKA_PREFIXES.findIndex((x) => lower.startsWith(x.toLowerCase()));
    if (p < 0) return null;
    const rest = lower.slice(ARKA_PREFIXES[p].length);
    const s = ARKA_SUFFIXES.findIndex((x) => x.toLowerCase() === rest);
    return s < 0 ? null : p * 8 + s + 1;
}

// ---------- Full-string parsers ----------

const TIME_RE = '(\\d{1,2}):(\\d{1,2}):(\\d{1,2})(?:[.,](\\d+))?';

/**
 * Parses what the GU→… output shows, e.g. "Turkal, 4 of 2, 3022 GUY ⭑ 10:54:28.09"
 * (weekday and time optional; semester may be a number or Arkabilar name;
 * "4-2-3022" dashed form also accepted).
 */
export function parseGuyString(input: string): GuyDateTime | null {
    const s = input.trim();
    const date =
        s.match(/(\d{1,2})\s+of\s+([A-Za-z][A-Za-z\s-]*?|\d{1,2})\s*,\s*(-?\d+)/i) ??
        s.match(/(\d{1,2})-(\d{1,2})-(-?\d+)/);
    if (!date) return null;
    const equinox = parseInt(date[1]);
    const semester = /^\d+$/.test(date[2]) ? parseInt(date[2]) : parseArkabilar(date[2]);
    const year = parseInt(date[3]);
    if (semester === null || equinox < 1 || equinox > 45 || semester < 1 || semester > 32) return null;
    const after = s.slice((date.index ?? 0) + date[0].length);
    const t = after.match(new RegExp(TIME_RE));
    // Trions: ".09" is hundredths-style two-digit; take the first two digits.
    const trion = t?.[4] ? parseInt(t[4].padEnd(2, '0').slice(0, 2)) : 0;
    const period = t ? parseInt(t[1]) : 0;
    const union = t ? parseInt(t[2]) : 0;
    const duon = t ? parseInt(t[3]) : 0;
    if (period > 23 || union > 59 || duon > 59 || trion > 59) return null;
    return { year, semester, equinox, period, union, duon, trion };
}

export interface EarthParts {
    era: 'CE' | 'BCE';
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    ms: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parses "13 Mar 1853 BCE, 10:54:28.150 UTC" (time/UTC optional; era defaults
 * to CE; full month names ok) or an ISO-ish "2018-06-21T04:05:06.007Z".
 */
export function parseEarthString(input: string): EarthParts | null {
    const s = input.trim();
    let era: 'CE' | 'BCE' = 'CE';
    let year: number, month: number, day: number;
    let rest: string;

    const named = s.match(/^(?:[A-Za-z]+,?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d+)\s*(BCE|BC|CE|AD)?/i);
    const iso = s.match(/^(\d{4,})-(\d{1,2})-(\d{1,2})/);
    if (named) {
        day = parseInt(named[1]);
        month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
        year = parseInt(named[3]);
        if (/^bc/i.test(named[4] ?? '')) era = 'BCE';
        rest = s.slice(named[0].length);
    } else if (iso) {
        year = parseInt(iso[1]);
        month = parseInt(iso[2]);
        day = parseInt(iso[3]);
        rest = s.slice(iso[0].length);
    } else return null;

    if (month < 1 || day < 1 || day > 31 || year < 1) return null;
    const t = rest.match(new RegExp(TIME_RE));
    const hour = t ? parseInt(t[1]) : 0;
    const minute = t ? parseInt(t[2]) : 0;
    const second = t ? parseInt(t[3]) : 0;
    const ms = t?.[4] ? parseInt(t[4].padEnd(3, '0').slice(0, 3)) : 0;
    if (hour > 23 || minute > 59 || second > 59) return null;
    return { era, year, month, day, hour, minute, second, ms };
}
