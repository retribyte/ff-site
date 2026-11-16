// PROTOTYPE, throwaway. Frame math lifted from the "Galactic Sector Grid"
// artifact (draft 4): 1 unit = 1 klyr, Sag A at the origin, bar along +y.
// All places and bodies below are in-memory sample data.

export type Vec3 = [number, number, number];
export type RegionKey = 'gu' | 'ade' | 'lr' | 'rim';
export type PlaceKind = 'system' | 'landmark';
export type BodyKind = 'star' | 'planet' | 'moon' | 'station';
export type Precision = 'exact' | 'region';
export type InputStyle = 'slider' | 'chips' | 'lineup';

export interface Episode {
    season: string;
    no: number;
    title?: string;
}

export interface Body {
    id: string;
    kind: BodyKind;
    name: string;
    parentId: string | null;
    /** star: key of STAR_TYPES. planet/moon: key of COMPOSITIONS. */
    type: string;
    /** radius in km (planets, moons). Stars take theirs from the type. */
    radiusKm: number;
    /** planets: AU from the star. moons and stations: km from the parent. */
    orbit: number;
    color?: string;
    note?: string;
    wikiSlug?: string;
    travelogue: Episode[];
}

export interface Place {
    id: string;
    kind: PlaceKind;
    name: string;
    placeholder?: boolean;
    pos: Vec3;
    precision: Precision;
    /** Region picked with "somewhere in ...". Exact places derive theirs. */
    regionHint?: RegionKey;
    category?: string;
    note?: string;
    owner: string;
    wikiSlug?: string;
    bodies: Body[];
    travelogue: Episode[];
}

// ---------- Frame ----------
export const S = 5;
export const N = 9;
export const H = 5;
export const DISK_R = 43.7;
export const RIM_R = 38;
const LET = 'ABCDEFGHI';
const D2R = Math.PI / 180;
const SUN_R = 26.7;
export const SUN_ANG = 117 * D2R;
const sHat = [Math.cos(SUN_ANG), Math.sin(SUN_ANG)];
const e0 = [-sHat[0], -sHat[1]];
const e90 = [Math.cos(27 * D2R), Math.sin(27 * D2R)];
export const SUN: Vec3 = [SUN_R * sHat[0], SUN_R * sHat[1], 0.066];
export const MAP_ROT = SUN_ANG - Math.atan2(164, 94);
export const PPK = 189 / 26.7;

function galactic(l: number, b: number, d: number): Vec3 {
    const dp = d * Math.cos(b * D2R);
    const cl = Math.cos(l * D2R);
    const sl = Math.sin(l * D2R);
    return [SUN[0] + dp * (cl * e0[0] + sl * e90[0]), SUN[1] + dp * (cl * e0[1] + sl * e90[1]), SUN[2] + d * Math.sin(b * D2R)];
}

const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** FF4's old 26 x 25 grid (the "sector O-19" style addresses in the archive). */
function oldGrid(col: string, row: number): Vec3 {
    const c = col.charCodeAt(0) - 65 + 0.5;
    const r = row - 1 + 0.5;
    const p = rot((c - 13.42) * 2.94, -(r - 12.76) * 2.94, MAP_ROT);
    return [p[0], p[1], 0.3];
}

/** Old wiki `Map:Milky Way Galaxy` pixels. PLACEHOLDER positions: that map does not convert cleanly (see handover). */
function oldWikiMap(px: number, py: number): Vec3 {
    const ang = SUN_ANG - Math.atan2(442.3, 194.7);
    const p = rot((px - 1391) * 0.036, (py - 1347) * 0.036, ang);
    return [p[0], p[1], 0];
}

/** The eight octants, with the Sector Grid artifact's colors. N, E, S, W sit above the plane; the Greek four sit below them. */
export const OCTS: { key: string; sx: number; sy: number; sz: number; color: string }[] = [
    { key: 'N', sx: -1, sy: 1, sz: 1, color: '#e8584f' },
    { key: 'E', sx: 1, sy: 1, sz: 1, color: '#4f8ff0' },
    { key: 'S', sx: 1, sy: -1, sz: 1, color: '#e9c24a' },
    { key: 'W', sx: -1, sy: -1, sz: 1, color: '#45c27a' },
    { key: 'Alpha', sx: -1, sy: 1, sz: -1, color: '#7fd3e8' },
    { key: 'Beta', sx: 1, sy: 1, sz: -1, color: '#9b7cf0' },
    { key: 'Gamma', sx: 1, sy: -1, sz: -1, color: '#f08a3c' },
    { key: 'Omega', sx: -1, sy: -1, sz: -1, color: '#e060c8' },
];
const OCT_NAMES: Record<string, string> = Object.fromEntries(OCTS.map((o) => [`${o.sx},${o.sy},${o.sz}`, o.key]));

