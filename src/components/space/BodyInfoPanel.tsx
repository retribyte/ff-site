import type { CelestialBody } from '@/lib/types';
import { bodyMass, formatGravity, formatMass, habitability, starColor, surfaceGravity, yearLength } from '@/lib/space';
import { formatAu, formatKm, formatNumber } from './format';
import styles from './space.module.scss';

// Telemetry spec sheet for the selected body: dotted-leader rows, tabular
// mono values with unit suffixes. Star gets radius/temperature/color chip;
// planets add gravity/mass/year (days *and* GUY equinoxes) plus the
// habitability LED meter; moons get radius/orbit/gravity/mass only.

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.trow}>
            <span className={styles.tk}>{label}</span>
            <span className={styles.tleader} aria-hidden />
            <span className={styles.tv}>{value}</span>
        </div>
    );
}

function HabitabilityMeter({ score }: { score: number }) {
    const lit = Math.round((score / 100) * 8);
    const segClass = (i: number) => {
        if (i >= lit) return styles.seg;
        if (i === 0) return `${styles.seg} ${styles.segOn1}`;
        if (i < 4) return `${styles.seg} ${styles.segOn2}`;
        return `${styles.seg} ${styles.segOn3}`;
    };
    return (
        <div className={styles.meter}>
            <span className={`pixel-label ${styles.tk}`} style={{ fontSize: '0.62rem' }}>
                habit.
            </span>
            <span className={styles.meterSegs} role='img' aria-label={`Habitability ${score}%`}>
                {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} className={segClass(i)} />
                ))}
            </span>
            <span className={styles.meterPct}>{score}%</span>
        </div>
    );
}

export default function BodyInfoPanel({ body, starTemperatureK }: { body: CelestialBody; starTemperatureK: number | null }) {
    if (body.type === 'STAR') {
        const color = body.color || (body.temperatureK != null ? starColor(body.temperatureK) : '#ffcc73');
        return (
            <div className={styles.telemetry}>
                <Row label='radius' value={formatKm(body.radiusKm)} />
                {body.temperatureK != null && <Row label='temperature' value={`${formatNumber(body.temperatureK)} K`} />}
                <div className={styles.trow}>
                    <span className={styles.tk}>color</span>
                    <span className={styles.tleader} aria-hidden />
                    <span className={styles.colorChip} style={{ background: color, color }} title={color} />
                </div>
            </div>
        );
    }

    const composition = body.composition ?? 'TERRESTRIAL';
    const gravity = surfaceGravity(body.radiusKm, composition);
    const mass = bodyMass(body.radiusKm, composition);

    if (body.type === 'PLANET') {
        const distanceAu = body.distance ?? 0;
        const { days, equinoxes } = yearLength(distanceAu);
        const hab = starTemperatureK != null ? habitability(starTemperatureK, distanceAu, body.radiusKm, composition) : null;
        return (
            <div className={styles.telemetry}>
                <Row label='radius' value={formatKm(body.radiusKm)} />
                <Row label='orbit' value={formatAu(distanceAu)} />
                <Row label='gravity' value={formatGravity(gravity)} />
                <Row label='mass' value={formatMass(mass)} />
                <Row label='year' value={`${formatNumber(days)} d · ${formatNumber(equinoxes)} eqx`} />
                {hab !== null && <HabitabilityMeter score={hab} />}
            </div>
        );
    }

    // MOON
    return (
        <div className={styles.telemetry}>
            <Row label='radius' value={formatKm(body.radiusKm)} />
            <Row label='orbit' value={formatKm(body.distance ?? 0)} />
            <Row label='gravity' value={formatGravity(gravity)} />
            <Row label='mass' value={formatMass(mass)} />
        </div>
    );
}
