// Reviewing a revision of a story already on the shelf (the /import page):
// the incoming draft compared line by line with the story as it stands, each
// difference listed, and the draft rebuilt with whichever side the reviewer
// keeps for each. Pure, so the importer can recompute it on every pick.
//
// Lines line up by their text (a longest common subsequence, as transcripts'
// re-imports do); between two matches, leftover lines pair up as edits when
// they're alike enough, else one is removed and the other added. A matched or
// paired line differs when its type, text, voice, inline runs or picture do.

export interface RevSegment {
    text: string;
    characterId?: number | null;
    personaId?: number | null;
    speaker?: string | null;
    npc?: boolean;
    italic?: boolean;
    bold?: boolean;
}

export interface RevLine {
    type: string;
    text: string;
    characterId?: number;
    personaId?: number;
    speaker?: string;
    npcVoice?: boolean;
    segments?: RevSegment[];
    booruId?: number;
}

export interface RevChapter<L> {
    chapter_no: number;
    title?: string | null;
    lines: L[];
}

/** One difference: a line changed, added by the draft, or only on the shelf. */
export interface Change<L> {
    key: string;
    kind: 'changed' | 'added' | 'removed';
    chapterNo: number;
    /** the shelf's line and its number (changed, removed) */
    shelf?: L;
    shelfNo?: number;
    /** the draft's line and its position in the draft's chapter (changed, added) */
    incoming?: L;
    incomingNo?: number;
    /** what differs, for a changed line */
    differs?: ('text' | 'voice' | 'type' | 'styling' | 'picture')[];
}

type Step<L> = { same: L } | { change: Change<L> };

export interface Revision<L> {
    chapters: { chapter_no: number; title?: string | null; steps: Step<L>[] }[];
    changes: Change<L>[];
}

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A voice as one comparable string: a character (and persona) by id, an NPC by name, or none. */
function voiceSig(v: { characterId?: number | null; personaId?: number | null; speaker?: string | null; npcVoice?: boolean; npc?: boolean }) {
    if (v.characterId != null) return `c${v.characterId}:${v.personaId ?? ''}`;
    if (v.npcVoice || v.npc || v.speaker) return `n:${(v.speaker ?? '').trim().toLowerCase()}`;
    return '';
}
const segmentsSig = (line: RevLine) =>
    (line.segments ?? []).map((s) => `${s.text}\u0001${voiceSig(s)}\u0001${s.italic ? 1 : 0}${s.bold ? 1 : 0}`).join('\u0002');
const voicesSig = (line: RevLine) => [voiceSig(line), ...(line.segments ?? []).map(voiceSig)].join('|');
const stylingSig = (line: RevLine) => (line.segments ?? []).map((s) => `${s.text.length}${s.italic ? 'i' : ''}${s.bold ? 'b' : ''}`).join('|');

function differences(a: RevLine, b: RevLine): Change<RevLine>['differs'] {
    const out: NonNullable<Change<RevLine>['differs']> = [];
    if (a.text !== b.text) out.push('text');
    if (voicesSig(a) !== voicesSig(b)) out.push('voice');
    if (a.type !== b.type) out.push('type');
    if (a.text === b.text && segmentsSig(a) !== segmentsSig(b) && stylingSig(a) !== stylingSig(b)) out.push('styling');
    if ((a.booruId ?? null) !== (b.booruId ?? null)) out.push('picture');
    return out;
}

/** How alike two texts are, 0..1: the share of words they have in common. */
export function similarity(a: string, b: string): number {
    const words = (t: string) => norm(t).toLowerCase().split(' ').filter(Boolean);
    const wa = words(a);
    const wb = words(b);
    if (!wa.length && !wb.length) return 1;
    const count = new Map<string, number>();
    for (const w of wa) count.set(w, (count.get(w) ?? 0) + 1);
    let common = 0;
    for (const w of wb) {
        const n = count.get(w) ?? 0;
        if (n > 0) {
            common++;
            count.set(w, n - 1);
        }
    }
    return (2 * common) / (wa.length + wb.length);
}

// Leftover lines between two matches pair up as one edited line only when this alike
const SAME_LINE = 0.4;
// A whole long story against its revision (Vortox Machina is ~3,300 lines)
const MAX_LCS_CELLS = 30_000_000;

