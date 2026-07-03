'use client';

import Link from 'next/link';
import { memo, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import type { SlimMessage, TranscriptData } from '@/lib/transcript';
import CommentaryThread from './CommentaryThread';
import PixelAvatar from './PixelAvatar';
import { Highlighted } from './ScanBar';
import type { Block } from './TranscriptReader';
import styles from './transcript.module.scss';

function formatTimestamp(iso: string | null): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    });
}

interface Embed {
    title?: string;
    description?: string[];
    footer?: string;
}

function parseEmbed(text: string): Embed | null {
    try {
        const parsed = JSON.parse(text);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Embed) : null;
    } catch {
        return null;
    }
}

function MessageLine({ message, query }: { message: SlimMessage; query: string | null }) {
    switch (message.type) {
        case 'COMMAND':
            return (
                <p className={styles.command}>
                    <Highlighted text={message.text} query={query} />
                </p>
            );
        case 'ACTION':
            return (
                <p className={styles.action}>
                    <Highlighted text={message.text} query={query} />
                </p>
            );
        case 'EMBED': {
            const embed = parseEmbed(message.text);
            if (!embed) {
                return (
                    <div className={styles.embed}>
                        <p>
                            <Highlighted text={message.text} query={query} />
                        </p>
                    </div>
                );
            }
            return (
                <div className={styles.embed}>
                    {embed.title && <p className={styles.embedTitle}>{embed.title}</p>}
                    {(embed.description ?? []).map((line, i) => (
                        <p key={i}>
                            <Highlighted text={line} query={query} />
                        </p>
                    ))}
                    {embed.footer && <p className={styles.embedFooter}>{embed.footer}</p>}
                </div>
            );
        }
        default:
            // QUOTE, BOT_RESPONSE, OTHER — plain transmission text
            return (
                <p className={styles.plain}>
                    <Highlighted text={message.text} query={query} />
                </p>
            );
    }
}

interface Props {
    block: Block;
    episodeTitle: string;
    characters: TranscriptData['characters'];
    players: TranscriptData['players'];
    targetNo: number | null;
    query: string | null;
    currentMatchNo: number | null;
}

function StoryBlock({ block, episodeTitle, characters, players, targetNo, query, currentMatchNo }: Props) {
    const { colorMode } = useTheme();
    const [copied, setCopied] = useState(false);

    const character = block.characterId !== null ? characters[block.characterId] : null;
    const player = players[block.playerId];
    const speaker = character?.name ?? player?.name ?? 'Unknown';
    // Characterless speakers (the bot, table talk) still get legacy-table colors by name
    const color = characterColor(speaker, character?.color ?? null, colorMode);
    const avatarSrc = character?.image ?? player?.icon ?? null;

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
        <li
            className={styles.block}
            style={{ '--char': color } as React.CSSProperties}
            data-target={isTarget || hasCurrentMatch || undefined}
        >
            <PixelAvatar src={avatarSrc} name={speaker} color={color} />

            <div className={styles.blockBody}>
                <div className={styles.blockHeader}>
                    {block.characterId !== null ? (
                        <Link href={`/characters/${block.characterId}`} className={styles.speaker}>
                            {speaker}
                        </Link>
                    ) : (
                        <span className={styles.speaker}>{speaker}</span>
                    )}
                    {character && player && character.name !== player.name && (
                        <span className={styles.playedBy}>{player.name}</span>
                    )}
                    {block.timestamp && (
                        <time className={styles.timestamp} dateTime={block.timestamp}>
                            {formatTimestamp(block.timestamp)}
                        </time>
                    )}
                </div>
                {block.messages.map((message) => (
                    <div key={message.no} id={`m-${message.no}`}>
                        <MessageLine message={message} query={query} />
                        <CommentaryThread
                            episodeTitle={episodeTitle}
                            messageNo={message.no}
                            initial={message.commentaries}
                        />
                    </div>
                ))}
            </div>

            <button
                type='button'
                className={styles.anchor}
                onClick={copyAnchor}
                aria-label={`Copy link to line ${block.key}`}
                title='Copy link to this line'
            >
                {copied ? '✓' : '#'}
            </button>
        </li>
    );
}

export default memo(StoryBlock);