/** Direction of Andromeda in the plane (galactic longitude 121.2). */
export const ANDROMEDA_DIR: [number, number] = (() => {
    const cl = Math.cos(121.2 * D2R);
    const sl = Math.sin(121.2 * D2R);
    const x = cl * e0[0] + sl * e90[0];
    const y = cl * e0[1] + sl * e90[1];
    const n = Math.hypot(x, y);
    return [x / n, y / n];
})();

/**
 * Outer Rim rule from the Sector Grid artifact: a sector (column i, row j, any
 * octant) is Outer Rim when it holds some of the disk and its center is at
 * least RIM_R from Sag A.
 */
export const rimCell = (i: number, j: number) => Math.hypot(i * S, j * S) < DISK_R && Math.hypot(i * S + S / 2, j * S + S / 2) >= RIM_R;
export const RIM_CELLS: [number, number][] = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (rimCell(i, j)) RIM_CELLS.push([i, j]);

export function sectorOf(p: Vec3): string {
    const [x, y, z] = p;
    const oct = OCT_NAMES[`${x >= 0 ? 1 : -1},${y >= 0 ? 1 : -1},${z >= 0 ? 1 : -1}`];
    const i = Math.min(N - 1, Math.floor(Math.abs(x) / S));
    const j = Math.min(N - 1, Math.floor(Math.abs(y) / S));
    return `Sector ${LET[j]}-${i + 1}, ${oct}`;
}

export function fullAddress(p: Vec3): string {
    const ax = Math.abs(p[0]);
    const ay = Math.abs(p[1]);
    const az = Math.abs(p[2]);
    const i = Math.min(N - 1, Math.floor(ax / S));
    const j = Math.min(N - 1, Math.floor(ay / S));
    const f = (v: number) => v.toFixed(3);
    const extra = az > H ? ` + ${Math.round((az - H) * 1000)}` : '';
    return `${f((ax - (i * S + S / 2)) * 1000)}, ${f((ay - (j * S + S / 2)) * 1000)}, ${f((Math.min(az, H) - H / 2) * 1000)}, ${sectorOf(p)}${extra}`;
}

// ---------- Regions ----------
export const REGIONS: Record<RegionKey, { name: string; short: string; color: string }> = {
    gu: { name: 'Galactic Union space', short: 'GU space', color: '#c48a4e' },
    ade: { name: 'ADE space', short: 'ADE space', color: '#e0506c' },
    lr: { name: 'Llamanian Republic space', short: 'LR space', color: '#66d6b8' },
    rim: { name: 'the Outer Rim', short: 'Outer Rim', color: '#f0b44c' },
};

const TERR_RGB: [RegionKey, number, number, number][] = [
    ['gu', 177, 118, 61],
    ['ade', 195, 46, 71],
    ['lr', 102, 211, 185],
];
const TW = 400;
const TH = 300;
let terrPixels: Uint8ClampedArray | null = null;
/** 0 = none, else index + 1 into TERR_RGB. Gaps in the LR hatching are filled from neighbours. */
let terrMap: Uint8Array | null = null;
const terrCells: Record<string, number[]> = { gu: [], ade: [], lr: [] };

/** Reads the artifact's territory image so regions can be tested and sampled. */
export function loadTerritories(): Promise<void> {
    if (terrPixels) return Promise.resolve();
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = TW;
            c.height = TH;
            const g = c.getContext('2d')!;
            g.drawImage(img, 0, 0, TW, TH);
            terrPixels = g.getImageData(0, 0, TW, TH).data;
            const solid = new Uint8Array(TW * TH);
            for (let k = 0; k < TW * TH; k++) solid[k] = classifyPixel(k);
            terrMap = solid.slice();
            for (let k = 0; k < TW * TH; k++) {
                if (solid[k] || terrPixels[k * 4 + 3] === 0) continue;
                const x = k % TW;
                const y = Math.floor(k / TW);
                for (let dy = -3; dy <= 3 && !terrMap[k]; dy++)
                    for (let dx = -3; dx <= 3; dx++) {
                        const n = solid[(y + dy) * TW + x + dx];
                        if (n) {
                            terrMap[k] = n;
                            break;
                        }
                    }
            }
            for (let k = 0; k < TW * TH; k++) if (terrMap[k]) terrCells[TERR_RGB[terrMap[k] - 1][0]].push(k);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = '/prototype/territories.png';
    });
}

