'use client';

import type { CelestialBody } from '@/lib/types';
import styles from './space.module.scss';

// Recursive overview tree (star → planets → moons), the keyboard/screen
// reader path to everything the diagram canvas draws. Buttons are natively
// tabbable; selecting a node highlights it here and rings its body on the
// canvas (state lives in the parent SystemConsole).

const DOT_CLASS: Record<CelestialBody['type'], string> = {
    STAR: styles.dotStar,
    PLANET: styles.dotPlanet,
    MOON: styles.dotMoon,
};

const INDENT_CLASS: Record<number, string> = {
    0: '',
    1: styles.indent1,
    2: styles.indent2,
};

function Node({
    body,
    depth,
    selectedId,
    onSelect,
}: {
    body: CelestialBody;
    depth: number;
    selectedId: number | null;
    onSelect: (id: number) => void;
}) {
    const selected = selectedId === body.id;
    return (
        <>
            <button
                type='button'
                className={`${styles.treeButton} ${INDENT_CLASS[depth] ?? ''} ${selected ? styles.treeButtonSelected : ''}`}
                onClick={() => onSelect(body.id)}
                aria-pressed={selected}
            >
                <span className={`${styles.dot} ${DOT_CLASS[body.type]}`} />
                <span>{body.name}</span>
            </button>
            {(body.children ?? []).map((child) => (
                <Node key={child.id} body={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
            ))}
        </>
    );
}

export default function BodyTree({
    star,
    selectedId,
    onSelect,
}: {
    star: CelestialBody | null;
    selectedId: number | null;
    onSelect: (id: number) => void;
}) {
    if (!star) {
        return <p className='pixel-label'>no bodies charted</p>;
    }
    return (
        <div className={styles.tree}>
            <Node body={star} depth={0} selectedId={selectedId} onSelect={onSelect} />
        </div>
    );
}
