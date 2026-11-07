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
    colorLight = null,
    size,
}: {
    src: string | null;
    name: string;
    color: string | null;
    colorLight?: string | null;
    size?: number;
}) {
    const { colorMode } = useTheme();
    return <PixelAvatar src={src} name={name} color={characterColor(name, color, colorMode, colorLight)} size={size} />;
}
