'use client';

import { useState } from 'react';
import styles from './space.module.scss';

// One rail instead of three overlays: a CSS Grid [rail] [viewport] shared by
// the galaxy map and the system diagram. The rail collapses to a slim chevron
// strip via a single boolean — the viewport is never covered.
export default function ConsoleShell({
    toolbar,
    railTitle,
    rail,
    viewport,
}: {
    toolbar: React.ReactNode;
    railTitle: string;
    rail: React.ReactNode;
    viewport: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={styles.shell}>
            {toolbar}
            <div className={styles.body} data-collapsed={collapsed || undefined}>
                <div className={styles.rail}>
                    <div className={styles.railHeader}>
                        {!collapsed && (
                            <span className={styles.railHeaderLabel}>
                                <span aria-hidden>◈</span> {railTitle}
                            </span>
                        )}
                        <button
                            type='button'
                            className={styles.chev}
                            onClick={() => setCollapsed((c) => !c)}
                            aria-label={collapsed ? `Expand ${railTitle} rail` : `Collapse ${railTitle} rail`}
                            aria-expanded={!collapsed}
                        >
                            {collapsed ? '▸' : '◂'}
                        </button>
                    </div>
                    {!collapsed && <div className={styles.railContent}>{rail}</div>}
                </div>
                <div className={styles.viewportSlot}>{viewport}</div>
            </div>
        </div>
    );
}
