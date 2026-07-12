'use client';

import { useState } from 'react';
import Link from 'next/link';
import ConsoleShell from './ConsoleShell';
import Toolbar from './Toolbar';
import SystemDiagram from './SystemDiagram';
import BodyTree from './BodyTree';
import BodyInfoPanel from './BodyInfoPanel';
import WikiLink from '@/components/WikiLink';
import { useSession } from '@/components/auth/SessionProvider';
import type { CelestialBody, StarSystem } from '@/lib/types';
import styles from './space.module.scss';

function findBody(body: CelestialBody | null, id: number): CelestialBody | null {
    if (!body) return null;
    if (body.id === id) return body;
    for (const child of body.children ?? []) {
        const found = findBody(child, id);
        if (found) return found;
    }
    return null;
}

// /galaxy/systems/[id] page composition: overview tree + telemetry in the
// rail, SystemDiagram in the viewport. Read-only, plus a self-gated "Edit"
// entry point to the builder for the system's creator/admin (the builder
// route re-checks ownership server-side regardless — this is just the
// visible way to reach it; the map-authoring "New system" entry points are
// Phase 3.3's job).
export default function SystemConsole({ system }: { system: StarSystem }) {
    const star = system.bodies?.[0] ?? null;
    const [selectedId, setSelectedId] = useState<number | null>(star?.id ?? null);
    const selected = selectedId != null ? findBody(star, selectedId) : null;
    const { user } = useSession();
    const canEdit = user != null && (user.id === system.creatorId || user.role === 'ADMIN');

    return (
        <ConsoleShell
            toolbar={
                <Toolbar
                    crumb={
                        <>
                            <Link href='/galaxy'>
                                <span className={styles.crumbArrow} aria-hidden>
                                    ◤
                                </span>{' '}
                                GALAXY
                            </Link>{' '}
                            <span className={styles.crumbDim}>▸</span> {system.name.toUpperCase()}
                        </>
                    }
                />
            }
            railTitle='Bodies'
            rail={
                <>
                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>Bodies</p>
                        <BodyTree star={star} selectedId={selectedId} onSelect={setSelectedId} />
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.section}>
                        <p className={styles.sectionHeader}>{system.name}</p>
                        {system.description && <p className={styles.desc}>{system.description}</p>}
                        {system.creator && <p className={styles.attribution}>charted by {system.creator.username}</p>}
                        <WikiLink article={system.wikiArticle} />
                        {canEdit && (
                            <div className={styles.rowActions}>
                                <Link href={`/galaxy/systems/${system.id}/edit`} className={`${styles.btn} ${styles.btnPrimary}`}>
                                    Edit system
                                </Link>
                            </div>
                        )}
                    </div>

                    {selected && (
                        <>
                            <hr className={styles.divider} />
                            <div className={styles.section}>
                                <p className={styles.sectionHeader}>Telemetry · {selected.name}</p>
                                <BodyInfoPanel body={selected} starTemperatureK={star?.temperatureK ?? null} />
                                {selected.description && <p className={styles.desc}>{selected.description}</p>}
                                <WikiLink article={selected.wikiArticle} />
                            </div>
                        </>
                    )}
                </>
            }
            viewport={<SystemDiagram star={star} selectedId={selectedId} onSelect={setSelectedId} />}
        />
    );
}