function classifyPixel(k: number): number {
    if (!terrPixels || terrPixels[k * 4 + 3] < 40) return 0;
    let best = 0;
    let bestD = 60 * 60 * 3;
    TERR_RGB.forEach(([, r, g, b], i) => {
        const d = (terrPixels![k * 4] - r) ** 2 + (terrPixels![k * 4 + 1] - g) ** 2 + (terrPixels![k * 4 + 2] - b) ** 2;
        if (d < bestD) {
            bestD = d;
            best = i + 1;
        }
    });
    return best;
}

const classify = (k: number): RegionKey | null => (terrMap && terrMap[k] ? TERR_RGB[terrMap[k] - 1][0] : null);

// The territory plane: 800/PPK x 600/PPK klyr, offset, inside a group rotated by MAP_ROT.
const PLANE = { cx: (400 - 336) / PPK, cy: -(300 - 356) / PPK, w: 800 / PPK, h: 600 / PPK };

export function regionAt(p: Vec3): RegionKey | null {
    const [lx, ly] = rot(p[0], p[1], -MAP_ROT);
    const u = (lx - PLANE.cx) / PLANE.w + 0.5;
    const v = 0.5 - (ly - PLANE.cy) / PLANE.h;
    if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const key = classify(Math.floor(v * TH) * TW + Math.floor(u * TW));
        if (key) return key;
    }
    const i = Math.floor(Math.abs(p[0]) / S);
    const j = Math.floor(Math.abs(p[1]) / S);
    return i < N && j < N && rimCell(i, j) ? 'rim' : null;
}

export function randomPointIn(region: RegionKey): Vec3 {
    if (region === 'rim' || !terrCells[region].length) {
        for (let tries = 0; tries < 200; tries++) {
            const [i, j] = RIM_CELLS[Math.floor(Math.random() * RIM_CELLS.length)];
            const p: Vec3 = [(Math.random() < 0.5 ? -1 : 1) * (i + Math.random()) * S, (Math.random() < 0.5 ? -1 : 1) * (j + Math.random()) * S, 0];
            if (Math.hypot(p[0], p[1]) < DISK_R - 0.5 && (region !== 'rim' || regionAt(p) === 'rim')) return p;
        }
        return [0, RIM_R + 2, 0];
    }
    const cells = terrCells[region];
    for (let tries = 0; tries < 40; tries++) {
        const k = cells[Math.floor(Math.random() * cells.length)];
        const u = ((k % TW) + Math.random()) / TW;
        const v = (Math.floor(k / TW) + Math.random()) / TH;
        const [x, y] = rot((u - 0.5) * PLANE.w + PLANE.cx, (0.5 - v) * PLANE.h + PLANE.cy, MAP_ROT);
        if (Math.hypot(x, y) < DISK_R) return [x, y, 0];
    }
    return [0, 0, 0];
}

export function regionLabel(place: Place): string {
    const key = place.precision === 'region' && place.regionHint ? place.regionHint : regionAt(place.pos);
    return key ? REGIONS[key].short : 'Unclaimed space';
}

// ---------- "Numbers nobody knows": reference scales ----------
export interface Ref {
    key: string;
    label: string;
    value: number;
}

/** Radius references, km. */
export const SIZE_REFS: Ref[] = [
    { key: 'ceres', label: 'Ceres', value: 473 },
    { key: 'moon', label: 'the Moon', value: 1737 },
    { key: 'mars', label: 'Mars', value: 3390 },
    { key: 'earth', label: 'Earth', value: 6371 },
    { key: 'neptune', label: 'Neptune', value: 24622 },
    { key: 'jupiter', label: 'Jupiter', value: 69911 },
];
export const SIZE_RANGE: [number, number] = [200, 140000];

/** Planet orbit references, AU. */
export const ORBIT_REFS: Ref[] = [
    { key: 'mercury', label: 'Mercury', value: 0.39 },
    { key: 'earth', label: 'Earth', value: 1 },
    { key: 'jupiter', label: 'Jupiter', value: 5.2 },
    { key: 'neptune', label: 'Neptune', value: 30 },
];
export const ORBIT_RANGE: [number, number] = [0.05, 80];

