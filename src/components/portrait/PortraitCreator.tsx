'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import raceTable from '@/data/portrait/races.json';
import { BrowserBundle, paint, toPngBlob } from '@/lib/portrait/browserBundle';
import { defaultRecipe, EMOTES, randomRecipe } from '@/lib/portrait/humanoid';
import { resolveRaces, type Race, type RaceDef } from '@/lib/portrait/races';
import { speciesFor } from '@/lib/portrait/species';
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

    const races = useMemo(() => (bundle ? resolveRaces(bundle.manifest, raceTable.races as RaceDef[]) : []), [bundle]);
    const picked = races.find((r) => r.id === draft?.race) ?? null;
    // The species follows the recipe's own choice of mods, which the Sources tab can change.
    const race = picked && bundle && draft ? { ...picked, species: speciesFor(bundle.manifest, picked.species.kind, draft.recipe.exclude) ?? picked.species } : picked;

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
    const pickRace = (r: Race) => setDraft({ race: r.id, recipe: defaultRecipe(r.species, r) });

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
                    <button type='button' className={styles.primary} onClick={() => set((r) => ({ ...randomRecipe(sp, r), emote: r.emote }))}>Randomise</button>
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
