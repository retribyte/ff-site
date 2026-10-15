// booru.vortox.space (Shimmie2) — the image source for user avatars.
// ff-server resolves a post ID to its image URL; this is just for linking back.

export const BOORU_URL = (process.env.NEXT_PUBLIC_BOORU_URL ?? 'https://booru.vortox.space').replace(/\/+$/, '');

export function booruPostUrl(id: number): string {
    return `${BOORU_URL}/post/view/${id}`;
}