/** Moon and station orbit references, km from the parent. */
export const MOON_ORBIT_REFS: Ref[] = [
    { key: 'iss', label: 'low orbit', value: 7000 },
    { key: 'geo', label: 'geostationary', value: 42000 },
    { key: 'luna', label: 'the Moon', value: 384400 },
    { key: 'titan', label: 'Titan', value: 1222000 },
];
export const MOON_ORBIT_RANGE: [number, number] = [5000, 4000000];

export const STAR_TYPES: Record<string, { label: string; color: string; lum: number; mass: number; px: number }> = {
    red_dwarf: { label: 'Red dwarf', color: '#ff7a5c', lum: 0.02, mass: 0.3, px: 16 },
    orange: { label: 'Orange dwarf', color: '#ffb36b', lum: 0.3, mass: 0.75, px: 20 },
    sunlike: { label: 'Sun-like', color: '#ffe9a8', lum: 1, mass: 1, px: 24 },
    white: { label: 'White star', color: '#f4f6ff', lum: 8, mass: 1.8, px: 28 },
    blue_giant: { label: 'Blue giant', color: '#9cc0ff', lum: 5000, mass: 15, px: 38 },
    red_giant: { label: 'Red giant', color: '#ff5a3c', lum: 400, mass: 1.2, px: 44 },
    neutron: { label: 'Neutron star', color: '#cfe8ff', lum: 0.5, mass: 1.5, px: 9 },
    black_hole: { label: 'Black hole', color: '#17131f', lum: 0, mass: 10, px: 20 },
};

export const COMPOSITIONS: Record<string, { label: string; color: string; density: number }> = {
    rocky: { label: 'Rocky', color: '#b98a64', density: 1 },
    ocean: { label: 'Ocean', color: '#3f8fd6', density: 0.9 },
    desert: { label: 'Desert', color: '#d9a954', density: 1 },
    ice: { label: 'Ice', color: '#bfe3f2', density: 0.35 },
    gas: { label: 'Gas giant', color: '#d8a878', density: 0.24 },
    artificial: { label: 'Artificial', color: '#9aa3b8', density: 0.1 },
};

export const starOf = (place: Place) => place.bodies.find((b) => b.kind === 'star');

export const toT = (v: number, [lo, hi]: [number, number]) => Math.log(v / lo) / Math.log(hi / lo);
export const fromT = (t: number, [lo, hi]: [number, number]) => lo * Math.pow(hi / lo, t);

function nearestRef(v: number, refs: Ref[]): { ref: Ref; ratio: number } {
    let best = refs[0];
    for (const r of refs) if (Math.abs(Math.log(v / r.value)) < Math.abs(Math.log(v / best.value))) best = r;
    return { ref: best, ratio: v / best.value };
}

const times = (ratio: number) => (ratio >= 0.85 && ratio <= 1.18 ? 'about the size of' : ratio > 1 ? `${ratio.toFixed(1)} times the size of` : `${Math.round(ratio * 100)}% the size of`);

export function describeSize(km: number): string {
    const { ref, ratio } = nearestRef(km, SIZE_REFS);
    return `${times(ratio)} ${ref.label}`;
}

export type Zone = 'scorching' | 'hot' | 'temperate' | 'cold' | 'frozen';
export const ZONES: { key: Zone; label: string; color: string; factor: number }[] = [
    { key: 'scorching', label: 'Scorching', color: '#ff6b4a', factor: 0.3 },
    { key: 'hot', label: 'Hot', color: '#ffb056', factor: 0.7 },
    { key: 'temperate', label: 'Temperate', color: '#6fd18a', factor: 1.1 },
    { key: 'cold', label: 'Cold', color: '#74b7f2', factor: 3 },
    { key: 'frozen', label: 'Frozen', color: '#b9c6e8', factor: 15 },
];

/** Distance (AU) at which a planet gets Earth's sunlight from this star. */
export const habAU = (starType: string) => Math.sqrt(Math.max(STAR_TYPES[starType]?.lum ?? 1, 0.0005));

