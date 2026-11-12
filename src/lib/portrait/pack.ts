// A mod's sprites.pack is its PNGs end to end. The site never downloads a whole pack: it asks
// for the byte ranges of the images it needs, and ranges that sit close together go out as one
// request, so drawing a page of thumbnails costs a handful of requests rather than hundreds.

export interface Wanted<T> {
    offset: number;
    length: number;
    /** Whatever the caller needs back with the bytes. */
    for: T;
}

export interface Run<T> {
    start: number;
    /** One past the last byte. */
    end: number;
    items: Wanted<T>[];
}

/** Unwanted bytes worth downloading to save a request. */
export const MAX_GAP = 24 * 1024;

/** Groups wanted byte ranges into runs, joining neighbours no more than `gap` bytes apart. */
export function planRuns<T>(wanted: Wanted<T>[], gap = MAX_GAP): Run<T>[] {
    const runs: Run<T>[] = [];
    for (const item of [...wanted].sort((a, b) => a.offset - b.offset)) {
        const run = runs[runs.length - 1];
        if (run && item.offset - run.end <= gap) {
            run.items.push(item);
            run.end = Math.max(run.end, item.offset + item.length);
        } else runs.push({ start: item.offset, end: item.offset + item.length, items: [item] });
    }
    return runs;
}

/** One item's bytes out of a response that starts at byte `base` of the pack. */
export function slice(body: Uint8Array, base: number, item: { offset: number; length: number }): Uint8Array | null {
    const from = item.offset - base;
    return from >= 0 && from + item.length <= body.length ? body.subarray(from, from + item.length) : null;
}
