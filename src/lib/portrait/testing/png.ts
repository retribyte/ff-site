// PNG helpers for tests and local tooling (Node only).

import { deflateSync, inflateSync } from 'node:zlib';
import { readPng } from '../png';
import type { Pixels } from '../types';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePng(file: Buffer): Pixels {
    return readPng(file, (data) => inflateSync(data));
}

let crcTable: Uint32Array | null = null;
function crc32(buf: Buffer): number {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

export function encodePng(pixels: Pixels): Buffer {
    const chunk = (type: string, body: Buffer) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(body.length, 0);
        head.write(type, 4, 'latin1');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
        return Buffer.concat([head, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(pixels.width, 0);
    ihdr.writeUInt32BE(pixels.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const stride = pixels.width * 4;
    const raw = Buffer.alloc((stride + 1) * pixels.height);
    for (let y = 0; y < pixels.height; y++)
        raw.set(pixels.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
