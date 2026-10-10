// The FF emblem star, as a die-cut sticker (or a bare path for the backdrop's stars)

export const FOUR_STAR_PATH = 'M0,-1 Q0.12,-0.12 1,0 Q0.12,0.12 0,1 Q-0.12,0.12 -1,0 Q-0.12,-0.12 0,-1Z';

type Props = {
    size?: number;
    color?: string;
    rotate?: number;
    className?: string;
    style?: React.CSSProperties;
};

export default function FourStar({ size = 32, color = 'var(--sticker-ink)', rotate = 0, className, style }: Props) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox='-1.25 -1.25 2.5 2.5'
            aria-hidden
            style={{ transform: `rotate(${rotate}deg)`, ...style }}
        >
            {/* white die-cut margin, then the ink */}
            <path d={FOUR_STAR_PATH} fill='#fff' stroke='#fff' strokeWidth={0.28} strokeLinejoin='round' />
            <path d={FOUR_STAR_PATH} fill={color} />
        </svg>
    );
}
