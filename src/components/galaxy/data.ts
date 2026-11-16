// The galaxy map's frame math, regions and "no raw numbers" reference scales, and
// the shape the map's components work with. Frame math is lifted from the "Galactic
// Sector Grid" artifact (draft 4): 1 unit = 1 klyr, Sag A at the origin, bar along +y.
// The key lists (STAR_TYPES, COMPOSITIONS, LANDMARK_CATEGORIES) must match ff-server's
// src/galaxy/galaxy.validation.ts, which refuses keys it does not know.

import { decodeEntities } from '@/lib/html';
import type { WikiData, WikiValue } from '@/lib/types';

export type Vec3 = [number, number, number];
export type RegionKey = 'gu' | 'ade' | 'lr' | 'rim';
export type PlaceKind = 'system' | 'landmark';
export type BodyKind = 'star' | 'planet' | 'moon' | 'station';
export type Precision = 'exact' | 'region';

/** "This episode happened here." `episode` is null when that episode is gone from the archive. */
export interface TravelTag {
    id: number;
    creatorId: number;
    episodeSlug: string;
    episode: { slug: string; title: string; episode_no: number; seasonTitle: string; seasonSlug: string } | null;
}

export interface Body {
    id: number;
    kind: BodyKind;
    /** With no name of its own (`unnamed`): a star reads "Unnamed star", a planet or moon its designation. */
    name: string;
    unnamed?: boolean;
    /** Planets: "this is planet N of its star", stored for one whose inner neighbours are not on the map. */
    ordinal: number | null;
    /** Planets: the number counted out from the star. Moons and stations: 1 for a, 2 for b. Filled by `designate`. */
    num: number;
    /** GU designation: Sol-3 for a planet, Sol-3a for what orbits it. Filled by `designate`. */
    gu: string;
    parentId: number | null;
    /** star: key of STAR_TYPES. planet/moon/station: key of COMPOSITIONS. */
    type: string;
    /** radius in km (planets, moons). Stars take theirs from the type. */
    radiusKm: number;
    /** planets: AU from the star. moons and stations: km from the parent. */
    orbit: number;
    color?: string;
    /** ff-server-sanitized HTML: render with RichText. */
    note?: string;
    /** The wiki's slug for the same thing. */
    slug?: string;
    wiki?: WikiInfo;
    travelogue: TravelTag[];
}

export interface Place {
    id: number;
    kind: PlaceKind;
    /** A system nobody has named reads "Unnamed system" (`placeholder`). */
    name: string;
    placeholder?: boolean;
    pos: Vec3;
    precision: Precision;
    /** Region picked with "somewhere in ...". Exact places derive theirs. */
    regionHint?: RegionKey;
    /** Landmarks: key of LANDMARK_CATEGORIES. */
    category?: string;
    note?: string;
    owner: { id: number; username: string };
    slug?: string;
    wiki?: WikiInfo;
    bodies: Body[];
    travelogue: TravelTag[];
}

// ---------- ff-server's shapes (GET /galaxy/places) ----------
/** What the wiki says about the same slug (ff-server's cached row), ready to show. */
export interface WikiInfo {
    /** The article's title. */
    page: string;
    /** Address of its picture, at card width. */
    image?: string;
    /** The article's first paragraph. */
    intro?: string;
    faction?: string;
}

function wikiInfo(wiki: WikiData | null | undefined): WikiInfo | undefined {
    if (!wiki || typeof wiki.page_name !== 'string') return undefined;
    const text = (value: WikiValue | undefined) => {
        const s = decodeEntities(Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '').trim();
        return s || undefined;
    };
    const image = text(wiki.image_url);
    return {
        page: decodeEntities(wiki.page_name),
        image: image?.startsWith('https://') ? image : undefined,
        intro: text(wiki.intro)?.split(/\n+/)[0],
        faction: text(wiki.faction),
    };
}

export interface ApiBody {
    id: number;
    parentId: number | null;
    kind: 'STAR' | 'PLANET' | 'MOON' | 'STATION';
    name: string | null;
    slug: string | null;
    type: string;
    radiusKm: number | null;
    orbit: number | null;
    ordinal?: number | null;
    color: string | null;
    description: string | null;
    wiki?: WikiData | null;
}

