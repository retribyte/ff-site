'use client';

import { useEffect, useMemo, useState } from 'react';
import { BUNDLE_URL } from '@/lib/portrait/browserBundle';
import type { RaceDef, StyleLock } from '@/lib/portrait/races';
import type { ModFile } from '@/lib/portrait/types';
import type { PortraitMod, PortraitSettings } from '@/components/portrait/PortraitCreator';
import ModUploader from '@/components/portrait/ModUploader';
import { adminCall, formatWhen } from './adminApi';
import styles from './admin.module.scss';
import own from './portraitAdmin.module.scss';

// What the portrait creator offers, edited in place of the old races.json and curation.json.
// Mods change at once; the race list and the curation form are saved with their own button.

type Settings = PortraitSettings & { mods: PortraitMod[] };

/** The settings as the server has them now (after an upload added a mod). */
async function refreshSettings(): Promise<Settings> {
    const res = await fetch('/site/ff/portrait/settings');
    const envelope = (await res.json()) as { status: string; data?: Settings };
    if (!res.ok || envelope.status !== 'success' || !envelope.data) throw new Error('settings unavailable');
    return envelope.data;
}

const words = (text: string) => text.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean);
const message = (err: unknown) => (err instanceof Error ? err.message : 'That did not work');

export default function PortraitAdmin({ initial }: { initial: PortraitSettings }) {
    const [settings, setSettings] = useState<Settings>({ ...initial, mods: initial.mods ?? [] });
    // Species in the sprites the server has, to offer the ones the race list does not mention
    const [kinds, setKinds] = useState<{ kind: string; title: string }[]>([]);
    useEffect(() => {
        fetch(`${BUNDLE_URL}/mods.json`)
            .then((res) => (res.ok ? res.json() : { mods: [] }))
            .then((index: { mods: ModFile[] }) => {
                const found = new Map<string, string>();
                for (const mod of index.mods) for (const [kind, sp] of Object.entries(mod.species ?? {})) found.set(kind, (sp as { title?: string }).title || kind);
                setKinds([...found].map(([kind, title]) => ({ kind, title })).sort((a, b) => a.kind.localeCompare(b.kind)));
            })
            .catch(() => setKinds([]));
    }, [settings.mods]);

    return (
        <>
            <ModsPanel settings={settings} onSaved={setSettings} />
            <section className={styles.panel} aria-labelledby='portrait-upload'>
                <h2 id='portrait-upload' className={styles.panelTitle}>
                    Add mods
                </h2>
                <ModUploader
                    switchedOff={settings.mods.filter((m) => !m.enabled)}
                    onUploaded={() => void refreshSettings().then(setSettings, () => {})}
                />
            </section>
            <RacesPanel settings={settings} kinds={kinds} onSaved={setSettings} />
            <CurationPanel settings={settings} onSaved={setSettings} />
        </>
    );
}

interface PanelProps {
    settings: Settings;
    onSaved: (settings: Settings) => void;
}

// ----- mods

