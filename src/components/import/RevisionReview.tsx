'use client';

import { useMemo, useState } from 'react';
import { wordDiff, type Change, type RevLine } from '@/lib/storyRevision';
import styles from './storyImporter.module.scss';

// A revision's differences from the story on the shelf, one row each: the
// draft's side is used unless the reviewer keeps the shelf's (a fix made on
// the site, a line the draft no longer has, a voice changed with 🎭). The
// preview below and the upload follow the picks.

const PAGE = 40;

type Kind = Change<RevLine>['kind'];

const KIND_LABEL: Record<Kind, string> = {
    changed: 'changed',
    added: 'new',
    removed: 'only on the shelf',
};

// Each kind's two sides: what using the draft does, what keeping the shelf does
const SIDES: Record<Kind, [string, string]> = {
    changed: ['use new', 'keep shelf'],
    added: ['add it', 'leave out'],
    removed: ['remove it', 'keep it'],
};

const DIFFERS_LABEL = { text: 'text', voice: 'speaker', type: 'line type', styling: 'styling', picture: 'picture' };

function Diff({ from, to }: { from: string; to: string }) {
    return (
        <p className={styles.reviewText}>
            {wordDiff(from, to).map((part, i) =>
                part.op === 'same' ? (
                    <span key={i}>{part.text}</span>
                ) : part.op === 'del' ? (
                    <del key={i}>{part.text}</del>
                ) : (
                    <ins key={i}>{part.text}</ins>
                )
            )}
        </p>
    );
}

export default function RevisionReview({
    changes,
    keep,
    onKeep,
    voiceLabel,
}: {
    changes: Change<RevLine>[];
    /** the changes whose shelf side is kept */
    keep: ReadonlySet<string>;
    onKeep: (keys: string[], kept: boolean) => void;
    /** who speaks a line, as the reader would name them ("narration" when nobody) */
    voiceLabel: (line: RevLine) => string;
}) {
    const [filter, setFilter] = useState<Kind | 'all'>('all');
    const [shown, setShown] = useState(PAGE);
    const counts = useMemo(() => {
        const c: Record<Kind, number> = { changed: 0, added: 0, removed: 0 };
        for (const change of changes) c[change.kind]++;
        return c;
    }, [changes]);
    const listed = filter === 'all' ? changes : changes.filter((c) => c.kind === filter);
    const keptCount = listed.filter((c) => keep.has(c.key)).length;

    if (changes.length === 0) {
        return <p className={styles.hint}>No differences from the story on the shelf.</p>;
    }

    return (
        <div className={styles.review}>
            <div className={styles.reviewBar}>
                <div className={styles.chapterTabs} role='tablist' aria-label='Show'>
                    {(['all', 'changed', 'added', 'removed'] as const).map((kind) => {
                        const n = kind === 'all' ? changes.length : counts[kind];
                        if (kind !== 'all' && n === 0) return null;
                        return (
                            <button
                                key={kind}
                                type='button'
                                role='tab'
                                aria-selected={filter === kind}
                                className={styles.chapterTab}
                                onClick={() => {
                                    setFilter(kind);
                                    setShown(PAGE);
                                }}
                            >
                                {kind === 'all' ? 'all' : KIND_LABEL[kind]} ({n.toLocaleString('en-US')})
                            </button>
                        );
                    })}
                </div>
                <div className={styles.reviewBulk}>
                    <span className={styles.hint}>
                        {filter === 'all' ? 'All' : `All ${KIND_LABEL[filter]}`}:
                    </span>
                    <button
                        type='button'
                        className={styles.namerCancel}
                        disabled={keptCount === 0}
                        onClick={() => onKeep(listed.map((c) => c.key), false)}
                    >
                        use the new version
                    </button>
                    <button
                        type='button'
                        className={styles.namerCancel}
                        disabled={keptCount === listed.length}
                        onClick={() => onKeep(listed.map((c) => c.key), true)}
                    >
                        keep the shelf&apos;s
                    </button>
                </div>
            </div>

            <ol className={styles.reviewList}>
                {listed.slice(0, shown).map((change) => {
                    const kept = keep.has(change.key);
                    const [useLabel, keepLabel] = SIDES[change.kind];
                    const where = change.kind === 'added' ? `new line ${change.incomingNo}` : `line ${change.shelfNo}`;
                    return (
                        <li key={change.key} className={styles.reviewRow} data-kept={kept || undefined}>
                            <div className={styles.reviewHead}>
                                <span className={`pixel-label ${styles.reviewKind}`} data-kind={change.kind}>
                                    {KIND_LABEL[change.kind]}
                                </span>
                                <span className={styles.mapName}>
                                    {change.chapterNo !== 1 ? `chapter ${change.chapterNo}, ` : ''}
                                    {where}
                                    {change.differs && change.differs.length > 0 && `: ${change.differs.map((d) => DIFFERS_LABEL[d]).join(', ')}`}
                                </span>
                                <span className={styles.reviewPick} role='radiogroup' aria-label={`${KIND_LABEL[change.kind]} ${where}`}>
                                    <button type='button' role='radio' aria-checked={!kept} onClick={() => kept && onKeep([change.key], false)}>
                                        {useLabel}
                                    </button>
                                    <button type='button' role='radio' aria-checked={kept} onClick={() => !kept && onKeep([change.key], true)}>
                                        {keepLabel}
                                    </button>
                                </span>
                            </div>
                            {change.kind === 'changed' && (
                                <>
                                    {change.differs?.includes('voice') && (
                                        <p className={styles.reviewVoice}>
                                            <del>{voiceLabel(change.shelf!)}</del> → <ins>{voiceLabel(change.incoming!)}</ins>
                                        </p>
                                    )}
                                    {change.differs?.includes('type') && (
                                        <p className={styles.reviewVoice}>
                                            <del>{change.shelf!.type.toLowerCase()}</del> → <ins>{change.incoming!.type.toLowerCase()}</ins>
                                        </p>
                                    )}
                                    <Diff from={change.shelf!.text} to={change.incoming!.text} />
                                </>
                            )}
                            {change.kind === 'added' && (
                                <p className={`${styles.reviewText} ${styles.reviewWhole}`}>
                                    <span className={styles.reviewWho}>{voiceLabel(change.incoming!)}: </span>
                                    {change.incoming!.text}
                                </p>
                            )}
                            {change.kind === 'removed' && (
                                <p className={`${styles.reviewText} ${styles.reviewWhole}`}>
                                    <span className={styles.reviewWho}>{voiceLabel(change.shelf!)}: </span>
                                    {change.shelf!.text}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ol>
            {listed.length > shown && (
                <button type='button' className={styles.namerCancel} onClick={() => setShown((n) => n + PAGE * 5)}>
                    show more ({(listed.length - shown).toLocaleString('en-US')} left)
                </button>
            )}
        </div>
    );
}
