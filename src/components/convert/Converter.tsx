'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    EQUINOXES_PER_SEMESTER,
    SEMESTERS_PER_GUY,
    GUY_EPOCH_MS,
    formatEarthDateTime,
    formatGuyDate,
    formatGuyTime,
    guyDateTimeToMs,
    guyDateToEquinoxes,
    guyWeekday,
    msToGuyDateTime,
    type GuyDateTime,
} from '@/lib/guy-time';
import styles from './converter.module.scss';

// Port of the legacy ff-site /convert tool, rebuilt on lib/guy-time.
// Conversion is live — no button, results update as you type.

type Fields = Record<string, string>;

const GU_FIELDS: { key: keyof GuyDateTime; label: string; min: number; max: number }[] = [
    { key: 'year', label: 'GUY', min: -Infinity, max: Infinity },
    { key: 'semester', label: 'semester', min: 1, max: SEMESTERS_PER_GUY },
    { key: 'equinox', label: 'equinox', min: 1, max: EQUINOXES_PER_SEMESTER },
    { key: 'period', label: 'period', min: 0, max: 23 },
    { key: 'union', label: 'union', min: 0, max: 59 },
    { key: 'duon', label: 'duon', min: 0, max: 59 },
    { key: 'trion', label: 'trion', min: 0, max: 59 },
];

const EARTH_FIELDS: { key: string; label: string; min: number; max: number }[] = [
    { key: 'year', label: 'year', min: 1, max: Infinity },
    { key: 'month', label: 'month', min: 1, max: 12 },
    { key: 'day', label: 'day', min: 1, max: 31 },
    { key: 'hour', label: 'hour', min: 0, max: 23 },
    { key: 'minute', label: 'minute', min: 0, max: 59 },
    { key: 'second', label: 'second', min: 0, max: 59 },
    { key: 'ms', label: 'ms', min: 0, max: 999 },
];

function parseFields(
    fields: Fields,
    defs: { key: string; label: string; min: number; max: number }[]
): { values: Record<string, number> } | { error: string } {
    const values: Record<string, number> = {};
    for (const def of defs) {
        const raw = (fields[def.key] ?? '').trim();
        if (raw === '' || raw === '-') return { error: 'awaiting input…' };
        const n = parseInt(raw);
        if (Number.isNaN(n)) return { error: `${def.label}: not a number` };
        if (n < def.min || n > def.max) {
            return { error: `${def.label}: ${def.min === -Infinity ? 'any' : def.min}–${def.max === Infinity ? '∞' : def.max}` };
        }
        values[def.key] = n;
    }
    return { values };
}

function FieldGrid({
    defs,
    fields,
    onChange,
}: {
    defs: { key: string; label: string; min: number; max: number }[];
    fields: Fields;
    onChange: (key: string, value: string) => void;
}) {
    return (
        <div className={styles.fieldGrid}>
            {defs.map((def) => (
                <label key={def.key} className={styles.field}>
                    <span className='pixel-label'>{def.label}</span>
                    <input
                        type='text'
                        inputMode='numeric'
                        value={fields[def.key] ?? ''}
                        onChange={(e) => onChange(def.key, e.target.value)}
                        aria-label={def.label}
                    />
                </label>
            ))}
        </div>
    );
}

