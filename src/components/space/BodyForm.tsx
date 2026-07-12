'use client';

import { useId, useState } from 'react';
import type { BodyComposition, CelestialBody, CelestialBodyType } from '@/lib/types';
import { starColor } from '@/lib/space';
import type { BodyDraft } from './builderTree';
import styles from './space.module.scss';

// Contextual create/edit form used both under a tree "+ add" trigger and in
// the selected-body detail section (edit mode, prefilled). Controlled inputs
// throughout — the legacy MoonCreate/LandmarkCreate read the DOM directly,
// which this deliberately avoids. Basic required/number validation only;
// the server is the source of truth for the rest (duplicate names, etc).

const COMPOSITION_OPTIONS: { value: BodyComposition; label: string }[] = [
    { value: 'TERRESTRIAL', label: 'terrestrial' },
    { value: 'GAS', label: 'gas' },
    { value: 'ICE', label: 'ice' },
];

interface FormState {
    name: string;
    radiusKm: string;
    temperatureK: string;
    distance: string;
    composition: BodyComposition;
    color: string;
    description: string;
    wikiArticle: string;
}

function toFormState(initial: CelestialBody | null): FormState {
    return {
        name: initial?.name ?? '',
        radiusKm: initial ? String(initial.radiusKm) : '',
        temperatureK: initial?.temperatureK != null ? String(initial.temperatureK) : '',
        distance: initial?.distance != null ? String(initial.distance) : '',
        composition: initial?.composition ?? 'TERRESTRIAL',
        color: initial?.color ?? '',
        description: initial?.description ?? '',
        wikiArticle: initial?.wikiArticle ?? '',
    };
}

export default function BodyForm({
    type,
    initial = null,
    onSubmit,
    onCancel,
    submitLabel,
}: {
    type: CelestialBodyType;
    /** prefill for edit mode; omit/null for create */
    initial?: CelestialBody | null;
    onSubmit: (draft: BodyDraft) => void;
    /** omit to hide the Cancel button (the empty-state star form has nothing to cancel to) */
    onCancel?: () => void;
    submitLabel: string;
}) {
    const uid = useId();
    const [values, setValues] = useState<FormState>(() => toFormState(initial));
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setValues((prev) => ({ ...prev, [key]: value }));

    const distanceLabel = type === 'MOON' ? 'orbit (km)' : 'orbit (AU)';
    const parsedTemp = parseFloat(values.temperatureK);
    const chipColor = Number.isFinite(parsedTemp) ? starColor(parsedTemp) : '#7a80ab';

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        const name = values.name.trim();
        if (!name) return setError('name is required');
        const radiusKm = parseFloat(values.radiusKm);
        if (!Number.isFinite(radiusKm) || radiusKm <= 0) return setError('radius must be a positive number');

        let temperatureK: number | null = null;
        let distance: number | null = null;
        let composition: BodyComposition | null = null;

        if (type === 'STAR') {
            temperatureK = parseFloat(values.temperatureK);
            if (!Number.isFinite(temperatureK)) return setError('temperature is required');
        } else {
            distance = parseFloat(values.distance);
            if (!Number.isFinite(distance) || distance < 0) return setError(`${distanceLabel} must be a non-negative number`);
            composition = values.composition;
        }

        onSubmit({
            name,
            radiusKm,
            distance,
            composition,
            temperatureK,
            color: values.color.trim() || null,
            description: values.description.trim() || null,
            wikiArticle: values.wikiArticle.trim() || null,
        });
    };

    return (
        <form className={styles.builderForm} onSubmit={submit}>
            <div className={styles.builderField}>
                <label className='pixel-label' htmlFor={`${uid}-name`}>
                    name
                </label>
                <input
                    id={`${uid}-name`}
                    type='text'
                    value={values.name}
                    onChange={(e) => set('name', e.target.value)}
                    required
                    autoFocus
                />
            </div>

            <div className={styles.builderField}>
                <label className='pixel-label' htmlFor={`${uid}-radius`}>
                    radius (km)
                </label>
                <input
                    id={`${uid}-radius`}
                    type='number'
                    min={0}
                    step='any'
                    value={values.radiusKm}
                    onChange={(e) => set('radiusKm', e.target.value)}
                    required
                />
            </div>

            {type === 'STAR' ? (
                <div className={styles.builderField}>
                    <label className='pixel-label' htmlFor={`${uid}-temp`}>
                        temperature (K)
                    </label>
                    <div className={styles.tempRow}>
                        <input
                            id={`${uid}-temp`}
                            type='number'
                            min={0}
                            step='any'
                            value={values.temperatureK}
                            onChange={(e) => set('temperatureK', e.target.value)}
                            required
                        />
                        <span className={styles.colorChip} style={{ background: chipColor, color: chipColor }} title={chipColor} />
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.builderField}>
                        <label className='pixel-label' htmlFor={`${uid}-distance`}>
                            {distanceLabel}
                        </label>
                        <input
                            id={`${uid}-distance`}
                            type='number'
                            min={0}
                            step='any'
                            value={values.distance}
                            onChange={(e) => set('distance', e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.builderField}>
                        <label className='pixel-label' htmlFor={`${uid}-comp`}>
                            composition
                        </label>
                        <select
                            id={`${uid}-comp`}
                            value={values.composition}
                            onChange={(e) => set('composition', e.target.value as BodyComposition)}
                        >
                            {COMPOSITION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </>
            )}

            <div className={styles.builderField}>
                <label className='pixel-label' htmlFor={`${uid}-color`}>
                    color override
                </label>
                <input
                    id={`${uid}-color`}
                    type='text'
                    placeholder='#62DE2C'
                    value={values.color}
                    onChange={(e) => set('color', e.target.value)}
                />
            </div>

            <div className={styles.builderField}>
                <label className='pixel-label' htmlFor={`${uid}-desc`}>
                    description
                </label>
                <textarea id={`${uid}-desc`} rows={2} value={values.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className={styles.builderField}>
                <label className='pixel-label' htmlFor={`${uid}-wiki`}>
                    wiki article
                </label>
                <input id={`${uid}-wiki`} type='text' value={values.wikiArticle} onChange={(e) => set('wikiArticle', e.target.value)} />
            </div>

            {error && (
                <p className={styles.formError} role='alert'>
                    ✖ {error}
                </p>
            )}

            <div className={styles.builderActions}>
                {onCancel && (
                    <button type='button' className={`${styles.btn} ${styles.btnQuiet}`} onClick={onCancel}>
                        Cancel
                    </button>
                )}
                <button type='submit' className={`${styles.btn} ${styles.btnPrimary}`}>
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}