/** Matched index pairs of a longest common subsequence of a and b (none when too big). */
function lcs(a: string[], b: string[]): [number, number][] {
    const n = a.length;
    const m = b.length;
    if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_LCS_CELLS) return [];
    const w = m + 1;
    const len = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            len[i * w + j] = a[i] === b[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
        }
    }
    const pairs: [number, number][] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) pairs.push([i++, j++]);
        else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) i++;
        else j++;
    }
    return pairs;
}

// Above this many pairs a gap pairs its lines by position instead
const MAX_GAP_CELLS = 40_000;

/**
 * The lines of a gap that are one line edited: the in-order pairing with the
 * most total likeness, counting only pairs alike enough. A gap too big for
 * that pairs by position.
 */
function pairAlike(a: string[], b: string[]): [number, number][] {
    const n = a.length;
    const m = b.length;
    if (!n || !m) return [];
    if (n * m > MAX_GAP_CELLS) {
        const pairs: [number, number][] = [];
        for (let k = 0; k < Math.min(n, m); k++) if (similarity(a[k], b[k]) >= SAME_LINE) pairs.push([k, k]);
        return pairs;
    }
    const sim = (i: number, j: number) => similarity(a[i], b[j]);
    // best[i][j]: the most likeness pairing a[i..] with b[j..]
    const w = m + 1;
    const best = new Float64Array((n + 1) * w);
    const pick = new Float64Array(n * m);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            const s = sim(i, j);
            pick[i * m + j] = s;
            const paired = s >= SAME_LINE ? s + best[(i + 1) * w + j + 1] : -1;
            best[i * w + j] = Math.max(paired, best[(i + 1) * w + j], best[i * w + j + 1]);
        }
    }
    const pairs: [number, number][] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        const s = pick[i * m + j];
        if (s >= SAME_LINE && best[i * w + j] === s + best[(i + 1) * w + j + 1]) pairs.push([i++, j++]);
        else if (best[i * w + j] === best[(i + 1) * w + j]) i++;
        else j++;
    }
    return pairs;
}

// The alignment is the costly part and depends only on the texts, so the last
// one per chapter is kept: a speaker pick or a kept line doesn't redo it
const alignCache = new Map<string, { key: string; result: (number | null)[] }>();

/** For each new line, the old line it lines up with (null: added). */
export function alignLines(oldTexts: string[], newTexts: string[], cacheKey?: string): (number | null)[] {
    const key = cacheKey ? `${oldTexts.join('\u0000')}\u0001${newTexts.join('\u0000')}` : '';
    const cached = cacheKey ? alignCache.get(cacheKey) : undefined;
    if (cached && cached.key === key) return cached.result;

    const a = oldTexts.map(norm);
    const b = newTexts.map(norm);
    const n = a.length;
    const m = b.length;
    let pre = 0;
    while (pre < n && pre < m && a[pre] === b[pre]) pre++;
    let suf = 0;
    while (suf < n - pre && suf < m - pre && a[n - 1 - suf] === b[m - 1 - suf]) suf++;
    const anchors: [number, number][] = [];
    for (let i = 0; i < pre; i++) anchors.push([i, i]);
    for (const [i, j] of lcs(a.slice(pre, n - suf), b.slice(pre, m - suf))) anchors.push([pre + i, pre + j]);
    for (let k = suf; k > 0; k--) anchors.push([n - k, m - k]);

    const out: (number | null)[] = new Array(m).fill(null);
    let oi = 0;
    let nj = 0;
    for (const [ai, aj] of [...anchors, [n, m] as [number, number]]) {
        // the gap before this match: alike lines pair up in order as edits
        for (const [i, j] of pairAlike(oldTexts.slice(oi, ai), newTexts.slice(nj, aj))) out[nj + j] = oi + i;
        if (aj < m) out[aj] = ai;
        oi = ai + 1;
        nj = aj + 1;
    }
    if (cacheKey) alignCache.set(cacheKey, { key, result: out });
    return out;
}

