// A species as a race sees it. The bundle carries each .species file unpatched plus every
// mod's patch; here the patches of the mods a race keeps are applied and the creator's
// options read out. So leaving a mod out drops its changes to the species too (Cuter turns
// Avian beaks and fluff into human hair; without it they come back), not only its sprites.

import { isHiddenItem } from './curation';
import { applyPatch, type Json } from './jsonPatch';
import { STYLE_PARTS, type ClothingFit, type ColorOption, type FitPart, type FitRule, type Manifest, type RawSpecies, type Species, type SpeciesFlag, type SpeciesGender, type StyleColor, type StylePart, type StyleSlot } from './types';

const FLAGS: SpeciesFlag[] = [
    'altOptionAsUndyColor', 'headOptionAsHairColor', 'altOptionAsHairColor', 'hairColorAsBodySubColor',
    'headOptionAsFacialhair', 'altOptionAsFacialMask', 'bodyColorAsFacialMaskSubColor', 'altColorAsFacialMaskSubColor',
];

type Obj = { [key: string]: Json };
const obj = (v: Json | undefined): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const str = (v: Json | undefined, fallback = ''): string => (typeof v === 'string' ? v : fallback);
/** Text without Starbound colour codes (^orange;). */
const plain = (v: Json | undefined) => str(v).replace(/\^[^;^]*;/g, '').trim();

function colorOptions(raw: Json | undefined): ColorOption[] {
    const out: ColorOption[] = [];
    for (const entry of list(raw)) {
        if (typeof entry === 'string') out.push(entry);
        else if (entry && typeof entry === 'object' && !Array.isArray(entry))
            out.push(Object.fromEntries(Object.entries(entry).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])));
    }
    return out;
}

/** The game's own style layers' ids. A species' own layers may not reuse them. */
export const BUILTIN_STYLES = ['hair', 'facialHair', 'facialMask'] as const;

const STYLE_COLORS: StyleColor[] = ['body', 'hair', 'undy', 'facialMask', 'own', 'none'];
/** Each part's sheet in a style folder, as the body's own sheets are named (a gendered one first). */
const PART_FILES: Record<StylePart, string> = { head: 'head', body: 'body', frontArm: 'frontarm', backArm: 'backarm' };
/** A species' own layer goes just above the part it draws on unless it says otherwise. */
const DEFAULT_ABOVE: Record<StylePart, string> = { head: 'head', body: 'body', frontArm: 'frontArm', backArm: 'backArm' };
const FIT_PARTS: FitPart[] = ['headwear', 'chest', 'backSleeve', 'frontSleeve', 'legs', 'back'];

const int = (v: Json | undefined): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);

function fitRule(raw: Json | undefined): FitRule | null {
    const o = obj(raw);
    const rule: FitRule = {};
    const off = list(o.offset);
    if (off.length === 2 && int(off[0]) !== undefined && int(off[1]) !== undefined) rule.offset = [int(off[0])!, int(off[1])!];
    for (const key of ['columns', 'rows'] as const) {
        const r = obj(o[key]);
        const at = int(r.at), add = int(r.add);
        if (at !== undefined && add !== undefined && at >= 0 && add !== 0) rule[key] = { at, add };
    }
    return Object.keys(rule).length ? rule : null;
}

/** `ffClothingFit` of the species, with the gender's own rules over it part by part. */
function clothingFit(species: Json | undefined, gender: Json | undefined): ClothingFit | undefined {
    const fit: ClothingFit = {};
    for (const source of [obj(species), obj(gender)])
        for (const part of FIT_PARTS) {
            const rule = fitRule(source[part]);
            if (rule) fit[part] = rule;
        }
    return Object.keys(fit).length ? fit : undefined;
}

