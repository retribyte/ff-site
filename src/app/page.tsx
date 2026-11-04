import Link from 'next/link';
import Logo from '@/components/logo/Logo';
import { api } from '@/lib/api';
import type { Story } from '@/lib/types';
import { seasonColors, seasonOrder, seasonSlug } from '@/lib/seasons';
import styles from './page.module.scss';

// The Stories door counts the live shelf — render per-request, not at build time
export const dynamic = 'force-dynamic';

/** Stories per campaign, in campaign order; stories with no campaign (VM) aren't counted. */
async function storyCampaigns(): Promise<{ title: string; count: number; color: string }[]> {
    let stories: Story[];
    try {
        stories = await api<Story[]>('/stories');
    } catch {
        return []; // API down: the door still renders, just without counts
    }
    const counts = new Map<string, number>();
    for (const s of stories) {
        if (s.season) counts.set(s.season.title, (counts.get(s.season.title) ?? 0) + 1);
    }
    return [...counts]
        .sort(([a], [b]) => {
            const [ra, ka] = seasonOrder(a);
            const [rb, kb] = seasonOrder(b);
            return ra - rb || ka.localeCompare(kb);
        })
        .map(([title, count]) => ({ title, count, color: seasonColors(title).primary }));
}

const seasons = [
    { id: 'ff1', title: 'Final Frontier 1', colorVar: '--ff1' },
    { id: 'ff2', title: 'Final Frontier 2', colorVar: '--ff2' },
    { id: 'ff3', title: 'Final Frontier 3', colorVar: '--ff3' },
    { id: 'ff4', title: 'Final Frontier 4', colorVar: '--ff4' },
];

const minorDoors = [
    { href: '/characters', title: 'Characters', blurb: 'Player characters and the people they met.' },
    { href: '/items', title: 'Items', blurb: 'Gear, weapons, and artifacts.' },
    { href: '/search', title: 'Search', blurb: 'Find any line in the archive.' },
    { href: '/8ball', title: '8-Ball', blurb: 'Ask the archive oracle a question.' },
];

const sisterSites = [
    { href: 'https://wiki.vortox.space', title: 'Wiki', blurb: 'The full lore encyclopedia.' },
    { href: 'https://booru.vortox.space', title: 'Booru', blurb: 'Character art and the image gallery.' },
];

export default async function Home() {
    const campaigns = await storyCampaigns();

    return (
        <main className={styles.main}>
            <section className={styles.hero}>
                <Logo className={styles.heroLogo} />
            </section>

            <div className='star-divider'>✦ ✧ ✦</div>

            <section className={styles.doors}>
                <Link href='/archives' className={`pixel-panel ${styles.door}`}>
                    <h2>Archives</h2>
                    <p>Read the finished campaigns, episode by episode.</p>
                    <ul className={styles.seasonChips}>
                        {seasons.map((s) => (
                            <li key={s.id} style={{ color: `var(${s.colorVar})` }}>
                                {s.id.toUpperCase()}
                            </li>
                        ))}
                    </ul>
                </Link>

                <Link href='/stories' className={`pixel-panel ${styles.door}`}>
                    <h2>Stories</h2>
                    <p>Short stories and the Vortox Machina chronicle.</p>
                    <ul className={styles.seasonChips}>
                        <li style={{ color: 'var(--vm)' }}>VM</li>
                        {campaigns.map((c) => (
                            <li key={c.title} style={{ color: c.color }}>
                                {c.count}×{seasonSlug(c.title).toUpperCase()}
                            </li>
                        ))}
                    </ul>
                </Link>
            </section>

            <section className={`${styles.doors} ${styles.minorDoors}`}>
                {minorDoors.map((d) => (
                    <Link key={d.href} href={d.href} className={`pixel-panel ${styles.door}`}>
                        <h3>{d.title}</h3>
                        <p>{d.blurb}</p>
                    </Link>
                ))}
            </section>

            <section className={`${styles.doors} ${styles.sisterDoors}`} aria-label='Sister sites'>
                {sisterSites.map((d) => (
                    <a
                        key={d.href}
                        href={d.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`pixel-panel ${styles.door}`}
                    >
                        <h3>{d.title} ↗</h3>
                        <p>{d.blurb}</p>
                    </a>
                ))}
            </section>

            <footer className={styles.footer}>
                <span className='pixel-label'>est. 981 GUY · best viewed in any browser</span>
            </footer>
        </main>
    );
}