/** The shelf's chapters against the draft's: every line that differs, in reading order. */
export function compareStory<L extends RevLine>(shelf: RevChapter<L>[], incoming: RevChapter<L>[]): Revision<L> {
    const nos = [...new Set([...shelf.map((c) => c.chapter_no), ...incoming.map((c) => c.chapter_no)])].sort((a, b) => a - b);
    const revision: Revision<L> = { chapters: [], changes: [] };
    for (const no of nos) {
        const old = shelf.find((c) => c.chapter_no === no);
        const neu = incoming.find((c) => c.chapter_no === no);
        const oldLines = old?.lines ?? [];
        const newLines = neu?.lines ?? [];
        const alignment = alignLines(
            oldLines.map((l) => l.text),
            newLines.map((l) => l.text),
            `chapter ${no}`
        );
        const steps: Step<L>[] = [];
        const add = (change: Omit<Change<L>, 'key' | 'chapterNo'>, index: number) => {
            const full: Change<L> = { key: `${no}:${change.kind}:${index}`, chapterNo: no, ...change };
            steps.push({ change: full });
            revision.changes.push(full);
        };
        // within a gap: what the shelf loses, then what the draft adds
        let oi = 0;
        let added: number[] = [];
        const flush = (upTo: number) => {
            for (; oi < upTo; oi++) add({ kind: 'removed', shelf: oldLines[oi], shelfNo: oi + 1 }, oi);
            for (const j of added) add({ kind: 'added', incoming: newLines[j], incomingNo: j + 1 }, j);
            added = [];
        };
        alignment.forEach((i, j) => {
            if (i === null) {
                added.push(j);
                return;
            }
            flush(i);
            oi = i + 1;
            const differs = differences(oldLines[i], newLines[j]);
            if (differs?.length) {
                add({ kind: 'changed', shelf: oldLines[i], shelfNo: i + 1, incoming: newLines[j], incomingNo: j + 1, differs }, j);
            } else steps.push({ same: newLines[j] });
        });
        flush(oldLines.length);
        revision.chapters.push({ chapter_no: no, title: neu?.title ?? old?.title, steps });
    }
    return revision;
}

/**
 * The draft with the reviewer's picks applied: for each change in `keep`, the
 * shelf's side (its version of a changed line, or a line the draft dropped,
 * or no line where the draft added one); the draft's side for the rest. A
 * chapter left with no lines is dropped.
 */
export function applyRevision<L extends RevLine>(revision: Revision<L>, keep: ReadonlySet<string>): RevChapter<L>[] {
    const out: RevChapter<L>[] = [];
    for (const chapter of revision.chapters) {
        const lines: L[] = [];
        for (const step of chapter.steps) {
            if ('same' in step) {
                lines.push(step.same);
                continue;
            }
            const { change } = step;
            const kept = keep.has(change.key);
            if (change.kind === 'changed') lines.push(kept ? change.shelf! : change.incoming!);
            else if (change.kind === 'added' && !kept) lines.push(change.incoming!);
            else if (change.kind === 'removed' && kept) lines.push(change.shelf!);
        }
        if (lines.length) out.push({ chapter_no: chapter.chapter_no, title: chapter.title, lines });
    }
    return out;
}

/** A word-level diff of two texts, for showing a changed line. */
export function wordDiff(a: string, b: string): { text: string; op: 'same' | 'del' | 'ins' }[] {
    const ta = a.split(/(\s+)/).filter(Boolean);
    const tb = b.split(/(\s+)/).filter(Boolean);
    if ((ta.length + 1) * (tb.length + 1) > 2_000_000) {
        return [
            { text: a, op: 'del' },
            { text: b, op: 'ins' },
        ];
    }
    const pairs = lcs(ta, tb);
    const out: { text: string; op: 'same' | 'del' | 'ins' }[] = [];
    const push = (text: string, op: 'same' | 'del' | 'ins') => {
        const last = out.at(-1);
        if (last && last.op === op) last.text += text;
        else out.push({ text, op });
    };
    let i = 0;
    let j = 0;
    for (const [pi, pj] of [...pairs, [ta.length, tb.length] as [number, number]]) {
        for (; i < pi; i++) push(ta[i], 'del');
        for (; j < pj; j++) push(tb[j], 'ins');
        if (pi < ta.length) push(ta[pi], 'same');
        i = pi + 1;
        j = pj + 1;
    }
    return out;
}
