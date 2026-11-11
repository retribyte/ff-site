'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { JobRun } from '@/lib/types';
import { findVoiceOption, loadVoiceOptions, type VoiceOption } from '@/lib/voiceOptions';
import { adminCall, formatWhen } from './adminApi';
import RunResult from './RunResult';
import styles from './admin.module.scss';

// GET /admin/vm-import: where the last import stopped, and the speaker codes it knows
interface Status {
    storyTitle: string | null;
    lineCount: number;
    lastMessageId: string;
    lastMessageAt: string;
    speakers: Record<string, string>;
}

// POST /admin/vm-import/preview
interface Preview {
    lastMessageAt: string;
    newestId: string | null;
    entries: number;
    lineCount: number;
    codes: { code: string; count: number; example: string; voice: string | null }[];
    unknown: string[];
}

interface Pick {
    kind: 'character' | 'npc';
    text: string;
}

interface ExportFile {
    name: string;
    /** the export, cut down to the messages after the last import (what gets uploaded) */
    data: { channel?: unknown; messages: { id: string }[] };
    total: number;
}

const newer = (a: string, b: string) => BigInt(a) > BigInt(b);

// Vortox Machina from Discord (ff-server /admin/vm-import): pick a
// DiscordChatExporter JSON export of #cyoa-vm; the GM's entries posted since
// the last import are appended to the story. Preview lists them and asks who
// any new speaker code ("G:") is; the answer is remembered. Dry run shows
// every line it would add; apply unlocks after a dry run of exactly these inputs.
export default function VmImportPanel() {
    const router = useRouter();
    const [status, setStatus] = useState<Status | null>(null);
    const [file, setFile] = useState<ExportFile | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [picks, setPicks] = useState<Record<string, Pick>>({});
    const [characters, setCharacters] = useState<VoiceOption[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<JobRun | null>(null);
    const [dryRunKey, setDryRunKey] = useState<string | null>(null);

    const loadStatus = () =>
        adminCall<Status>('vm-import')
            .then(setStatus)
            .catch((err) => setError(err instanceof Error ? err.message : 'The lore server is not answering'));

    useEffect(() => {
        void loadStatus();
        loadVoiceOptions()
            .then(setCharacters)
            .catch(() => setCharacters([]));
    }, []);

    // The picks for codes the import doesn't know yet, as the server takes them
    const speakers = () => {
        const out: Record<string, { characterId: number; personaId: number | null } | { npc: string | null }> = {};
        for (const code of preview?.unknown ?? []) {
            const pick = picks[code];
            if (!pick) throw new Error(`Pick who ${code} is`);
            if (pick.kind === 'npc') {
                out[code] = { npc: pick.text.trim() || null };
                continue;
            }
            const match = findVoiceOption(characters ?? [], pick.text);
            if (!match) throw new Error(`${code}: no character (or character as persona) named '${pick.text.trim()}'`);
            out[code] = { characterId: match.characterId, personaId: match.personaId };
        }
        return out;
    };
    const inputsKey = JSON.stringify({ file: file?.name, total: file?.data.messages.length, picks });

    const pickFile = async (picked: File | undefined) => {
        setError(null);
        setPreview(null);
        setRun(null);
        setDryRunKey(null);
        setFile(null);
        if (!picked || !status) return;
        try {
            const data = JSON.parse(await picked.text()) as ExportFile['data'];
            if (!Array.isArray(data?.messages)) throw new Error('Not a DiscordChatExporter JSON export (no messages list)');
            // Only what's new goes up: a whole-channel export can be many megabytes
            const fresh = data.messages.filter((m) => typeof m?.id === 'string' && /^\d+$/.test(m.id) && newer(m.id, status.lastMessageId));
            const cut = { channel: data.channel, messages: fresh };
            setFile({ name: picked.name, data: cut, total: data.messages.length });
            setBusy(true);
            setPreview(await adminCall<Preview>('vm-import/preview', { export: cut }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'That file could not be read');
        } finally {
            setBusy(false);
        }
    };

    const go = async (dryRun: boolean) => {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            const result = await adminCall<JobRun>('vm-import', { export: file.data, speakers: speakers(), dryRun });
            setRun(result);
            setDryRunKey(dryRun ? inputsKey : null);
            if (!dryRun) {
                setFile(null);
                setPreview(null);
                setPicks({});
                await loadStatus();
            }
            router.refresh();
        } catch (err) {
            setRun(null);
            setDryRunKey(null);
            setError(err instanceof Error ? err.message : 'The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const setPick = (code: string, next: Partial<Pick>) =>
        setPicks((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { kind: 'character', text: '' }), ...next } }));

    const nothingNew = preview !== null && preview.lineCount === 0;

    return (
        <section className={styles.panel} aria-labelledby='vm-import'>
            <h2 id='vm-import' className={styles.panelTitle}>
                Vortox Machina from Discord
            </h2>
            <p className={styles.help}>
                Export #cyoa-vm with DiscordChatExporter (JSON) and pick the file. The GM&apos;s entries posted since the last
                import are added to the end of the story; everything else in the export is ignored, so exporting the whole
                channel is fine. A speaker code the import hasn&apos;t seen before (&ldquo;G:&rdquo;) needs a voice first, once.
            </p>
            {status && (
                <p className={styles.help}>
                    {status.storyTitle ?? 'The story'} has {status.lineCount.toLocaleString('en-US')} lines. The last import
                    ended at a message from {formatWhen(status.lastMessageAt)}. Known codes:{' '}
                    {Object.entries(status.speakers)
                        .map(([code, voice]) => `${code} ${voice}`)
                        .join(', ')}
                    .
                </p>
            )}
            <input
                type='file'
                accept='application/json,.json'
                className={styles.fileInput}
                onChange={(e) => {
                    void pickFile(e.target.files?.[0]);
                    e.target.value = ''; // so picking the same file again (a fresh export) reads it again
                }}
                disabled={busy || !status}
                aria-label='DiscordChatExporter JSON export of #cyoa-vm'
            />
            {file && preview && (
                <p className={styles.help}>
                    {file.name}: {file.total.toLocaleString('en-US')} messages,{' '}
                    {nothingNew
                        ? 'nothing new from the GM since the last import.'
                        : `${preview.entries} new GM entr${preview.entries === 1 ? 'y' : 'ies'}, ${preview.lineCount} line${preview.lineCount === 1 ? '' : 's'}.`}
                </p>
            )}
            {preview && preview.codes.length > 0 && (
                <ul className={styles.help}>
                    {preview.codes.map((c) => (
                        <li key={c.code}>
                            <strong>{c.code}</strong> ({c.count} line{c.count === 1 ? '' : 's'}, e.g. &ldquo;{c.example}&rdquo;):{' '}
                            {c.voice ?? 'new code, pick who it is below'}
                        </li>
                    ))}
                </ul>
            )}
            {preview && preview.unknown.length > 0 && (
                <div className={styles.voiceForm}>
                    <datalist id='vm-import-characters'>
                        {(characters ?? []).map((c) => (
                            <option key={c.label} value={c.label} />
                        ))}
                    </datalist>
                    {preview.unknown.map((code) => {
                        const pick = picks[code] ?? { kind: 'character', text: '' };
                        return (
                            <div key={code} className={styles.voiceField}>
                                <span className='pixel-label'>{code}</span>
                                <select
                                    className={styles.select}
                                    value={pick.kind}
                                    onChange={(e) => setPick(code, { kind: e.target.value as Pick['kind'] })}
                                    disabled={busy}
                                    aria-label={`${code}: character or NPC`}
                                >
                                    <option value='character'>character</option>
                                    <option value='npc'>NPC</option>
                                </select>
                                <input
                                    className={styles.select}
                                    value={pick.text}
                                    onChange={(e) => setPick(code, { text: e.target.value })}
                                    list={pick.kind === 'character' ? 'vm-import-characters' : undefined}
                                    placeholder={pick.kind === 'character' ? 'character, or "Vec as Sascha"' : 'NPC name (blank: an unnamed NPC)'}
                                    disabled={busy}
                                    aria-label={`${code}: ${pick.kind === 'character' ? 'character name' : 'NPC name'}`}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            {preview && !nothingNew && (
                <div className={styles.actions}>
                    <button type='button' className={styles.ghost} onClick={() => void go(true)} disabled={busy}>
                        {busy ? 'working…' : 'dry run'}
                    </button>
                    <button
                        type='button'
                        className={styles.go}
                        onClick={() => void go(false)}
                        disabled={busy || dryRunKey !== inputsKey}
                        title={dryRunKey !== inputsKey ? 'Dry run these exact settings first' : undefined}
                    >
                        append {preview.lineCount} line{preview.lineCount === 1 ? '' : 's'}
                    </button>
                </div>
            )}
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
            {run && <RunResult run={run} />}
        </section>
    );
}
