import styles from './logo.module.scss';
import { FINAL_PATH, FRONTIER_PATH, LOGO_VIEWBOX } from './logoPaths';

/** fflogo3.svg on the booru (post 1128). logoPaths.ts holds its letter outlines. */
const LOGO_SRC =
    'https://booru.vortox.space/_images/a9d14ffbff5a09c6bf695baef4831d92/1128%20-%20artist%3Aretribyte%20logo%20meta%3Avector%20series%3Afinal_frontier%20star%20text.svg';

// The cover art's glow (cover.psd / cover_ff4.psd) is two Photoshop Layer Style
// strokes: Outside, white, blend mode Overlay, sized 10px (layer at 100%) and
// 20px (layer at 50%), on a logo placed at 1053/1694 scale. In logo units that
// is 16 and 32 outward. An SVG stroke is centred on its path, so the width is
// doubled; FINAL also gets its own 15-unit black outline added first.
const GLOWS = [
    { className: styles.glowNear, final: 2 * (15 + 16), frontier: 2 * 16 },
    { className: styles.glowFar, final: 2 * (15 + 32), frontier: 2 * 32 },
];

/**
 * The Final Frontier wordmark with its cover-art glow. Each glow is its own
 * element so it can Overlay-blend with the page behind it. Wrapping this in
 * anything that starts a stacking context (opacity, transform, filter,
 * isolation, z-index) cuts the glow off from the page, and it disappears.
 */
export default function Logo({ className }: { className?: string }) {
    return (
        <span className={`${styles.logo} ${className ?? ''}`}>
            {GLOWS.map((glow, i) => (
                <svg key={i} className={glow.className} viewBox={LOGO_VIEWBOX} overflow='visible' aria-hidden>
                    <path d={FINAL_PATH} strokeWidth={glow.final} />
                    <path d={FRONTIER_PATH} strokeWidth={glow.frontier} />
                </svg>
            ))}
            <img src={LOGO_SRC} alt='Final Frontier' className={styles.image} />
        </span>
    );
}
