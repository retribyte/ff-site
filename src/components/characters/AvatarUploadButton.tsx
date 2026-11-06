'use client';

import { readAvatarFile } from '@/lib/avatarUpload';
import styles from './avatarUpload.module.scss';

// A file picker styled as a button: hands back the checked PNG as a data: URL,
// which the caller sends as the record's `image`.
export default function AvatarUploadButton({
    label = 'upload PNG',
    ariaLabel,
    disabled,
    onPick,
    onError,
}: {
    label?: string;
    ariaLabel?: string;
    disabled?: boolean;
    onPick: (dataUrl: string) => void;
    onError: (message: string) => void;
}) {
    const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
            onPick(await readAvatarFile(file));
        } catch (error) {
            onError(error instanceof Error ? error.message : "That file couldn't be read");
        } finally {
            input.value = ''; // so picking the same file again still fires change
        }
    };

    return (
        <label className={`${styles.upload} ${disabled ? styles.disabled : ''}`} title='PNG, at most 14x14 pixels'>
            {label}
            <input type='file' accept='image/png' onChange={pick} disabled={disabled} aria-label={ariaLabel ?? label} />
        </label>
    );
}