export function zoneOf(au: number, starType: string): (typeof ZONES)[number] {
    const rel = au / habAU(starType);
    if (rel < 0.5) return ZONES[0];
    if (rel < 0.9) return ZONES[1];
    if (rel < 1.6) return ZONES[2];
    if (rel < 6) return ZONES[3];
    return ZONES[4];
}

export function yearDays(au: number, starType: string): number {
    return 365.25 * Math.sqrt(au ** 3 / (STAR_TYPES[starType]?.mass ?? 1));
}

export function gravityG(body: Body): number {
    return (body.radiusKm / 6371) * (COMPOSITIONS[body.type]?.density ?? 1);
}

/** Mass in Earth masses, from size and what it is made of. */
export function massEarths(body: Body): number {
    return (COMPOSITIONS[body.type]?.density ?? 1) * (body.radiusKm / 6371) ** 3;
}

/** A rough 0 to 100 "could people live here" score. Moons take their planet's orbit. */
export function habitability(place: Place, body: Body): number | null {
    const star = starOf(place);
    if (!star || body.kind === 'star' || star.type === 'black_hole') return null;
    const planet = body.kind === 'planet' ? body : place.bodies.find((b) => b.id === body.parentId);
    if (!planet) return null;
    const zone = zoneOf(planet.orbit, star.type).key;
    const zoneScore = zone === 'temperate' ? 1 : zone === 'hot' || zone === 'cold' ? 0.45 : 0.05;
    const g = gravityG(body);
    const gravScore = body.kind === 'station' ? 1 : g >= 0.5 && g <= 1.5 ? 1 : g < 0.5 ? Math.max(0.15, g / 0.5) : Math.max(0.1, 1.5 / g);
    const comp: Record<string, number> = { ocean: 1, rocky: 0.8, desert: 0.7, ice: 0.4, gas: 0, artificial: 0.75 };
    return Math.round(100 * zoneScore * gravScore * (comp[body.type] ?? 0.5));
}

export const fmtNum = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2));

export function bodyColor(b: Body): string {
    if (b.color) return b.color;
    if (b.kind === 'star') return STAR_TYPES[b.type]?.color ?? '#ffe9a8';
    return COMPOSITIONS[b.type]?.color ?? '#9aa3b8';
}


// ---------- Sample data ----------
let seq = 0;
export const newId = (prefix: string) => `${prefix}${++seq}`;

const ep = (season: string, no: number, title?: string): Episode => ({ season, no, title });

function body(kind: BodyKind, name: string, parentId: string | null, type: string, radiusKm: number, orbit: number, extra: Partial<Body> = {}): Body {
    return { id: newId('b'), kind, name, parentId, type, radiusKm, orbit, travelogue: [], ...extra };
}

function system(name: string, pos: Vec3, extra: Partial<Place>, build: (add: (b: Body) => Body) => void): Place {
    const bodies: Body[] = [];
    build((b) => {
        bodies.push(b);
        return b;
    });
    return { id: newId('p'), kind: 'system', name, pos, precision: 'exact', owner: 'Trey', bodies, travelogue: [], ...extra };
}

function landmark(name: string, category: string, pos: Vec3, note = '', extra: Partial<Place> = {}): Place {
    return { id: newId('p'), kind: 'landmark', name, category, pos, precision: 'exact', owner: 'Trey', note, bodies: [], travelogue: [], ...extra };
}

