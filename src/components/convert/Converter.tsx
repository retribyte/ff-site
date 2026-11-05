'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { arkabilarName, parseArkabilar, parseEarthString, parseGuyString } from '@/lib/guy-format';
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
    onPasteText,
    timeFrom,
    extra,
}: {
    defs: { key: string; label: string; min: number; max: number }[];
    fields: Fields;
    onChange: (key: string, value: string) => void;
    /** Return true if the pasted text was a full date string and was applied. */
    onPasteText?: (text: string) => boolean;
    /** Key of the first time-of-day field; it starts the second row. */
    timeFrom: string;
    /** Extra control rendered inline right after the field with key `after`. */
    extra?: { after: string; node: React.ReactNode };
}) {
    const split = defs.findIndex((d) => d.key === timeFrom);
    const renderField = (def: (typeof defs)[number]) => (
        <Fragment key={def.key}>
            <label className={styles.field}>
                <span className='pixel-label'>{def.label}</span>
                <input
                    type='text'
                    inputMode='numeric'
                    value={fields[def.key] ?? ''}
                    onChange={(e) => onChange(def.key, e.target.value)}
                    onPaste={(e) => {
                        const text = e.clipboardData.getData('text');
                        if (onPasteText?.(text)) e.preventDefault();
                    }}
                    aria-label={def.label}
                />
            </label>
            {extra?.after === def.key && extra.node}
        </Fragment>
    );
    return (
        <>
            <div className={styles.fieldGrid}>{defs.slice(0, split).map(renderField)}</div>
            <div className={styles.fieldGrid}>{defs.slice(split).map(renderField)}</div>
        </>
    );
}

function ResultBox({
    error,
    text,
    children,
}: {
    error?: string;
    /** Plain text placed on the clipboard (round-trips through the paste parsers). */
    text?: string;
    children?: React.ReactNode;
}) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <div className={styles.resultWrap}>
            <output className={styles.result} data-error={error ? true : undefined}>
                {error ? `✖ ${error}` : text}
                {!error && children}
            </output>
            {!error && (
                <button
                    type='button'
                    className={styles.copyButton}
                    onClick={copy}
                    aria-label={copied ? 'Copied' : 'Copy result'}
                    title={copied ? 'Copied' : 'Copy'}
                >
                    <svg viewBox='0 0 16 16' width='16' height='16' fill='none' stroke='currentColor' strokeWidth='1.5' aria-hidden='true'>
                        {copied ? (
                            <path d='M3 8.5l3.5 3.5L13 4.5' />
                        ) : (
                            <>
                                <rect x='5.5' y='5.5' width='8' height='8' rx='1' />
                                <path d='M10.5 5.5v-3h-8v8h3' />
                            </>
                        )}
                    </svg>
                </button>
            )}
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
        const semByName = parseArkabilar(gu.semester ?? '');
        const parsed = parseFields(semByName ? { ...gu, semester: String(semByName) } : gu, GU_FIELDS);
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
        const day = guyWeekday(guyDateToEquinoxes(g));
        return {
            text: `${day}, ${formatGuyDate(guyDateToEquinoxes(g))} GUY ⁄ ${formatGuyTime(g)}`,
            sub: `alt: ${day}, ${g.equinox} of ${arkabilarName(g.semester)}, ${g.year} GUY`,
        };
    }, [earth, era]);

    const pasteGu = (text: string) => {
        const g = parseGuyString(text);
        if (!g) return false;
        setGu(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, String(v)])));
        return true;
    };
    const pasteEarth = (text: string) => {
        const e = parseEarthString(text);
        if (!e) return false;
        setEra(e.era);
        setEarth({
            year: String(e.year),
            month: String(e.month),
            day: String(e.day),
            hour: String(e.hour),
            minute: String(e.minute),
            second: String(e.second),
            ms: String(e.ms),
        });
        return true;
    };

    const semesterNum = parseArkabilar(gu.semester ?? '') ?? parseInt(gu.semester ?? '');
    const semesterHint = arkabilarName(semesterNum);

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
                    galactic union ⇄ earth standard
                </p>
                <p>
                    Right now it is {guyWeekday(guyDateToEquinoxes(now))},{' '}
                    {formatGuyDate(guyDateToEquinoxes(now))} GUY
                </p>
            </header>

            <div className={styles.panels}>
                <section className={`pixel-panel ${styles.panel}`}>
                    <h2 className={styles.panelTitle}>GU → Earth</h2>
                    <p style={{'margin': '0'}}>{'Paste a full GU date to fill all fields'}</p>
                    <FieldGrid defs={GU_FIELDS} fields={gu} onChange={setGuField} onPasteText={pasteGu} timeFrom='period' />
                    <ResultBox
                        error={'error' in earthResult ? earthResult.error : undefined}
                        text={'text' in earthResult ? earthResult.text : undefined}
                    />
                </section>

                <section className={`pixel-panel ${styles.panel}`}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Earth → GU</h2>
                        <button type='button' className={styles.nowButton} onClick={loadNow}>
                            now
                        </button>
                    </div>
                    <p style={{'margin': '0'}}>{'Paste a full Earth date to fill all fields'}</p>
                    <FieldGrid
                        defs={EARTH_FIELDS}
                        fields={earth}
                        onChange={setEarthField}
                        onPasteText={pasteEarth}
                        timeFrom='hour'
                        extra={{
                            after: 'year',
                            node: (
                                <label className={styles.field}>
                                    <span className='pixel-label'>era</span>
                                    <select value={era} onChange={(e) => setEra(e.target.value as 'CE' | 'BCE')}>
                                        <option value='CE'>CE</option>
                                        <option value='BCE'>BCE</option>
                                    </select>
                                </label>
                            ),
                        }}
                    />
                    <ResultBox
                        error={'error' in guResult ? guResult.error : undefined}
                        text={'text' in guResult ? guResult.text : undefined}
                    >
                        {'sub' in guResult && (
                            <>
                                <br />
                                <small>{guResult.sub}</small>
                            </>
                        )}
                    </ResultBox>
                </section>
            </div>
        </main>
    );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
