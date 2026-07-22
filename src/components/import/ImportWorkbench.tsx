'use client';

import { useState } from 'react';
import styles from './episodeImporter.module.scss';

// Shared scaffold for the story/episode importers: the file dropzone, the
// parse-error line, and the manifest panel with its upload → progress →
// success/failure → eject state machine. The payload parsing, reference-data
// loading, name resolution and the actual upload sequence are all
// importer-specific and stay with the caller; the caller renders its manifest
// facts + mapping lists via `children(busy)` and hands us `upload`/`eject`.

export type Phase =
    | { step: 'idle' }
    | { step: 'uploading'; done: number; total: number }
    | { step: 'success'; count: number; href: string }
    | { step: 'failed'; message: string; created: boolean };

export interface UploadContext {
    /** Report chunk progress so the button + <progress> advance. */
    onProgress: (done: number, total: number) => void;
    /** Signal the parent record now exists — drives the eject prompt on failure. */
    onCreated: () => void;
}

interface Props {
    dropLabel: string;
    dropHint: string;
    fileName: string;
    parseError: string | null;
    onFile: (file: File | undefined) => void;

    /** True once a payload has parsed OK; shows the manifest panel. */
    ready: boolean;
    /** Manifest facts + mapping lists; `busy` disables inputs during upload. */
    children: (busy: boolean) => React.ReactNode;

    uploadLabel: string;
    /** Extra reason to block upload beyond busy/success/exists (e.g. unresolved players). */
    uploadBlocked?: boolean;
    /** A same-slug/title record already exists — blocks upload and shows existsMessage. */
    exists: boolean;
    existsMessage: React.ReactNode;

    upload: (ctx: UploadContext) => Promise<{ count: number; href: string }>;
    eject: () => Promise<void>;
    ejectLabel: string;
    successMessage: (count: number, href: string) => React.ReactNode;
    /** Sentence shown before the eject button when a partial upload left the parent created. */
    partialHint: React.ReactNode;
}

export default function ImportWorkbench({
    dropLabel,
    dropHint,
    fileName,
    parseError,
    onFile,
    ready,
    children,
    uploadLabel,
    uploadBlocked = false,
    exists,
    existsMessage,
    upload,
    eject,
    ejectLabel,
    successMessage,
    partialHint,
}: Props) {
    const [phase, setPhase] = useState<Phase>({ step: 'idle' });
    const busy = phase.step === 'uploading';
    const canUpload = ready && !busy && phase.step !== 'success' && !exists && !uploadBlocked;

    const runUpload = async () => {
        setPhase({ step: 'uploading', done: 0, total: 0 });
        let created = false;
        try {
            const { count, href } = await upload({
                onProgress: (done, total) => setPhase({ step: 'uploading', done, total }),
                onCreated: () => {
                    created = true;
                },
            });
            setPhase({ step: 'success', count, href });
        } catch (error) {
            setPhase({
                step: 'failed',
                message: error instanceof Error ? error.message : 'The lore server is not answering.',
                created,
            });
        }
    };

    const runEject = async () => {
        try {
            await eject();
            setPhase({ step: 'idle' });
        } catch (error) {
            setPhase({
                step: 'failed',
                message: `Rollback failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                created: true,
            });
        }
    };

    return (
        <div className={styles.importer}>
            <label className={`pixel-panel ${styles.dropzone}`}>
                <input
                    type='file'
                    accept='.json,application/json'
                    onChange={(e) => onFile(e.target.files?.[0])}
                    disabled={busy}
                />
                <span className='pixel-label'>{dropLabel}</span>
                <span className={styles.dropHint}>{fileName || dropHint}</span>
            </label>

            {parseError && (
                <p className={styles.error} role='alert'>
                    ✖ {parseError}
                </p>
            )}

            {ready && (
                <section className={`pixel-panel ${styles.preview}`}>
                    <h2 className='pixel-label'>manifest</h2>
                    {children(busy)}

                    <div className={styles.actions}>
                        <button type='button' className={styles.upload} onClick={runUpload} disabled={!canUpload}>
                            {busy ? `transmitting ${phase.done}/${phase.total}…` : uploadLabel}
                        </button>
                        {phase.step === 'uploading' && (
                            <progress value={phase.done} max={phase.total} className={styles.progress} />
                        )}
                    </div>

                    {phase.step === 'success' && successMessage(phase.count, phase.href)}
                    {phase.step === 'failed' && (
                        <div className={styles.failure}>
                            <p className={styles.error} role='alert'>
                                ✖ {phase.message}
                            </p>
                            {phase.created && (
                                <p className={styles.hint}>
                                    {partialHint}{' '}
                                    <button type='button' className={styles.eject} onClick={runEject}>
                                        {ejectLabel}
                                    </button>
                                </p>
                            )}
                        </div>
                    )}
                    {exists && phase.step !== 'success' && existsMessage}
                </section>
            )}
        </div>
    );
}
