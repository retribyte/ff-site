'use client';

import { useEffect, useMemo, useState } from 'react';
import { slugify } from '@/lib/slug';
import styles from './storyImporter.module.scss';

// First step of a Google Doc import: send the .docx to ff-server's
// POST /stories/convert, ask who each text color is, and hand the resulting
// payload ({story, authors, chapters}, speakers as names) to the story
// importer, which matches speakers to characters and uploads it. Nothing is
// written until that upload.

interface ColorInfo {
    color: string;
    count: number;
    samples: string[];
}

interface Analysis {
    colors: ColorInfo[];
    defaults: { title: string | null; blurb: string | null; slug: string };
    pictures: number;
}

export interface ConvertedStory {
    story: Record<string, string>;
    authors: string[];
    chapters: unknown[];
}

/** A picture from the doc (its ![alt](docx:n) line), base64 when a browser can show it. */
export interface DocxPicture {
    n: number;
    alt: string;
    contentType: string | null;
    data: string | null;
}

/** Story.importMeta: how this doc was read, remembered so a revision only asks about new colors. */
export interface ImportMeta {
    format: 'prose' | 'script';
    colors: Record<string, string | null>; // '#rrggbb' -> speaker name, '?' (unnamed NPCs) or null (narration)
}

// What the last import of the story at this slug remembered
interface Remembered {
    slug: string;
    title: string;
    meta: ImportMeta;
}

const NARRATION = '__narration__';
const OTHER = '__other__';
// Several NPCs share this color, so each span imports as an unnamed NPC voice
// ("?" to the converter: [spoken]{?}). Name them in the importer's modal, or
// later in the story reader.
const SEVERAL_NPCS = '__npcs__';
// The house color for "whichever NPC is talking"
const NPC_GRAY = '#666666';

async function convertCall<T>(body: unknown): Promise<T> {
    const res = await fetch('/api/ff/stories/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || envelope?.status === 'error') {
        throw new Error(envelope?.message ?? `The converter answered HTTP ${res.status}`);
    }
    return envelope?.data as T;
}

function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

