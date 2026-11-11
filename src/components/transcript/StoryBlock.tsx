'use client';

import Link from 'next/link';
import { memo, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import { resolvePersonaIdentity } from '@/lib/personaIdentity';
import { parseEmbed } from '@/lib/search';
import type { SlimMessage, TranscriptData } from '@/lib/transcript';
import AttributionControl from './AttributionControl';
import CommentaryThread, { notesUrl } from './CommentaryThread';
import PixelAvatar from './PixelAvatar';
import { Highlighted } from './ScanBar';
import type { Block } from './TranscriptReader';
import styles from './transcript.module.scss';

// One formatter per zone, built once: Date#toLocaleString builds a new
// Intl.DateTimeFormat on every call, which was the costliest part of
// rendering a long transcript's blocks.
const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
};
const utcFormat = new Intl.DateTimeFormat('en-US', { ...TIMESTAMP_OPTIONS, timeZone: 'UTC' });
let localFormat: Intl.DateTimeFormat | null = null;

// `local` false -> UTC (what the server renders, so hydration matches);
// true -> the viewer's own timezone, switched on after mount.
function formatTimestamp(iso: string, local: boolean): string {
    const format = local ? (localFormat ??= new Intl.DateTimeFormat('en-US', TIMESTAMP_OPTIONS)) : utcFormat;
    return format.format(new Date(iso));
}

const subscribeNoop = () => () => {};

// Its own component so the switch to local time after hydration re-renders
// only the timestamps, not every block around them.
function Timestamp({ iso }: { iso: string }) {
    // False during SSR/hydration (server has no viewer timezone), true after,
    // without a setState-in-effect.
    const localTime = useSyncExternalStore(subscribeNoop, () => true, () => false);
    return (
        <time className={styles.timestamp} dateTime={iso}>
            {formatTimestamp(iso, localTime)}
        </time>
    );
}

// Discord colors [bracketed] runs inside ini/md code blocks; the brackets
// themselves stay visible, as they did in Discord.
const CODE_MARK = /(\[[^\]\n]+\])/;

function EmbedLine({ line, code, query }: { line: string; code?: string; query: string | null }) {
    if (code !== 'ini' && code !== 'md') return <Highlighted text={line} query={query} />;
    return (
        <>
            {line.split(CODE_MARK).map((part, i) =>
                i % 2 === 1 ? (
                    <span key={i} className={styles.codeMark}>
                        <Highlighted text={part} query={query} />
                    </span>
                ) : (
                    part && <Highlighted key={i} text={part} query={query} />
                )
            )}
        </>
    );
}

function MessageLine({ message, query, children }: { message: SlimMessage; query: string | null; children?: React.ReactNode }) {
    switch (message.type) {
        case 'COMMAND':
            return (
                <div className={styles.command}>
                    <Highlighted text={message.text} query={query} />
                    {children}
                </div>
            );
        case 'ACTION':
            return (
                <div className={styles.action}>
                    <Highlighted text={message.text} query={query} />
                    {children}
                </div>
            );
        case 'EMBED': {
            const embed = parseEmbed(message.text);
            if (!embed) {
                return (
                    <div className={styles.embed}>
                        <p>
                            <Highlighted text={message.text} query={query} />
                        </p>
                        {children}
                    </div>
                );
            }
            // Discord's embed color, when it has one, replaces the speaker tint
            const colorStyle = embed.color ? ({ '--embed-color': embed.color } as React.CSSProperties) : undefined;
            return (
                <div
                    className={`${styles.embed} ${embed.code !== undefined ? styles.embedCode : ''}`}
                    style={colorStyle}
                >
                    {embed.title && <p className={styles.embedTitle}>{embed.title}</p>}
                    {(embed.description ?? []).map((line, i) => (
                        <p key={i}>
                            <EmbedLine line={line} code={embed.code} query={query} />
                        </p>
                    ))}
                    {embed.footer && <p className={styles.embedFooter}>{embed.footer}</p>}
                    {children}
                </div>
            );
        }
        default:
            // QUOTE, BOT_RESPONSE, OTHER — plain transmission text
            return (
                <div className={styles.plain}>
                    <Highlighted text={message.text} query={query} />
                    {children}
                </div>
            );
    }
}

