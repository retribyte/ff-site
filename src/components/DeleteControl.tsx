'use client';

import { useState } from 'react';
import { useShiftKey } from '@/hooks/useShiftKey';
import styles from './deleteControl.module.scss';

// Shared "eject" affordance: a subdued Delete button that expands into a
// confirm prompt (Eject / Keep). Used by RecordEditor and the story views so
// deletion reads the same everywhere. The parent owns the actual delete call
// (and any error/navigation) via onConfirm.
export default function DeleteControl({
    onConfirm,
    busy = false,
    deleteLabel = 'Delete',
    prompt = 'eject this record?',
    confirmLabel = 'Eject',
    cancelLabel = 'Keep',
}: {
    onConfirm: () => void;
    /** disables the confirm/cancel buttons while the parent's delete is in flight */
    busy?: boolean;
    deleteLabel?: string;
    prompt?: string;
    confirmLabel?: string;
    cancelLabel?: string;
}) {
    const [confirming, setConfirming] = useState(false);
    const shiftHeld = useShiftKey();

    if (confirming) {
        return (
            <span className={styles.confirmGroup}>
                <span className='pixel-label'>{prompt}</span>
                <button type='button' className={styles.deleteConfirm} onClick={onConfirm} disabled={busy}>
                    {confirmLabel}
                </button>
                <button
                    type='button'
                    className={styles.cancel}
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                >
                    {cancelLabel}
                </button>
            </span>
        );
    }

    return (
        <button
            type='button'
            className={styles.delete}
            onClick={() => (shiftHeld ? onConfirm() : setConfirming(true))}
        >
            {deleteLabel}
        </button>
    );
}