function ModsPanel({ settings, onSaved }: PanelProps) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState<string | null>(null);
    const [find, setFind] = useState('');
    const [limits, setLimits] = useState<Record<string, string>>({});

    const change = async (id: string, body: unknown, method: 'PATCH' | 'DELETE') => {
        setBusy(id);
        setError('');
        try {
            onSaved(await adminCall<Settings>(`portrait/mods/${encodeURIComponent(id)}`, body, method));
            setLimits((l) => Object.fromEntries(Object.entries(l).filter(([key]) => key !== id)));
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(null);
            setConfirming(null);
        }
    };
    const q = find.trim().toLowerCase();
    const shown = settings.mods.filter((m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    const off = settings.mods.filter((m) => !m.enabled).length;

    return (
        <section className={styles.panel} aria-labelledby='portrait-mods'>
            <h2 id='portrait-mods' className={styles.panelTitle}>
                Mods
            </h2>
            <p className={styles.help}>
                {settings.mods.filter((m) => m.present).length} mods have sprites on the server; {off} switched off. Switching a mod off hides its sprites and
                clothing from everyone at once and keeps its files. Deleting removes the files from the server: to get the mod back, it has to be uploaded again.
            </p>
            <input className={own.find} type='search' placeholder='Find a mod by name or id' aria-label='Find a mod' value={find} onChange={(e) => setFind(e.target.value)} />
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Mod</th>
                        <th>Id</th>
                        <th>State</th>
                        <th>Clothing only for</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {shown.map((mod) => {
                        const limit = limits[mod.id] ?? mod.itemsOnlyFor.join(', ');
                        const limitChanged = words(limit).join(',').toLowerCase() !== mod.itemsOnlyFor.join(',');
                        return (
                            <tr key={mod.id} data-off={!mod.enabled || undefined} className={own.modRow}>
                                <td>
                                    {mod.name}
                                    {mod.uploadedBy && mod.uploadedAt && <span className={own.dim}> · uploaded by {mod.uploadedBy}, {formatWhen(mod.uploadedAt)}</span>}
                                </td>
                                <td className={own.mono}>{mod.id}</td>
                                <td className={styles.nowrap}>
                                    {mod.enabled ? 'on' : <span className={styles.bad}>off</span>}
                                    {!mod.present && <span className={styles.tag}>no files</span>}
                                </td>
                                <td className={styles.nowrap}>
                                    <input
                                        className={own.cell}
                                        type='text'
                                        placeholder='any species'
                                        aria-label={`Species that may wear ${mod.name}'s clothing`}
                                        value={limit}
                                        onChange={(e) => setLimits((l) => ({ ...l, [mod.id]: e.target.value }))}
                                    />
                                    {limitChanged && (
                                        <button type='button' className={styles.ghost} disabled={busy !== null} onClick={() => void change(mod.id, { itemsOnlyFor: words(limit) }, 'PATCH')}>
                                            save
                                        </button>
                                    )}
                                </td>
                                <td className={styles.nowrap}>
                                    <span className={styles.actions}>
                                        <button type='button' className={styles.ghost} disabled={busy !== null} onClick={() => void change(mod.id, { enabled: !mod.enabled }, 'PATCH')}>
                                            {busy === mod.id ? '…' : mod.enabled ? 'switch off' : 'switch on'}
                                        </button>
                                        {confirming === mod.id ? (
                                            <>
                                                <button type='button' className={styles.go} disabled={busy !== null} onClick={() => void change(mod.id, undefined, 'DELETE')}>
                                                    {mod.present ? 'yes, delete its files' : 'yes, forget it'}
                                                </button>
                                                <button type='button' className={styles.ghost} onClick={() => setConfirming(null)}>
                                                    keep
                                                </button>
                                            </>
                                        ) : (
                                            <button type='button' className={styles.ghost} disabled={busy !== null} onClick={() => setConfirming(mod.id)}>
                                                {mod.present ? 'delete' : 'forget'}
                                            </button>
                                        )}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}

// ----- races

const LOCKS: (keyof StyleLock)[] = ['hair', 'facialHair', 'facialMask'];

/** A race entry without its empty fields, as the server stores it. */
function tidy(race: RaceDef): RaceDef {
    const out: RaceDef = { id: race.id.trim() };
    for (const key of ['species', 'name', 'descriptor', 'category'] as const) if (race[key]?.trim()) out[key] = race[key]!.trim();
    if (race.exclude?.length) out.exclude = race.exclude;
    if (race.prefer?.length) out.prefer = race.prefer;
    if (race.hidden) out.hidden = true;
    if (race.lock && Object.keys(race.lock).length) out.lock = race.lock;
    return out;
}

function RacesPanel({ settings, kinds, onSaved }: PanelProps & { kinds: { kind: string; title: string }[] }) {
    const [races, setRaces] = useState<RaceDef[]>(settings.races);
    const [open, setOpen] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [line, setLine] = useState('');
    const [find, setFind] = useState('');

    const dirty = JSON.stringify(races.map(tidy)) !== JSON.stringify(settings.races.map(tidy));
    const modName = useMemo(() => new Map(settings.mods.map((m) => [m.id, m.name])), [settings.mods]);
    const used = new Set(races.map((r) => (r.species ?? r.id).toLowerCase()));
    const unlisted = kinds.filter((k) => !used.has(k.kind.toLowerCase()));

    const edit = (i: number, patch: Partial<RaceDef>) => {
        setSaved(false);
        setRaces((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    };
    const move = (i: number, by: number) => {
        const to = i + by;
        if (to < 0 || to >= races.length) return;
        setSaved(false);
        setRaces((list) => {
            const next = [...list];
            [next[i], next[to]] = [next[to], next[i]];
            return next;
        });
        setOpen((o) => (o === i ? to : o === to ? i : o));
    };
    const add = (race: RaceDef) => {
        setSaved(false);
        // An entry with the same id is replaced where it stands
        const at = races.findIndex((r) => r.id === race.id);
        setRaces(at >= 0 ? races.map((r, n) => (n === at ? race : r)) : [...races, race]);
        setFind('');
        setOpen(at >= 0 ? at : races.length);
    };
    const addLine = () => {
        setError('');
        try {
            const parsed = JSON.parse(line.trim().replace(/,\s*$/, '')) as RaceDef;
            if (!parsed || typeof parsed.id !== 'string' || !parsed.id.trim()) throw new Error('no id');
            add(parsed);
            setLine('');
        } catch {
            setError('That is not a race line. Copy one from the creator’s Sources tab.');
        }
    };
    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const next = await adminCall<Settings>('portrait/races', { races: races.map(tidy) }, 'PUT');
            onSaved(next);
            setRaces(next.races);
            setSaved(true);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    const q = find.trim().toLowerCase();
    const matches = (r: RaceDef) => !q || [r.id, r.species, r.name, r.descriptor, r.category].some((v) => v?.toLowerCase().includes(q));

    return (
        <section className={styles.panel} aria-labelledby='portrait-races'>
            <h2 id='portrait-races' className={styles.panelTitle}>
                Races
            </h2>
            <p className={styles.help}>
                The creator lists races in this order within each category. A species with no entry here still appears, under “uncategorised”: to keep one out,
                add it and tick hidden. One species can be several races (Blazekid is Novakid with other sprites): give the second its own id and name the
                species.
            </p>
            <input className={own.find} type='search' placeholder='Find a race' aria-label='Find a race' value={find} onChange={(e) => setFind(e.target.value)} />
            <ol className={own.races}>
                {races.map((race, i) =>
                    matches(race) ? (
                        <li key={i} className={own.race} data-hidden={race.hidden || undefined}>
                            <div className={own.raceHead}>
                                <span className={own.order}>
                                    <button type='button' className={styles.ghost} aria-label={`Move ${race.id} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                                        ↑
                                    </button>
                                    <button type='button' className={styles.ghost} aria-label={`Move ${race.id} down`} disabled={i === races.length - 1} onClick={() => move(i, 1)}>
                                        ↓
                                    </button>
                                </span>
                                <button type='button' className={own.raceName} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                                    <strong>{race.name || race.id}</strong>
                                    {race.descriptor && <span className={own.dim}> {race.descriptor}</span>}
                                    {race.species && race.species !== race.id && <span className={own.dim}> · species {race.species}</span>}
                                </button>
                                <select className={styles.select} aria-label={`Category of ${race.id}`} value={race.category ?? ''} onChange={(e) => edit(i, { category: e.target.value })}>
                                    <option value=''>uncategorised</option>
                                    {[...new Set([...settings.categories, ...(race.category ? [race.category] : [])])].map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                                <label className={own.check}>
                                    <input type='checkbox' checked={!!race.hidden} onChange={(e) => edit(i, { hidden: e.target.checked })} /> hidden
                                </label>
                            </div>
                            {open === i && (
                                <div className={own.raceForm}>
                                    <Field label='Id' hint='Permanent; saved recipes name it'>
                                        <input className={own.input} type='text' value={race.id} onChange={(e) => edit(i, { id: e.target.value })} />
                                    </Field>
                                    <Field label='Species' hint='Starbound species; blank = same as id'>
                                        <input className={own.input} type='text' list='portrait-kinds' value={race.species ?? ''} onChange={(e) => edit(i, { species: e.target.value })} />
                                    </Field>
                                    <Field label='Name' hint='Final Frontier name; blank = the mod’s own'>
                                        <input className={own.input} type='text' value={race.name ?? ''} onChange={(e) => edit(i, { name: e.target.value })} />
                                    </Field>
                                    <Field label='Descriptor' hint='One word: Moth, Bird'>
                                        <input className={own.input} type='text' value={race.descriptor ?? ''} onChange={(e) => edit(i, { descriptor: e.target.value })} />
                                    </Field>
                                    <ModList label='Leaves out' hint='Mods whose sprites and species changes this race does not use' ids={race.exclude ?? []} modName={modName} onChange={(exclude) => edit(i, { exclude })} />
                                    <ModList label='Puts on top' hint='Mods whose sprites win, most preferred first' ids={race.prefer ?? []} modName={modName} onChange={(prefer) => edit(i, { prefer })} />
                                    {LOCKS.map((key) => (
                                        <Field key={key} label={`Fixed ${key}`} hint='Tick to take the choice away; blank value = none'>
                                            <span className={own.lock}>
                                                <input
                                                    type='checkbox'
                                                    aria-label={`Fix ${key}`}
                                                    checked={race.lock?.[key] !== undefined}
                                                    onChange={(e) => {
                                                        const lock = { ...race.lock };
                                                        if (e.target.checked) lock[key] = '';
                                                        else delete lock[key];
                                                        edit(i, { lock });
                                                    }}
                                                />
                                                {race.lock?.[key] !== undefined && (
                                                    <input className={own.input} type='text' placeholder='none' value={race.lock[key]} onChange={(e) => edit(i, { lock: { ...race.lock, [key]: e.target.value } })} />
                                                )}
                                            </span>
                                        </Field>
                                    ))}
                                    <div>
                                        <button
                                            type='button'
                                            className={styles.ghost}
                                            onClick={() => {
                                                setSaved(false);
                                                setRaces((list) => list.filter((_, n) => n !== i));
                                                setOpen(null);
                                            }}
                                        >
                                            remove this entry
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ) : null
                )}
            </ol>
            <datalist id='portrait-kinds'>
                {kinds.map((k) => (
                    <option key={k.kind} value={k.kind}>
                        {k.title}
                    </option>
                ))}
            </datalist>
            {unlisted.length > 0 && (
                <div>
                    <p className={styles.help}>In the sprites but not in this list (shown as uncategorised). Add one to name, place or hide it:</p>
                    <p className={own.chips}>
                        {unlisted.map((k) => (
                            <button key={k.kind} type='button' className={styles.ghost} onClick={() => add({ id: k.kind.toLowerCase().replace(/\s+/g, '_'), ...(/\s|[A-Z]/.test(k.kind) ? { species: k.kind } : {}) })}>
                                + {k.title}
                            </button>
                        ))}
                    </p>
                </div>
            )}
            <div className={own.addLine}>
                <input className={own.input} type='text' placeholder='Paste a race line copied from the creator’s Sources tab' aria-label='Race line' value={line} onChange={(e) => setLine(e.target.value)} />
                <button type='button' className={styles.ghost} disabled={!line.trim()} onClick={addLine}>
                    add
                </button>
                <button type='button' className={styles.ghost} onClick={() => add({ id: `race_${races.length + 1}` })}>
                    new blank race
                </button>
            </div>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            <div className={styles.actions}>
                <button type='button' className={styles.go} disabled={!dirty || busy} onClick={() => void save()}>
                    {busy ? 'saving…' : 'save races'}
                </button>
                <button type='button' className={styles.ghost} disabled={!dirty || busy} onClick={() => setRaces(settings.races)}>
                    undo changes
                </button>
                {dirty && <span className={styles.note}>Unsaved changes.</span>}
                {saved && !dirty && <span className={`${styles.note} ${styles.good}`}>Saved.</span>}
            </div>
        </section>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className={own.field}>
            <span className={own.fieldLabel}>{label}</span>
            {children}
            {hint && <span className={own.hint}>{hint}</span>}
        </label>
    );
}

function ModList({ label, hint, ids, modName, onChange }: { label: string; hint: string; ids: string[]; modName: Map<string, string>; onChange: (ids: string[]) => void }) {
    const [adding, setAdding] = useState('');
    return (
        <div className={own.field}>
            <span className={own.fieldLabel}>{label}</span>
            <span className={own.chips}>
                {ids.map((id) => (
                    <button key={id} type='button' className={styles.ghost} title='Remove' onClick={() => onChange(ids.filter((x) => x !== id))}>
                        {modName.get(id) ?? id} ✕
                    </button>
                ))}
                <select
                    className={styles.select}
                    aria-label={`${label}: add a mod`}
                    value={adding}
                    onChange={(e) => {
                        if (e.target.value) onChange([...ids, e.target.value]);
                        setAdding('');
                    }}
                >
                    <option value=''>add a mod…</option>
                    {[...modName].filter(([id]) => !ids.includes(id)).map(([id, name]) => (
                        <option key={id} value={id}>
                            {name}
                        </option>
                    ))}
                </select>
            </span>
            <span className={own.hint}>{hint}</span>
        </div>
    );
}

// ----- categories, hidden clothing, pixel repairs

const eraseText = (erase: Record<string, number[][]>) => Object.entries(erase).map(([key, points]) => `${key} = ${points.map((p) => p.join(',')).join(' ')}`).join('\n');

function parseErase(text: string): Record<string, number[][]> {
    const out: Record<string, number[][]> = {};
    for (const raw of text.split('\n')) {
        const row = raw.trim();
        if (!row) continue;
        const at = row.lastIndexOf('=');
        const key = at > 0 ? row.slice(0, at).trim() : '';
        const points = at > 0 ? row.slice(at + 1).trim().split(/\s+/).filter(Boolean).map((p) => p.split(',').map(Number)) : [];
        if (!key || !points.length || points.some((p) => p.length !== 2 || p.some((n) => !Number.isInteger(n) || n < 0))) throw new Error(`Pixel repairs: “${row}” should read  <mod id><image path> = x,y x,y`);
        out[key] = points;
    }
    return out;
}

function CurationPanel({ settings, onSaved }: PanelProps) {
    const from = (s: Settings) => ({
        categories: s.categories.join(', '),
        hideItemPattern: s.curation.hideItemPattern,
        hideItems: s.curation.hideItems.join('\n'),
        erase: eraseText(s.curation.erase),
    });
    const [form, setForm] = useState(() => from(settings));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const dirty = JSON.stringify(form) !== JSON.stringify(from(settings));
    const set = (patch: Partial<typeof form>) => {
        setSaved(false);
        setForm((f) => ({ ...f, ...patch }));
    };
    const inUse = [...new Set(settings.races.map((r) => r.category).filter((c): c is string => !!c))];
    const listed = form.categories.split(',').map((c) => c.trim());
    const orphaned = inUse.filter((c) => !listed.includes(c));

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const body = {
                categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
                hideItemPattern: form.hideItemPattern.trim(),
                hideItems: [...new Set(words(form.hideItems))],
                erase: parseErase(form.erase),
            };
            const next = await adminCall<Settings>('portrait/curation', body, 'PATCH');
            onSaved(next);
            setForm(from(next));
            setSaved(true);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={styles.panel} aria-labelledby='portrait-curation'>
            <h2 id='portrait-curation' className={styles.panelTitle}>
                Categories, hidden clothing, pixel repairs
            </h2>
            <Field label='Categories' hint='The race picker’s tabs, in order, separated by commas'>
                <input className={own.input} type='text' value={form.categories} onChange={(e) => set({ categories: e.target.value })} />
            </Field>
            {orphaned.length > 0 && <p className={`${styles.note} ${styles.bad}`}>Races still use: {orphaned.join(', ')}. They keep showing under that name, after the tabs listed.</p>}
            <Field label='Hide clothing matching' hint='A pattern tested against each item’s id and name, ignoring case (invisi|inviso). Blank hides nothing.'>
                <input className={`${own.input} ${own.mono}`} type='text' value={form.hideItemPattern} onChange={(e) => set({ hideItemPattern: e.target.value })} />
            </Field>
            <Field label={`Hidden items (${words(form.hideItems).length})`} hint='Item ids, one per line: clothing that draws nothing or should not be offered'>
                <textarea className={`${own.input} ${own.mono}`} rows={8} value={form.hideItems} onChange={(e) => set({ hideItems: e.target.value })} />
            </Field>
            <Field label='Pixel repairs' hint='Stray pixels to clear from a sprite sheet, one sheet per line:  <mod id><image path> = x,y x,y'>
                <textarea className={`${own.input} ${own.mono}`} rows={3} value={form.erase} onChange={(e) => set({ erase: e.target.value })} />
            </Field>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            <div className={styles.actions}>
                <button type='button' className={styles.go} disabled={!dirty || busy} onClick={() => void save()}>
                    {busy ? 'saving…' : 'save'}
                </button>
                <button type='button' className={styles.ghost} disabled={!dirty || busy} onClick={() => setForm(from(settings))}>
                    undo changes
                </button>
                {dirty && <span className={styles.note}>Unsaved changes.</span>}
                {saved && !dirty && <span className={`${styles.note} ${styles.good}`}>Saved.</span>}
            </div>
        </section>
    );
}
