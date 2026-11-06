'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import type { Character, NpcPersona } from '@/lib/types';
import AvatarUploadButton from './AvatarUploadButton';
import styles from './npcVoiceList.module.scss';

interface Envelope<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

// Filterable list of NPC voices with a two-click Promote: the NPC becomes a
// character owned by whoever voiced most of its lines, and the lines move to
// it (ff-server POST /admin/speakers/promote).
export default function NpcVoiceList({ npcs }: { npcs: NpcPersona[] }) {
    const router = useRouter();
    const [filter, setFilter] = useState('');
    const [armedId, setArmedId] = useState<number | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const needle = filter.trim().toLowerCase();
    const shown = needle ? npcs.filter((n) => n.name.toLowerCase().includes(needle)) : npcs;

    const promote = async (npc: NpcPersona) => {
        if (armedId !== npc.id) {
            setArmedId(npc.id);
            return;
        }
        setBusyId(npc.id);
        setError(null);
        try {
            const res = await fetch('/site/ff/admin/speakers/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personaId: npc.id }),
            });
            const envelope = (await res.json().catch(() => null)) as Envelope<{ character: Character }> | null;
            if (!res.ok || envelope?.status === 'error' || !envelope?.data) {
                throw new Error(envelope?.message ?? `HTTP ${res.status}`);
            }
            router.push(`/characters/${envelope.data.character.slug}`);
        } catch (err) {
            setError(`${npc.name}: ${err instanceof Error ? err.message : 'the lore server is not answering'}`);
            setArmedId(null);
        } finally {
            setBusyId(null);
        }
    };

    const replaceImage = async (npc: NpcPersona, image: string) => {
        setBusyId(npc.id);
        setError(null);
        try {
            const res = await fetch(`/site/ff/personas/${npc.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image }),
            });
            const envelope = (await res.json().catch(() => null)) as Envelope<unknown> | null;
            if (!res.ok || envelope?.status === 'error') {
                throw new Error(envelope?.message ?? `HTTP ${res.status}`);
            }
            router.refresh();
        } catch (err) {
            setError(`${npc.name}: ${err instanceof Error ? err.message : 'the lore server is not answering'}`);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className={styles.wrap}>
            <input
                className={styles.filter}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder='filter by name'
                aria-label='Filter NPC voices'
            />
            {error && <p className={styles.error} role='alert'>✖ {error}</p>}
            <ul className={styles.list}>
                {shown.map((npc) => (
                    <li key={npc.id} className={styles.item}>
                        {npc.image && <PixelAvatar src={npc.image} name={npc.name} color={npc.color ?? 'var(--text-muted)'} size={28} />}
                        <span className={styles.name}>{npc.name}</span>
                        <span className={styles.count}>
                            {npc.messageCount} {npc.messageCount === 1 ? 'line' : 'lines'}
                        </span>
                        <AvatarUploadButton
                            label={npc.image ? 'change image' : 'add image'}
                            ariaLabel={`upload image for ${npc.name}`}
                            disabled={busyId !== null}
                            onPick={(image) => replaceImage(npc, image)}
                            onError={(message) => setError(`${npc.name}: ${message}`)}
                        />
                        <button
                            type='button'
                            className={armedId === npc.id ? styles.armed : styles.promote}
                            onClick={() => promote(npc)}
                            onBlur={() => armedId === npc.id && busyId === null && setArmedId(null)}
                            disabled={busyId !== null}
                        >
                            {busyId === npc.id ? '…' : armedId === npc.id ? 'confirm: make a character' : 'promote'}
                        </button>
                    </li>
                ))}
            </ul>
            {shown.length === 0 && <p className={styles.empty}>No NPC voices match.</p>}
        </section>
    );
}
