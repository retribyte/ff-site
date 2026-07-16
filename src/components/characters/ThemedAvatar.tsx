'use client';

import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import PixelAvatar from '@/components/transcript/PixelAvatar';

// Server pages can't know the active theme; this picks the right
// character-color variant client-side and draws the outlined avatar.
export default function ThemedAvatar({
    src,
    name,
    color,
    size,
}: {
    src: string | null;
    name: string;
    color: string | null;
    size?: number;
}) {
    const { colorMode } = useTheme();
    return <PixelAvatar src={src} name={name} color={characterColor(name, color, colorMode)} size={size} />;
}
