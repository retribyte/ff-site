'use client';

import { Fragment } from 'react';
import type { CelestialBody } from '@/lib/types';
import styles from './space.module.scss';

// Editable overview tree for the builder: same selectable rows as the
// read-only BodyTree, plus contextual "+ add" trigger rows (a "+ planet" row
// under the star, a "+ moon" row under each planet) — no tab progression, no
// "to which planet?" dropdown. Clicking a trigger asks the parent to open an
// inline create form scoped to that target; the form itself renders
// elsewhere in the rail (SystemBuilder), not nested here.

export type CreateTarget = { kind: 'planet' } | { kind: 'moon'; planetId: number };

const DOT_CLASS: Record<CelestialBody['type'], string> = {
    STAR: styles.dotStar,
    PLANET: styles.dotPlanet,
    MOON: styles.dotMoon,
};

export default function BuilderBodyTree({
    star,
    selectedId,
    onSelect,
    onRequestCreate,
}: {
    star: CelestialBody;
    selectedId: number | null;
    onSelect: (id: number) => void;
    onRequestCreate: (target: CreateTarget) => void;
}) {
    const planets = star.children ?? [];

    return (
        <div className={styles.tree}>
            <button
                type='button'
                className={`${styles.treeButton} ${selectedId === star.id ? styles.treeButtonSelected : ''}`}
                onClick={() => onSelect(star.id)}
                aria-pressed={selectedId === star.id}
            >
                <span className={`${styles.dot} ${DOT_CLASS.STAR}`} />
                <span>{star.name}</span>
            </button>

            {planets.map((planet) => (
                <Fragment key={planet.id}>
                    <button
                        type='button'
                        className={`${styles.treeButton} ${styles.indent1} ${
                            selectedId === planet.id ? styles.treeButtonSelected : ''
                        }`}
                        onClick={() => onSelect(planet.id)}
                        aria-pressed={selectedId === planet.id}
                    >
                        <span className={`${styles.dot} ${DOT_CLASS.PLANET}`} />
                        <span>{planet.name}</span>
                    </button>

                    {(planet.children ?? []).map((moon) => (
                        <button
                            key={moon.id}
                            type='button'
                            className={`${styles.treeButton} ${styles.indent2} ${
                                selectedId === moon.id ? styles.treeButtonSelected : ''
                            }`}
                            onClick={() => onSelect(moon.id)}
                            aria-pressed={selectedId === moon.id}
                        >
                            <span className={`${styles.dot} ${DOT_CLASS.MOON}`} />
                            <span>{moon.name}</span>
                        </button>
                    ))}

                    <button
                        type='button'
                        className={`${styles.treeButton} ${styles.indent2} ${styles.addRow}`}
                        onClick={() => onRequestCreate({ kind: 'moon', planetId: planet.id })}
                    >
                        + moon
                    </button>
                </Fragment>
            ))}

            <button
                type='button'
                className={`${styles.treeButton} ${styles.indent1} ${styles.addRow}`}
                onClick={() => onRequestCreate({ kind: 'planet' })}
            >
                + planet
            </button>
        </div>
    );
}
