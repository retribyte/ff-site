'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImportMeta } from './DocxStoryForm';
import styles from './storyImporter.module.scss';

// Vortox Machina from Discord: a DiscordChatExporter JSON export of #cyoa-vm,
// read by ff-server (POST /stories/convert/discord) into the story's lines,
// each line of dialogue carrying the speaker code the GM wrote it with
// ("E: ..."). This form maps each code to a speaker, as the Google Doc form
// maps colors, and hands the draft to the importer: preview, NPC names, and
// (for the "vm" story already on the shelf) the review of what changed. The
// story remembers the codes (Story.importMeta.codes), so the next export only
// asks about new ones.

interface Conversion {
    lines: { type: 'ACTION' | 'NARRATION' | 'DIALOGUE' | 'TRANSCRIPT'; text: string; code?: string }[];
    entries: number;
    codes: { code: string; count: number; example: string }[];
    warnings: string[];
}

interface ConvertedLine {
    type: string;
    text: string;
    speaker?: string;
    npcVoice?: boolean;
}

export interface DiscordPayload {
    story: { slug: string; title: string; format: string; season?: string };
    chapters: { chapter_no: number; lines: ConvertedLine[] }[];
}

const SEVERAL_NPCS = '?';
const OTHER = '__other__';

// Who the codes were before the story remembered any (the old admin import's list)
const KNOWN_CODES: Record<string, string> = {
    E: 'Emmett Tawfeek',
    L: 'Los',
    I: 'IRENE',
    W: 'Wes Romaw',
    F: 'Felps',
    FP: 'Felps',
    S: 'Squorchy Vurkallus',
};
const isNpcCode = (code: string) => /^\?{1,3}\d?$/.test(code);

interface ShelfLine {
    type: string;
    text: string;
    characterId?: number;
    personaId?: number;
    npcVoice?: boolean;
    speaker?: string;
}

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Who each speaker code is, going by the story on the shelf: the voice most of
 * its lines have there, where the same text is already a line. A character
 * by name; NPCs as "several NPCs" (the revision names those from the shelf too).
 */
function suggestCodes(lines: Conversion['lines'], shelf: ShelfLine[], characters: { id: number; name: string }[]): Record<string, string> {
    const voiceOf = new Map<string, string>();
    for (const line of shelf) {
        if (line.type !== 'DIALOGUE') continue;
        const name = line.characterId !== undefined ? characters.find((c) => c.id === line.characterId)?.name : SEVERAL_NPCS;
        if (name && !voiceOf.has(norm(line.text))) voiceOf.set(norm(line.text), name);
    }
    const votes = new Map<string, Map<string, number>>();
    for (const line of lines) {
        if (line.code === undefined) continue;
        const name = voiceOf.get(norm(line.text));
        if (!name) continue;
        const tally = votes.get(line.code) ?? new Map<string, number>();
        tally.set(name, (tally.get(name) ?? 0) + 1);
        votes.set(line.code, tally);
    }
    const out: Record<string, string> = {};
    for (const [code, tally] of votes) out[code] = [...tally].sort((a, b) => b[1] - a[1])[0][0];
    return out;
}

// Only what the converter reads goes up: an export carries avatars, embeds and
// reactions for every message, many megabytes for the whole channel
function slimExport(raw: unknown) {
    const data = raw as { channel?: { id?: unknown }; messages?: unknown };
    if (!data || typeof data !== 'object' || !Array.isArray(data.messages)) {
        throw new Error('Not a DiscordChatExporter JSON export (no messages list).');
    }
    return {
        channel: data.channel?.id !== undefined ? { id: String(data.channel.id) } : undefined,
        messages: (data.messages as { id?: unknown; author?: { name?: unknown; nickname?: unknown }; content?: unknown }[]).map((m) => ({
            id: m.id,
            author: { name: m.author?.name, nickname: m.author?.nickname },
            content: m.content,
        })),
    };
}

