// Client-side check of an avatar file, for feedback before the round trip.
// ff-server enforces the same rules on save (src/utils/avatar-image.ts).
export const AVATAR_MAX_SIDE = 14;
export const AVATAR_MAX_BYTES = 16 * 1024;

/** The file as a data: URL, ready to send as a record's `image`; throws an Error to show the user. */
export async function readAvatarFile(file: File): Promise<string> {
    if (file.type !== 'image/png') throw new Error('Avatars must be PNG files');
    if (file.size > AVATAR_MAX_BYTES) throw new Error(`Avatars can be at most ${AVATAR_MAX_BYTES / 1024} KB`);

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("That file couldn't be read"));
        reader.readAsDataURL(file);
    });
    const { width, height } = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("That file isn't a valid PNG"));
        image.src = dataUrl;
    });
    if (width > AVATAR_MAX_SIDE || height > AVATAR_MAX_SIDE) {
        throw new Error(`Avatars can be at most ${AVATAR_MAX_SIDE}x${AVATAR_MAX_SIDE} pixels (this one is ${width}x${height})`);
    }
    return dataUrl;
}
