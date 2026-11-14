'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUNDLE_URL } from '@/lib/portrait/browserBundle';
import { findBasePak, openChosenMods, packFolder, uploadFolder } from '@/lib/portrait/extract/browser';
import { Extraction, type ModOut } from '@/lib/portrait/extract/extract';
import { AssetStore, PakSource } from '@/lib/portrait/extract/sources';
import type { ModFile, ModItemsFile } from '@/lib/portrait/types';
import type { PortraitMod } from './PortraitCreator';
import styles from './modUploader.module.scss';

// Adds mods to the portrait creator from the member's own copy of Starbound. Their files are
// read here, in the browser; what is uploaded is only the sprites and item lists of the mods
// they tick, and a mod is in the creator for everyone as soon as its upload finishes.
// Used on /portraits/mods and on the admin page.

type Os = 'windows' | 'linux' | 'mac';
const STEAM: Record<Os, { label: string; root: string; sep: string }> = {
    windows: { label: 'Windows', root: 'C:\\Program Files (x86)\\Steam\\steamapps', sep: '\\' },
    linux: { label: 'Linux', root: '~/.local/share/Steam/steamapps', sep: '/' },
    mac: { label: 'macOS', root: '~/Library/Application Support/Steam/steamapps', sep: '/' },
};
const steamPath = (os: Os, ...parts: string[]) => [STEAM[os].root, ...parts].join(STEAM[os].sep);

/** What the server has of a mod, to tell a new mod from one already there. */
interface ServerMod {
    sprites: number;
    bytes: number;
    items: number;
    species: number;
    /** The mod's own name for itself, to spot the same mod under another folder name. */
    modName?: string;
}

/** `twin`: the site has this mod under another id (a hand-installed copy beside the workshop one). */
type Status = 'new' | 'same' | 'differs' | 'twin';

interface Row {
    mod: ModOut;
    sprites: number;
    bytes: number;
    status: Status;
}