export default function DiscordStoryForm({
    onConverted,
    disabled,
}: {
    onConverted: (payload: DiscordPayload, fileName: string, warnings: string[], importMeta: ImportMeta) => void;
    disabled?: boolean;
}) {
    const [fileName, setFileName] = useState<string | null>(null);
    const [conversion, setConversion] = useState<Conversion | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState('Vortox Machina');
    const [slug, setSlug] = useState('vm');
    const [season, setSeason] = useState('VM');
    // Picks made here: code -> a character's name, SEVERAL_NPCS or OTHER (+ a name)
    const [picks, setPicks] = useState<Record<string, string>>({});
    const [otherNames, setOtherNames] = useState<Record<string, string>>({});
    const [remembered, setRemembered] = useState<{ slug: string; title: string; codes: Record<string, string> } | null>(null);

    const [characters, setCharacters] = useState<{ id: number; name: string }[]>([]);
    const characterNames = useMemo(
        () => [...new Set(characters.map((c) => c.name))].sort((a, b) => a.localeCompare(b)),
        [characters]
    );
    const [seasons, setSeasons] = useState<string[]>([]);
    useEffect(() => {
        fetch('/site/ff/characters')
            .then((res) => res.json())
            .then((envelope: { data?: { id: number; name: string }[] }) => setCharacters(envelope.data ?? []))
            .catch(() => setCharacters([]));
        fetch('/site/ff/seasons')
            .then((res) => res.json())
            .then((envelope: { data?: { title: string }[] }) => setSeasons((envelope.data ?? []).map((s) => s.title)))
            .catch(() => setSeasons([]));
    }, []);

    // The story at this slug, if it's on the shelf: its title, and the codes its last import used
    const targetSlug = slug.trim();
    useEffect(() => {
        if (!targetSlug) return;
        let live = true;
        const timer = setTimeout(() => {
            fetch(`/site/ff/stories/${encodeURIComponent(targetSlug)}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((envelope: { data?: { title: string; importMeta?: ImportMeta | null } } | null) => {
                    if (!live) return;
                    const story = envelope?.data;
                    setRemembered(story ? { slug: targetSlug, title: story.title, codes: story.importMeta?.codes ?? {} } : null);
                    if (story) setTitle(story.title);
                })
                .catch(() => live && setRemembered(null));
        }, 300);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [targetSlug]);
    const memory = remembered?.slug === targetSlug ? remembered : null;

    // The story as it stands, to suggest who each code is from the lines whose text it already has
    const [shelf, setShelf] = useState<{ slug: string; lines: ShelfLine[] } | null>(null);
    useEffect(() => {
        if (!conversion || !memory) return;
        let live = true;
        fetch(`/site/ff/stories/${encodeURIComponent(memory.slug)}/text`)
            .then((res) => (res.ok ? res.json() : null))
            .then((envelope: { data?: { chapters: { lines: ShelfLine[] }[] } } | null) => {
                if (live && envelope?.data) setShelf({ slug: memory.slug, lines: envelope.data.chapters.flatMap((c) => c.lines) });
            })
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, [conversion, memory]);
    const suggested = useMemo(
        () => (conversion && shelf?.slug === targetSlug ? suggestCodes(conversion.lines, shelf.lines, characters) : {}),
        [conversion, shelf, targetSlug, characters]
    );

    const characterSet = useMemo(() => new Set(characterNames), [characterNames]);
    // What a code starts as: the story's memory, then who speaks its lines on the shelf now, then
    // the known codes, then "several NPCs" for ?-codes
    const defaultFor = (code: string): string | undefined =>
        memory?.codes[code] ?? suggested[code] ?? KNOWN_CODES[code] ?? (isNpcCode(code) ? SEVERAL_NPCS : undefined);
    const pickFor = (code: string) => {
        if (picks[code] !== undefined) return picks[code];
        const name = defaultFor(code);
        if (name === undefined) return '';
        return name === SEVERAL_NPCS || characterSet.has(name) ? name : OTHER;
    };
    const otherNameFor = (code: string) => {
        if (otherNames[code] !== undefined) return otherNames[code];
        const name = defaultFor(code);
        return name && name !== SEVERAL_NPCS && !characterSet.has(name) ? name : '';
    };
    const speakerFor = (code: string) => {
        const pick = pickFor(code);
        return pick === OTHER ? otherNameFor(code).trim() : pick;
    };

    const codes = conversion?.codes ?? [];
    // a code the story's last import didn't have (none are new before it has remembered any)
    const newCodes = memory && Object.keys(memory.codes).length ? codes.filter((c) => !(c.code in memory.codes)) : [];
    const unchosen = codes.filter((c) => !speakerFor(c.code));

    const onFile = async (picked: File | undefined) => {
        if (!picked) return;
        setError(null);
        setConversion(null);
        setPicks({});
        setOtherNames({});
        setBusy(true);
        try {
            const body = JSON.stringify({ export: slimExport(JSON.parse(await picked.text())) });
            const res = await fetch('/site/ff/stories/convert/discord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            const envelope = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: Conversion } | null;
            if (!res.ok || envelope?.status === 'error' || !envelope?.data) {
                throw new Error(envelope?.message ?? `The converter answered HTTP ${res.status}`);
            }
            setFileName(picked.name);
            setConversion(envelope.data);
        } catch (err) {
            setFileName(null);
            setError(err instanceof SyntaxError ? 'That file is not JSON.' : err instanceof Error ? err.message : 'That file could not be read.');
        } finally {
            setBusy(false);
        }
    };

    const convert = () => {
        if (!conversion || !fileName) return;
        const speakers = Object.fromEntries(codes.map((c) => [c.code, speakerFor(c.code)]));
        const lines: ConvertedLine[] = conversion.lines.map((line) => {
            if (line.code === undefined) return { type: line.type, text: line.text };
            const speaker = speakers[line.code];
            return speaker === SEVERAL_NPCS ? { type: line.type, text: line.text, npcVoice: true } : { type: line.type, text: line.text, speaker };
        });
        const story: DiscordPayload['story'] = { slug: targetSlug, title: title.trim(), format: 'SCRIPT' };
        if (season) story.season = season;
        onConverted({ story, chapters: [{ chapter_no: 1, lines }] }, fileName, conversion.warnings, {
            format: 'script',
            colors: {},
            codes: speakers,
        });
    };

    const locked = disabled || busy;

    return (
        <section className={`pixel-panel ${styles.preview}`} aria-labelledby='discord-heading'>
            <h2 className='pixel-label' id='discord-heading'>
                vortox machina from discord
            </h2>
            <p className={styles.hint}>
                Export #cyoa-vm with DiscordChatExporter (JSON, the whole channel) and pick the file. Every GM entry is
                read into the story; for the story already on the shelf, you then review what changed before replacing
                it.
            </p>
            <label className={`${styles.dropzone} ${styles.dropzoneInline}`}>
                <input
                    type='file'
                    accept='.json,application/json'
                    onChange={(e) => {
                        void onFile(e.target.files?.[0]);
                        e.target.value = ''; // picking the same file again (a fresh export) reads it again
                    }}
                    disabled={locked}
                />
                <span className='pixel-label'>{busy ? 'reading…' : '▲ select a discord export'}</span>
                <span className={styles.dropHint}>{fileName ?? 'DiscordChatExporter JSON of #cyoa-vm'}</span>
            </label>

            {conversion && (
                <>
                    <p className={styles.hint}>
                        {conversion.entries.toLocaleString('en-US')} GM entries, {conversion.lines.length.toLocaleString('en-US')}{' '}
                        lines.
                    </p>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className='pixel-label'>title</span>
                            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} required />
                        </label>
                        <label className={styles.field}>
                            <span className='pixel-label'>slug</span>
                            <input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={locked} required />
                        </label>
                        <label className={styles.field}>
                            <span className='pixel-label'>season</span>
                            <select value={season} onChange={(e) => setSeason(e.target.value)} disabled={locked}>
                                <option value=''>(none)</option>
                                {seasons.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <h3 className='pixel-label'>who is each speaker code?</h3>
                    {memory && (
                        <p className={styles.hint}>
                            {Object.keys(memory.codes).length > 0
                                ? `Remembered from the last import of “${memory.title}”`
                                : `Suggested from who speaks these lines in “${memory.title}” now`}
                            {newCodes.length > 0
                                ? `; ${newCodes.length} code${newCodes.length === 1 ? '' : 's'} (marked new) to check.`
                                : '.'}
                        </p>
                    )}
                    <ul className={styles.colorList}>
                        {codes.map((c) => (
                            <li key={c.code} className={styles.colorRow}>
                                <span className={`pixel-label ${styles.codeChip}`}>{c.code}</span>
                                <span className={styles.colorMeta}>
                                    <span className={styles.mapName}>
                                        {c.count.toLocaleString('en-US')} line{c.count === 1 ? '' : 's'}
                                        {newCodes.includes(c) && <span className={styles.badgeWarn}> new</span>}
                                    </span>
                                    <span className={styles.samples}>&ldquo;{c.example}&rdquo;</span>
                                </span>
                                <span className={styles.colorPick}>
                                    <select
                                        aria-label={`speaker for ${c.code}`}
                                        value={pickFor(c.code)}
                                        onChange={(e) => setPicks((prev) => ({ ...prev, [c.code]: e.target.value }))}
                                        disabled={locked}
                                    >
                                        <option value=''>(choose)</option>
                                        <option value={SEVERAL_NPCS}>several NPCs (name each line)</option>
                                        <option value={OTHER}>an NPC (a name not in the archive)…</option>
                                        {characterNames.map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                    {pickFor(c.code) === OTHER && (
                                        <input
                                            aria-label={`NPC name for ${c.code}`}
                                            value={otherNameFor(c.code)}
                                            onChange={(e) => setOtherNames((prev) => ({ ...prev, [c.code]: e.target.value }))}
                                            placeholder='NPC name'
                                            disabled={locked}
                                        />
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className={styles.actions}>
                        <button
                            type='button'
                            className={styles.upload}
                            onClick={convert}
                            disabled={locked || !title.trim() || !targetSlug || unchosen.length > 0}
                        >
                            Convert and preview
                        </button>
                        {unchosen.length > 0 && (
                            <span className={styles.hint}>
                                {unchosen.length} code{unchosen.length === 1 ? '' : 's'} still need a speaker
                            </span>
                        )}
                    </div>
                    {conversion.warnings.length > 0 && (
                        <ul className={styles.warnings}>
                            {conversion.warnings.map((w) => (
                                <li key={w}>⚠ {w}</li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {error && (
                <p className={styles.error} role='alert'>
                    ✖ {error}
                </p>
            )}
        </section>
    );
}
