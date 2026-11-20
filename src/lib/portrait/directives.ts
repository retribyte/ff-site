// Starbound image directives ("?replace;ffca8a=d0d4e9?hueshift=40"), ported from
// OpenStarbound's StarImageProcessing.cpp / StarColor.cpp. Only the operations the installed
// species and clothing use are implemented; an unknown one is skipped.

import type { ColorOption, Pixels } from './types';

export type Operation =
    | { type: 'replace'; map: Map<number, number> }
    | { type: 'hueshift'; amount: number }
    | { type: 'saturation'; amount: number }
    | { type: 'brightness'; multiply: number }
    | { type: 'multiply'; color: [number, number, number, number] }
    | { type: 'setcolor'; color: [number, number, number] };

/** 3, 4, 6 or 8 hex digits to [r, g, b, a]; null if malformed. */
export function hexToRgba(hex: string): [number, number, number, number] | null {
    const s = hex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]+$/.test(s)) return null;
    if (s.length === 3 || s.length === 4) {
        const n = [...s].map((c) => parseInt(c + c, 16));
        return [n[0], n[1], n[2], n[3] ?? 255];
    }
    if (s.length === 6 || s.length === 8) {
        const n = [0, 2, 4, 6].map((i) => (i < s.length ? parseInt(s.slice(i, i + 2), 16) : 255));
        return [n[0], n[1], n[2], n[3]];
    }
    return null;
}

export function rgbaToHex(r: number, g: number, b: number, a = 255): string {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return h(r) + h(g) + h(b) + (a === 255 ? '' : h(a));
}

const pack = (c: ArrayLike<number>) => ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0;

export function parseDirectives(directives: string): Operation[] {
    const ops: Operation[] = [];
    for (const part of directives.split('?')) {
        const bits = part.split(/[=;]/).filter((b) => b !== '');
        if (bits.length === 0) continue;
        const type = bits[0].toLowerCase();
        if (type === 'replace') {
            const map = new Map<number, number>();
            for (let i = 1; i + 1 < bits.length; i += 2) {
                const from = hexToRgba(bits[i]);
                const to = hexToRgba(bits[i + 1]);
                if (from && to) map.set(pack(from), pack(to));
            }
            if (map.size) ops.push({ type, map });
        } else if (type === 'hueshift' && bits[1]) {
            ops.push({ type, amount: parseFloat(bits[1]) / 360 });
        } else if (type === 'saturation' && bits[1]) {
            ops.push({ type, amount: parseFloat(bits[1]) / 100 });
        } else if (type === 'brightness' && bits[1]) {
            ops.push({ type, multiply: parseFloat(bits[1]) / 100 + 1 });
        } else if (type === 'multiply' && bits[1]) {
            const color = hexToRgba(bits[1]);
            if (color) ops.push({ type, color });
        } else if (type === 'setcolor' && bits[1]) {
            const color = hexToRgba(bits[1]);
            if (color) ops.push({ type, color: [color[0], color[1], color[2]] });
        }
    }
    return ops;
}

function toHsv(r: number, g: number, b: number): [number, number, number] {
    const vr = r / 255, vg = g / 255, vb = b / 255;
    const max = Math.max(vr, vg, vb);
    const delta = max - Math.min(vr, vg, vb);
    if (delta === 0) return [0, 0, max];
    const dr = ((max - vr) / 6 + delta / 2) / delta;
    const dg = ((max - vg) / 6 + delta / 2) / delta;
    const db = ((max - vb) / 6 + delta / 2) / delta;
    let h = vr === max ? db - dg : vg === max ? 1 / 3 + dr - db : 2 / 3 + dg - dr;
    if (h < 0) h += 1;
    if (h >= 1) h -= 1;
    return [h, delta / max, max];
}

function fromHsv(h: number, s: number, v: number): [number, number, number] {
    if (s === 0) {
        const c = Math.round(v * 255);
        return [c, c, c];
    }
    let vh = h * 6;
    if (vh === 6) vh = 0;
    const i = Math.floor(vh);
    const v1 = v * (1 - s);
    const v2 = v * (1 - s * (vh - i));
    const v3 = v * (1 - s * (1 - (vh - i)));
    const rgb = [[v, v3, v1], [v2, v, v1], [v1, v, v3], [v1, v2, v], [v3, v1, v], [v, v1, v2]][i] ?? [v, v1, v2];
    return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Apply operations in place. Fully transparent pixels are left alone by the HSV operations, as in the game. */
export function applyOperations(data: Uint8ClampedArray, ops: Operation[]): void {
    for (const op of ops) {
        for (let i = 0; i < data.length; i += 4) {
            if (op.type === 'replace') {
                const to = op.map.get(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
                if (to !== undefined) {
                    data[i] = to >>> 24;
                    data[i + 1] = (to >>> 16) & 255;
                    data[i + 2] = (to >>> 8) & 255;
                    data[i + 3] = to & 255;
                }
            } else if (op.type === 'multiply') {
                for (let c = 0; c < 4; c++) data[i + c] = Math.trunc((data[i + c] * op.color[c]) / 255);
            } else if (op.type === 'setcolor') {
                data[i] = op.color[0];
                data[i + 1] = op.color[1];
                data[i + 2] = op.color[2];
            } else if (data[i + 3] !== 0) {
                let [h, s, v] = toHsv(data[i], data[i + 1], data[i + 2]);
                if (op.type === 'hueshift') {
                    if (op.amount === 0) continue;
                    h += op.amount;
                    if (h >= 1) h -= 1;
                    if (h < 0) h += 1;
                } else if (op.type === 'saturation') {
                    s = clamp01(s + op.amount);
                } else {
                    v = clamp01(v * op.multiply);
                }
                const rgb = fromHsv(h, s, v);
                data[i] = rgb[0];
                data[i + 1] = rgb[1];
                data[i + 2] = rgb[2];
            }
        }
    }
}

/** A colour option as a directive string, the way the game's colorDirectivesFromConfig builds it. */
export function optionDirective(option: ColorOption | undefined): string {
    if (option === undefined) return '';
    if (typeof option === 'string') return option;
    const pairs = Object.entries(option).map(([from, to]) => `;${from}=${to}`);
    return pairs.length ? `?replace${pairs.join('')}` : '';
}

/** Index into a list the way Starbound's List::wrap does. */
export function wrap<T>(list: T[], index: number): T | undefined {
    return list.length ? list[((index % list.length) + list.length) % list.length] : undefined;
}

/** The distinct opaque-ish colours of an image, most used first (what a palette editor lists). */
export function distinctColors(pixels: Pixels): string[] {
    const counts = new Map<string, number>();
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const hex = rgbaToHex(d[i], d[i + 1], d[i + 2], d[i + 3]);
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}