const megabytes = (bytes: number) => (bytes < 100_000 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1e6).toFixed(1)} MB`);
/** Lets the page repaint while a long job runs. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve));

async function serverMods(): Promise<Map<string, ServerMod>> {
    const out = new Map<string, ServerMod>();
    const get = async <T,>(file: string): Promise<T[]> => {
        const res = await fetch(`${BUNDLE_URL}/${file}`, { cache: 'no-cache' });
        return res.ok ? ((await res.json()) as { mods: T[] }).mods : [];
    };
    const [mods, items] = await Promise.all([get<ModFile>('mods.json'), get<ModItemsFile>('items.json')]);
    const count = (images: ModFile['images']) => ({ sprites: Object.keys(images).length, bytes: Object.values(images).reduce((sum, ref) => sum + ref[1], 0) });
    for (const mod of mods) out.set(mod.id, { ...count(mod.images), items: 0, species: Object.keys(mod.species).length, modName: mod.modName });
    for (const file of items) {
        const known = out.get(file.id);
        if (!known) continue;
        const more = count(file.images);
        out.set(file.id, { ...known, sprites: known.sprites + more.sprites, bytes: known.bytes + more.bytes, items: file.items.length });
    }
    return out;
}

function statusOf(mod: ModOut, sprites: number, bytes: number, server: Map<string, ServerMod>): Status {
    const there = server.get(mod.id);
    if (!there) return [...server.values()].some((other) => other.modName !== undefined && other.modName === mod.src.name) ? 'twin' : 'new';
    return there.sprites === sprites && there.bytes === bytes && there.items === mod.items.length && there.species === Object.keys(mod.species).length ? 'same' : 'differs';
}

export default function ModUploader({ switchedOff = [], onUploaded }: {
    /** Mods an admin has switched off: they are left out of the reading altogether. */
    switchedOff?: Pick<PortraitMod, 'id' | 'name'>[];
    onUploaded?: () => void;
}) {
    const [os, setOs] = useState<Os>('windows');
    const [base, setBase] = useState<File | null>(null);
    const [chosen, setChosen] = useState<File[]>([]);
    const [reading, setReading] = useState('');
    const [extraction, setExtraction] = useState<Extraction | null>(null);
    const [server, setServer] = useState<Map<string, ServerMod>>(new Map());
    const [ticked, setTicked] = useState<Set<string>>(new Set());
    const [warnings, setWarnings] = useState<string[]>([]);
    const [skipped, setSkipped] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [sending, setSending] = useState<{ id: string; sent: number; total: number } | null>(null);
    const [results, setResults] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState('');
    const folderInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const agent = navigator.userAgent;
        setOs(/Mac/i.test(agent) ? 'mac' : /Linux|X11/i.test(agent) && !/Android/i.test(agent) ? 'linux' : 'windows');
    }, []);
    // React has no prop for it: lets the second picker take a whole folder
    useEffect(() => {
        folderInput.current?.setAttribute('webkitdirectory', '');
    }, []);

    const addFiles = (list: FileList | null) => {
        const files = [...(list ?? [])];
        if (!files.length) return;
        const found = findBasePak(files);
        if (found) setBase(found);
        setChosen((before) => [...before, ...files.filter((f) => f !== found)]);
        setExtraction(null);
        setError('');
    };
    const modCount = useMemo(() => new Set(chosen.filter((f) => f.name.toLowerCase().endsWith('.pak') || /^[_.]metadata$/i.test(f.name)).map((f) => f.webkitRelativePath || f.name)).size, [chosen]);

    const read = async () => {
        if (!base) return;
        setError('');
        setResults({});
        setExtraction(null);
        const notes: string[] = [];
        try {
            setReading('Opening the base game…');
            await breathe();
            const store = new AssetStore((message) => notes.push(message));
            const vanilla = await PakSource.open('packed.pak', base);
            setReading('Opening the mods…');
            await breathe();
            const mods = await openChosenMods(chosen, (message) => notes.push(message));
            // What an admin switched off stays out, as if it were not installed
            const off = (id: string) => switchedOff.find((s) => id === s.id || id.startsWith(`${s.id}-`));
            const kept = mods.filter((m) => !(m.id && off(m.id)));
            setSkipped(mods.filter((m) => m.id && off(m.id)).map((m) => m.source.title));
            store.load(vanilla, kept.map((m) => ({ source: m.source, id: m.id })));
            let last = 0;
            const done = await Extraction.run(store, async (p) => {
                if (Date.now() - last < 120) return;
                last = Date.now();
                setReading(p.stage === 'species' ? `Reading species… ${p.done} of ${p.total}` : `Reading clothing… ${p.done} of ${p.total}`);
                await breathe();
            });
            const there = await serverMods();
            setServer(there);
            setExtraction(done);
            setTicked(new Set(done.offered().filter((mod) => statusOf(mod, mod.images().length, mod.packBytes(), there) === 'new').map((mod) => mod.id)));
            setWarnings(notes);
        } catch (e) {
            setError(e instanceof Error ? `Those files could not be read: ${e.message}` : 'Those files could not be read');
        } finally {
            setReading('');
        }
    };

    const rows: Row[] = useMemo(() => {
        if (!extraction) return [];
        // What the site lacks first, then copies that differ, then the rest; load order within each
        const rank: Record<Status, number> = { new: 0, differs: 1, twin: 2, same: 3 };
        return extraction
            .offered()
            .map((mod) => {
                const sprites = mod.images().length;
                const bytes = mod.packBytes();
                return { mod, sprites, bytes, status: statusOf(mod, sprites, bytes, server) };
            })
            .map((row, i) => ({ row, i }))
            .sort((a, b) => rank[a.row.status] - rank[b.row.status] || a.i - b.i)
            .map(({ row }) => row);
    }, [extraction, server]);
    const picked = rows.filter((r) => ticked.has(r.mod.id));
    const pickedBytes = picked.reduce((sum, r) => sum + r.bytes, 0);

    const upload = useCallback(async () => {
        if (!extraction) return;
        setError('');
        let sentAny = false;
        for (const row of picked) {
            const id = row.mod.id;
            try {
                setSending({ id, sent: 0, total: row.bytes });
                await breathe();
                const folder = packFolder(await extraction.build(row.mod));
                await uploadFolder(id, folder, (sent, total) => setSending({ id, sent, total }));
                setResults((r) => ({ ...r, [id]: 'uploaded' }));
                setTicked((t) => new Set([...t].filter((x) => x !== id)));
                sentAny = true;
            } catch (e) {
                setResults((r) => ({ ...r, [id]: e instanceof Error ? e.message : 'failed' }));
            }
        }
        setSending(null);
        if (sentAny) {
            setServer(await serverMods().catch(() => server));
            onUploaded?.();
        }
    }, [extraction, picked, server, onUploaded]);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(text);
        } catch {
            setCopied('');
        }
    };
    const PathLine = ({ path }: { path: string }) => (
        <span className={styles.path}>
            <code>{path}</code>
            <button type='button' className={styles.small} onClick={() => void copy(path)}>{copied === path ? 'copied' : 'copy'}</button>
        </span>
    );
    const toggle = (id: string) => setTicked((t) => (t.has(id) ? new Set([...t].filter((x) => x !== id)) : new Set([...t, id])));
    const busy = reading !== '' || sending !== null;

    return (
        <div className={styles.uploader}>
            <p className={styles.help}>
                This reads Starbound’s files on your computer, here in the browser, and uploads only the sprites and clothing lists of the mods you tick. A mod is in
                the creator for everyone as soon as its upload finishes. You need a computer with Starbound installed.
            </p>
            <p className={styles.help}>
                The file window cannot be opened at a folder for you, so each step shows where to look: copy the path and paste it into the file window’s address bar.
                These are Steam’s usual places on{' '}
                <select className={styles.os} aria-label='Operating system' value={os} onChange={(e) => setOs(e.target.value as Os)}>
                    {(Object.keys(STEAM) as Os[]).map((key) => <option key={key} value={key}>{STEAM[key].label}</option>)}
                </select>
                ; yours differ if Steam or the game is on another drive.
            </p>

            <ol className={styles.steps}>
                <li>
                    <strong>The base game’s file, packed.pak.</strong> A mod cannot be read without it: it says how every sprite sheet is cut into frames, and holds
                    the species and clothing that mods change. It is not uploaded unless you tick it below.
                    <PathLine path={steamPath(os, 'common', 'Starbound', 'assets')} />
                    <label className={styles.pick}>
                        <input type='file' accept='.pak' disabled={busy} onChange={(e) => addFiles(e.target.files)} />
                        {base && <span className={styles.good}>✓ {base.name} ({megabytes(base.size)})</span>}
                    </label>
                </li>
                <li>
                    <strong>Your mods.</strong> Choose the workshop folder to take every mod you are subscribed to (your browser will ask to confirm; nothing is
                    uploaded yet), or pick .pak files one by one. Pick as often as you like.
                    <PathLine path={steamPath(os, 'workshop', 'content', '211820')} />
                    <span className={styles.pickRow}>
                        <label className={styles.pick}>
                            a folder <input ref={folderInput} type='file' multiple disabled={busy} onChange={(e) => addFiles(e.target.files)} />
                        </label>
                        <label className={styles.pick}>
                            .pak files <input type='file' accept='.pak' multiple disabled={busy} onChange={(e) => addFiles(e.target.files)} />
                        </label>
                    </span>
                    {chosen.length > 0 && (
                        <span className={styles.good}>
                            ✓ {modCount} mod{modCount === 1 ? '' : 's'} found in {chosen.length} file{chosen.length === 1 ? '' : 's'}{' '}
                            <button type='button' className={styles.small} disabled={busy} onClick={() => { setChosen([]); setExtraction(null); }}>clear</button>
                        </span>
                    )}
                </li>
                <li>
                    <button type='button' className={styles.go} disabled={!base || busy} onClick={() => void read()}>
                        {reading ? 'reading…' : extraction ? 'Read again' : 'Read my files'}
                    </button>
                    {!base && <span className={styles.hint}> Choose packed.pak first.</span>}
                    {reading && <span className={styles.hint} role='status'> {reading}</span>}
                </li>
            </ol>

            {error && <p className={styles.error} role='alert'>✖ {error}</p>}

            {extraction && (
                <>
                    <p className={styles.help}>
                        {rows.length} of your mods have something for the creator ({extraction.species} species, {extraction.itemCount} pieces of clothing). Ticked:
                        the ones the site does not have yet.
                        {skipped.length > 0 && <> Left out because an admin switched them off: {skipped.join(', ')}.</>}
                    </p>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th></th>
                                <th>Mod</th>
                                <th>Holds</th>
                                <th>Size</th>
                                <th>On the site</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ mod, sprites, bytes, status }) => {
                                const species = Object.keys(mod.species).length;
                                const result = results[mod.id];
                                const going = sending?.id === mod.id ? sending : null;
                                return (
                                    <tr key={mod.id} data-status={status}>
                                        <td>
                                            <input type='checkbox' aria-label={`Upload ${mod.name}`} checked={ticked.has(mod.id)} disabled={busy} onChange={() => toggle(mod.id)} />
                                        </td>
                                        <td>
                                            {mod.name} <span className={styles.id}>{mod.id}</span>
                                        </td>
                                        <td>{[species && `${species} species`, mod.items.length && `${mod.items.length} clothing`, `${sprites} sprites`].filter(Boolean).join(', ')}</td>
                                        <td className={styles.nowrap}>{megabytes(bytes)}</td>
                                        <td className={styles.nowrap}>
                                            {going ? (
                                                <progress max={going.total} value={going.sent} aria-label={`Uploading ${mod.name}`} />
                                            ) : result === 'uploaded' ? (
                                                <span className={styles.good}>✓ uploaded</span>
                                            ) : result ? (
                                                <span className={styles.bad}>✖ {result}</span>
                                            ) : status === 'new' ? (
                                                <span className={styles.new}>not yet</span>
                                            ) : status === 'twin' ? (
                                                <span title='The site has this mod from a copy installed by hand, under another id. Uploading yours adds a second copy beside it.'>there, as another copy</span>
                                            ) : status === 'same' ? (
                                                'already there'
                                            ) : (
                                                <span title='The site’s copy was made from a different version of this mod, or beside different mods. Tick it to replace the site’s copy with yours.'>a different copy</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className={styles.actions}>
                        <button type='button' className={styles.go} disabled={!picked.length || busy} onClick={() => void upload()}>
                            {sending ? 'uploading…' : `Upload ${picked.length} mod${picked.length === 1 ? '' : 's'} (${megabytes(pickedBytes)})`}
                        </button>
                        <button type='button' className={styles.small} disabled={busy} onClick={() => setTicked(new Set(rows.filter((r) => r.status === 'new').map((r) => r.mod.id)))}>tick the new ones</button>
                        <button type='button' className={styles.small} disabled={busy} onClick={() => setTicked(new Set())}>untick all</button>
                    </div>
                    {warnings.length > 0 && (
                        <details className={styles.warnings}>
                            <summary>{warnings.length} note{warnings.length === 1 ? '' : 's'} from reading the files</summary>
                            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
