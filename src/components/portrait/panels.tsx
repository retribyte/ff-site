'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { paint, type BrowserBundle } from '@/lib/portrait/browserBundle';
import { renderLayer } from '@/lib/portrait/compose';
import { distinctColors, hexToRgba } from '@/lib/portrait/directives';
import { buildLayers, defaultRecipe } from '@/lib/portrait/humanoid';
import { spriteSources, UNCATEGORISED, type Race } from '@/lib/portrait/races';
import { speciesFor } from '@/lib/portrait/species';
import type { ColorOption, ColorPick, ItemsFile, Recipe, WearItem, WearSlot } from '@/lib/portrait/types';
import Thumb from './Thumb';
import styles from './portrait.module.scss';

type SetRecipe = (update: (recipe: Recipe) => Recipe) => void;

// ---------------------------------------------------------------------------- race picker

export function RacePicker({ bundle, races, categories, current, onPick }: {
    bundle: BrowserBundle;
    races: Race[];
    categories: string[];
    current: string;
    onPick: (race: Race) => void;
}) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [npcs, setNpcs] = useState(true);
    const tabs = ['all', ...categories, ...(races.some((r) => r.category === UNCATEGORISED) ? [UNCATEGORISED] : [])];
    const q = query.trim().toLowerCase();
    const shown = races.filter((r) =>
        (category === 'all' || r.category === category) &&
        (npcs || !r.npc) &&
        (!q || [r.name, r.modName ?? '', r.descriptor, r.species.kind].some((t) => t.toLowerCase().includes(q))));
    const groups = (category === 'all' ? tabs.slice(1) : [category])
        .map((c) => ({ category: c, races: shown.filter((r) => r.category === c) }))
        .filter((g) => g.races.length);

    return (
        <section className={styles.races} aria-label='Race'>
            <input className={styles.search} type='search' placeholder='Find a race' value={query} onChange={(e) => setQuery(e.target.value)} aria-label='Find a race' />
            <div className={styles.tabs} role='tablist'>
                {tabs.map((t) => (
                    <button key={t} type='button' role='tab' aria-selected={category === t} className={styles.tab} onClick={() => setCategory(t)}>
                        {t}
                    </button>
                ))}
            </div>
            <label className={styles.check}>
                <input type='checkbox' checked={npcs} onChange={(e) => setNpcs(e.target.checked)} /> include NPC-only races
            </label>
            <div className={styles.raceScroll}>
                {groups.map((g) => (
                    <div key={g.category}>
                        <h3 className={styles.groupTitle}>{g.category} <span className={styles.count}>{g.races.length}</span></h3>
                        <ul className={styles.raceGrid}>
                            {g.races.map((r) => (
                                <li key={r.id}>
                                    <button type='button' className={styles.race} aria-pressed={current === r.id} onClick={() => onPick(r)} title={r.species.description || undefined}>
                                        <Thumb bundle={bundle} recipe={{ ...defaultRecipe(r.species, r), nude: true }} view='head' size={48} />
                                        <span className={styles.raceText}>
                                            <span className={styles.raceName}>{r.name}</span>
                                            <span className={styles.raceKind}>
                                                {r.descriptor}
                                                {r.npc && <span className={styles.npc}>npc</span>}
                                            </span>
                                            {r.modName && <span className={styles.raceMod}>{r.modName}</span>}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                {groups.length === 0 && <p className={styles.empty}>No race matches.</p>}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------- swatches

function optionColors(option: ColorOption): string[] {
    return typeof option === 'string' ? [] : Object.values(option);
}

export function Swatches({ options, value, onPick, label }: { options: ColorOption[]; value: number; onPick: (index: number) => void; label: string }) {
    if (options.length < 2) return null;
    const picked = ((value % options.length) + options.length) % options.length;
    return (
        <div className={styles.field}>
            <h4 className={styles.fieldTitle}>{label} <span className={styles.count}>{picked + 1} of {options.length}</span></h4>
            <div className={styles.swatches}>
                {options.map((option, i) => {
                    const colors = optionColors(option);
                    return (
                        <button key={i} type='button' className={styles.swatch} aria-pressed={i === picked} aria-label={`${label} ${i + 1}`} title={typeof option === 'string' ? option : undefined} onClick={() => onPick(i)}>
                            {colors.length ? colors.slice(0, 4).map((c, n) => <span key={n} style={{ background: `#${c.slice(0, 6)}` }} />) : <span className={styles.swatchFx}>fx</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------- body

function StyleGrid({ bundle, recipe, label, options, value, field, onPick }: {
    bundle: BrowserBundle; recipe: Recipe; label: string; options: string[]; value: string;
    field: 'hair' | 'facialHair' | 'facialMask'; onPick: (value: string) => void;
}) {
    if (options.length < 2) return null;
    return (
        <div className={styles.field}>
            <h4 className={styles.fieldTitle}>{label} <span className={styles.count}>{options.length}</span></h4>
            <div className={styles.styleGrid}>
                {options.map((o) => (
                    <button key={o} type='button' className={styles.styleCell} aria-pressed={o === value} title={o || 'none'} onClick={() => onPick(o)}>
                        <Thumb bundle={bundle} recipe={{ ...recipe, [field]: o, nude: true, wear: {} }} view='head' size={44} />
                    </button>
                ))}
            </div>
        </div>
    );
}

export function BodyPanel({ bundle, race, recipe, set }: { bundle: BrowserBundle; race: Race; recipe: Recipe; set: SetRecipe }) {
    const sp = race.species;
    const g = sp.genders[recipe.gender] ?? sp.genders[0];
    const dir = (g.sprites.body ?? '').replace(/[^/]*$/, '');
    const f = sp.flags;
    const L = (i: number, fallback: string) => sp.labels[i] || fallback;
    // Options whose sprite only ships in a mod this race passes over are left out, and so are
    // repeats (hair mods sometimes list a style twice).
    const available = (group: string, list: string[]) => [...new Set(list)].filter((o) => o === '' || bundle.has(`${dir}${group}/${o}.png`.toLowerCase(), recipe));
    const pick = (key: 'body' | 'undy' | 'hairColor') => (option: number) => set((r) => ({ ...r, [key]: { ...r[key], option } }));
    const both = (label: string, kind: string, shared: boolean) => (shared ? `${label} (${kind})` : label);

    return (
        <div className={styles.panelBody}>
            <Swatches label={L(0, 'Body colour')} options={sp.bodyColor} value={recipe.body.option} onPick={pick('body')} />
            <StyleGrid bundle={bundle} recipe={recipe} label={L(1, 'Hair')} options={available(g.hairGroup, g.hair)} value={recipe.hair} field='hair' onPick={(hair) => set((r) => ({ ...r, hair }))} />
            {f.headOptionAsHairColor && (
                <Swatches label={both(L(5, 'Hair colour'), 'colour', !!f.headOptionAsFacialhair)} options={sp.hairColor} value={recipe.hairColor.option} onPick={pick('hairColor')} />
            )}
            {f.headOptionAsFacialhair && (
                <StyleGrid bundle={bundle} recipe={recipe} label={both(L(5, 'Facial hair'), 'style', !!f.headOptionAsHairColor)} options={available(g.facialHairGroup, g.facialHair)} value={recipe.facialHair} field='facialHair' onPick={(facialHair) => set((r) => ({ ...r, facialHair }))} />
            )}
            {(f.altOptionAsUndyColor || f.altOptionAsHairColor) && (
                <Swatches label={both(L(4, 'Detail colour'), 'colour', !!f.altOptionAsFacialMask)} options={sp.undyColor} value={recipe.undy.option} onPick={pick('undy')} />
            )}
            {f.altOptionAsFacialMask && (
                <StyleGrid bundle={bundle} recipe={recipe} label={both(L(4, 'Face'), 'style', !!f.altOptionAsUndyColor)} options={available(g.facialMaskGroup, g.facialMask)} value={recipe.facialMask} field='facialMask' onPick={(facialMask) => set((r) => ({ ...r, facialMask }))} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------- wardrobe

const SLOTS: { slot: WearSlot; label: string }[] = [
    { slot: 'head', label: 'Head' },
    { slot: 'chest', label: 'Chest' },
    { slot: 'legs', label: 'Legs' },
    { slot: 'back', label: 'Back' },
];
const GROUP_PAGE = 48;

function ItemIcon({ bundle, item }: { bundle: BrowserBundle; item: WearItem }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || !item.icon) return;
        let stale = false;
        const io = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io.disconnect();
            const [image, frame] = item.icon!.split(':');
            bundle.frame(image, frame).then((px) => {
                if (px && !stale && ref.current) paint(ref.current, px);
            });
        }, { rootMargin: '150px' });
        io.observe(el);
        return () => {
            stale = true;
            io.disconnect();
        };
    }, [bundle, item]);
    return <canvas ref={ref} width={16} height={16} className={styles.itemIcon} aria-hidden />;
}

export function WardrobePanel({ bundle, race, recipe, set }: { bundle: BrowserBundle; race: Race; recipe: Recipe; set: SetRecipe }) {
    const [items, setItems] = useState<ItemsFile | null>(bundle.items);
    const [slot, setSlot] = useState<WearSlot>('chest');
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let stale = false;
        bundle.loadItems().then((loaded) => {
            if (!stale) setItems(loaded);
        });
        return () => {
            stale = true;
        };
    }, [bundle]);

    const modNames = useMemo(() => new Map(bundle.manifest.mods.map((m) => [m.id, m.name])), [bundle]);
    const groups = useMemo(() => {
        if (!items) return [];
        const q = query.trim().toLowerCase();
        const byMod = new Map<string, WearItem[]>();
        for (const item of items.items) {
            if (item.slot !== slot) continue;
            if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) continue;
            if (!byMod.has(item.mod)) byMod.set(item.mod, []);
            byMod.get(item.mod)!.push(item);
        }
        // The race's own mod first, then the base game, then the rest by size.
        const rank = (mod: string) => (mod === race.species.mod ? 0 : mod === 'vanilla' ? 1 : 2);
        return [...byMod.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].length - a[1].length);
    }, [items, slot, query, race.species.mod]);

    const worn = recipe.wear[slot];
    const wornItem = worn && items?.items.find((i) => i.id === worn.item && i.slot === slot);
    const wear = (item: WearItem | null) => set((r) => {
        const next = { ...r.wear };
        if (item) next[slot] = { item: item.id, option: 0 };
        else delete next[slot];
        return { ...r, wear: next, nude: false };
    });
    const starters = (() => {
        const g = race.species.genders[recipe.gender] ?? race.species.genders[0];
        const ids = slot === 'chest' ? g.shirt : slot === 'legs' ? g.pants : [];
        return ids.map((id) => items?.items.find((i) => i.id === id && i.slot === slot)).filter((i): i is WearItem => !!i);
    })();
    const row = (item: WearItem, index: number) => (
        <li key={`${item.id} ${index}`}>
            <button type='button' className={styles.item} aria-pressed={worn?.item === item.id} onClick={() => wear(item)} title={item.id}>
                <ItemIcon bundle={bundle} item={item} />
                <span>{item.name}</span>
            </button>
        </li>
    );

    return (
        <div className={styles.panelBody}>
            <div className={styles.tabs} role='tablist'>
                {SLOTS.map((s) => (
                    <button key={s.slot} type='button' role='tab' aria-selected={slot === s.slot} className={styles.tab} onClick={() => setSlot(s.slot)}>
                        {s.label}{recipe.wear[s.slot] ? ' ✓' : ''}
                    </button>
                ))}
            </div>
            {wornItem && worn && (
                <div className={styles.wornBox}>
                    <div className={styles.wornHead}>
                        <ItemIcon bundle={bundle} item={wornItem} />
                        <strong>{wornItem.name}</strong>
                        <button type='button' className={styles.small} onClick={() => wear(null)}>take off</button>
                    </div>
                    <Swatches label='Colour' options={items?.palettes[wornItem.colors] ?? []} value={worn.option}
                        onPick={(option) => set((r) => ({ ...r, wear: { ...r.wear, [slot]: { ...r.wear[slot]!, option } } }))} />
                </div>
            )}
            <input className={styles.search} type='search' placeholder={`Find ${slot} items`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label='Find clothing' />
            {!items && <p className={styles.empty}>Loading the wardrobe…</p>}
            {starters.length > 0 && !query && (
                <details className={styles.modGroup} open>
                    <summary>{race.name} starting outfits <span className={styles.count}>{starters.length}</span></summary>
                    <ul className={styles.itemList}>{starters.map(row)}</ul>
                </details>
            )}
            {groups.map(([mod, list]) => {
                const all = expanded[mod] || list.length <= GROUP_PAGE;
                return (
                    <details key={mod} className={styles.modGroup} open={!!query && groups.length < 6}>
                        <summary>{modNames.get(mod) ?? mod} <span className={styles.count}>{list.length}</span></summary>
                        <ul className={styles.itemList}>{(all ? list : list.slice(0, GROUP_PAGE)).map(row)}</ul>
                        {!all && <button type='button' className={styles.small} onClick={() => setExpanded((e) => ({ ...e, [mod]: true }))}>show all {list.length}</button>}
                    </details>
                );
            })}
            {items && groups.length === 0 && <p className={styles.empty}>Nothing matches.</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------- palette editor

type PaletteTarget = 'body' | 'hairColor' | WearSlot;
const TARGET_PARTS: Record<PaletteTarget, string[]> = {
    body: ['backArm', 'head', 'emote', 'body', 'frontArm', 'facialMask'],
    hairColor: ['hair', 'facialHair'],
    head: ['headwear'],
    chest: ['chest', 'backSleeve', 'frontSleeve'],
    legs: ['legs'],
    back: ['back'],
};

function getPick(recipe: Recipe, target: PaletteTarget): ColorPick | undefined {
    return target === 'body' || target === 'hairColor' ? recipe[target] : recipe.wear[target];
}

function withTweak(recipe: Recipe, target: PaletteTarget, tweak: Record<string, string> | undefined): Recipe {
    if (target === 'body' || target === 'hairColor') return { ...recipe, [target]: { ...recipe[target], tweak } };
    const worn = recipe.wear[target];
    return worn ? { ...recipe, wear: { ...recipe.wear, [target]: { ...worn, tweak } } } : recipe;
}

/**
 * Lists the colours a part is actually drawn in and lets each be replaced. The edits are a
 * colour swap applied after the part's chosen option, so they work the same for body, hair
 * and every clothing item, whatever directives the option itself uses.
 */
export function PalettePanel({ bundle, recipe, set }: { bundle: BrowserBundle; recipe: Recipe; set: SetRecipe }) {
    const targets = (['body', 'hairColor', 'head', 'chest', 'legs', 'back'] as PaletteTarget[]).filter((t) => getPick(recipe, t));
    const [target, setTarget] = useState<PaletteTarget>('body');
    const active = targets.includes(target) ? target : 'body';
    const tweak = getPick(recipe, active)?.tweak ?? {};
    const [colors, setColors] = useState<string[]>([]);
    const baseKey = JSON.stringify(withTweak(recipe, active, undefined));

    useEffect(() => {
        let stale = false;
        (async () => {
            const base: Recipe = JSON.parse(baseKey);
            const items = Object.keys(base.wear).length ? await bundle.loadItems() : undefined;
            const layers = buildLayers(speciesFor(bundle.manifest, base.species, base.exclude), base, items).filter((l) => TARGET_PARTS[active].includes(l.part));
            await bundle.preload(layers, base);
            const source = bundle.source(base);
            const counts = new Map<string, number>();
            for (const layer of layers) {
                const px = renderLayer(layer, source);
                if (px) distinctColors(px).forEach((c, i) => counts.set(c, (counts.get(c) ?? 0) + 1000 - i));
            }
            if (!stale) setColors([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c));
        })();
        return () => {
            stale = true;
        };
    }, [bundle, baseKey, active]);

    const change = (from: string, to: string | null) => set((r) => {
        const next = { ...(getPick(r, active)?.tweak ?? {}) };
        if (to === null || to === from) delete next[from];
        else next[from] = to;
        return withTweak(r, active, Object.keys(next).length ? next : undefined);
    });
    const label = (t: PaletteTarget) => (t === 'body' ? 'Body' : t === 'hairColor' ? 'Hair' : `${t[0].toUpperCase()}${t.slice(1)} item`);

    return (
        <div className={styles.panelBody}>
            <div className={styles.tabs} role='tablist'>
                {targets.map((t) => (
                    <button key={t} type='button' role='tab' aria-selected={active === t} className={styles.tab} onClick={() => setTarget(t)}>
                        {label(t)}{getPick(recipe, t)?.tweak ? ' ✎' : ''}
                    </button>
                ))}
            </div>
            <p className={styles.hint}>Every colour this part is drawn in. Change one and it is swapped wherever it appears.</p>
            <ul className={styles.paletteList}>
                {colors.map((from) => {
                    const to = tweak[from] ?? from;
                    const alpha = from.length === 8 ? from.slice(6) : '';
                    return (
                        <li key={from} className={styles.paletteRow}>
                            <span className={styles.chip} style={{ background: `#${from}` }} title={`#${from}`} />
                            <span className={styles.arrow}>to</span>
                            <input type='color' value={`#${to.slice(0, 6)}`} onChange={(e) => change(from, e.target.value.slice(1) + alpha)} aria-label={`Replace #${from}`} />
                            <input type='text' className={styles.hex} defaultValue={to.slice(0, 6)} key={to} maxLength={6} spellCheck={false}
                                onBlur={(e) => hexToRgba(e.target.value) && e.target.value.length === 6 && change(from, e.target.value.toLowerCase() + alpha)} aria-label={`Hex for #${from}`} />
                            {tweak[from] && <button type='button' className={styles.small} onClick={() => change(from, null)}>reset</button>}
                        </li>
                    );
                })}
            </ul>
            {Object.keys(tweak).length > 0 && (
                <button type='button' className={styles.small} onClick={() => set((r) => withTweak(r, active, undefined))}>reset all {label(active).toLowerCase()} colours</button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------- sprite sources

/**
 * Which mods' sprites this portrait uses, when several mods redraw the same species. A mod can
 * be left out, or put on top so its sprites win wherever it has one; the rest follow the
 * game's load order.
 */
export function SourcesPanel({ bundle, race, recipe, set }: { bundle: BrowserBundle; race: Race; recipe: Recipe; set: SetRecipe }) {
    const sources = useMemo(() => spriteSources(bundle.manifest, race.species), [bundle, race.species]);
    const names = useMemo(() => new Map(bundle.manifest.mods.map((m) => [m.id, m.name])), [bundle]);
    const prefer = recipe.prefer ?? [];
    const choose = (exclude: string[], onTop: string[]) => set((r) => {
        const choice = { exclude, prefer: onTop };
        // Dropping a mod can change the species itself (its styles, and which kinds it has).
        const sp = speciesFor(bundle.manifest, race.species.kind, exclude) ?? race.species;
        const g = sp.genders[r.gender] ?? sp.genders[0];
        const dir = `/humanoid/${sp.kind.toLowerCase()}/`;
        const has = (group: string, o: string) => o === '' || bundle.has(`${dir}${group}/${o}.png`.toLowerCase(), choice);
        // A style that is gone falls back to the first one still available.
        const keep = (group: string, value: string, list: string[], wanted: boolean) =>
            !wanted ? '' : value !== '' && list.includes(value) && has(group, value) ? value : list.find((o) => has(group, o)) ?? '';
        const next: Recipe = {
            ...r, exclude,
            hair: keep(g.hairGroup, r.hair, g.hair, true),
            facialHair: keep(g.facialHairGroup, r.facialHair, g.facialHair, !!sp.flags.headOptionAsFacialhair),
            facialMask: keep(g.facialMaskGroup, r.facialMask, g.facialMask, !!sp.flags.altOptionAsFacialMask),
        };
        if (onTop.length) next.prefer = onTop;
        else delete next.prefer;
        return next;
    });
    if (sources.length === 0)
        return <div className={styles.panelBody}><p className={styles.hint}>Only one mod draws the {race.name}, so there is nothing to choose between.</p></div>;
    const line = JSON.stringify({
        id: race.id, species: race.species.kind, name: race.name, descriptor: race.descriptor, category: race.category,
        ...(recipe.exclude.length ? { exclude: recipe.exclude } : {}), ...(prefer.length ? { prefer } : {}),
    });

    return (
        <div className={styles.panelBody}>
            <p className={styles.hint}>
                {sources.length}{' '}mods draw this species, listed in the game&apos;s load order: where two have the same sprite, the lower one wins.
                Untick a mod to leave it out, or put one on top so it wins instead. Each row previews the race with that mod on top.
            </p>
            <ul className={styles.sourceList}>
                {sources.map((s, i) => {
                    const used = !recipe.exclude.includes(s.mod);
                    const top = prefer.includes(s.mod);
                    return (
                        <li key={s.mod} className={styles.sourceRow}>
                            <label className={styles.check}>
                                <input type='checkbox' disabled={i === 0} checked={used}
                                    onChange={(e) => choose(e.target.checked ? recipe.exclude.filter((m) => m !== s.mod) : [...recipe.exclude, s.mod], prefer.filter((m) => m !== s.mod))} />
                                <span>{names.get(s.mod) ?? s.mod}</span>
                            </label>
                            <span className={styles.count}>{s.files} sprites</span>
                            <span className={styles.sourceThumbs}>
                                <Thumb bundle={bundle} recipe={{ ...recipe, exclude: [], prefer: [s.mod] }} view='head' size={72} />
                                <Thumb bundle={bundle} recipe={{ ...recipe, exclude: [], prefer: [s.mod] }} view='full' size={72} />
                                <button type='button' className={styles.small} aria-pressed={top} disabled={!used}
                                    onClick={() => choose(recipe.exclude, top ? prefer.filter((m) => m !== s.mod) : [s.mod, ...prefer])}>
                                    {top ? 'on top' : 'put on top'}
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <p className={styles.hint}>To keep this choice as a race, add this line to src/data/portrait/races.json:</p>
            <pre className={styles.code}>{line}</pre>
            <button type='button' className={styles.small} onClick={() => navigator.clipboard?.writeText(line)}>copy line</button>
        </div>
    );
}
