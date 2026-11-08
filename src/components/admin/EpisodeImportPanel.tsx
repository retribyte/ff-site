'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EpisodeImportPlan, JobRun } from '@/lib/types';
import { adminCall } from './adminApi';
import RunResult from './RunResult';
import styles from './admin.module.scss';

type PlannedEpisode = EpisodeImportPlan['episodes'][number];

/** The preview's verdict on one episode. */
function check(e: PlannedEpisode): string {
    if (e.conflicts.length) return e.conflicts.join('; ');
    if (e.action === 'new') return 'new';
    if (e.action === 'unchanged' || !e.changes) return 'unchanged, skipped';
    const c = e.changes;
    const parts = [`${c.edited} edited`, `${c.added} added`, `${c.removed} removed`];
    const notes = c.notesKept + c.notesMoved;
    if (notes) parts.push(`${notes} note${notes === 1 ? '' : 's'} kept${c.notesMoved ? ` (${c.notesMoved} moved to a nearby message)` : ''}`);
    if (c.renamedFrom) parts.push(`renamed from '${c.renamedFrom}'`);
    return `update: ${parts.join(', ')}`;
}

/** "import 2 new, update 1": what the button will do. */
function importLabel(episodes: PlannedEpisode[]): string {
    const count = (action: PlannedEpisode['action']) => episodes.filter((e) => e.action === action).length;
    const parts = [count('new') && `import ${count('new')} new`, count('update') && `update ${count('update')}`].filter(Boolean);
    return parts.length ? parts.join(', ') : 'nothing to import';
}

interface LoadedFile {
    name: string;
    payload: { seasonTitle: string; episode: { title: string; episode_no: number }; messages: unknown[] };
}

/** Reads md-to-api.py's episode JSON files; a file that isn't one is reported, not sent. */
async function readFiles(list: FileList): Promise<{ files: LoadedFile[]; errors: string[] }> {
    const files: LoadedFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(list)) {
        try {
            const payload = JSON.parse(await file.text());
            if (!payload?.seasonTitle || !payload?.episode?.title || !Array.isArray(payload?.messages)) {
                throw new Error('not an md-to-api.py episode file');
            }
            files.push({ name: file.name, payload });
        } catch (error) {
            errors.push(`${file.name}: ${error instanceof Error ? error.message : 'unreadable'}`);
        }
    }
    files.sort((a, b) => a.payload.episode.episode_no - b.payload.episode.episode_no);
    return { files, errors };
}

// Import or update episodes from md-to-api.py's JSON: preview, then a dry run or the import.
export default function EpisodeImportPanel() {
    const router = useRouter();
    const [files, setFiles] = useState<LoadedFile[]>([]);
    const [fileErrors, setFileErrors] = useState<string[]>([]);
    const [plan, setPlan] = useState<EpisodeImportPlan | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<JobRun | null>(null);

    const episodes = () => files.map((f) => f.payload);
    const actionable = plan?.episodes.some((e) => e.action !== 'unchanged') ?? false;

    const choose = async (list: FileList | null) => {
        setPlan(null);
        setRun(null);
        setError(null);
        if (!list || list.length === 0) {
            setFiles([]);
            setFileErrors([]);
            return;
        }
        const { files: loaded, errors } = await readFiles(list);
        setFiles(loaded);
        setFileErrors(errors);
        if (loaded.length === 0) return;
        setBusy(true);
        try {
            setPlan(await adminCall<EpisodeImportPlan>('episode-import/preview', { episodes: loaded.map((f) => f.payload) }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Preview failed');
        } finally {
            setBusy(false);
        }
    };

    const start = async (dryRun: boolean) => {
        setBusy(true);
        setError(null);
        setRun(null);
        try {
            const result = await adminCall<JobRun>('episode-import', { episodes: episodes(), dryRun });
            setRun(result);
            if (!dryRun && result.status === 'SUCCEEDED') {
                setFiles([]);
                setPlan(null);
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={styles.panel} aria-labelledby='episode-import'>
            <h2 id='episode-import' className={styles.panelTitle}>
                Episode import
            </h2>
            <p className={styles.help}>
                Episodes from <code>md-to-api.py</code>&rsquo;s JSON (<code>archive-to-markdown/api/&lt;season&gt;/</code>).
                One whose season and number are already in the archive is updated in place: commentary notes follow their
                messages and persona stamps stay. Unchanged ones are skipped. Everything selected imports together or not at
                all.
            </p>
            <input
                type='file'
                accept='.json,application/json'
                multiple
                disabled={busy}
                onChange={(e) => void choose(e.target.files)}
                className={styles.fileInput}
                aria-label='Episode JSON files'
            />

            {fileErrors.length > 0 && (
                <ul className={styles.errors}>
                    {fileErrors.map((e) => (
                        <li key={e}>{e}</li>
                    ))}
                </ul>
            )}

            {busy && !plan && <p className={styles.help}>checking…</p>}

            {plan && (
                <>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>episode</th>
                                <th>messages</th>
                                <th>check</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plan.episodes.map((e) => (
                                <tr key={`${e.seasonTitle}-${e.episodeNo}-${e.title}`}>
                                    <td>
                                        {e.seasonTitle} #{e.episodeNo} {e.title}
                                        {e.reconstructed && <span className={styles.tag}>reconstructed</span>}
                                        {e.newSeason && <span className={styles.tag}>new season</span>}
                                    </td>
                                    <td>{e.messages.toLocaleString('en-US')}</td>
                                    <td className={e.conflicts.length ? styles.bad : e.action === 'unchanged' ? undefined : styles.good}>
                                        {check(e)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {plan.missingPlayers.length > 0 && (
                        <p className={styles.bad}>
                            No account for: {plan.missingPlayers.join(', ')}. Create those players first.
                        </p>
                    )}
                    {plan.newNpcVoices.length > 0 && (
                        <p className={styles.note}>New NPC voices: {plan.newNpcVoices.join(', ')}</p>
                    )}
                    {plan.newPersonas.length > 0 && (
                        <p className={styles.note}>
                            New personas: {plan.newPersonas.map((p) => `${p.character} as ${p.name}`).join(', ')}
                        </p>
                    )}
                    {plan.caseMatches.length > 0 && (
                        <p className={styles.note}>
                            Matched by case: {plan.caseMatches.map((m) => `${m.speaker} → ${m.character}`).join(', ')}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <button type='button' className={styles.ghost} onClick={() => void start(true)} disabled={busy || !plan.ok || !actionable}>
                            dry run
                        </button>
                        <button type='button' className={styles.go} onClick={() => void start(false)} disabled={busy || !plan.ok || !actionable}>
                            {busy ? 'importing…' : importLabel(plan.episodes)}
                        </button>
                    </div>
                </>
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
