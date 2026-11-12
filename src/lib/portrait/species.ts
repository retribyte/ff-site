// A species as a race sees it. The bundle carries each .species file unpatched plus every
// mod's patch; here the patches of the mods a race keeps are applied and the creator's
// options read out. So leaving a mod out drops its changes to the species too (Cuter turns
// Avian beaks and fluff into human hair; without it they come back), not only its sprites.

import { isHiddenItem } from './curation';
import { applyPatch, type Json } from './jsonPatch';
import type { ColorOption, Manifest, RawSpecies, Species, SpeciesFlag, SpeciesGender } from './types';

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

export function deriveSpecies(raw: RawSpecies, exclude: string[], hasImage: (path: string) => boolean): Species {
    let doc: Json = raw.config;
    for (const patch of raw.patches) if (!exclude.includes(patch.m)) doc = applyPatch(doc, patch.p);
    const cfg = obj(doc);
    const dir = `/humanoid/${raw.kind.toLowerCase()}/`;
    const tooltip = obj(cfg.charCreationTooltip);
    const genders: SpeciesGender[] = list(cfg.genders).map((entry) => {
        const g = obj(entry);
        const name = str(g.name);
        const sprites: SpeciesGender['sprites'] = {};
        const files = { head: `${name}head.png`, body: `${name}body.png`, emote: 'emote.png', backArm: 'backarm.png', frontArm: 'frontarm.png' } as const;
        for (const [part, file] of Object.entries(files) as [keyof typeof files, string][])
            if (hasImage(dir + file)) sprites[part] = dir + file;
        // A style with no sprite in any mod is left out; '' means "none" and always stays.
        const options = (key: string, group: string) =>
            [...new Set(list(g[key] ?? cfg[key] ?? ['']).map(String))].filter((o) => o === '' || (group !== '' && hasImage(`${dir}${group}/${o}.png`.toLowerCase())));
        const hairGroup = str(g.hairGroup, str(cfg.HairGroup, 'hair'));
        const facialHairGroup = str(g.facialHairGroup, str(cfg.facialHairGroup));
        const facialMaskGroup = str(g.facialMaskGroup, str(cfg.facialMaskGroup));
        return {
            name, sprites,
            hairGroup, hair: options('hair', hairGroup),
            facialHairGroup, facialHair: options('facialHair', facialHairGroup),
            facialMaskGroup, facialMask: options('facialMask', facialMaskGroup),
            // Starting outfits the creator hides (invisible clothing) are not offered.
            shirt: list(g.shirt ?? cfg.shirt).map(String).filter((id) => !isHiddenItem(id)),
            pants: list(g.pants ?? cfg.pants).map(String).filter((id) => !isHiddenItem(id)),
        };
    });
    return {
        kind: raw.kind,
        mod: raw.mod,
        title: plain(tooltip.title) || raw.kind,
        subTitle: plain(tooltip.subTitle),
        description: plain(tooltip.description),
        labels: list(cfg.charGenTextLabels).map(plain),
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
    if (!species) known.set(key, (species = deriveSpecies(raw, exclude, (path) => path in manifest.images)));
    return species;
}
