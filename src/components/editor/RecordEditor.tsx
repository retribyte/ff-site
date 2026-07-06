'use client';

import { useEffect, useMemo, useState } from 'react';
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
import DeleteControl from '@/components/DeleteControl';
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
    data?: { id?: number };
}

/** Loads the options for an entity-ref picker (species list, character list…). */
function useRefOptions(fields: FieldDef[]) {
    const refPaths = useMemo(
        () => [...new Set(fields.filter((f) => f.kind === 'entity-ref').map((f) => f.ref!.path))],
        [fields]
    );
    const [options, setOptions] = useState<Record<string, { id: number; label: string }[]>>({});

    useEffect(() => {
        let cancelled = false;
        for (const path of refPaths) {
            const labelField = fields.find((f) => f.ref?.path === path)!.ref!.labelField;
            fetch(`/api/ff${path}`)
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

    const set = (name: string, value: string | string[]) => setValues((prev) => ({ ...prev, [name]: value }));

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
            const res = await fetch(`/api/ff${schema.basePath}${isEdit ? `/${recordId}` : ''}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const envelope = (await res.json()) as Envelope;
            if (!res.ok || envelope.status === 'error') {
                setError(envelope.message ?? `Save failed (HTTP ${res.status})`);
                return;
            }
            const id = envelope.data?.id ?? recordId;
            router.push(id !== undefined ? schema.viewPath(id) : schema.indexPath);
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
            const res = await fetch(`/api/ff${schema.basePath}/${recordId}`, { method: 'DELETE' });
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
            {schema.fields.map((field) => (
                <Field
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    onChange={(v) => set(field.name, v)}
                    refOptions={field.ref ? (refOptions[field.ref.path] ?? []) : []}
                />
            ))}

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

function Field({
    field,
    value,
    onChange,
    refOptions,
}: {
    field: FieldDef;
    value: string | string[];
    onChange: (value: string | string[]) => void;
    refOptions: { id: number; label: string }[];
}) {
    const id = `field-${field.name}`;

    let control: React.ReactNode;
    switch (field.kind) {
        case 'textarea':
            control = (
                <textarea
                    id={id}
                    value={value as string}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={4}
                />
            );
            break;
        case 'select':
            control = (
                <select id={id} value={value as string} onChange={(e) => onChange(e.target.value)} required={field.required}>
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
                <select id={id} value={value as string} onChange={(e) => onChange(e.target.value)} required={field.required}>
                    <option value=''>{field.required ? 'select…' : '(none)'}</option>
                    {refOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
            break;
        case 'color':
            control = (
                <span className={styles.colorRow}>
                    <input
                        type='color'
                        aria-label={`${field.label} picker`}
                        value={/^#[0-9a-fA-F]{6}$/.test(value as string) ? (value as string) : '#5d4be5'}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <input
                        id={id}
                        type='text'
                        value={value as string}
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
        case 'list': {
            const items = value as string[];
            control = (
                <span className={styles.list}>
                    {items.map((item, index) => (
                        <span key={index} className={styles.listRow}>
                            <input
                                type='text'
                                value={item}
                                placeholder={field.placeholder}
                                aria-label={`${field.label} ${index + 1}`}
                                onChange={(e) =>
                                    onChange(items.map((existing, i) => (i === index ? e.target.value : existing)))
                                }
                            />
                            <button
                                type='button'
                                className={styles.miniButton}
                                aria-label={`Remove ${field.label} ${index + 1}`}
                                onClick={() => onChange(items.filter((_, i) => i !== index))}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button type='button' className={styles.miniButton} onClick={() => onChange([...items, ''])}>
                        + add
                    </button>
                </span>
            );
            break;
        }
        default:
            control = (
                <input
                    id={id}
                    type={field.kind === 'number' ? 'number' : 'text'}
                    step={field.kind === 'number' ? 'any' : undefined}
                    value={value as string}
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
