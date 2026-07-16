import { ITEM_TYPE_META, SENTIENCE_LABELS } from '@/lib/lore';

// Schema-driven editing: every record type declares its fields once and the
// RecordEditor renders/validates/submits any of them.

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'color' | 'entity-ref';

export interface FieldDef {
    name: string;
    label: string;
    kind: FieldKind;
    required?: boolean;
    placeholder?: string;
    help?: string;
    /** select: the enum choices */
    options?: { value: string; label: string }[];
    /** entity-ref: which collection the picker loads (API path + label field) */
    ref?: { path: string; labelField: string };
    /** custom record → form-value read (default: direct field access) */
    read?: (record: Record<string, unknown>) => unknown;
    /** custom form-value → payload write (default: by-kind conversion) */
    write?: (value: string) => unknown;
    /** input pattern + message shown when it doesn't match */
    pattern?: { regex: string; message: string };
    /** when the form value is empty, omit the key from the payload entirely
     *  instead of sending null — for optional columns that 500 on null
     *  (e.g. slug, which the API derives from name when absent) */
    omitWhenEmpty?: boolean;
}

export interface EntitySchema {
    kind: string;
    /** API collection, e.g. '/characters' */
    basePath: string;
    /** where to land after save/delete */
    viewPath: (idOrSlug: number | string) => string;
    indexPath: string;
    fields: FieldDef[];
}

const SLUG_FIELD: FieldDef = {
    name: 'slug',
    label: 'slug',
    kind: 'text',
    placeholder: 'derived from name if left blank',
    help: 'blank = derived from name on create; lowercase words joined by underscores',
    pattern: { regex: '^[a-z0-9]+(_[a-z0-9]+)*$', message: 'lowercase words joined by underscores' },
    omitWhenEmpty: true,
};

export const characterSchema: EntitySchema = {
    kind: 'character',
    basePath: '/characters',
    viewPath: (idOrSlug) => `/characters/${idOrSlug}`,
    indexPath: '/characters',
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        {
            name: 'speciesId',
            label: 'species',
            kind: 'entity-ref',
            required: true,
            ref: { path: '/species', labelField: 'name' },
        },
        { name: 'blurb', label: 'blurb', kind: 'textarea', help: 'short public bio shown on the dossier' },
        { name: 'image', label: 'avatar url', kind: 'text', placeholder: '/avatars/emmett.png' },
        { name: 'color', label: 'theme color', kind: 'color' },
        SLUG_FIELD,
    ],
};

export const speciesSchema: EntitySchema = {
    kind: 'species',
    basePath: '/species',
    viewPath: (idOrSlug) => `/species/${idOrSlug}`,
    indexPath: '/species',
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        { name: 'description', label: 'description', kind: 'textarea', required: true },
        {
            name: 'class',
            label: 'sentience class',
            kind: 'select',
            required: true,
            options: Object.entries(SENTIENCE_LABELS).map(([value, label]) => ({ value, label })),
        },
        SLUG_FIELD,
    ],
};

export const itemSchema: EntitySchema = {
    kind: 'item',
    basePath: '/items',
    viewPath: (idOrSlug) => `/items/${idOrSlug}`,
    indexPath: '/items',
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        {
            name: 'itemType',
            label: 'type',
            kind: 'select',
            required: true,
            options: Object.entries(ITEM_TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
        },
        { name: 'description', label: 'description', kind: 'textarea', required: true },
        { name: 'image', label: 'image url', kind: 'text' },
        SLUG_FIELD,
    ],
};

export const EDITOR_SCHEMAS = {
    character: characterSchema,
    species: speciesSchema,
    item: itemSchema,
} as const;

export type EditorKind = keyof typeof EDITOR_SCHEMAS;

// ---------- record ↔ form value conversion ----------

export type FormValues = Record<string, string>;

export function recordToValues(schema: EntitySchema, record: Record<string, unknown> | null): FormValues {
    const values: FormValues = {};
    for (const field of schema.fields) {
        if (record && field.read) {
            values[field.name] = field.read(record) as string;
            continue;
        }
        const raw = record?.[field.name];
        if (raw === null || raw === undefined) {
            values[field.name] = field.kind === 'select' ? (field.options?.[0]?.value ?? '') : '';
        } else {
            values[field.name] = String(raw);
        }
    }
    return values;
}

/** Thrown when a field's custom write rejects the input; shown as the form error. */
export class FieldValidationError extends Error {}

export function valuesToPayload(schema: EntitySchema, values: FormValues): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of schema.fields) {
        const value = values[field.name];
        if (field.omitWhenEmpty && value.trim() === '') continue;
        if (field.write) {
            const written = field.write(value);
            if (written === undefined) {
                throw new FieldValidationError(`${field.label}: ${field.pattern?.message ?? 'invalid value'}`);
            }
            payload[field.name] = written;
            continue;
        }
        switch (field.kind) {
            case 'number':
                payload[field.name] = value === '' ? null : parseFloat(value);
                break;
            case 'entity-ref':
                payload[field.name] = value === '' ? null : parseInt(value);
                break;
            default:
                payload[field.name] = value === '' ? null : value;
        }
    }
    return payload;
}
