import Link from 'next/link';
import {
    Atkinson_Hyperlegible,
    Permanent_Marker,
    Share_Tech_Mono,
    Special_Elite,
    Stardos_Stencil,
    VT323,
} from 'next/font/google';
import SpaceBackdrop from '@/components/home/SpaceBackdrop';
import FourStar from '@/components/home/FourStar';
import styles from './page.module.scss';

// Every card on the wall was lettered by a different crewmate
const stencil = Stardos_Stencil({ variable: '--hf-stencil', weight: ['400', '700'], subsets: ['latin'] });
const typewriter = Special_Elite({ variable: '--hf-typewriter', weight: '400', subsets: ['latin'] });
const crt = VT323({ variable: '--hf-crt', weight: '400', subsets: ['latin'] });
const marker = Permanent_Marker({ variable: '--hf-marker', weight: '400', subsets: ['latin'] });
const labelMaker = Share_Tech_Mono({ variable: '--hf-label', weight: '400', subsets: ['latin'] });
const plain = Atkinson_Hyperlegible({ variable: '--hf-plain', weight: ['400', '700'], subsets: ['latin'] });

const fontVars = [stencil, typewriter, crt, marker, labelMaker, plain].map((f) => f.variable).join(' ');

const seasons = [
    { slug: 'ff1', title: 'Final Frontier 1', color: '--ff1' },
    { slug: 'ff2', title: 'Final Frontier 2', color: '--ff2' },
    { slug: 'ff3', title: 'Final Frontier 3', color: '--ff3' },
    { slug: 'ff4', title: 'Final Frontier 4', color: '--ff4' },
];

// PLACEHOLDER — real story list comes from the API in the data pass
const spines = [
    { title: 'Vortox Machina', color: '#d3612c', h: 96 },
    { title: 'Still Waters', color: '#2f5d7a', h: 88 },
    { title: 'story title', color: '#6b3f8f', h: 100 },
    { title: 'story title', color: '#3d6b3a', h: 84 },
    { title: 'story title', color: '#8f2f3f', h: 92 },
    { title: 'story title', color: '#c9a23b', h: 80 },
];

// PLACEHOLDER — random QUOTE messages in the data pass
const quotes = [
    { avatar: 'jim', text: 'quote text from a QUOTE message goes here', from: 'FF3 · Tuck and Run', rot: -2 },
    { avatar: 'iris', text: 'another quote, a little longer so the note has to stretch', from: 'FF2 · episode', rot: 1.5 },
    { avatar: 'dutch', text: 'short one', from: 'FF4 · episode', rot: -1 },
    { avatar: 'sanya', text: 'quote text goes here', from: 'Short story name', rot: 2.5 },
];

const crew = ['asier', 'bail', 'chomsky', 'danny', 'emmett', 'garrick', 'ibraxas', 'lucian', 'morra', 'rawley', 'serpile', 'zion'];

// Stickers slapped on the wall by hand — positions are deliberate, nudge freely
const stickers = [
    { top: 18, left: 30, size: 40, rot: 0 },
    { top: 70, left: 64, size: 18, rot: 12 },
    { top: 120, left: 22, size: 28, rot: -8 },
    { top: 22, right: 70, size: 22, rot: 20 },
    { top: 66, right: 26, size: 40, rot: -5 },
    { top: 134, right: 92, size: 16, rot: 0 },
];

function GalaxyScreen() {
    // Two log-spiral arms of dots
    const pts: { x: number; y: number; r: number }[] = [];
    for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 70; i++) {
            const t = i / 70;
            const a = arm * Math.PI + t * Math.PI * 3.2;
            const d = 6 + t * 52;
            const jitter = ((i * 37 + arm * 11) % 9) - 4;
            pts.push({ x: 70 + Math.cos(a) * d + jitter * 0.8, y: 60 + Math.sin(a) * d * 0.62 + jitter * 0.5, r: 0.6 + (1 - t) * 1.2 });
        }
    }
    return (
        <svg viewBox='0 0 140 120' className={styles.galaxy} aria-hidden>
            <circle cx='70' cy='60' r='9' fill='var(--crt-glow)' opacity='0.9' />
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.r} fill='var(--crt-glow)' />
            ))}
        </svg>
    );
}

