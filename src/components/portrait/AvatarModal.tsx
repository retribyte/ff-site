'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { paint, toPngBlob } from '@/lib/portrait/browserBundle';
import { AVATAR_SIDE, clampBox, cropAvatar, defaultBox, pixelKey, type Box } from '@/lib/portrait/avatar';
import type { Pixels } from '@/lib/portrait/types';
import styles from './portrait.module.scss';

// The 14x14 avatar cut from the portrait on the stage: move the square, erase the stray
// pixels (a shoulder, a pauldron), then download it or put it on a character.

const SOURCE_SCALE = 8;
const CROP_SCALE = 16;

interface CharacterOption {
    id: number;
    name: string;
}

function dataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The avatar could not be read'));
        reader.readAsDataURL(blob);
    });
}

export default function AvatarModal({ pixels, name, user, onClose }: {
    pixels: Pixels;
    /** For the downloaded file's name. */
    name: string;
    user: { id: number; role: string };
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const source = useRef<HTMLCanvasElement>(null);
    const crop = useRef<HTMLCanvasElement>(null);
    const [box, setBox] = useState<Box>(() => defaultBox(pixels));
    // Erased pixels, in the portrait's own coordinates, so moving the square keeps them
    const [erased, setErased] = useState<ReadonlySet<string>>(new Set());
    const [tool, setTool] = useState<'erase' | 'restore'>('erase');
    const [characters, setCharacters] = useState<CharacterOption[] | null>(null);
    const [target, setTarget] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const drag = useRef<'box' | 'paint' | null>(null);

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    // Characters this member may change: their own, or all of them for an admin
    useEffect(() => {
        const query = user.role === 'ADMIN' ? 'lite=true' : `lite=true&ownerId=${user.id}`;
        fetch(`/site/ff/characters?${query}`)
            .then((res) => res.json())
            .then((envelope: { data?: CharacterOption[] }) => setCharacters([...(envelope.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))))
            .catch(() => setCharacters([]));
    }, [user]);

    const cut = useMemo(() => cropAvatar(pixels, box, erased), [pixels, box, erased]);

    useEffect(() => {
        if (source.current) paint(source.current, pixels);
        if (crop.current) paint(crop.current, cut);
    }, [pixels, cut]);

    // Pointer position as a pixel of the canvas under it
    const pixelAt = (event: React.PointerEvent<HTMLCanvasElement>, scaleTo: number) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: Math.floor(((event.clientX - rect.left) / rect.width) * scaleTo), y: Math.floor(((event.clientY - rect.top) / rect.height) * scaleTo) };
    };
    const moveBox = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * pixels.width;
        const y = ((event.clientY - rect.top) / rect.height) * pixels.height;
        setBox(clampBox(pixels, { x: x - AVATAR_SIDE / 2, y: y - AVATAR_SIDE / 2 }));
    };
    const paintAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const at = pixelAt(event, AVATAR_SIDE);
        if (at.x < 0 || at.y < 0 || at.x >= AVATAR_SIDE || at.y >= AVATAR_SIDE) return;
        const key = pixelKey(box.x + at.x, box.y + at.y);
        setErased((set) => {
            if ((tool === 'erase') === set.has(key)) return set;
            const next = new Set(set);
            if (tool === 'erase') next.add(key);
            else next.delete(key);
            return next;
        });
    };
    const nudge = (event: React.KeyboardEvent) => {
        const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!step) return;
        event.preventDefault();
        setBox((b) => clampBox(pixels, { x: b.x + step[0], y: b.y + step[1] }));
    };

    const erasedHere = [...erased].filter((key) => {
        const [x, y] = key.split(',').map(Number);
        return x >= box.x && y >= box.y && x < box.x + AVATAR_SIDE && y < box.y + AVATAR_SIDE;
    }).length;
    const empty = !cut.data.some((value, i) => i % 4 === 3 && value > 0);

    const download = async () => {
        const blob = await toPngBlob(cut, 1);
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}-avatar.png`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const apply = async () => {
        const character = characters?.find((c) => String(c.id) === target);
        if (!character) return;
        setBusy(true);
        setError('');
        setNote('');
        try {
            const blob = await toPngBlob(cut, 1);
            if (!blob) throw new Error('The avatar could not be drawn');
            const res = await fetch(`/site/ff/characters/${character.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: await dataUrl(blob) }) });
            const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string } | null;
            if (!res.ok || envelope?.status !== 'success') throw new Error(envelope?.message ?? `Request failed (HTTP ${res.status})`);
            setNote(`${character.name} now wears this avatar.`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'That did not work');
        } finally {
            setBusy(false);
        }
    };

    return (
        <dialog ref={dialog} className={`pixel-panel ${styles.avatarModal}`} onClose={onClose} aria-labelledby='avatar-heading'>
            <header className={styles.avatarHead}>
                <h2 className='pixel-label' id='avatar-heading'>make a 14 by 14 avatar</h2>
                <button type='button' className={styles.small} onClick={() => dialog.current?.close()}>close</button>
            </header>
            <div className={styles.avatarBody}>
                <div className={styles.avatarPane}>
                    <h4 className={styles.fieldTitle}>1. Place the square</h4>
                    <div className={styles.avatarSource} style={{ width: pixels.width * SOURCE_SCALE, height: pixels.height * SOURCE_SCALE }} tabIndex={0} onKeyDown={nudge} role='application' aria-label='Portrait: drag or use the arrow keys to move the square'>
                        <canvas
                            ref={source}
                            className={styles.avatarCanvas}
                            onPointerDown={(e) => { drag.current = 'box'; e.currentTarget.setPointerCapture(e.pointerId); moveBox(e); }}
                            onPointerMove={(e) => drag.current === 'box' && moveBox(e)}
                            onPointerUp={() => { drag.current = null; }}
                        />
                        <span className={styles.avatarBox} style={{ left: box.x * SOURCE_SCALE, top: box.y * SOURCE_SCALE, width: AVATAR_SIDE * SOURCE_SCALE, height: AVATAR_SIDE * SOURCE_SCALE }} />
                    </div>
                    <p className={styles.hint}>Drag, or click the picture and use the arrow keys.</p>
                </div>
                <div className={styles.avatarPane}>
                    <h4 className={styles.fieldTitle}>2. Erase what does not belong</h4>
                    <canvas
                        ref={crop}
                        className={`${styles.avatarCanvas} ${styles.avatarCrop}`}
                        style={{ width: AVATAR_SIDE * CROP_SCALE, height: AVATAR_SIDE * CROP_SCALE }}
                        aria-label='The avatar: click or drag over pixels to erase them'
                        onPointerDown={(e) => { drag.current = 'paint'; e.currentTarget.setPointerCapture(e.pointerId); paintAt(e); }}
                        onPointerMove={(e) => drag.current === 'paint' && paintAt(e)}
                        onPointerUp={() => { drag.current = null; }}
                    />
                    <div className={styles.row}>
                        <button type='button' className={styles.toggle} aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>eraser</button>
                        <button type='button' className={styles.toggle} aria-pressed={tool === 'restore'} onClick={() => setTool('restore')}>put back</button>
                        <button type='button' className={styles.small} disabled={!erased.size} onClick={() => setErased(new Set())}>undo all{erasedHere ? ` (${erasedHere})` : ''}</button>
                    </div>
                    <div className={styles.avatarSizes} aria-label='At actual size, as the site shows it'>
                        <AvatarPreview cut={cut} size={14} />
                        <AvatarPreview cut={cut} size={28} />
                        <AvatarPreview cut={cut} size={56} />
                    </div>
                </div>
            </div>
            <footer className={styles.avatarFoot}>
                <button type='button' className={styles.toggle} disabled={empty} onClick={() => void download()}>Download PNG</button>
                <span className={styles.avatarApply}>
                    <select className={styles.select} aria-label='Character to give this avatar' value={target} onChange={(e) => { setTarget(e.target.value); setNote(''); }} disabled={!characters?.length}>
                        <option value=''>{characters === null ? 'loading characters…' : characters.length ? 'put it on a character…' : 'you have no characters'}</option>
                        {characters?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type='button' className={styles.primary} disabled={!target || busy || empty} onClick={() => void apply()}>{busy ? 'saving…' : 'Apply'}</button>
                </span>
                {note && <span className={styles.hint} role='status'>{note}</span>}
                {error && <span className={styles.error} role='alert'>{error}</span>}
            </footer>
        </dialog>
    );
}

function AvatarPreview({ cut, size }: { cut: Pixels; size: number }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (canvas.current) paint(canvas.current, cut);
    }, [cut]);
    return <canvas ref={canvas} className={styles.avatarCanvas} style={{ width: size, height: size }} />;
}
