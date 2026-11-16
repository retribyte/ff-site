'use client';

// PROTOTYPE, throwaway. Three variants of the galaxy map layout on the
// throwaway route /prototype/galaxy, switchable via ?variant=A|B|C.

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useGalaxyStore } from './store';
import MapApp from './MapApp';
import { VariantA, VariantB, VariantC } from './variants';
import styles from './proto.module.scss';

const VARIANTS = [
    { key: 'M', name: 'Chosen layout', Component: MapApp },
    { key: 'A', name: 'Floating cards, sliders', Component: VariantA },
    { key: 'B', name: 'Bottom dock, chips', Component: VariantB },
    { key: 'C', name: 'Search and sheet, lineup', Component: VariantC },
];

export default function Prototype() {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const store = useGalaxyStore();
    const index = Math.max(0, VARIANTS.findIndex((v) => v.key === (params.get('variant') ?? 'M').toUpperCase()));
    const current = VARIANTS[index];

    const go = (delta: number) => {
        const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
        router.replace(`${pathname}?variant=${next.key}`);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (el.closest('input, textarea, select, [contenteditable]')) return;
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'ArrowRight') go(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const state = {
        variant: current.key,
        level: store.level,
        view: store.view,
        placing: store.placing,
        place: store.selPlace && { name: store.selPlace.name, pos: store.selPlace.pos.map((n) => Math.round(n * 100) / 100), precision: store.selPlace.precision, regionHint: store.selPlace.regionHint },
        body: store.selBody && { name: store.selBody.name, type: store.selBody.type, radiusKm: Math.round(store.selBody.radiusKm), orbit: store.selBody.orbit },
        places: store.places.length,
    };

    return (
        <main className={styles.root}>
            <current.Component store={store} />
            <div className={styles.switcher}>
                <button type='button' onClick={() => go(-1)} aria-label='Previous variant'>&larr;</button>
                <span>{current.key} ({current.name})</span>
                <button type='button' onClick={() => go(1)} aria-label='Next variant'>&rarr;</button>
                <details>
                    <summary>state</summary>
                    <pre>{JSON.stringify(state, null, 1)}</pre>
                </details>
            </div>
        </main>
    );
}