export default function Home() {
    return (
        <div className={`${styles.ship} ${fontVars}`}>
            <SpaceBackdrop className={styles.backdrop} />

            <header className={`${styles.frame} ${styles.frameTop}`}>
                <Link href='/' className={styles.brand}>
                    <img src='/images/logo.svg' width={64} height={64} alt='' />
                    Final Frontier
                </Link>
                <nav className={styles.nav}>
                    <Link href='/archives'>Archives</Link>
                    <Link href='/stories'>Stories</Link>
                    <Link href='/characters'>Characters</Link>
                </nav>
                <nav className={styles.external}>
                    <a href='https://wiki.vortox.space'>Wiki</a>
                    <a href='https://booru.vortox.space'>Booru</a>
                </nav>
            </header>

            <div className={styles.hull}>
                <div className={styles.window} />

                <main className={styles.wall}>
                    {/* PLACEHOLDER peekers — random art from a booru tag later */}
                    <div className={`${styles.peeker} ${styles.peekerLeft}`}>crewmate art<br />peeking in</div>
                    <div className={`${styles.peeker} ${styles.peekerRight}`}>crewmate art<br />peeking in</div>

                    <div className={styles.masthead}>
                        {stickers.map((s, i) => (
                            <FourStar
                                key={i}
                                className={styles.sticker}
                                size={s.size}
                                rotate={s.rot}
                                style={{ top: s.top, left: s.left, right: s.right }}
                            />
                        ))}
                        <img src='/images/logo.png' alt='Final Frontier' className={styles.logo} />
                    </div>

                    <div className={styles.board}>
                        <section className={styles.archives}>
                            <h2 className={styles.plate}>Archives</h2>
                            <ul className={styles.rack}>
                                {seasons.map((s) => (
                                    <li key={s.slug}>
                                        <Link
                                            href={`/archives/${s.slug}`}
                                            className={styles.cart}
                                            style={{ '--season': `var(${s.color})` } as React.CSSProperties}
                                        >
                                            <span className={styles.cartLabel}>{s.title}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className={styles.stories}>
                            <h2 className={styles.typed}>Stories</h2>
                            <div className={styles.shelf}>
                                {spines.map((b, i) => (
                                    <Link
                                        key={i}
                                        href='/stories'
                                        className={styles.spine}
                                        style={{ background: b.color, height: b.h }}
                                    >
                                        {b.title}
                                    </Link>
                                ))}
                            </div>
                        </section>

                        <section className={styles.map}>
                            <div className={styles.crt}>
                                <div className={styles.screen}>
                                    <span className={styles.screenTitle}>GALAXY MAP</span>
                                    <GalaxyScreen />
                                    <span className={styles.screenStatus}>&gt; awaiting nav data_</span>
                                </div>
                                <div className={styles.knobs}>
                                    <span />
                                    <span />
                                </div>
                            </div>
                        </section>

                        <section className={styles.quotes}>
                            <h2 className={styles.scrawl}>quotes</h2>
                            {quotes.map((q, i) => (
                                <figure key={i} className={styles.note} style={{ rotate: `${q.rot}deg` }}>
                                    <img src={`/avatars/${q.avatar}.png`} alt='' className={styles.noteAvatar} />
                                    <div>
                                        <blockquote>{q.text}</blockquote>
                                        <figcaption>{q.from}</figcaption>
                                    </div>
                                </figure>
                            ))}
                        </section>

                        <section className={styles.crew}>
                            <h2 className={styles.dymo}>CREW</h2>
                            <ul className={styles.badges}>
                                {crew.map((c) => (
                                    <li key={c} className={styles.badge}>
                                        <img src={`/avatars/${c}.png`} alt='' />
                                        <span>{c}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </main>

                <div className={styles.window} />
            </div>

            <footer className={`${styles.frame} ${styles.frameBottom}`}>
                <span>est. 981 GUY</span>
                <span>unfinished, but the lights are on</span>
            </footer>
        </div>
    );
}
