'use client';

import { useCallback, useEffect, useState } from 'react';
import { toPngBlob } from '@/lib/portrait/browserBundle';
import type { Pixels, Recipe } from '@/lib/portrait/types';
import styles from './portrait.module.scss';

// The member's kept portraits (ff-server's /portraits): save the one on the stage, reopen
// or delete an earlier one. Each is private to the member who saved it.

export interface SavedPortrait {
    id: number;
    name: string;
    race: string;
    updatedAt: string;
}

/** The saved portrait the stage was last saved to or opened from. */
export interface Kept {
    id: number;
    name: string;
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`/site/ff/portraits${path}`, {
            method,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error('The lore server is not answering');
    }
    if (res.status === 204) return undefined as T;
    const envelope = (await res.json().catch(() => null)) as { status: string; data?: T; message?: string } | null;
    if (!res.ok || envelope?.status !== 'success') throw new Error(envelope?.message ?? `Request failed (HTTP ${res.status})`);
    return envelope.data as T;
}

function dataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The portrait could not be read'));
        reader.readAsDataURL(blob);
    });
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function SavedPanel({ race, raceName, recipe, pixels, kept, setKept, onOpen }: {
    race: string;
    raceName: string;
    recipe: Recipe;
    pixels: Pixels | null;
    kept: Kept | null;
    setKept: (kept: Kept | null) => void;
    /** Puts a saved portrait on the stage; false (with its own note) if it cannot be shown here. */
    /** The recipe as saved, of any version: the creator upgrades it. */
    onOpen: (draft: { race: string; recipe: unknown }) => boolean;
}) {
    const [list, setList] = useState<SavedPortrait[] | null>(null);
    const [name, setName] = useState(kept?.name ?? '');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState<number | null>(null);

    const refresh = useCallback(() => call<SavedPortrait[]>('').then(setList, (e: Error) => setError(e.message)), []);
    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = async (work: () => Promise<string>) => {
        setBusy(true);
        setError('');
        setNote('');
        try {
            setNote(await work());
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'That did not work');
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };
    const image = async () => {
        const blob = pixels && (await toPngBlob(pixels, 1));
        if (!blob) throw new Error('There is no portrait to save yet');
        return dataUrl(blob);
    };
    const title = name.trim() || raceName;
    const saveNew = () => run(async () => {
        const made = await call<SavedPortrait>('', 'POST', { name: title, race, recipe, image: await image() });
        setKept({ id: made.id, name: made.name });
        setName(made.name);
        return `Saved as “${made.name}”.`;
    });
    const update = (target: Kept) => run(async () => {
        const made = await call<SavedPortrait>(`/${target.id}`, 'PUT', { name: title, race, recipe, image: await image() });
        setKept({ id: made.id, name: made.name });
        return `“${made.name}” updated.`;
    });
    const open = (item: SavedPortrait) => run(async () => {
        const full = await call<SavedPortrait & { recipe: unknown }>(`/${item.id}`);
        if (!onOpen({ race: full.race, recipe: full.recipe })) return '';
        setKept({ id: full.id, name: full.name });
        setName(full.name);
        return `“${full.name}” opened.`;
    });
    const remove = (item: SavedPortrait) => run(async () => {
        await call(`/${item.id}`, 'DELETE');
        if (kept?.id === item.id) setKept(null);
        return `“${item.name}” deleted.`;
    });

    return (
        <div className={styles.panelBody}>
            <div className={styles.field}>
                <h4 className={styles.fieldTitle}>Keep this portrait</h4>
                <input className={styles.search} type='text' maxLength={100} placeholder={`Name (${raceName})`} aria-label='Portrait name' value={name} onChange={(e) => setName(e.target.value)} />
                <div className={styles.row}>
                    {kept && (
                        <button type='button' className={styles.primary} disabled={busy} onClick={() => void update(kept)}>
                            Save over “{kept.name}”
                        </button>
                    )}
                    <button type='button' className={kept ? styles.toggle : styles.primary} disabled={busy} onClick={() => void saveNew()}>
                        Save as new
                    </button>
                </div>
                <p className={styles.hint}>Only you can see the portraits you save.</p>
                {note && <p className={styles.hint} role='status'>{note}</p>}
                {error && <p className={styles.error} role='alert'>{error}</p>}
            </div>
            <div className={styles.field}>
                <h4 className={styles.fieldTitle}>Saved <span className={styles.count}>{list?.length ?? ''}</span></h4>
                {list === null && !error && <p className={styles.empty}>Loading…</p>}
                {list?.length === 0 && <p className={styles.empty}>Nothing saved yet.</p>}
                <ul className={styles.savedList}>
                    {list?.map((item) => (
                        <li key={item.id} className={styles.savedItem} data-current={kept?.id === item.id || undefined}>
                            <button type='button' className={styles.savedOpen} disabled={busy} onClick={() => void open(item)} title='Open on the stage'>
                                {/* eslint-disable-next-line @next/next/no-img-element -- a 43px sprite from the API, not a page image */}
                                <img className={styles.savedThumb} src={`/site/ff/portraits/${item.id}/image.png?v=${encodeURIComponent(item.updatedAt)}`} alt='' width={64} height={64} />
                                <span>
                                    <strong>{item.name}</strong>
                                    <span className={styles.hint}> {item.race}, {when(item.updatedAt)}</span>
                                </span>
                            </button>
                            {confirming === item.id ? (
                                <>
                                    <button type='button' className={styles.small} disabled={busy} onClick={() => void remove(item)}>yes, delete</button>
                                    <button type='button' className={styles.small} onClick={() => setConfirming(null)}>keep</button>
                                </>
                            ) : (
                                <button type='button' className={styles.small} disabled={busy} onClick={() => setConfirming(item.id)}>delete</button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
