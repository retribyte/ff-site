'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import raceTable from '@/data/portrait/races.json';
import { BrowserBundle, paint, toPngBlob } from '@/lib/portrait/browserBundle';
import { defaultRecipe, EMOTES, randomRecipe } from '@/lib/portrait/humanoid';
import { raceSpecies, resolveRaces, type Race, type RaceDef } from '@/lib/portrait/races';
import type { Pixels, Recipe } from '@/lib/portrait/types';
import { BodyPanel, PalettePanel, RacePicker, SourcesPanel, WardrobePanel } from './panels';
import Thumb from './Thumb';
import styles from './portrait.module.scss';

const DRAFT_KEY = 'portraitDraft';
const TABS = ['body', 'wardrobe', 'colours', 'sources'] as const;
type Tab = (typeof TABS)[number];
const BACKDROPS = ['space', 'dark', 'light', 'checker'] as const;

interface Draft {
    race: string;
    recipe: Recipe;
}

export default function PortraitCreator() {
    const [bundle, setBundle] = useState<BrowserBundle | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [tab, setTab] = useState<Tab>('body');
    const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]>('space');
    const [pixels, setPixels] = useState<Pixels | null>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [pasting, setPasting] = useState(false);
    const [note, setNote] = useState('');

    const races = useMemo(() => (bundle ? resolveRaces(bundle.manifest, raceTable.races as RaceDef[]) : []), [bundle]);
    const picked = races.find((r) => r.id === draft?.race) ?? null;
    // The species follows the recipe's own choice of mods, which the Sources tab can change.
    const race = picked && bundle && draft ? { ...picked, species: raceSpecies(bundle.manifest, picked, draft.recipe.exclude) } : picked;

    // Load the bundle, then start from the draft left in this browser, else the first race.
    useEffect(() => {
        BrowserBundle.load().then((loaded) => {
            const list = resolveRaces(loaded.manifest, raceTable.races as RaceDef[]);
            let saved: Draft | null = null;
            try {
                saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
            } catch {
                saved = null;
            }
            const known = saved && saved.recipe?.v === 1 && list.some((r) => r.id === saved!.race && r.species.kind === saved!.recipe.species);
            setBundle(loaded);
            if (list.length) setDraft(known ? saved : { race: list[0].id, recipe: defaultRecipe(list[0].species, list[0]) });
        }, (e: Error) => setError(e.message));
    }, []);

    useEffect(() => {
        if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [draft]);

    const recipe = draft?.recipe ?? null;
    useEffect(() => {
        if (!bundle || !recipe) return;
        let stale = false;
        bundle.render(recipe).then(({ pixels: px }) => {
            if (stale) return;
            setPixels(px);
            if (canvas.current) paint(canvas.current, px);
        });
        return () => {
            stale = true;
        };
    }, [bundle, recipe]);

    const set = useCallback((update: (recipe: Recipe) => Recipe) => {
        setDraft((d) => (d ? { ...d, recipe: update(d.recipe) } : d));
    }, []);
    // The clothing toggle belongs to the session, not the race: it carries over to a new race
    // and through Randomize.
    const pickRace = (r: Race) => setDraft((d) => ({ race: r.id, recipe: { ...defaultRecipe(r.species, r), nude: d?.recipe.nude ?? false } }));

    if (error) return <main className={styles.page}><p className={styles.error}>{error}</p></main>;
    if (!bundle || !race || !recipe) return <main className={styles.page}><p className={styles.empty}>Loading sprites…</p></main>;

    const sp = race.species;
    const setGender = (gender: number) => set((r) => {
        const g = sp.genders[gender];
        return {
            ...r,
            gender,
            hair: g.hair.includes(r.hair) ? r.hair : g.hair[0] ?? '',
            facialHair: g.facialHair.includes(r.facialHair) ? r.facialHair : sp.flags.headOptionAsFacialhair ? g.facialHair[0] ?? '' : '',
            facialMask: g.facialMask.includes(r.facialMask) ? r.facialMask : sp.flags.altOptionAsFacialMask ? g.facialMask[0] ?? '' : '',
        };
    });
    const download = async (scale: number) => {
        if (!pixels) return;
        const blob = await toPngBlob(pixels, scale);
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${race.id}-portrait${scale > 1 ? `-${scale}x` : ''}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    // A recipe as text: the race plus every pick, worn item, colour edit and choice of mods, so
    // a portrait can be handed to someone else or kept in a note and reopened here.
    const copyRecipe = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(draft));
            setNote('Recipe copied.');
        } catch {
            setNote('Could not reach the clipboard.');
        }
    };
    const loadRecipe = (text: string) => {
        let parsed: Draft | null = null;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = null;
        }
        const r = parsed?.recipe;
        if (!r || r.v !== 1 || typeof r.species !== 'string' || !Array.isArray(r.exclude) || typeof r.wear !== 'object') return setNote('That is not a portrait recipe.');
        const kind = r.species.toLowerCase();
        const target = races.find((x) => x.id === parsed!.race && x.species.kind.toLowerCase() === kind) ?? races.find((x) => x.species.kind.toLowerCase() === kind);
        if (!target) return setNote(`This recipe is for "${r.species}", which is not in the sprites loaded here.`);
        const known = new Set(bundle.manifest.mods.map((m) => m.id));
        const missing = [...new Set(Object.values(r.wear).map((w) => w?.item).filter((id): id is string => !!id && !!bundle.items && !bundle.items.items.some((i) => i.id === id)))];
        setDraft({ race: target.id, recipe: { ...r, species: target.species.kind, prefer: r.prefer?.filter((m) => known.has(m)) } });
        setPasting(false);
        setNote(missing.length ? `Recipe loaded. Not in the sprites loaded here: ${missing.join(', ')}.` : 'Recipe loaded.');
    };
    // Poses that differ only in name are shown once.
    const poses = sp.personalities.map((p, i) => ({ i, key: JSON.stringify(p) })).filter((p, n, all) => all.findIndex((q) => q.key === p.key) === n);

    return (
        <main className={styles.page}>
            <RacePicker bundle={bundle} races={races} categories={raceTable.categories} current={race.id} onPick={pickRace} />

            <section className={styles.stage} aria-label='Portrait'>
                <header className={styles.stageHead}>
                    <h1 className={styles.title}>{race.name}</h1>
                    <span className='pixel-label'>{race.descriptor}</span>
                    {race.modName && <span className={styles.raceMod}>{race.modName}</span>}
                </header>
                <div className={styles.frame} data-backdrop={backdrop}>
                    <canvas ref={canvas} width={43} height={43} className={styles.portrait} aria-label={`${race.name} portrait`} />
                </div>
                <div className={styles.row}>
                    <button type='button' className={styles.primary} onClick={() => set((r) => ({ ...randomRecipe(sp, r), emote: r.emote, nude: r.nude }))}>Randomize</button>
                    {sp.genders.length > 1 && sp.genders.map((g, i) => (
                        <button key={g.name} type='button' className={styles.toggle} aria-pressed={recipe.gender === i} onClick={() => setGender(i)}>{g.name}</button>
                    ))}
                    <label className={styles.check}>
                        <input type='checkbox' checked={!recipe.nude} onChange={(e) => set((r) => ({ ...r, nude: !e.target.checked }))} /> clothing
                    </label>
                </div>
                <div className={styles.field}>
                    <h4 className={styles.fieldTitle}>{sp.labels[9] || 'Pose'} <span className={styles.count}>{poses.length}</span></h4>
                    <div className={styles.poses}>
                        {poses.map((p) => (
                            <button key={p.i} type='button' className={styles.styleCell} aria-pressed={sp.personalities[recipe.personality % sp.personalities.length] && JSON.stringify(sp.personalities[recipe.personality % sp.personalities.length]) === p.key} onClick={() => set((r) => ({ ...r, personality: p.i }))} aria-label={`Pose ${p.i + 1}`}>
                                <Thumb bundle={bundle} recipe={{ ...recipe, personality: p.i }} size={64} />
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.row}>
                    <label className={styles.inline}>
                        Expression
                        <select value={recipe.emote} onChange={(e) => set((r) => ({ ...r, emote: e.target.value }))}>
                            {EMOTES.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </label>
                    <label className={styles.inline}>
                        Backdrop
                        <select value={backdrop} onChange={(e) => setBackdrop(e.target.value as typeof backdrop)}>
                            {BACKDROPS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </label>
                </div>
                <div className={styles.row}>
                    <button type='button' className={styles.toggle} onClick={() => download(1)}>PNG 43 px</button>
                    <button type='button' className={styles.toggle} onClick={() => download(4)}>PNG 4x</button>
                    <button type='button' className={styles.toggle} onClick={() => download(8)}>PNG 8x</button>
                    <button type='button' className={styles.toggle} disabled title='The 14 by 14 avatar crop comes last'>Make avatar</button>
                </div>
                <div className={styles.row}>
                    <button type='button' className={styles.toggle} onClick={copyRecipe} title='Copy this portrait as text: race, every option and worn item, colour edits and which mods draw it'>Copy recipe</button>
                    <button type='button' className={styles.toggle} aria-pressed={pasting} onClick={() => { setPasting(!pasting); setNote(''); }}>Paste recipe</button>
                    {note && <span className={styles.hint} role='status'>{note}</span>}
                </div>
                {pasting && (
                    <input className={styles.search} type='text' autoFocus placeholder='Paste a copied recipe here' aria-label='Paste a recipe' value=''
                        onChange={(e) => e.target.value.trim() && loadRecipe(e.target.value)} />
                )}
            </section>

            <section className={styles.options} aria-label='Options'>
                <div className={styles.tabs} role='tablist'>
                    {TABS.map((t) => (
                        <button key={t} type='button' role='tab' aria-selected={tab === t} className={styles.tab} onClick={() => setTab(t)}>{t}</button>
                    ))}
                </div>
                {tab === 'body' && <BodyPanel bundle={bundle} race={race} recipe={recipe} set={set} />}
                {tab === 'wardrobe' && <WardrobePanel bundle={bundle} race={race} recipe={recipe} set={set} />}
                {tab === 'colours' && <PalettePanel bundle={bundle} recipe={recipe} set={set} />}
                {tab === 'sources' && <SourcesPanel bundle={bundle} race={race} recipe={recipe} set={set} />}
            </section>
        </main>
    );
}
