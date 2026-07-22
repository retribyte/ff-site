'use client';

import styles from './episodeImporter.module.scss';

// A name → id mapping picker: one row per distinct source name, each with a
// <select> of resolution targets. Shared by both importers (author, speakers,
// players, characters) — the options and the resolution logic stay with the
// caller; this is just the repeated list-of-selects UI.

export interface MappingOption {
    value: string;
    label: string;
}

interface Props {
    /** Section heading (pixel-label). Omit for a bare single-row group. */
    heading?: string;
    /** Distinct source names to map (already sorted/deduped by the caller). */
    names: string[];
    /** Current select value for a name. */
    value: (name: string) => string;
    /** Options for every row's <select>; include the empty/"unresolved" one first. */
    options: MappingOption[];
    onChange: (name: string, value: string) => void;
    disabled?: boolean;
    ariaLabel: (name: string) => string;
    /** Optional note under the list (unresolved-hint or error paragraph). */
    note?: React.ReactNode;
}

export default function MappingList({ heading, names, value, options, onChange, disabled, ariaLabel, note }: Props) {
    if (names.length === 0) return null;
    return (
        <>
            {heading && <h3 className='pixel-label'>{heading}</h3>}
            <ul className={styles.mappings}>
                {names.map((name) => (
                    <li key={name}>
                        <span className={styles.mapName}>{name}</span>
                        <select
                            value={value(name)}
                            onChange={(e) => onChange(name, e.target.value)}
                            disabled={disabled}
                            aria-label={ariaLabel(name)}
                        >
                            {options.map((opt) => (
                                <option key={opt.value || '__empty'} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </li>
                ))}
            </ul>
            {note}
        </>
    );
}
