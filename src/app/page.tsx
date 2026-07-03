import Link from 'next/link';
import styles from './page.module.scss';

const seasons = [
    { id: 'ff1', title: 'Final Frontier 1', colorVar: '--ff1' },
    { id: 'ff2', title: 'Final Frontier 2', colorVar: '--ff2' },
    { id: 'ff3', title: 'Final Frontier 3', colorVar: '--ff3' },
    { id: 'ff4', title: 'Final Frontier 4', colorVar: '--ff4' },
];

export default function Home() {
    return (
        <main className={styles.main}>
            <section className={styles.hero}>
                <p className='pixel-label'>★ you have reached the ★</p>
                <h1 className={styles.title}>Final Frontier</h1>
                <p className={styles.tagline}>
                    The canonical archive of the Vortox universe — campaign transcripts, characters, species, and
                    assorted lore<span className='blink'>▌</span>
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

                <Link href='/cyoa' className={`pixel-panel ${styles.door}`}>
                    <h2>Vortox Machina</h2>
                    <p>The choose-your-own-adventure chronicle.</p>
                    <span className='pixel-label' style={{ color: 'var(--vm)' }}>
                        CYOA
                    </span>
                </Link>
            </section>

            <footer className={styles.footer}>
                <span className='pixel-label'>est. GUY unknown · best viewed in any browser</span>
            </footer>
        </main>
    );
}
