import { ddMmYyyyToIso, formatDdMmYyyy } from '@/lib/dates';
import { ITEM_TYPE_META, SENTIENCE_LABELS } from '@/lib/lore';

// Schema-driven editing: every record type declares its fields once and the
// RecordEditor renders/validates/submits any of them.

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'color' | 'list' | 'entity-ref';

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
    /** list: key each string maps to in the API's object array, e.g. 'name' for aliases */
    itemKey?: string;
    /** custom record → form-value read (default: direct field access) */
    read?: (record: Record<string, unknown>) => unknown;
    /** custom form-value → payload write (default: by-kind conversion) */
    write?: (value: string) => unknown;
    /** input pattern + message shown when it doesn't match */
    pattern?: { regex: string; message: string };
}

export interface EntitySchema {
    kind: string;
    /** API collection, e.g. '/characters' */
    basePath: string;
    /** where to land after save/delete */
    viewPath: (id: number | string) => string;
    indexPath: string;
    fields: FieldDef[];
}

const SEX_OPTIONS = [
    { value: 'UNSPECIFIED', label: 'unspecified' },
    { value: 'MALE', label: 'male' },
    { value: 'FEMALE', label: 'female' },
    { value: 'OTHER', label: 'other' },
];

export const characterSchema: EntitySchema = {
    kind: 'character',
    basePath: '/characters',
    viewPath: (id) => `/characters/${id}`,
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
        { name: 'sex', label: 'sex', kind: 'select', required: true, options: SEX_OPTIONS },
        { name: 'aliases', label: 'aliases', kind: 'list', itemKey: 'name', placeholder: 'The Commander' },
        {
            name: 'relationships',
            label: 'relationships',
            kind: 'list',
            itemKey: 'description',
            placeholder: 'Sibling of …',
        },
        { name: 'blurb', label: 'blurb', kind: 'textarea', help: 'short public bio shown on the dossier' },
        {
            name: 'dob',
            label: 'date of birth',
            kind: 'text',
            placeholder: 'dd-mm-yyyy',
            help: 'GUY notation, dd-mm-yyyy',
            pattern: { regex: '\\d{1,2}-\\d{1,2}-\\d{4}', message: 'use dd-mm-yyyy' },
            read: (record) => (typeof record.dob === 'string' ? formatDdMmYyyy(new Date(record.dob)) : ''),
            write: (value) => (value === '' ? null : ddMmYyyyToIso(value)),
        },
        { name: 'pob', label: 'birthplace', kind: 'text' },
        { name: 'homePlanet', label: 'home planet', kind: 'text' },
        { name: 'height', label: 'height (m)', kind: 'number' },
        { name: 'weight', label: 'weight (kg)', kind: 'number' },
        { name: 'hairColor', label: 'hair color', kind: 'text' },
        { name: 'eyeColor', label: 'eye color', kind: 'text' },
        { name: 'image', label: 'avatar url', kind: 'text', placeholder: '/avatars/emmett.png' },
        { name: 'themeColor', label: 'theme color', kind: 'color' },
        { name: 'wikiArticle', label: 'wiki article', kind: 'text', placeholder: 'Emmett_Tawfeek' },
    ],
};

export const speciesSchema: EntitySchema = {
    kind: 'species',
    basePath: '/species',
    viewPath: (id) => `/species/${id}`,
    indexPath: '/species',
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        { name: 'binomialName', label: 'binomial name', kind: 'text', placeholder: 'Squoatlus lastus' },
        { name: 'description', label: 'description', kind: 'textarea', required: true },
        {
            name: 'class',
            label: 'sentience class',
            kind: 'select',
            required: true,
            options: Object.entries(SENTIENCE_LABELS).map(([value, label]) => ({ value, label })),
        },
        { name: 'lifespan', label: 'lifespan (GUY)', kind: 'text', required: true, placeholder: '~80 GUY' },
        { name: 'diet', label: 'diet', kind: 'text', placeholder: 'Omnivore' },
        { name: 'habitat', label: 'habitat', kind: 'text' },
        { name: 'placeOfOrigin', label: 'place of origin', kind: 'text' },
        { name: 'wikiArticle', label: 'wiki article', kind: 'text' },
    ],
};

export const itemSchema: EntitySchema = {
    kind: 'item',
    basePath: '/items',
    viewPath: (id) => `/items/${id}`,
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
        {
            name: 'characterId',
            label: 'bearer',
            kind: 'entity-ref',
            ref: { path: '/characters', labelField: 'name' },
            help: 'optional — the character this item belongs to',
        },
        { name: 'image', label: 'image url', kind: 'text' },
        { name: 'wikiArticle', label: 'wiki article', kind: 'text' },
    ],
};

export const EDITOR_SCHEMAS = {
    character: characterSchema,
    species: speciesSchema,
    item: itemSchema,
} as const;

export type EditorKind = keyof typeof EDITOR_SCHEMAS;

// ---------- record ↔ form value conversion ----------

export type FormValues = Record<string, string | string[]>;

export function recordToValues(schema: EntitySchema, record: Record<string, unknown> | null): FormValues {
    const values: FormValues = {};
    for (const field of schema.fields) {
        if (record && field.read) {
            values[field.name] = field.read(record) as string;
            continue;
        }
        const raw = record?.[field.name];
        if (field.kind === 'list') {
            const items = Array.isArray(raw) ? raw : [];
            values[field.name] = items.map((item) => String((item as Record<string, unknown>)[field.itemKey!] ?? ''));
        } else if (raw === null || raw === undefined) {
            values[field.name] = field.kind === 'select' ? (field.options?.[0]?.value ?? '') : '';
        } else {
            values[field.name] = String(raw);
        }
    }
    return values;
}

export function valuesToPayload(schema: EntitySchema, values: FormValues): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of schema.fields) {
        const value = values[field.name];
        if (field.write) {
            payload[field.name] = field.write(value as string);
            continue;
        }
        switch (field.kind) {
            case 'list':
                payload[field.name] = (value as string[])
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => ({ [field.itemKey!]: item }));
                break;
            case 'number':
                payload[field.name] = value === '' ? null : parseFloat(value as string);
                break;
            case 'entity-ref':
                payload[field.name] = value === '' ? null : parseInt(value as string);
                break;
            default:
                payload[field.name] = value === '' ? null : value;
        }
    }
    return payload;
}
