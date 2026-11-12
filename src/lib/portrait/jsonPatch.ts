// Starbound's JSON patches (the .patch files mods ship), same rules as portrait-extract's
// sbassets.apply_patch: a patch is a list of operations or a list of such lists (batches).
// A batch that fails, usually on its `test`, is skipped; a failing flat patch changes nothing.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Op = { op?: string; path?: string; from?: string; value?: Json; inverse?: boolean };

class PatchError extends Error {}

const pointer = (path: string): string[] => {
    if (path === '') return [];
    if (!path.startsWith('/')) throw new PatchError(`bad pointer ${path}`);
    return path.slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
};

function walk(doc: Json, parts: string[]): Json {
    for (const p of parts) {
        if (Array.isArray(doc)) {
            const i = Number(p);
            if (!Number.isInteger(i) || i < 0 || i >= doc.length) throw new PatchError(`no index ${p}`);
            doc = doc[i];
        } else if (doc && typeof doc === 'object') {
            if (!(p in doc)) throw new PatchError(`no key ${p}`);
            doc = doc[p];
        } else throw new PatchError(`cannot descend into ${p}`);
    }
    return doc;
}

function add(doc: Json, parts: string[], value: Json): Json {
    if (!parts.length) return value;
    const parent = walk(doc, parts.slice(0, -1));
    const key = parts[parts.length - 1];
    if (Array.isArray(parent)) {
        if (key === '-') parent.push(value);
        else {
            const i = Number(key);
            if (!Number.isInteger(i) || i < 0 || i > parent.length) throw new PatchError(`index ${key} past end`);
            parent.splice(i, 0, value);
        }
    } else if (parent && typeof parent === 'object') parent[key] = value;
    else throw new PatchError('add into a scalar');
    return doc;
}

function remove(doc: Json, parts: string[]): Json {
    const parent = walk(doc, parts.slice(0, -1));
    const key = parts[parts.length - 1];
    const found = walk(parent, [key]);
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete (parent as { [key: string]: Json })[key];
    return found;
}

const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T extends Json>(doc: T): T => JSON.parse(JSON.stringify(doc));

function applyOps(input: Json, ops: Op[]): Json {
    let doc = clone(input);
    for (const op of ops) {
        const parts = pointer(op.path ?? '');
        if (op.op === 'test') {
            let found: Json;
            try {
                found = walk(doc, parts);
            } catch (e) {
                if (op.inverse) continue;
                throw e;
            }
            if (op.value === undefined) {
                if (op.inverse) throw new PatchError('inverse test: path exists');
                continue;
            }
            if (same(found, op.value) === !!op.inverse) throw new PatchError('test failed');
        } else if (op.op === 'add') doc = add(doc, parts, clone(op.value ?? null));
        else if (op.op === 'replace') {
            walk(doc, parts);
            if (parts.length) remove(doc, parts);
            doc = add(doc, parts, clone(op.value ?? null));
        } else if (op.op === 'remove') remove(doc, parts);
        else if (op.op === 'move') doc = add(doc, parts, remove(doc, pointer(op.from ?? '')));
        else if (op.op === 'copy') doc = add(doc, parts, clone(walk(doc, pointer(op.from ?? ''))));
        else throw new PatchError(`unknown op ${op.op}`);
    }
    return doc;
}

/** The document with the patch applied; unchanged where the patch (or a batch of it) fails. */
export function applyPatch(doc: Json, patch: Json): Json {
    if (!Array.isArray(patch)) return doc;
    if (patch.length && patch.every(Array.isArray)) {
        for (const batch of patch) {
            try {
                doc = applyOps(doc, batch as Op[]);
            } catch {
                // a failed batch is skipped
            }
        }
        return doc;
    }
    try {
        return applyOps(doc, patch as Op[]);
    } catch {
        return doc;
    }
}