export interface ApiPlace {
    id: number;
    kind: 'SYSTEM' | 'LANDMARK';
    name: string | null;
    slug: string | null;
    x: number;
    y: number;
    z: number;
    region: 'GU' | 'ADE' | 'LR' | 'RIM' | null;
    category: string | null;
    description: string | null;
    creator: { id: number; username: string; icon: string | null };
    wiki?: WikiData | null;
    bodies: ApiBody[];
    travelogue: (TravelTag & { bodyId: number | null })[];
}

export function fromApi(p: ApiPlace): Place {
    const tagsOf = (bodyId: number | null) => p.travelogue.filter((t) => t.bodyId === bodyId).map((t) => ({ id: t.id, creatorId: t.creatorId, episodeSlug: t.episodeSlug, episode: t.episode }));
    return {
        id: p.id,
        kind: p.kind === 'SYSTEM' ? 'system' : 'landmark',
        name: p.name ?? 'Unnamed system',
        placeholder: p.name === null,
        pos: [p.x, p.y, p.z],
        precision: p.region ? 'region' : 'exact',
        regionHint: p.region ? (p.region.toLowerCase() as RegionKey) : undefined,
        category: p.category ?? undefined,
        note: p.description ?? undefined,
        owner: { id: p.creator.id, username: p.creator.username },
        slug: p.slug ?? undefined,
        wiki: wikiInfo(p.wiki),
        bodies: designate(p.bodies.map((b) => ({
            id: b.id,
            kind: b.kind.toLowerCase() as BodyKind,
            name: b.name ?? 'Unnamed star',
            unnamed: b.name === null,
            parentId: b.parentId,
            type: b.type,
            radiusKm: b.radiusKm ?? 696000,
            orbit: b.orbit ?? 0,
            ordinal: b.ordinal ?? null,
            num: 0,
            gu: '',
            color: b.color ?? undefined,
            note: b.description ?? undefined,
            slug: b.slug ?? undefined,
            wiki: wikiInfo(b.wiki),
            travelogue: tagsOf(b.id),
        }))),
        travelogue: tagsOf(null),
    };
}

// ---------- Addresses ----------
/** What the page's address says is open: nothing, a place picked on the galaxy, or a system's own view with perhaps a body picked. */
export interface Address {
    placeId: number | null;
    bodyId: number | null;
    level: 'galaxy' | 'system';
}

// A slug has no hyphen, so these can never be taken for one
const placeKey = (p: { id: number; slug?: string | null }) => p.slug ?? `system-${p.id}`;
const bodyKey = (b: { id: number; slug?: string | null }) => b.slug ?? `body-${b.id}`;

/** The address of what is open: /galaxy, /galaxy?at=rsjeno_base, /galaxy/sol or /galaxy/sol/earth. A thing with no slug goes by its number (system-22, body-51). */
export function addressUrl(place: Place | null, body: Body | null, level: 'galaxy' | 'system'): string {
    if (!place) return '/galaxy';
    if (level === 'system' && place.kind === 'system') return `/galaxy/${placeKey(place)}${body ? `/${bodyKey(body)}` : ''}`;
    return `/galaxy?at=${placeKey(place)}`;
}

/** Reads an address back (the path after /galaxy and the `at` of its query); null when it names something that is not on the map. */
export function readAddress(path: string[], at: string | null, places: { id: number; kind: string; slug?: string | null; bodies: { id: number; slug?: string | null }[] }[]): Address | null {
    const [placePart, bodyPart, ...rest] = path;
    if (rest.length > 0) return null;
    if (!placePart) {
        if (!at) return { placeId: null, bodyId: null, level: 'galaxy' };
        const place = places.find((p) => placeKey(p) === at);
        return place ? { placeId: place.id, bodyId: null, level: 'galaxy' } : null;
    }
    const place = places.find((p) => placeKey(p) === placePart);
    if (!place) return null;
    // A landmark has no view of its own: it is picked on the galaxy
    if (place.kind.toLowerCase() !== 'system') return bodyPart ? null : { placeId: place.id, bodyId: null, level: 'galaxy' };
    const body = bodyPart ? place.bodies.find((b) => bodyKey(b) === bodyPart) : null;
    if (bodyPart && !body) return null;
    return { placeId: place.id, bodyId: body?.id ?? null, level: 'system' };
}

