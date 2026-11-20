// PNG reader shared by the site and the tests. Sprites are decoded here, not by the browser:
// a canvas premultiplies alpha and may colour-manage, and Starbound's colour swaps need the
// file's exact bytes. Reads greyscale, RGB, palette and RGBA up to 8 bits a channel,
// non-interlaced; the caller supplies zlib inflate (DecompressionStream or node:zlib).

import type { Pixels } from './types';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readPng(file: Uint8Array, inflate: (data: Uint8Array) => Uint8Array): Pixels {
    const { meta, idat } = parsePng(file);
    return unfilter(inflate(idat), meta);
}

interface PngMeta {
    width: number;
    height: number;
    depth: number;
    colorType: number;
    palette: Uint8Array | null;
    alpha: Uint8Array | null;
}

const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];

function parsePng(file: Uint8Array): { meta: PngMeta; idat: Uint8Array } {
    if (SIGNATURE.some((byte, i) => file[i] !== byte)) throw new Error('not a PNG');
    let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
    let palette: Uint8Array | null = null, alpha: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    for (let at = 8; at < file.length;) {
        const length = u32(file, at);
        const type = String.fromCharCode(file[at + 4], file[at + 5], file[at + 6], file[at + 7]);
        const body = file.subarray(at + 8, at + 8 + length);
        if (type === 'IHDR') {
            width = u32(body, 0);
            height = u32(body, 4);
            depth = body[8];
            colorType = body[9];
            interlace = body[12];
        } else if (type === 'PLTE') palette = body;
        else if (type === 'tRNS') alpha = body;
        else if (type === 'IDAT') idat.push(body);
        at += 12 + length;
    }
    if (interlace) throw new Error('interlaced PNG');
    const joined = new Uint8Array(idat.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of idat) {
        joined.set(part, offset);
        offset += part.length;
    }
    return { meta: { width, height, depth, colorType, palette, alpha }, idat: joined };
}

function unfilter(raw: Uint8Array, { width, height, depth, colorType, palette, alpha }: PngMeta): Pixels {
    const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
    const packed = depth < 8 && (colorType === 0 || colorType === 3);
    if ((depth !== 8 && !packed) || !channels) throw new Error(`unsupported PNG (depth ${depth}, type ${colorType})`);
    const stride = packed ? Math.ceil((width * depth) / 8) : width * channels;
    let rows = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const value = raw[y * (stride + 1) + 1 + x];
            const back = packed ? 1 : channels;
            const a = x >= back ? rows[y * stride + x - back] : 0;
            const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
            const c = x >= back && y > 0 ? rows[(y - 1) * stride + x - back] : 0;
            let predicted = 0;
            if (filter === 1) predicted = a;
            else if (filter === 2) predicted = b;
            else if (filter === 3) predicted = (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            rows[y * stride + x] = (value + predicted) & 255;
        }
    }
    // A greyscale or RGB image can name one colour as transparent (tRNS), in file sample units.
    const greyKey = colorType === 0 && alpha && alpha.length >= 2 ? Math.round(u16(alpha, 0) * (255 / ((1 << depth) - 1))) : -1;
    const rgbKey = colorType === 2 && alpha && alpha.length >= 6 ? [u16(alpha, 0), u16(alpha, 2), u16(alpha, 4)] : null;
    if (packed) {
        // One sample per byte; greyscale samples are scaled up to 0..255.
        const wide = new Uint8Array(width * height);
        const scale = colorType === 0 ? 255 / ((1 << depth) - 1) : 1;
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const bit = x * depth;
                const sample = (rows[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
                wide[y * width + x] = Math.round(sample * scale);
            }
        rows = wide;
    }
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const s = i * channels;
        let px: [number, number, number, number];
        if (colorType === 6) px = [rows[s], rows[s + 1], rows[s + 2], rows[s + 3]];
        else if (colorType === 2) {
            const keyed = rgbKey && rows[s] === rgbKey[0] && rows[s + 1] === rgbKey[1] && rows[s + 2] === rgbKey[2];
            px = [rows[s], rows[s + 1], rows[s + 2], keyed ? 0 : 255];
        }
        else if (colorType === 3) {
            const p = rows[s] * 3;
            px = [palette![p], palette![p + 1], palette![p + 2], alpha && rows[s] < alpha.length ? alpha[rows[s]] : 255];
        } else if (colorType === 4) px = [rows[s], rows[s], rows[s], rows[s + 1]];
        else px = [rows[s], rows[s], rows[s], rows[s] === greyKey ? 0 : 255];
        data.set(px, i * 4);
    }
    return { width, height, data };
}

/** Decode with the platform's DecompressionStream (browsers, Node 18+). */
export async function decodePng(file: Uint8Array): Promise<Pixels> {
    const { meta, idat } = parsePng(file);
    const stream = new Blob([idat as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    return unfilter(new Uint8Array(await new Response(stream).arrayBuffer()), meta);
}
