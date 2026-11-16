'use client';

import { useEffect, useState } from 'react';
import { renderStill } from '@/components/galaxy/GalaxyScene';

export default function StillMaker() {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        const font = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'sans-serif';
        // The label font must be in before the labels are drawn
        void document.fonts.ready.then(() => renderStill(1600, font)).then(setSrc);
    }, []);
    return (
        <main style={{ padding: 16 }}>
            {src ? (
                <a href={src} download='still.webp'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img id='galaxy-still' src={src} alt='The galaxy map, top-down' style={{ maxWidth: '100%' }} />
                </a>
            ) : (
                <p>Drawing</p>
            )}
        </main>
    );
}
