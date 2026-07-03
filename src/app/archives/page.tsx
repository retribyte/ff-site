import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Season } from '@/lib/types';
import { seasonColors, seasonDisplayName, seasonSlug } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import styles from './archives.module.scss';

export const metadata: Metadata = {
    title: 'Archives',
};

// Season data comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

// The full campaign roster. Seasons without data in the DB still get a strip,
// dimmed, like the old site listed FF1–FF4 before their archives existed.
const ROSTER = ['FF1', 'FF2', 'FF3', 'FF4', 'Vortox Machina'];

export default async function ArchivesPage() {
    let seasons: Season[];
    try {
        seasons = await api<Season[]>('/seasons');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const byTitle = new Map(seasons.map((s) => [s.title, s]));
    const roster = [...ROSTER, ...seasons.map((s) => s.title).filter((t) => !ROSTER.includes(t))];

    return (
        <main className={styles.main}>
            <div className={styles.header}>
                <h1>The Archives</h1>
                <span className='pixel-label'>{seasons.length} recovered campaigns</span>
            </div>

            <div className={styles.strips}>
                {roster.map((title) => {
                    const season = byTitle.get(title);
                    const colors = seasonColors(title);
                    const style = { '--season': colors.primary, '--season-2': colors.secondary } as React.CSSProperties;
                    const episodeCount = season?.episodes?.length ?? 0;
                    // Skip the reveal-subtitle when it would just repeat the strip code
                    const subtitle = seasonDisplayName(title) !== title ? seasonDisplayName(title) : null;

                    if (!season) {
                        return (
                            <div key={title} className={`${styles.strip} ${styles.unarchived}`} style={style}>
                                <span className={styles.stripCode}>{title}</span>
                                {subtitle && <span className={styles.stripTitle}>{subtitle}</span>}
                                <span className='pixel-label'>unarchived · lost to time</span>
                            </div>
                        );
                    }

                    // The chronicle gets its dedicated prose reader
                    const href = seasonSlug(title) === 'vm' ? '/cyoa' : `/archives/${seasonSlug(title)}`;

                    return (
                        <Link key={title} href={href} className={styles.strip} style={style}>
                            <span className={styles.stripCode}>{title}</span>
                            {subtitle && <span className={styles.stripTitle}>{subtitle}</span>}
                            <span className={styles.stripMeta}>
                                {episodeCount} episode{episodeCount === 1 ? '' : 's'}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </main>
    );
}
