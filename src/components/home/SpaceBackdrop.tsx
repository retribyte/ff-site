import { FOUR_STAR_PATH } from './FourStar';

// What the crew sees out the windows: a synthwave horizon under a starfield.
// Deterministic (seeded) so server and client render the same sky.

const W = 1600;
const H = 900;
const HORIZON = 600;
const VANISH_X = W / 2;

function rng(seed: number) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = rng(981);

const dots = Array.from({ length: 260 }, () => ({
    x: rand() * W,
    y: rand() * (HORIZON - 40),
    r: 0.4 + rand() * 1.3,
    o: 0.25 + rand() * 0.7,
}));

const bigStars = Array.from({ length: 14 }, () => ({
    x: rand() * W,
    y: rand() * (HORIZON - 160),
    s: 5 + rand() * 11,
    o: 0.6 + rand() * 0.4,
}));

// Grid floor: horizontal lines bunch toward the horizon
const floorLines = Array.from({ length: 16 }, (_, i) => HORIZON + Math.pow(i / 15, 2.2) * (H - HORIZON + 40));
const rayXs = Array.from({ length: 31 }, (_, i) => (i - 15) * 260);

// Sun stripes: gaps widen toward the bottom
const sunGaps = Array.from({ length: 7 }, (_, i) => ({ y: 480 + i * 18 + i * i * 1.2, h: 2 + i * 1.6 }));

export default function SpaceBackdrop({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio='xMidYMax slice' aria-hidden>
            <defs>
                <linearGradient id='bd-sky' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0' stopColor='#05041a' />
                    <stop offset='0.45' stopColor='#1a0b3d' />
                    <stop offset='0.62' stopColor='#4b1460' />
                    <stop offset='0.67' stopColor='#9c2a6e' />
                    <stop offset='0.668' stopColor='#9c2a6e' />
                </linearGradient>
                <linearGradient id='bd-sun' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0' stopColor='#ffe27a' />
                    <stop offset='0.55' stopColor='#ff8a4c' />
                    <stop offset='1' stopColor='#ff2f8e' />
                </linearGradient>
                <linearGradient id='bd-floor' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0' stopColor='#2a0838' />
                    <stop offset='1' stopColor='#07020f' />
                </linearGradient>
                <radialGradient id='bd-glow' cx='0.5' cy='1' r='0.6'>
                    <stop offset='0' stopColor='#ff4fa0' stopOpacity='0.55' />
                    <stop offset='1' stopColor='#ff4fa0' stopOpacity='0' />
                </radialGradient>
                <mask id='bd-sun-mask'>
                    <rect width={W} height={H} fill='#fff' />
                    {sunGaps.map((g) => (
                        <rect key={g.y} x='0' y={g.y} width={W} height={g.h} fill='#000' />
                    ))}
                </mask>
                <filter id='bd-nebula' x='0' y='0' width='100%' height='100%'>
                    <feTurbulence type='fractalNoise' baseFrequency='0.0024 0.006' numOctaves='4' seed='7' />
                    <feColorMatrix
                        values='0 0 0 0 0.55
                                0 0 0 0 0.25
                                0 0 0 0 0.85
                                0 0 0 1.6 -0.75'
                    />
                    <feGaussianBlur stdDeviation='6' />
                </filter>
                <clipPath id='bd-above-horizon'>
                    <rect width={W} height={HORIZON} />
                </clipPath>
            </defs>

            <rect width={W} height={HORIZON} fill='url(#bd-sky)' />
            <rect width={W} height={HORIZON} filter='url(#bd-nebula)' opacity='0.55' />

            {dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill='#fff' opacity={d.o} />
            ))}
            {bigStars.map((s, i) => (
                <path
                    key={i}
                    d={FOUR_STAR_PATH}
                    fill='#fff'
                    opacity={s.o}
                    transform={`translate(${s.x} ${s.y}) scale(${s.s})`}
                />
            ))}

            <rect x='0' y={HORIZON - 260} width={W} height='260' fill='url(#bd-glow)' />
            <g clipPath='url(#bd-above-horizon)'>
                <circle cx={VANISH_X} cy={HORIZON - 30} r='190' fill='url(#bd-sun)' mask='url(#bd-sun-mask)' />
            </g>

            <rect x='0' y={HORIZON} width={W} height={H - HORIZON} fill='url(#bd-floor)' />
            <g stroke='#ff4fd8' strokeWidth='1.6' opacity='0.75'>
                {floorLines.map((y) => (
                    <line key={y} x1='0' y1={y} x2={W} y2={y} />
                ))}
                {rayXs.map((dx) => (
                    <line key={dx} x1={VANISH_X} y1={HORIZON} x2={VANISH_X + dx * 4} y2={H + 600} />
                ))}
            </g>
            <line x1='0' y1={HORIZON} x2={W} y2={HORIZON} stroke='#ffb3e6' strokeWidth='2.5' />
        </svg>
    );
}
