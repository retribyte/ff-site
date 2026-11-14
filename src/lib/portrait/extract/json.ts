// Starbound's JSON, read as scripts/portrait-extract/sbassets.py reads it: comments allowed,
// raw control characters allowed inside strings, and a trailing comma forgiven.

import type { Json } from '../jsonPatch';

/** Removes // and /* *​/ comments, leaving anything inside strings alone. */
export function stripComments(text: string): string {
    const out: string[] = [];
    const n = text.length;
    let i = 0;
    while (i < n) {
        const c = text[i];
        if (c === '"') {
            let j = i + 1;
            while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
            out.push(text.slice(i, j + 1));
            i = j + 1;
        } else if (c === '/' && text[i + 1] === '/') {
            while (i < n && text[i] !== '\r' && text[i] !== '\n') i++;
        } else if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? n : end + 2;
        } else {
            out.push(c);
            i++;
        }
    }
    return out.join('');
}

/** Escapes the control characters JSON.parse refuses inside strings (Python's strict=False takes them). */
function escapeControls(text: string): string {
    const out: string[] = [];
    const n = text.length;
    let i = 0;
    while (i < n) {
        if (text[i] !== '"') {
            out.push(text[i++]);
            continue;
        }
        let j = i + 1;
        let piece = '"';
        while (j < n && text[j] !== '"') {
            if (text[j] === '\\') {
                piece += text.slice(j, j + 2);
                j += 2;
            } else {
                const code = text.charCodeAt(j);
                piece += code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : text[j];
                j++;
            }
        }
        out.push(piece + '"');
        i = j + 1;
    }
    return out.join('');
}

const TRAILING_COMMA = /,(\s*[}\]])/g;
const decoder = new TextDecoder('utf-8');

/** Throws SyntaxError when the text is not JSON even leniently read. */
export function parseJson(data: Uint8Array | string): Json {
    const text = stripComments(typeof data === 'string' ? data : decoder.decode(data));
    try {
        return JSON.parse(text);
    } catch {
        const escaped = escapeControls(text);
        try {
            return JSON.parse(escaped);
        } catch {
            return JSON.parse(escaped.replace(TRAILING_COMMA, '$1'));
        }
    }
}

export type Obj = { [key: string]: Json };
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