interface Props {
    block: Block;
    episodeTitle: string;
    characters: TranscriptData['characters'];
    players: TranscriptData['players'];
    personas: TranscriptData['personas'];
    targetNo: number | null;
    query: string | null;
    currentMatchNo: number | null;
}

function StoryBlock({ block, episodeTitle, characters, players, personas, targetNo, query, currentMatchNo }: Props) {
    const { colorMode } = useTheme();
    const { user } = useSession();
    const [copied, setCopied] = useState(false);

    const characterId = block.characterId;
    const character = characterId !== null ? characters[characterId] : null;
    const player = players[block.playerId];
    const persona = block.personaId !== null ? personas[block.personaId] : null;
    const { speaker, color: rawColor, avatarSrc } = resolvePersonaIdentity(persona, character, player);
    // A player speaking as themselves (no character, no persona, no color of
    // their own -- table talk, bare commands) reads in one neutral grey;
    // a bot keeps its user color (the 8 Ball's purple, which FF4's Vortox is merged into)
    const isPlayerVoice = !character && !persona && !rawColor;
    // The color fallbacks (the legacy color table, the name hash) key on the
    // character's own name, not the persona's: Grass Stalker's FF1 "Emmett"
    // persona would otherwise borrow Emmett Tawfeek's green from the table
    const color = isPlayerVoice
        ? 'var(--text-muted)'
        : characterColor(
              character?.name ?? speaker,
              rawColor,
              colorMode,
              // a persona's own color wins in both themes; otherwise the character's light override
              persona?.color ? null : (character?.colorLight ?? null)
          );

    const isTarget =
        targetNo !== null && block.messages.some((m) => m.no === targetNo);
    const hasCurrentMatch =
        currentMatchNo !== null && block.messages.some((m) => m.no === currentMatchNo);

    const copyAnchor = () => {
        const url = `${window.location.origin}${window.location.pathname}?line=${block.key}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    };

    return (
        <li className={styles.row} style={{ '--char': color } as React.CSSProperties}>
            <div className={styles.block} data-target={isTarget || hasCurrentMatch || undefined}>
                <PixelAvatar src={avatarSrc} name={speaker} color={color} />

                <div className={styles.blockBody}>
                    <div className={styles.blockHeader}>
                        {characterId !== null ? (
                            // No prefetch: hundreds of blocks, a handful of characters
                            <Link
                                href={`/characters/${character?.slug ?? characterId}`}
                                prefetch={false}
                                className={styles.speaker}
                            >
                                {speaker}
                            </Link>
                        ) : (
                            <span className={styles.speaker}>{speaker}</span>
                        )}
                        {(character || persona) && player && speaker !== player.name && (
                            <span className={styles.playedBy}>{player.name}</span>
                        )}
                        {block.timestamp && <Timestamp iso={block.timestamp} />}
                    </div>
                    {block.messages.map((message, i) => {
                        // A different player voicing the same character: name them
                        // in the avatar gutter beside their lines
                        const prevPlayerId = i === 0 ? block.playerId : block.messages[i - 1].playerId;
                        const otherPlayer = message.playerId !== prevPlayerId ? players[message.playerId] : null;
                        return (
                            <div key={message.no} id={`m-${message.no}`}>
                                {otherPlayer && <span className={styles.playerTag}>{otherPlayer.name}</span>}
                                <MessageLine message={message} query={query}>
                                </MessageLine>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* A rail beside the block, top to bottom: link, personas (admin), notes */}
            <div className={styles.blockActions}>
                <button
                    type='button'
                    className={styles.anchor}
                    onClick={copyAnchor}
                    aria-label={`Copy link to line ${block.key}`}
                    title='Copy link to this line'
                >
                    {copied ? '✓' : '#'}
                </button>
                {user?.role === 'ADMIN' && (
                    <AttributionControl
                        episodeTitle={episodeTitle}
                        characterId={characterId}
                        characterName={character?.name ?? null}
                        anchorNo={block.key}
                        blockNos={block.messages.map((m) => m.no)}
                        currentPersonaId={block.personaId}
                    />
                )}
                <CommentaryThread
                    notesUrl={notesUrl({ episodeTitle, messageNo: block.key })}
                    initial={block.messages[0].commentaries}
                />
            </div>
        </li>
    );
}

export default memo(StoryBlock);
