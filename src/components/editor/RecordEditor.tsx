'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    EDITOR_SCHEMAS,
    FieldValidationError,
    recordToValues,
    valuesToPayload,
    type EditorKind,
    type FieldDef,
    type FormValues,
} from '@/lib/editor/schemas';
import AvatarField from '@/components/characters/AvatarField';
import { characterThemeColors, legacyColor } from '@/lib/characterColors';
import { BACKGROUNDS, MIN_CONTRAST, fullHex, minContrast, suggestColorFor } from '@/lib/colorContrast';
import DeleteControl from '@/components/DeleteControl';
import SimilarColors, { useColoredCharacters, type ColoredCharacter } from './SimilarColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';
import transcript from '@/components/transcript/transcript.module.scss';
import styles from './recordEditor.module.scss';

interface Props {
    kind: EditorKind;
    /** existing record (edit mode) as plain JSON, or null (create mode) */
    record: Record<string, unknown> | null;
    recordId?: number;
}

interface Envelope {
    status: 'success' | 'error';
    message?: string;
    data?: { id?: number; slug?: string };
}

/** Loads the options for an entity-ref picker (character list…). */
function useRefOptions(fields: FieldDef[]) {
    const refPaths = useMemo(
        () => [...new Set(fields.filter((f) => f.kind === 'entity-ref' || f.kind === 'entity-refs').map((f) => f.ref!.path))],
        [fields]
    );
    const [options, setOptions] = useState<Record<string, { id: number; label: string }[]>>({});

    useEffect(() => {
        let cancelled = false;
        for (const path of refPaths) {
            const labelField = fields.find((f) => f.ref?.path === path)!.ref!.labelField;
            fetch(`/site/ff${path}`)
                .then((res) => res.json())
                .then((envelope: { data?: Record<string, unknown>[] }) => {
                    if (cancelled || !envelope.data) return;
                    const opts = envelope.data
                        .map((r) => ({ id: r.id as number, label: String(r[labelField]) }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    setOptions((prev) => ({ ...prev, [path]: opts }));
                })
                .catch(() => {});
        }
        return () => {
            cancelled = true;
        };
    }, [refPaths, fields]);

    return options;
}

export default function RecordEditor({ kind, record, recordId }: Props) {
    const router = useRouter();
    const schema = EDITOR_SCHEMAS[kind];
    const isEdit = record !== null;

    const [values, setValues] = useState<FormValues>(() => recordToValues(schema, record));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const refOptions = useRefOptions(schema.fields);
    const cast = useColoredCharacters(schema.fields.some((f) => f.kind === 'color' && f.theme), recordId);

    const set = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }));

    // The two theme colors start locked together when they're empty or one is
    // the other made readable; locked, editing either one sets both
    const [colorsLinked, setColorsLinked] = useState(() => themeColorsLinked(schema.fields, values));
    const darkField = schema.fields.find((f) => f.theme === 'dark');
    const lightField = schema.fields.find((f) => f.theme === 'light');
    const setThemeColor = (field: FieldDef, value: string) => {
        set(field.name, value);
        const other = schema.fields.find((f) => f.theme && f.theme !== field.theme);
        // a complete color (#rrggbb, or #rgb shorthand) syncs; one still being typed waits
        const color = fullHex(value);
        if (!colorsLinked || !other?.theme || !field.theme || !color) return;
        // Taking up the color the field already shows (an empty field's
        // placeholder) changes nothing on screen, so it leaves the other alone
        const valid = (v: string | undefined) => (v ? fullHex(v) : null);
        const shown = characterThemeColors(values.name?.trim() || 'Name', valid(values.color), valid(values.colorLight));
        if (color.toLowerCase() !== shown[field.theme].toLowerCase()) {
            set(other.name, suggestColorFor(color, other.theme));
        }
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);

        let payload: Record<string, unknown>;
        try {
            payload = valuesToPayload(schema, values);
        } catch (validation) {
            setError(validation instanceof FieldValidationError ? validation.message : 'Invalid input');
            setBusy(false);
            return;
        }

        try {
            const res = await fetch(`/site/ff${schema.basePath}${isEdit ? `/${recordId}` : ''}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const envelope = (await res.json()) as Envelope;
            if (!res.ok || envelope.status === 'error') {
                setError(envelope.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            const idOrSlug = envelope.data?.slug ?? envelope.data?.id ?? recordId;
            router.push(idOrSlug !== undefined ? schema.viewPath(idOrSlug) : schema.indexPath);
            router.refresh();
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    const destroy = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/site/ff${schema.basePath}/${recordId}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
                const envelope = (await res.json().catch(() => null)) as Envelope | null;
                setError(envelope?.message ?? `Delete failed (HTTP ${res.status})`);
                return;
            }
            router.push(schema.indexPath);
            router.refresh();
        } catch {
            setError('The lore server is not answering');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={`pixel-panel ${styles.editor}`} onSubmit={submit}>
            {schema.fields.map((field) => {
                if (field.theme === 'light' && darkField) return null; // drawn by the pair
                if (field.theme === 'dark' && lightField) {
                    return (
                        <ThemeColorPair
                            key={field.name}
                            fields={{ dark: field, light: lightField }}
                            values={values}
                            onChange={setThemeColor}
                            linked={colorsLinked}
                            onToggleLinked={() => setColorsLinked((on) => !on)}
                            cast={cast}
                        />
                    );
                }
                return (
                    <Field
                        key={field.name}
                        field={field}
                        value={values[field.name]}
                        onChange={(v) => set(field.name, v)}
                        refOptions={field.ref ? (refOptions[field.ref.path] ?? []) : []}
                    />
                );
            })}

            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}

            <div className={styles.actions}>
                <button type='submit' className={styles.save} disabled={busy}>
                    {busy ? 'transmitting…' : isEdit ? 'Save changes' : `Create ${schema.kind}`}
                </button>
                {isEdit && <DeleteControl onConfirm={destroy} busy={busy} />}
            </div>
        </form>
    );
}

/** Whether a form's two theme colors start locked: when they're empty or one
 *  is the other made readable for its theme (suggestColorFor). Two colors
 *  picked separately, or an empty light color the legacy table fills, start
 *  unlocked, so the next edit doesn't silently replace them. */
function themeColorsLinked(fields: FieldDef[], values: FormValues): boolean {
    const dark = fields.find((f) => f.theme === 'dark');
    const light = fields.find((f) => f.theme === 'light');
    if (!dark || !light) return true;
    const d = fullHex(values[dark.name] ?? '')?.toLowerCase();
    const l = fullHex(values[light.name] ?? '')?.toLowerCase();
    if (!l) return legacyColor(values.name?.trim() ?? '', 'light') === null;
    if (!d) return true;
    return suggestColorFor(d, 'light') === l || suggestColorFor(l, 'dark') === d;
}

function Field({
    field,
    value,
    onChange,
    refOptions,
}: {
    field: FieldDef;
    value: string;
    onChange: (value: string) => void;
    refOptions: { id: number; label: string }[];
}) {
    const id = `field-${field.name}`;

    let control: React.ReactNode;
    switch (field.kind) {
        case 'textarea':
            control = (
                <textarea
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={4}
                />
            );
            break;
        case 'select':
            control = (
                <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
                    {field.options!.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
            break;
        case 'entity-ref':
            control = (
                <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
                    <option value=''>{field.required ? 'select…' : '(none)'}</option>
                    {refOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
            break;
        case 'entity-refs': {
            const selected = value === '' ? [] : value.split(',');
            control = (
                <select
                    id={id}
                    multiple
                    size={Math.min(8, Math.max(3, refOptions.length))}
                    value={selected}
                    onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value).join(','))}
                    required={field.required}
                >
                    {refOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
            break;
        }
        case 'avatar':
            control = <AvatarField id={id} value={value} onChange={onChange} placeholder={field.placeholder} />;
            break;
        case 'color':
            // theme colors render as a pair in ThemeColorPair
            control = (
                <span className={styles.colorRow}>
                    <input
                        type='color'
                        aria-label={`${field.label} picker`}
                        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#5d4be5'}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <input
                        id={id}
                        type='text'
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder='#62DE2C'
                        pattern='#[0-9a-fA-F]{6}'
                    />
                    {value && (
                        <button type='button' className={styles.miniButton} onClick={() => onChange('')}>
                            clear
                        </button>
                    )}
                </span>
            );
            break;
        default:
            control = (
                <input
                    id={id}
                    type={field.kind === 'number' ? 'number' : 'text'}
                    step={field.kind === 'number' ? 'any' : undefined}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    pattern={field.pattern?.regex}
                    title={field.pattern?.message}
                />
            );
    }

    return (
        <div className={styles.field}>
            <label htmlFor={id} className='pixel-label'>
                {field.label}
                {field.required && <span aria-hidden> *</span>}
            </label>
            {control}
            {field.help && <span className={styles.help}>{field.help}</span>}
        </div>
    );
}

/** The two themes' token values, for previews that show the other theme too
 *  (src/styles/_tokens.scss; keep in sync). */
const THEME_TOKENS: Record<'dark' | 'light', Record<string, string>> = {
    dark: {
        '--bg': BACKGROUNDS.dark[0],
        '--surface': BACKGROUNDS.dark[1],
        '--surface-2': BACKGROUNDS.dark[2],
        '--border': '#34346a',
        '--border-loud': '#4d4d95',
        '--text': '#f0f3f7',
        '--text-muted': '#9ba0c4',
        '--shadow': 'rgba(0, 0, 0, 0.55)',
    },
    light: {
        '--bg': BACKGROUNDS.light[0],
        '--surface': BACKGROUNDS.light[1],
        '--surface-2': BACKGROUNDS.light[2],
        '--border': '#c9c2e2',
        '--border-loud': '#9d92c9',
        '--text': '#1b1830',
        '--text-muted': '#5b5878',
        '--shadow': 'rgba(50, 40, 90, 0.28)',
    },
};

const THEMES = ['dark', 'light'] as const;

/**
 * A character's two theme colors (schemas.ts `theme`), each in its own box
 * (picker, then hex), with the lock between them: locked, editing either sets
 * the other (RecordEditor's setThemeColor). An empty color shows the one the
 * site will use (characterThemeColors) in its picker and as the hex field's
 * placeholder, so it can be edited straight away. A color that fails the
 * readability check against its theme's backgrounds gets the nearest readable
 * color offered, and characters with a similar color there are listed
 * (SimilarColors). Below, a transcript block in each theme shows how the
 * character's lines will look.
 */
function ThemeColorPair({
    fields,
    values,
    onChange,
    linked,
    onToggleLinked,
    cast,
}: {
    fields: Record<'dark' | 'light', FieldDef>;
    values: FormValues;
    onChange: (field: FieldDef, value: string) => void;
    linked: boolean;
    onToggleLinked: () => void;
    /** characters with a color set, for the similar-colors list */
    cast: ColoredCharacter[];
}) {
    const name = values.name?.trim() || 'Name';
    const valid = (v: string | undefined) => (v ? fullHex(v) : null); // #rgb counts, as #rrggbb
    const value = { dark: values[fields.dark.name] ?? '', light: values[fields.light.name] ?? '' };
    const resolved = characterThemeColors(name, valid(value.dark), valid(value.light));

    return (
        <div className={`${styles.field} ${styles.pairField}`}>
            <label htmlFor={`field-${fields.dark.name}`} className='pixel-label'>
                color
            </label>
            <div className={styles.colorPair}>
                {THEMES.map((theme) => {
                    const field = fields[theme];
                    const id = `field-${field.name}`;
                    const color = valid(value[theme]);
                    const contrast = color ? minContrast(color, theme) : null;
                    const suggestion =
                        color && contrast !== null && contrast < MIN_CONTRAST ? suggestColorFor(color, theme) : null;
                    const set = (v: string) => onChange(field, v);
                    return (
                        <Fragment key={theme}>
                            <span className={`${styles.colorBox} ${styles[`${theme}Box`]}`}>
                                <label htmlFor={id} className={styles.colorBoxLabel}>
                                    {theme} mode
                                </label>
                                <span className={styles.colorRow}>
                                    <input
                                        type='color'
                                        aria-label={`${field.label} picker`}
                                        value={valid(value[theme]) ?? resolved[theme]}
                                        onChange={(e) => set(e.target.value)}
                                        style={{ background: BACKGROUNDS[theme][1] }}
                                    />
                                    <input
                                        id={id}
                                        type='text'
                                        value={value[theme]}
                                        onChange={(e) => set(tidyHex(e.target.value))}
                                        // leaving a #rgb shorthand writes it out in full
                                        onBlur={() => color && color !== value[theme] && set(color)}
                                        placeholder={resolved[theme]}
                                        pattern='#([0-9a-fA-F]{3}){1,2}'
                                    />
                                </span>
                            </span>
                            {/* warning and similar colors each get a row shared by both
                                columns, so they line up whichever side has one */}
                            <span className={`${styles.colorNotes} ${styles[`${theme}Warning`]}`}>
                                {suggestion !== null && contrast !== null && (
                                    <>
                                        <span className={styles.warning}>
                                            hard to read in {theme} mode ({contrast.toFixed(1)}:1; text needs {MIN_CONTRAST}:1)
                                        </span>
                                        <button type='button' className={styles.miniButton} onClick={() => set(suggestion)}>
                                            <span className={styles.miniSwatch} style={{ background: suggestion }} aria-hidden />
                                            use {suggestion}
                                        </button>
                                    </>
                                )}
                            </span>
                            <span className={`${styles.colorNotes} ${styles[`${theme}Similar`]}`}>
                                <SimilarColors theme={theme} color={resolved[theme]} cast={cast} />
                            </span>
                        </Fragment>
                    );
                })}
                <span className={styles.lock} data-linked={linked || undefined}>
                    <span className={styles.connector} aria-hidden />
                    <button
                        type='button'
                        className={styles.lockButton}
                        aria-pressed={linked}
                        aria-label='Lock the dark-mode and light-mode colors together'
                        onClick={onToggleLinked}
                        title={
                            linked
                                ? 'Locked: editing either color sets the other to match. Click to edit them separately.'
                                : 'Unlocked: each color is edited on its own. Click to lock them together.'
                        }
                    >
                        <LockIcon locked={linked} />
                    </button>
                    <span className={styles.connector} aria-hidden />
                </span>
            </div>

            <div className={styles.dialoguePreview} aria-label='How this character looks in a transcript'>
                {THEMES.map((mode) => (
                    <div
                        key={mode}
                        className={styles.previewFrame}
                        style={{ ...THEME_TOKENS[mode], '--char': resolved[mode] } as React.CSSProperties}
                    >
                        <span className={styles.previewMode}>{mode} mode</span>
                        <div className={transcript.block}>
                            <PixelAvatar src={values.image || null} name={name} color={resolved[mode]} size={40} />
                            <div className={transcript.blockBody}>
                                <div className={transcript.blockHeader}>
                                    <span className={transcript.speaker}>{name}</span>
                                </div>
                                <div className={transcript.plain}>Did anyone else hear that?</div>
                                <div className={transcript.action}>{name} glances down the corridor.</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** A typed or pasted hex as the field stores it: trimmed, with its `#` (so
 *  `bb063d` from another tool counts as a color). Anything else is left as
 *  typed, for the pattern check to flag. */
function tidyHex(raw: string): string {
    const v = raw.trim();
    return /^([0-9a-fA-F]{3}){1,2}$/.test(v) ? `#${v}` : v;
}

/** A pixel padlock, shackle closed or lifted. */
function LockIcon({ locked }: { locked: boolean }) {
    return (
        <svg className={styles.lockIcon} viewBox='0 0 8 10' aria-hidden shapeRendering='crispEdges'>
            <rect x='2' y='0' width='4' height='1' />
            <rect x='1' y='1' width='1' height={locked ? 4 : 2} />
            <rect x='6' y='1' width='1' height='4' />
            <path fillRule='evenodd' d='M0 5h8v5H0z M3 7h2v2H3z' />
        </svg>
    );
}
