'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { JobRun } from '@/lib/types';
import { findVoiceOption, loadVoiceOptions, type VoiceOption } from '@/lib/voiceOptions';
import { adminCall } from './adminApi';
import RunResult from './RunResult';
import styles from './admin.module.scss';

type VoiceKind = 'character' | 'speaker';
interface VoiceField {
    kind: VoiceKind;
    text: string;
}

const slugList = (text: string) =>
    text
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

// Who speaks story dialogue, fixed in bulk (ff-server POST
// /admin/story-voices/reassign): an NPC to a real character ("Mary" -> Mary
// Breezwing), a character to an NPC (Jessica -> "Jess"), a character to one of
// its personas ("Vec" -> "Vec as Sascha"), or any to any, across whole lines
// and in-paragraph quotes. An NPC left with no lines is deleted. Preview is
// a dry run whose log lists every line it would change, so it doubles as the
// "where is this voice used" report. Apply unlocks only after a preview of
// exactly these inputs. Every run is in the History, with before-values.
export default function StoryVoicePanel() {
    const router = useRouter();
    const [characters, setCharacters] = useState<VoiceOption[] | null>(null);
    const [from, setFrom] = useState<VoiceField>({ kind: 'speaker', text: '' });
    const [to, setTo] = useState<VoiceField>({ kind: 'character', text: '' });
    const [stories, setStories] = useState('');
    const [seasons, setSeasons] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<JobRun | null>(null);
    const [previewed, setPreviewed] = useState<string | null>(null);

    useEffect(() => {
        loadVoiceOptions()
            .then(setCharacters)
            .catch(() => setCharacters([]));
    }, []);

    // An NPC by name; or a character, where "Vec" matches all of Vec's lines
    // as `from` (any persona) and "Vec as Sascha" just that persona's
    const resolve = (v: VoiceField, label: string) => {
        const text = v.text.trim();
        if (!text) throw new Error(`Fill in "${label}"`);
        if (v.kind === 'speaker') return { speaker: text };
        const match = findVoiceOption(characters ?? [], text);
        if (!match) throw new Error(`${label}: no character (or character as persona) named '${text}'`);
        return match.personaId !== null ? { characterId: match.characterId, personaId: match.personaId } : { characterId: match.characterId };
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
                aria-label={`${label}: character or NPC`}
            >
                <option value='speaker'>NPC</option>
                <option value='character'>character</option>
            </select>
            <input
                className={styles.select}
                value={v.text}
                onChange={(e) => set({ ...v, text: e.target.value })}
                list={v.kind === 'character' ? 'story-voice-characters' : undefined}
                placeholder={v.kind === 'character' ? 'character, or "Vec as Sascha"' : 'NPC name, e.g. Mary'}
                disabled={busy}
                aria-label={`${label} ${v.kind === 'character' ? 'character name' : 'NPC name'}`}
            />
        </div>
    );

    return (
        <section className={styles.panel} aria-labelledby='story-voices'>
            <h2 id='story-voices' className={styles.panelTitle}>
                Story voices
            </h2>
            <p className={styles.help}>
                Move story dialogue (whole lines and quotes inside paragraphs) from one voice to another: an NPC to a real
                character, a character to an NPC, a character to one of its personas (&ldquo;Vec as Sascha&rdquo;), or
                any to any. A character with no persona named, as &ldquo;from&rdquo;, covers all of its lines. An NPC left
                with no lines anywhere is deleted. Leave the scope empty for every story. Preview lists each line it would change, so it also answers &ldquo;where is this voice used?&rdquo;.
                Transcript lines aren&apos;t touched: use the 🎭 control on an episode for those.
            </p>
            <datalist id='story-voice-characters'>
                {(characters ?? []).map((c) => (
                    <option key={c.label} value={c.label} />
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
