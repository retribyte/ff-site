'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { JobRun } from '@/lib/types';
import { adminCall } from './adminApi';
import RunResult from './RunResult';
import styles from './admin.module.scss';

type VoiceKind = 'character' | 'speaker';
interface VoiceField {
    kind: VoiceKind;
    text: string;
}

interface CharacterLite {
    id: number;
    name: string;
}

const slugList = (text: string) =>
    text
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

// Who speaks story dialogue, fixed in bulk (ff-server POST
// /admin/story-voices/reassign): plain speaker text to a real character
// ("Mary" -> Mary Breezwing), a character back to plain text (Jessica -> "Jess"),
// or either to either, across whole lines and in-paragraph quotes. Preview is
// a dry run whose log lists every line it would change, so it doubles as the
// "where is this voice used" report. Apply unlocks only after a preview of
// exactly these inputs. Every run is in the History, with before-values.
export default function StoryVoicePanel() {
    const router = useRouter();
    const [characters, setCharacters] = useState<CharacterLite[] | null>(null);
    const [from, setFrom] = useState<VoiceField>({ kind: 'speaker', text: '' });
    const [to, setTo] = useState<VoiceField>({ kind: 'character', text: '' });
    const [stories, setStories] = useState('');
    const [seasons, setSeasons] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<JobRun | null>(null);
    const [previewed, setPreviewed] = useState<string | null>(null);

    useEffect(() => {
        fetch('/site/ff/characters')
            .then((res) => res.json())
            .then((envelope: { data?: CharacterLite[] }) =>
                setCharacters([...(envelope.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
            )
            .catch(() => setCharacters([]));
    }, []);

    const resolve = (v: VoiceField, label: string) => {
        const text = v.text.trim();
        if (!text) throw new Error(`Fill in "${label}"`);
        if (v.kind === 'speaker') return { speaker: text };
        const match = characters?.find((c) => c.name.toLowerCase() === text.toLowerCase());
        if (!match) throw new Error(`${label}: no character named '${text}'`);
        return { characterId: match.id };
    };

    const body = () => ({
        from: resolve(from, 'from'),
        to: resolve(to, 'to'),
        stories: slugList(stories),
        seasons: slugList(seasons),
    });
    const inputsKey = JSON.stringify({ from, to, stories: slugList(stories), seasons: slugList(seasons) });

    const go = async (dryRun: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const result = await adminCall<JobRun>('story-voices/reassign', { ...body(), dryRun });
            setRun(result);
            setPreviewed(dryRun ? inputsKey : null);
            router.refresh();
        } catch (err) {
            setRun(null);
            setPreviewed(null);
            setError(err instanceof Error ? err.message : 'The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const voiceInput = (label: string, v: VoiceField, set: (v: VoiceField) => void) => (
        <div className={styles.voiceField}>
            <span className='pixel-label'>{label}</span>
            <select
                className={styles.select}
                value={v.kind}
                onChange={(e) => set({ ...v, kind: e.target.value as VoiceKind })}
                disabled={busy}
                aria-label={`${label}: character or speaker text`}
            >
                <option value='speaker'>speaker text</option>
                <option value='character'>character</option>
            </select>
            <input
                className={styles.select}
                value={v.text}
                onChange={(e) => set({ ...v, text: e.target.value })}
                list={v.kind === 'character' ? 'story-voice-characters' : undefined}
                placeholder={v.kind === 'character' ? 'character name' : 'name as written, e.g. Mary'}
                disabled={busy}
                aria-label={`${label} ${v.kind === 'character' ? 'character name' : 'speaker text'}`}
            />
        </div>
    );

    return (
        <section className={styles.panel} aria-labelledby='story-voices'>
            <h2 id='story-voices' className={styles.panelTitle}>
                Story voices
            </h2>
            <p className={styles.help}>
                Move story dialogue (whole lines and quotes inside paragraphs) from one voice to another: plain speaker text
                to a real character, a character back to plain text, or either to either. Leave the scope empty for every
                story. Preview lists each line it would change, so it also answers &ldquo;where is this voice used?&rdquo;.
                Transcript lines aren&apos;t touched: use the 🎭 control on an episode for those.
            </p>
            <datalist id='story-voice-characters'>
                {(characters ?? []).map((c) => (
                    <option key={c.id} value={c.name} />
                ))}
            </datalist>
            <div className={styles.voiceForm}>
                {voiceInput('from', from, setFrom)}
                {voiceInput('to', to, setTo)}
                <label className={styles.voiceField}>
                    <span className='pixel-label'>stories</span>
                    <input
                        className={styles.select}
                        value={stories}
                        onChange={(e) => setStories(e.target.value)}
                        placeholder='story slugs, comma-separated'
                        disabled={busy}
                    />
                </label>
                <label className={styles.voiceField}>
                    <span className='pixel-label'>seasons</span>
                    <input
                        className={styles.select}
                        value={seasons}
                        onChange={(e) => setSeasons(e.target.value)}
                        placeholder='e.g. ff3, vm'
                        disabled={busy}
                    />
                </label>
            </div>
            <div className={styles.actions}>
                <button type='button' className={styles.ghost} onClick={() => void go(true)} disabled={busy}>
                    {busy ? 'working…' : 'preview'}
                </button>
                <button
                    type='button'
                    className={styles.go}
                    onClick={() => void go(false)}
                    disabled={busy || previewed !== inputsKey}
                    title={previewed !== inputsKey ? 'Preview these exact settings first' : undefined}
                >
                    apply
                </button>
            </div>
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            {run && <RunResult run={run} />}
        </section>
    );
}
