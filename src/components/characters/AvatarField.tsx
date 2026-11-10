'use client';

import { useState } from 'react';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import AvatarUploadButton from './AvatarUploadButton';
import styles from './avatarUpload.module.scss';

// Form control for an `image` value: upload a PNG, or type a path to one
// (existing records use /avatars/... paths). A pending upload is a data: URL in
// the form value, and ff-server stores it when the form saves. It's kept out of
// the text box, and swapped for a note and a way to undo it.
export default function AvatarField({
    id,
    value,
    onChange,
    placeholder,
    ariaLabel,
    disabled,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
}) {
    const [previous, setPrevious] = useState('');
    const [error, setError] = useState<string | null>(null);
    const pending = value.startsWith('data:');

    return (
        <span className={styles.field}>
            <span className={styles.row}>
                {value && <PixelAvatar src={value} name='?' color='var(--text-muted)' size={48} />}
                <AvatarUploadButton
                    disabled={disabled}
                    onPick={(dataUrl) => {
                        setError(null);
                        if (!pending) setPrevious(value);
                        onChange(dataUrl);
                    }}
                    onError={setError}
                />
                {pending ? (
                    <>
                        <span className={styles.note}>new image, saved with this form</span>
                        <button type='button' className={styles.undo} onClick={() => onChange(previous)} disabled={disabled}>
                            undo
                        </button>
                    </>
                ) : (
                    <input
                        id={id}
                        type='text'
                        className={styles.path}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        aria-label={ariaLabel}
                        disabled={disabled}
                    />
                )}
            </span>
            <span className={styles.help}>PNG, at most 14x14 pixels; or a path to an image</span>
            {error && (
                <span className={styles.error} role='alert'>
                    ✖ {error}
                </span>
            )}
        </span>
    );
}