const byOrbit = (a: Body, b: Body) => a.orbit - b.orbit || a.id - b.id;

/**
 * Numbers a system's bodies. Planets count outward from the star, never below their
 * stored `ordinal`, so a planet marked "planet 3" leaves 1 and 2 open inside it; what
 * orbits a planet is lettered a, b, c. Sets each body's `num` and `gu` (Sol-3, Sol-3a),
 * and the name of a planet or moon that has none. Run again after an orbit changes.
 */
export function designate(bodies: Body[]): Body[] {
    const star = bodies.find((b) => b.kind === 'star');
    const stem = star && !star.unnamed ? star.name : 'Unnamed';
    const out = new Map<number, { num: number; gu: string }>();
    const letter = (parent: Body | undefined, parentGu: string) => {
        if (!parent) return;
        bodies.filter((b) => b.parentId === parent.id && b.kind !== 'planet' && b.kind !== 'star').sort(byOrbit).forEach((b, i) => {
            const gu = `${parentGu}${String.fromCharCode(97 + (i % 26))}`;
            out.set(b.id, { num: i + 1, gu });
            letter(b, gu);
        });
    };
    let n = 0;
    for (const p of bodies.filter((b) => b.kind === 'planet').sort(byOrbit)) {
        n = Math.max(n + 1, p.ordinal ?? 0);
        out.set(p.id, { num: n, gu: `${stem}-${n}` });
        letter(p, `${stem}-${n}`);
    }
    letter(star, `${stem}-`);
    return bodies.map((b) => {
        const d = out.get(b.id) ?? { num: 0, gu: '' };
        return { ...b, ...d, name: b.unnamed && b.kind !== 'star' ? d.gu : b.name };
    });
}

/** The number a planet at `orbit` gets among the system's other planets when it claims `ordinal`, and the lowest it could have there. */
export function planetNumber(others: Body[], orbit: number, ordinal: number | null): { n: number; min: number } {
    const min = Math.max(0, ...others.filter((b) => b.kind === 'planet' && b.orbit < orbit).map((b) => b.num)) + 1;
    return { n: Math.max(min, ordinal ?? 0), min };
}

export const LANDMARK_CATEGORIES: Record<string, string> = { landmark: 'Landmark', station: 'Station', cluster: 'Cluster', nebula: 'Nebula' };

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

const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

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
        img.src = '/galaxy/territories.png';
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

/**
 * The closest a moon can orbit, in km from its planet's centre, before tides pull it
 * apart: the Roche limit for a solid body, 1.26 R (planet density / moon density)^(1/3).
 * Densities are the rough ones of COMPOSITIONS, so this is a floor, not a measurement.
 */
export function rocheKm(planet: { radiusKm: number; type: string }, moonType: string): number {
    const ratio = (COMPOSITIONS[planet.type]?.density ?? 1) / (COMPOSITIONS[moonType]?.density ?? 1);
    return 1.26 * planet.radiusKm * Math.cbrt(ratio);
}

/**
 * How near and how far a moon or station may orbit this planet, km. A moon stays
 * outside its Roche limit; a station is held together by its hull, so it only has to
 * clear the surface. With no planet known, the plain reference range.
 */
export function satelliteRange(kind: BodyKind, planet: { radiusKm: number; type: string } | undefined, type: string): [number, number] {
    if (!planet) return MOON_ORBIT_RANGE;
    const lo = Math.ceil(kind === 'moon' ? rocheKm(planet, type) : planet.radiusKm * 1.03);
    return [lo, Math.max(MOON_ORBIT_RANGE[1], lo * 100)];
}

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

export const fmtNum = (v: number) => (v > 0 && v < 0.01 ? v.toPrecision(1) : v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2));

export function bodyColor(b: Body): string {
    if (b.color) return b.color;
    if (b.kind === 'star') return STAR_TYPES[b.type]?.color ?? '#ffe9a8';
    return COMPOSITIONS[b.type]?.color ?? '#9aa3b8';
}