export default function Converter() {
    // Current moment, refreshed each union (minute) for the header line
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const now = msToGuyDateTime(nowMs - GUY_EPOCH_MS);

    // ── GU → Earth ────────────────────────────────────────────────────────
    const [gu, setGu] = useState<Fields>({
        year: '3022',
        semester: '2',
        equinox: '4',
        period: '0',
        union: '0',
        duon: '0',
        trion: '0',
    });

    const earthResult = useMemo(() => {
        const parsed = parseFields(gu, GU_FIELDS);
        if ('error' in parsed) return parsed;
        const g = parsed.values as unknown as GuyDateTime;
        return { text: formatEarthDateTime(new Date(GUY_EPOCH_MS + guyDateTimeToMs(g))) };
    }, [gu]);

    // ── Earth → GU ────────────────────────────────────────────────────────
    const [era, setEra] = useState<'CE' | 'BCE'>('CE');
    const [earth, setEarth] = useState<Fields>({
        year: '2018',
        month: '6',
        day: '21',
        hour: '0',
        minute: '0',
        second: '0',
        ms: '0',
    });

    const guResult = useMemo(() => {
        const parsed = parseFields(earth, EARTH_FIELDS);
        if ('error' in parsed) return parsed;
        const v = parsed.values;
        const astronomicalYear = era === 'BCE' ? 1 - v.year : v.year;
        const ms = Date.UTC(astronomicalYear, v.month - 1, v.day, v.hour, v.minute, v.second, v.ms);
        const check = new Date(ms);
        if (check.getUTCMonth() !== v.month - 1 || check.getUTCDate() !== v.day) {
            return { error: `day: no ${MONTH_LABELS[v.month - 1]} ${v.day} that year` };
        }
        const g = msToGuyDateTime(ms - GUY_EPOCH_MS);
        return {
            text: `${guyWeekday(guyDateToEquinoxes(g))}, ${formatGuyDate(guyDateToEquinoxes(g))} GUY · ${formatGuyTime(g)}`,
        };
    }, [earth, era]);

    const setGuField = (key: string, value: string) => setGu((prev) => ({ ...prev, [key]: value }));
    const setEarthField = (key: string, value: string) => setEarth((prev) => ({ ...prev, [key]: value }));

    const loadNow = () => {
        const d = new Date();
        setEra('CE');
        setEarth({
            year: String(d.getUTCFullYear()),
            month: String(d.getUTCMonth() + 1),
            day: String(d.getUTCDate()),
            hour: String(d.getUTCHours()),
            minute: String(d.getUTCMinutes()),
            second: String(d.getUTCSeconds()),
            ms: String(d.getUTCMilliseconds()),
        });
    };

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1>Chrono Conversion</h1>
                <p className='pixel-label'>
                    galactic union ⇄ earth standard · right now it is {guyWeekday(guyDateToEquinoxes(now))},{' '}
                    {formatGuyDate(guyDateToEquinoxes(now))} GUY
                </p>
            </header>

            <div className={styles.panels}>
                <section className={`pixel-panel ${styles.panel}`}>
                    <h2 className={styles.panelTitle}>GU → Earth</h2>
                    <FieldGrid defs={GU_FIELDS} fields={gu} onChange={setGuField} />
                    <output className={styles.result} data-error={'error' in earthResult || undefined}>
                        {'error' in earthResult ? `✖ ${earthResult.error}` : earthResult.text}
                    </output>
                </section>

                <section className={`pixel-panel ${styles.panel}`}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Earth → GU</h2>
                        <button type='button' className={styles.nowButton} onClick={loadNow}>
                            now
                        </button>
                    </div>
                    <div className={styles.eraRow}>
                        <label className={styles.field}>
                            <span className='pixel-label'>era</span>
                            <select value={era} onChange={(e) => setEra(e.target.value as 'CE' | 'BCE')}>
                                <option value='CE'>CE</option>
                                <option value='BCE'>BCE</option>
                            </select>
                        </label>
                    </div>
                    <FieldGrid defs={EARTH_FIELDS} fields={earth} onChange={setEarthField} />
                    <output className={styles.result} data-error={'error' in guResult || undefined}>
                        {'error' in guResult ? `✖ ${guResult.error}` : guResult.text}
                    </output>
                </section>
            </div>

            <footer className={styles.legend}>
                <span className='pixel-label'>
                    1 guy = 32 semesters = 1440 equinoxes · 1 equinox = 24 periods = 1 earth day · time reads
                    period:union:duon.trion
                </span>
            </footer>
        </main>
    );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