/** `ffLayers` of the species with the gender's entries merged over them by id (new ids added). */
function layerDefs(species: Json | undefined, gender: Json | undefined): Obj[] {
    const out: Obj[] = [];
    for (const entry of [...list(species), ...list(gender)]) {
        const def = obj(entry);
        const id = str(def.id).trim();
        if (!id || (BUILTIN_STYLES as readonly string[]).includes(id)) continue;
        const at = out.findIndex((d) => d.id === id);
        if (at >= 0) out[at] = { ...out[at], ...def, id };
        else out.push({ ...def, id });
    }
    return out;
}

export interface ImageLookup {
    has: (path: string) => boolean;
    /** Every image path under a folder (a species' own layer lists its styles from the folders there). */
    under?: (prefix: string) => string[];
}

export function deriveSpecies(raw: RawSpecies, exclude: string[], images: ImageLookup | ((path: string) => boolean)): Species {
    const lookup: ImageLookup = typeof images === 'function' ? { has: images } : images;
    const hasImage = lookup.has;
    let doc: Json = raw.config;
    for (const patch of raw.patches) if (!exclude.includes(patch.m)) doc = applyPatch(doc, patch.p);
    const cfg = obj(doc);
    const dir = `/humanoid/${raw.kind.toLowerCase()}/`;
    const tooltip = obj(cfg.charCreationTooltip);
    const labels = list(cfg.charGenTextLabels).map(plain);
    const flag = (f: SpeciesFlag) => cfg[f] === true;
    const genders: SpeciesGender[] = list(cfg.genders).map((entry) => {
        const g = obj(entry);
        const name = str(g.name);
        const sprites: SpeciesGender['sprites'] = {};
        const files = { head: `${name}head.png`, body: `${name}body.png`, emote: 'emote.png', backArm: 'backarm.png', frontArm: 'frontarm.png' } as const;
        for (const [part, file] of Object.entries(files) as [keyof typeof files, string][])
            if (hasImage(dir + file)) sprites[part] = dir + file;

        // The game's own three: a style is one image, drawn over the head.
        const builtin = (id: string, label: string, group: string, key: string, color: StyleColor[], above: string): StyleSlot => {
            const files: StyleSlot['files'] = {};
            const options: string[] = [];
            for (const o of new Set(list(g[key] ?? cfg[key] ?? ['']).map(String))) {
                if (o === '') options.push(o);
                else if (group !== '' && hasImage(`${dir}${group}/${o}.png`.toLowerCase())) {
                    options.push(o);
                    files[o] = { head: `${dir}${group}/${o}.png`.toLowerCase() };
                }
            }
            return { id, label, group, options, files, color, colors: [], stack: false, masked: true, above: { ...DEFAULT_ABOVE, head: above }, builtin: true };
        };
        // A style with no sprite in any mod is left out; '' means "none" and always stays.
        const styles: StyleSlot[] = [builtin('hair', labels[1] || 'Hair', str(g.hairGroup, str(cfg.HairGroup, 'hair')), 'hair', ['hair'], 'emote')];
        if (flag('headOptionAsFacialhair'))
            styles.push(builtin('facialHair', labels[5] || 'Facial hair', str(g.facialHairGroup, str(cfg.facialHairGroup)), 'facialHair', ['hair'], 'chest'));
        if (flag('altOptionAsFacialMask'))
            styles.push(builtin('facialMask', labels[4] || 'Face', str(g.facialMaskGroup, str(cfg.facialMaskGroup)), 'facialMask', ['facialMask'], 'chest'));

        // The site's own: a style is a folder with a sheet per part, each laid out like the part's own.
        for (const def of layerDefs(cfg.ffLayers, g.ffLayers)) {
            const id = str(def.id);
            const group = str(def.group, id).replace(/^\/+|\/+$/g, '').toLowerCase();
            const base = `${dir}${group}/`;
            let wanted = Array.isArray(def.options) ? def.options.map(String) : null;
            if (!wanted) {
                const found = new Set((lookup.under?.(base) ?? []).map((p) => p.slice(base.length).split('/')).filter((bits) => bits.length === 2).map((bits) => bits[0]));
                wanted = ['', ...[...found].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
            }
            const filesOf: StyleSlot['files'] = {};
            const options: string[] = [];
            for (const o of new Set(wanted)) {
                if (o === '') {
                    options.push(o);
                    continue;
                }
                const parts: Partial<Record<StylePart, string>> = {};
                for (const part of STYLE_PARTS) {
                    const file = [`${base}${o}/${name}${PART_FILES[part]}.png`, `${base}${o}/${PART_FILES[part]}.png`].map((f) => f.toLowerCase()).find(hasImage);
                    if (file) parts[part] = file;
                }
                if (Object.keys(parts).length) {
                    options.push(o);
                    filesOf[o] = parts;
                }
            }
            const color = (Array.isArray(def.color) ? def.color : [def.color ?? 'body']).map(String).filter((c): c is StyleColor => (STYLE_COLORS as string[]).includes(c));
            const aboveRaw = obj(def.above);
            const above = { ...DEFAULT_ABOVE };
            for (const part of STYLE_PARTS) if (typeof aboveRaw[part] === 'string') above[part] = aboveRaw[part] as string;
            styles.push({
                id, label: plain(def.label) || id, group, options, files: filesOf,
                color: color.length ? color : ['body'],
                colors: colorOptions(def.colors),
                stack: def.stack === true,
                masked: def.masked === true,
                above,
                builtin: false,
            });
        }
        const fit = clothingFit(cfg.ffClothingFit, g.ffClothingFit);
        return {
            name, sprites, styles,
            // Starting outfits the creator hides (invisible clothing) are not offered.
            shirt: list(g.shirt ?? cfg.shirt).map(String).filter((id) => !isHiddenItem(id)),
            pants: list(g.pants ?? cfg.pants).map(String).filter((id) => !isHiddenItem(id)),
            ...(fit ? { fit } : {}),
        };
    });
    return {
        kind: raw.kind,
        mod: raw.mod,
        title: plain(tooltip.title) || raw.kind,
        subTitle: plain(tooltip.subTitle),
        description: plain(tooltip.description),
        labels,
        playable: raw.playable,
        order: raw.order,
        flags: Object.fromEntries(FLAGS.filter((f) => cfg[f] === true).map((f) => [f, true])),
        bodyColor: colorOptions(cfg.bodyColor),
        undyColor: colorOptions(cfg.undyColor),
        hairColor: colorOptions(cfg.hairColor),
        personalities: raw.personalities,
        genders,
    };
}

/** A style layer of a gender, by id. */
export function styleSlot(gender: SpeciesGender | undefined, id: string): StyleSlot | undefined {
    return gender?.styles.find((s) => s.id === id);
}

const cache = new WeakMap<Manifest, Map<string, Species>>();

/** The species with the patches of every mod not in `exclude` applied (cached per manifest). */
export function speciesFor(manifest: Manifest, kind: string, exclude: string[] = []): Species | undefined {
    const raw = manifest.species[kind];
    if (!raw) return undefined;
    // Only mods that actually patch this species change the result.
    const relevant = raw.patches.map((p) => p.m).filter((m) => exclude.includes(m));
    const key = `${kind}\n${[...new Set(relevant)].sort().join(',')}`;
    let known = cache.get(manifest);
    if (!known) cache.set(manifest, (known = new Map()));
    let species = known.get(key);
    if (!species) known.set(key, (species = deriveSpecies(raw, exclude, { has: (path) => path in manifest.images, under: (prefix) => imagesUnder(manifest, prefix) })));
    return species;
}

const folders = new WeakMap<Manifest, string[]>();

/** The manifest's image paths under a folder, from one sorted list kept per manifest. */
function imagesUnder(manifest: Manifest, prefix: string): string[] {
    let paths = folders.get(manifest);
    if (!paths) folders.set(manifest, (paths = Object.keys(manifest.images).sort()));
    let lo = 0, hi = paths.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (paths[mid] < prefix) lo = mid + 1;
        else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < paths.length && paths[i].startsWith(prefix); i++) out.push(paths[i]);
    return out;
}