export default function DocxStoryForm({
    onConverted,
    disabled,
}: {
    onConverted: (
        payload: ConvertedStory,
        fileName: string,
        warnings: string[],
        importMeta: ImportMeta,
        pictures: DocxPicture[]
    ) => void;
    disabled?: boolean;
}) {
    const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [busy, setBusy] = useState<'reading' | 'converting' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [blurb, setBlurb] = useState('');
    const [formatChoice, setFormat] = useState<'prose' | 'script' | null>(null);
    const [season, setSeason] = useState('');
    const [authors, setAuthors] = useState('');
    const [published, setPublished] = useState('');
    // Picks made in this form: color -> character name, NARRATION, SEVERAL_NPCS
    // or OTHER. A color without one falls back to the remembered map, then to
    // the default (gray = several NPCs; anything else unchosen).
    const [voices, setVoices] = useState<Record<string, string>>({});
    const [otherNames, setOtherNames] = useState<Record<string, string>>({});
    const [remembered, setRemembered] = useState<Remembered | null>(null);

    const [characterNames, setCharacterNames] = useState<string[]>([]);
    const [seasons, setSeasons] = useState<string[]>([]);
    useEffect(() => {
        fetch('/api/ff/characters')
            .then((res) => res.json())
            .then((envelope: { data?: { name: string }[] }) =>
                setCharacterNames([...new Set((envelope.data ?? []).map((c) => c.name))].sort((a, b) => a.localeCompare(b)))
            )
            .catch(() => setCharacterNames([]));
        fetch('/api/ff/seasons')
            .then((res) => res.json())
            .then((envelope: { data?: { title: string }[] }) => setSeasons((envelope.data ?? []).map((s) => s.title)))
            .catch(() => setSeasons([]));
    }, []);

    const onFile = async (picked: File | undefined) => {
        if (!picked) return;
        setError(null);
        setWarnings([]);
        setAnalysis(null);
        setBusy('reading');
        try {
            const base64 = toBase64(await picked.arrayBuffer());
            const result = await convertCall<Analysis>({ docx: base64, fileName: picked.name });
            setFile({ name: picked.name, base64 });
            setAnalysis(result);
            setTitle(result.defaults.title ?? picked.name.replace(/\.docx$/i, '').replace(/_/g, "'"));
            setBlurb(result.defaults.blurb ?? '');
            setSlug('');
            setFormat(null);
            setVoices({});
            setOtherNames({});
        } catch (err) {
            setFile(null);
            setError(err instanceof Error ? err.message : 'That file could not be read.');
        } finally {
            setBusy(null);
        }
    };

    // A revised draft of a story already on the shelf: its last Google Doc
    // import remembered who each color was (Story.importMeta)
    const targetSlug = slug.trim() || slugify(title);
    useEffect(() => {
        if (!analysis || !targetSlug) return;
        let live = true;
        const timer = setTimeout(() => {
            fetch(`/api/ff/stories/${encodeURIComponent(targetSlug)}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((envelope: { data?: { title: string; importMeta?: ImportMeta | null } } | null) => {
                    if (!live) return;
                    const meta = envelope?.data?.importMeta;
                    setRemembered(meta ? { slug: targetSlug, title: envelope.data!.title, meta } : null);
                })
                .catch(() => live && setRemembered(null));
        }, 300);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [analysis, targetSlug]);
    const memory = remembered?.slug === targetSlug ? remembered : null;

    const characterSet = useMemo(() => new Set(characterNames), [characterNames]);
    // The remembered speaker for a color as a form pick (+ its name, for OTHER)
    const rememberedPick = (color: string): { pick: string; name?: string } | null => {
        const colors = memory?.meta.colors;
        if (!colors || !(color.toLowerCase() in colors)) return null;
        const speaker = colors[color.toLowerCase()];
        if (speaker === null) return { pick: NARRATION };
        if (speaker === '?') return { pick: SEVERAL_NPCS };
        return characterSet.has(speaker) ? { pick: speaker } : { pick: OTHER, name: speaker };
    };
    // gray is the house NPC color; any other color starts unchosen
    const pickFor = (color: string) =>
        voices[color] ?? rememberedPick(color)?.pick ?? (color === NPC_GRAY ? SEVERAL_NPCS : '');
    const otherNameFor = (color: string) => otherNames[color] ?? rememberedPick(color)?.name ?? '';
    const format = formatChoice ?? memory?.meta.format ?? 'prose';

    const newColors = memory ? (analysis?.colors ?? []).filter((c) => !rememberedPick(c.color)) : [];
    const unchosen = (analysis?.colors ?? []).filter((c) => {
        const v = pickFor(c.color);
        return !v || (v === OTHER && !otherNameFor(c.color).trim());
    });

    const convert = async () => {
        if (!file || !analysis) return;
        setError(null);
        setBusy('converting');
        const colors: Record<string, string | null> = Object.fromEntries(
            analysis.colors.map((c) => {
                const v = pickFor(c.color);
                if (v === SEVERAL_NPCS) return [c.color, '?'];
                return [c.color, v === NARRATION ? null : v === OTHER ? otherNameFor(c.color).trim() : v];
            })
        );
        // images: pictures come across as IMAGE lines, which need booru posts (given in the importer)
        const meta: Record<string, unknown> = { title: title.trim(), format, colors, images: true };
        if (slug.trim()) meta.slug = slug.trim();
        if (blurb.trim()) meta.blurb = blurb.trim();
        if (season) meta.season = season;
        if (authors.trim()) meta.authors = authors.trim();
        if (published) meta.published = published;
        try {
            const result = await convertCall<{ payload: ConvertedStory; warnings: string[]; pictures: DocxPicture[] }>({
                docx: file.base64,
                meta,
            });
            setWarnings(result.warnings);
            onConverted(result.payload, file.name, result.warnings, { format, colors }, result.pictures ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The conversion failed.');
        } finally {
            setBusy(null);
        }
    };

    const locked = disabled || busy !== null;

    return (
        <section className={`pixel-panel ${styles.preview}`} aria-labelledby='docx-heading'>
            <h2 className='pixel-label' id='docx-heading'>
                from a google doc
            </h2>
            <p className={styles.hint}>
                In Google Docs, choose File ▸ Download ▸ Microsoft Word (.docx), then pick the file here. Text colors
                tell the importer who is speaking.
            </p>
            <label className={`${styles.dropzone} ${styles.dropzoneInline}`}>
                <input
                    id='docx-file'
                    type='file'
                    accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    onChange={(e) => void onFile(e.target.files?.[0])}
                    disabled={locked}
                />
                <span className='pixel-label'>{busy === 'reading' ? 'reading…' : '▲ select a .docx'}</span>
                <span className={styles.dropHint}>{file?.name ?? 'exported from Google Docs'}</span>
            </label>

            {analysis && (
                <>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className='pixel-label'>title</span>
                            <input id='docx-title' value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} required />
                        </label>
                        <label className={styles.field}>
                            <span className='pixel-label'>slug</span>
                            <input
                                id='docx-slug'
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                // the server derives the same slug from the title when this is blank
                                placeholder={slugify(title) || 'made from the title'}
                                disabled={locked}
                            />
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className='pixel-label'>blurb</span>
                            <input id='docx-blurb' value={blurb} onChange={(e) => setBlurb(e.target.value)} disabled={locked} />
                        </label>
                        <label className={styles.field}>
                            <span className='pixel-label'>season</span>
                            <select id='docx-season' value={season} onChange={(e) => setSeason(e.target.value)} disabled={locked}>
                                <option value=''>(none)</option>
                                {seasons.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className='pixel-label'>published</span>
                            <input id='docx-published' type='date' value={published} onChange={(e) => setPublished(e.target.value)} disabled={locked} />
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className='pixel-label'>authors</span>
                            <input
                                id='docx-authors'
                                value={authors}
                                onChange={(e) => setAuthors(e.target.value)}
                                placeholder='usernames, comma-separated — blank credits you'
                                disabled={locked}
                            />
                        </label>
                        <fieldset className={`${styles.field} ${styles.fieldWide}`} disabled={locked}>
                            <legend className='pixel-label'>dialogue style</legend>
                            <label className={styles.radio}>
                                <input type='radio' name='docx-format' checked={format === 'prose'} onChange={() => setFormat('prose')} />
                                prose — dialogue sits inside paragraphs, like a novel
                            </label>
                            <label className={styles.radio}>
                                <input type='radio' name='docx-format' checked={format === 'script'} onChange={() => setFormat('script')} />
                                script — each line of dialogue is its own paragraph
                            </label>
                        </fieldset>
                    </div>

                    <h3 className='pixel-label'>who is each color?</h3>
                    {memory && (
                        <p className={styles.hint}>
                            Remembered from the last import of &ldquo;{memory.title}&rdquo;, so its colors are filled in
                            {newColors.length > 0
                                ? `; ${newColors.length} new color${newColors.length === 1 ? '' : 's'} (marked new) still need a speaker.`
                                : '.'}
                        </p>
                    )}
                    {analysis.colors.length === 0 ? (
                        <p className={styles.hint}>No colored text, so every line imports as narration.</p>
                    ) : (
                        <ul className={styles.colorList}>
                            {analysis.colors.map((c) => (
                                <li key={c.color} className={styles.colorRow}>
                                    <span className={styles.swatch} style={{ background: c.color }} aria-hidden />
                                    <span className={styles.colorMeta}>
                                        <span className={styles.mapName}>
                                            {c.color} · {c.count} run{c.count === 1 ? '' : 's'}
                                            {memory && !rememberedPick(c.color) && (
                                                <span className={styles.badgeWarn}> new</span>
                                            )}
                                        </span>
                                        <span className={styles.samples} style={{ color: c.color }}>
                                            {c.samples.map((s) => `“${s}”`).join('  ')}
                                        </span>
                                    </span>
                                    <span className={styles.colorPick}>
                                        <select
                                            aria-label={`speaker for ${c.color}`}
                                            value={pickFor(c.color)}
                                            onChange={(e) => setVoices((prev) => ({ ...prev, [c.color]: e.target.value }))}
                                            disabled={locked}
                                        >
                                            <option value=''>— choose —</option>
                                            <option value={NARRATION}>narration (not a voice)</option>
                                            <option value={SEVERAL_NPCS}>several NPCs (name each line)</option>
                                            <option value={OTHER}>a name not in the archive…</option>
                                            {characterNames.map((n) => (
                                                <option key={n} value={n}>
                                                    {n}
                                                </option>
                                            ))}
                                        </select>
                                        {pickFor(c.color) === SEVERAL_NPCS && (
                                            <span className={styles.pickHint}>
                                                imports unnamed: name the lines after converting, or later while
                                                reading
                                            </span>
                                        )}
                                        {pickFor(c.color) === OTHER && (
                                            <input
                                                aria-label={`display name for ${c.color}`}
                                                value={otherNameFor(c.color)}
                                                onChange={(e) => setOtherNames((prev) => ({ ...prev, [c.color]: e.target.value }))}
                                                placeholder='display name'
                                                disabled={locked}
                                            />
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {analysis.pictures > 0 && (
                        <p className={styles.hint}>
                            This document has {analysis.pictures} picture{analysis.pictures === 1 ? '' : 's'}. Stories show
                            pictures from the booru: after converting, give each one its booru post number.
                        </p>
                    )}

                    <div className={styles.actions}>
                        <button
                            type='button'
                            className={styles.upload}
                            onClick={() => void convert()}
                            disabled={locked || !title.trim() || unchosen.length > 0}
                        >
                            {busy === 'converting' ? 'converting…' : 'Convert and preview'}
                        </button>
                        {unchosen.length > 0 && (
                            <span className={styles.hint}>
                                {unchosen.length} color{unchosen.length === 1 ? '' : 's'} still need a speaker or “narration”
                            </span>
                        )}
                    </div>
                </>
            )}

            {warnings.length > 0 && (
                <ul className={styles.warnings}>
                    {warnings.map((w) => (
                        <li key={w}>⚠ {w}</li>
                    ))}
                </ul>
            )}
            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </section>
    );
}
