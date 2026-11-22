// Style layers for tests, shaped as species.ts derives them.

import type { StyleColor, StyleSlot } from '../types';

const ABOVE = { head: 'head', body: 'body', frontArm: 'frontArm', backArm: 'backArm' };

/** One of the game's own three: a style is one image over the head. */
export function builtinSlot(kind: string, id: string, group: string, options: string[], color: StyleColor[], above: string): StyleSlot {
    const files = Object.fromEntries(options.filter(Boolean).map((o) => [o, { head: `/humanoid/${kind}/${group}/${o}.png` }]));
    return { id, label: id, group, options, files, color, colors: [], stack: false, masked: true, above: { ...ABOVE, head: above }, builtin: true };
}

/** A species' own layer: each style a folder with a sheet for each part listed. */
export function ownSlot(kind: string, id: string, styles: Record<string, string[]>, over: Partial<StyleSlot> = {}): StyleSlot {
    const files = Object.fromEntries(Object.entries(styles).map(([o, parts]) => [o, Object.fromEntries(parts.map((p) => [p, `/humanoid/${kind}/${id}/${o}/${p.toLowerCase()}.png`]))]));
    return { id, label: id, group: id, options: ['', ...Object.keys(styles)], files, color: ['body'], colors: [], stack: false, masked: false, above: { ...ABOVE }, builtin: false, ...over };
}
