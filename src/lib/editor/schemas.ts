import { api } from '@/lib/api';
import { formatGuyDate, parseGuyDate } from '@/lib/guy-time';
import { ITEM_TYPE_META, SENTIENCE_LABELS } from '@/lib/lore';

// The one FF galaxy, per the Phase 1 seed (src/lib/space.ts and the space
// console components hardcode the same slug).
const GALAXY_SLUG = 'ff';

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
    /** number: HTML5 min/max/step hints (validation still happens server-side) */
    min?: number;
    max?: number;
    step?: number | 'any';
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
    /** API collection for GET-by-id (edit mode) / PUT / DELETE, e.g. '/characters' */
    basePath: string;
    /** POST path for create, when it differs from basePath (e.g. a nested
     *  '/galaxies/ff/systems' create route backed by a flat '/systems/:id' resource).
     *  Defaults to basePath. */
    createPath?: string;
    /** where to land after an edit-save/delete, and the "back" link target */
    viewPath: (id: number | string) => string;
    /** where to land after a *create* save, when it differs from viewPath
     *  (e.g. system metadata creation hands off to the body-tree builder) */
    afterCreatePath?: (id: number | string) => string;
    indexPath: string;
    fields: FieldDef[];
    /** override how the existing record is loaded server-side in edit mode;
     *  default: GET `${basePath}/${id}`. For resources with no GET-by-id
     *  route (e.g. landmarks, only returned nested inside the galaxy payload). */
    loadRecord?: (id: number) => Promise<Record<string, unknown> | null>;
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
            placeholder: '4-2-3022',
            help: 'GUY notation: equinox-semester-year (45 eqx/semester, 32 semesters/GUY)',
            pattern: { regex: '\\d{1,2}-\\d{1,2}--?\\d+', message: 'use equinox-semester-year, e.g. 4-2-3022' },
            read: (record) => (typeof record.dob === 'number' ? formatGuyDate(record.dob) : ''),
            // undefined marks invalid input — valuesToPayload turns it into a form error
            write: (value) => (value === '' ? null : (parseGuyDate(value) ?? undefined)),
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

export const landmarkSchema: EntitySchema = {
    kind: 'landmark',
    basePath: '/landmarks',
    createPath: `/galaxies/${GALAXY_SLUG}/landmarks`,
    // No detail page for landmarks — they only ever show as markers on
    // /galaxy, so both the post-save and back-link destinations are the map.
    viewPath: () => '/galaxy',
    indexPath: '/galaxy',
    // There's no GET /landmarks/:id route (landmarks are only ever returned
    // nested inside GET /galaxies/:slug) — load the record from there instead.
    loadRecord: async (id) => {
        const galaxy = await api<{ landmarks: Record<string, unknown>[] }>(`/galaxies/${GALAXY_SLUG}`);
        return galaxy.landmarks.find((landmark) => landmark.id === id) ?? null;
    },
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        { name: 'description', label: 'description', kind: 'textarea' },
        {
            name: 'xPos',
            label: 'x position',
            kind: 'number',
            required: true,
            min: 0,
            max: 1,
            step: 0.01,
            help: '0..1, normalized to the galaxy map',
        },
        {
            name: 'yPos',
            label: 'y position',
            kind: 'number',
            required: true,
            min: 0,
            max: 1,
            step: 0.01,
            help: '0..1, normalized to the galaxy map',
        },
        { name: 'wikiArticle', label: 'wiki article', kind: 'text' },
    ],
};

// System *metadata* only (name/description/wiki) — the body tree (star →
// planets → moons) is edited in the dedicated SystemBuilder, not here.
export const starSystemSchema: EntitySchema = {
    kind: 'system',
    basePath: '/systems',
    createPath: `/galaxies/${GALAXY_SLUG}/systems`,
    viewPath: (id) => `/galaxy/systems/${id}`,
    // Creating a system is just the metadata shell — the natural next hop is
    // the body-tree builder, not the (still-empty) read-only page.
    afterCreatePath: (id) => `/galaxy/systems/${id}/edit`,
    indexPath: '/galaxy',
    fields: [
        { name: 'name', label: 'name', kind: 'text', required: true },
        { name: 'description', label: 'description', kind: 'textarea' },
        { name: 'wikiArticle', label: 'wiki article', kind: 'text' },
    ],
};

export const EDITOR_SCHEMAS = {
    character: characterSchema,
    species: speciesSchema,
    item: itemSchema,
    landmark: landmarkSchema,
    system: starSystemSchema,
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

/** Thrown when a field's custom write rejects the input; shown as the form error. */
export class FieldValidationError extends Error {}

export function valuesToPayload(schema: EntitySchema, values: FormValues): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of schema.fields) {
        const value = values[field.name];
        if (field.write) {
            const written = field.write(value as string);
            if (written === undefined) {
                throw new FieldValidationError(`${field.label}: ${field.pattern?.message ?? 'invalid value'}`);
            }
            payload[field.name] = written;
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