export function seedPlaces(): Place[] {
    return [
        system('Sol', SUN, { note: 'A popular tourist trap, and where Earth is located.', wikiSlug: 'sol' }, (add) => {
            const sun = add(body('star', 'Sol', null, 'sunlike', 696000, 0));
            const earth = add(body('planet', 'Earth', sun.id, 'ocean', 6371, 1, {
                wikiSlug: 'earth',
                travelogue: [ep('FF2', 10, 'Toothache Troubles'), ep('FF2', 13, 'Seeing Double'), ep('FF2', 14, 'Crash and Burn'), ep('FF2', 15, 'Worm in the Hole')],
            }));
            add(body('moon', 'Luna', earth.id, 'rocky', 1737, 384400));
            add(body('planet', 'Mars', sun.id, 'desert', 3390, 1.52));
            add(body('planet', 'Jupiter', sun.id, 'gas', 69911, 5.2));
        }),
        system('Unnamed system', oldWikiMap(1433, 993.5), { placeholder: true, note: 'Placeholder: Barbona was added before anyone named its star.' }, (add) => {
            const star = add(body('star', 'Unnamed star', null, 'orange', 500000, 0));
            add(body('planet', 'Barbona', star.id, 'ocean', 7800, 0.62, {
                note: 'An ocean planet, and home of the Torrid.',
                wikiSlug: 'barbona',
                travelogue: [ep('FF4', 3, 'Ambush'), ep('FF4', 4, 'Blackjack'), ep('FF4', 5, 'Diplomacy'), ep('FF4', 6, 'Obligatory Shopping Episode'), ep('FF4', 7, 'Marv Attacks'), ep('FF4', 23, 'Finale')],
            }));
        }),
        system('Eflah', oldWikiMap(1505.5, 981), { note: 'A less-populated system, home of Fleex.' }, (add) => {
            const star = add(body('star', 'Eflah', null, 'red_dwarf', 200000, 0));
            add(body('planet', 'Fleex', star.id, 'rocky', 4100, 0.16, { wikiSlug: 'fleex', travelogue: [ep('FF4', 6, 'Obligatory Shopping Episode')] }));
            add(body('planet', 'Eflah II', star.id, 'ice', 9000, 1.4));
        }),
        system('Eyacara', oldWikiMap(1342, 1036.5), { owner: 'Zander' }, (add) => {
            const star = add(body('star', 'Eyacara', null, 'white', 1200000, 0));
            const six = add(body('planet', 'Eyacara-6', star.id, 'gas', 52000, 9));
            add(body('station', 'KYL Trade Center', six.id, 'artificial', 600, 90000, {
                note: 'An artificial moon orbiting the planet Eyacara-6.',
                travelogue: [ep('FF2', 13, 'Seeing Double'), ep('FF2', 14, 'Crash and Burn'), ep('FF2', 16, 'Barrier to Entria'), ep('FF2', 17, 'Take Two'), ep('FF2', 21, 'Deep Space Famine'), ep('FF2', 22, 'Dam Hooligans'), ep('FF2', 23, 'Bark and Bite')],
            }));
        }),
        system('Unnamed system', [22, -18, 0], { placeholder: true, owner: 'Sean' }, (add) => {
            const star = add(body('star', 'Unnamed star', null, 'sunlike', 696000, 0));
            add(body('planet', 'Zarazoga-9', star.id, 'ocean', 5900, 0.95, { note: 'A tropical paradise, free from GU or ADE influence.', travelogue: [ep('FF3', 7), ep('FF3', 8)] }));
        }),
        system('Ophiuchus-D', oldGrid('O', 19), { note: 'A black hole in old sector O-19. Target of Operation EVENT HORIZON.', travelogue: [ep('FF4', 1, 'Welcome, New Recruits'), ep('FF4', 18, 'Mutiny')] }, (add) => {
            add(body('star', 'Ophiuchus-D', null, 'black_hole', 60, 0));
        }),
        landmark('Sagittarius A', 'Black hole', [0, 0, 0], 'The 729 Core Worlds share one orbit 406 AU out. One lap is one GUY.'),
        landmark('GU government site', 'Station', oldGrid('N', 12), 'Old sector N-12.'),
        landmark('Independent station', 'Station', oldGrid('N', 15), 'Old sector N-15.'),
        landmark('Omega Centauri', 'Cluster', galactic(309.1, 14.97, 17.0)),
        landmark('M13', 'Cluster', galactic(59.0, 40.9, 22.2), 'Out in the halo, above the disk.'),
        landmark('Ptorei Nebula', 'Nebula', oldWikiMap(1696, 1580)),
        landmark('Bakree Nebula', 'Nebula', oldWikiMap(1389, 1960), 'Birthplace of the Novakids.'),
        landmark('Bagriburg', 'Landmark', oldWikiMap(475, 2002), 'An invitation-only district where many reclusive species live.'),
        landmark('Padox District', 'Landmark', oldWikiMap(761, 2186), 'A densely populated district.'),
        landmark('Geche Customs', 'Station', oldWikiMap(928, 2234)),
        landmark('Coterr Inner Junction', 'Landmark', oldWikiMap(1135, 1690)),
        landmark('Vanta Outer Junction', 'Landmark', oldWikiMap(356, 1528)),
        landmark('RSJENO base', 'Station', oldWikiMap(1181, 1296), "Base of the GU's research and journalism arm."),
    ];
}

export const epLabel = (e: Episode) => `${e.season} episode ${e.no}${e.title ? `, ${e.title}` : ''}`;
