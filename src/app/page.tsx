import Link from 'next/link';
import styles from './page.module.scss';

const seasons = [
    { id: 'ff1', title: 'Final Frontier 1', colorVar: '--ff1' },
    { id: 'ff2', title: 'Final Frontier 2', colorVar: '--ff2' },
    { id: 'ff3', title: 'Final Frontier 3', colorVar: '--ff3' },
    { id: 'ff4', title: 'Final Frontier 4', colorVar: '--ff4' },
];

const minorDoors = [
    { href: '/characters', title: 'Characters', blurb: 'Player characters and the people they met.' },
    { href: '/species', title: 'Species', blurb: 'The peoples of the galaxy.' },
    { href: '/items', title: 'Items', blurb: 'Gear, weapons, and artifacts.' },
    { href: '/search', title: 'Search', blurb: 'Find any line in the archive.' },
    { href: '/8ball', title: '8-Ball', blurb: 'Ask the archive oracle a question.' },
];

const sisterSites = [
    { href: 'https://wiki.vortox.space', title: 'Wiki', blurb: 'The full lore encyclopedia.' },
    { href: 'https://booru.vortox.space', title: 'Booru', blurb: 'Character art and the image gallery.' },
];

export default function Home() {
    return (
        <main className={styles.main}>
            <section className={styles.hero}>
                <p className='pixel-label'>★ Welcome to the home of ★</p>
                <h1 className={styles.title}>Final Frontier</h1>
                <p className={styles.tagline}>
                    The canonical archive of the Final Frontier universe ✦
                </p>
                <p className={styles.tagline}>
                    ✧ Campaign transcripts, short stories, and
                    assorted lore
                    {/* <span className='blink'>▌</span> */}
                </p>
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
                    <span className='pixel-label' style={{ color: 'var(--vm)' }}>
                        CYOA · FICTION
                    </span>
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
