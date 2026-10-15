// Booru images never load straight from booru.vortox.space: its Cloudflare
// challenge can block browsers (the bypass key lives only in ff-server), and
// PixelAvatar reads pixels back from a canvas, which a cross-origin image
// taints. Route them through ff-server's /booru/image proxy, same-origin via
// /api/ff. Every other src (local /avatars/..., data: URLs) passes through.

import { BOORU_URL } from '@/lib/booru';

const BOORU_ORIGIN = new URL(BOORU_URL).origin;

export function imageSrc(src: string): string;
export function imageSrc(src: string | null | undefined): string | null;
export function imageSrc(src: string | null | undefined): string | null {
    if (!src) return null;
    let url: URL;
    try {
        url = new URL(src);
    } catch {
        return src; // relative — already ours
    }
    if (url.origin !== BOORU_ORIGIN) return src;
    return `/api/ff/booru/image?url=${encodeURIComponent(src)}`;
}
