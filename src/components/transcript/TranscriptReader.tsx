'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MessageType } from '@/lib/types';
import StoryBlock from './StoryBlock';
import styles from './transcript.module.scss';

export interface SlimMessage {
    no: number;
    type: MessageType;
    text: string;
    characterId: number | null;
    playerId: number;
    timestamp: string | null;
}

export interface SpeakerInfo {
    name: string;
    color: string | null;
    image: string | null;
}

export interface TranscriptData {
    messages: SlimMessage[];
    characters: Record<number, SpeakerInfo>;
    players: Record<number, { name: string; icon: string | null }>;
}

export interface Block {
    key: number; // first messageNo in the block
    playerId: number;
    characterId: number | null;
    timestamp: string | null;
    messages: SlimMessage[];
}

// Consecutive messages from the same player-as-character read as one
// transmission, unless more than GAP_MS passes between them.
const GAP_MS = 15 * 60 * 1000;

function groupIntoBlocks(messages: SlimMessage[]): Block[] {
    const blocks: Block[] = [];
    for (const message of messages) {
        const prev = blocks[blocks.length - 1];
        const prevLast = prev?.messages[prev.messages.length - 1];
        const sameSpeaker =
            prev && prev.playerId === message.playerId && prev.characterId === message.characterId;
        const closeInTime =
            !prevLast?.timestamp ||
            !message.timestamp ||
            new Date(message.timestamp).getTime() - new Date(prevLast.timestamp).getTime() < GAP_MS;

        if (sameSpeaker && closeInTime) {
            prev.messages.push(message);
        } else {
            blocks.push({
                key: message.no,
                playerId: message.playerId,
                characterId: message.characterId,
                timestamp: message.timestamp,
                messages: [message],
            });
        }
    }
    return blocks;
}

function scrollToMessage(no: number, smooth: boolean) {
    const el = document.getElementById(`m-${no}`);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'auto', block: 'center' });
}

export default function TranscriptReader({ data }: { data: TranscriptData }) {
    const searchParams = useSearchParams();
    const blocks = useMemo(() => groupIntoBlocks(data.messages), [data.messages]);

    // ── Deep link (?line=N) ───────────────────────────────────────────────
    const lineParam = searchParams.get('line');
    const targetNo = lineParam ? parseInt(lineParam) : null;
    useEffect(() => {
        if (targetNo !== null && !Number.isNaN(targetNo)) {
            // Let the first paint land before jumping
            requestAnimationFrame(() => scrollToMessage(targetNo, false));
        }
    }, [targetNo]);

    // ── Search ("scan") ───────────────────────────────────────────────────
    const [query, setQuery] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return data.messages.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m.no);
    }, [query, data.messages]);

    // First jump lands on the current match; subsequent jumps step through.
    // Query changes reset the cursor via the derived-state-reset pattern.
    const [hasJumped, setHasJumped] = useState(false);
    const [prevQuery, setPrevQuery] = useState(query);
    if (prevQuery !== query) {
        setPrevQuery(query);
        setMatchIndex(0);
        setHasJumped(false);
    }

    const jumpToMatch = useCallback(
        (direction: 1 | -1) => {
            if (matches.length === 0) return;
            const step = hasJumped ? direction : 0;
            setHasJumped(true);
            const wrapped = (((matchIndex + step) % matches.length) + matches.length) % matches.length;
            setMatchIndex(wrapped);
            scrollToMessage(matches[wrapped], true);
        },
        [matches, matchIndex, hasJumped]
    );

    const activeQuery = query.trim().length >= 2 ? query.trim() : null;
    const currentMatchNo = matches.length > 0 ? matches[matchIndex] : null;

    return (
        <div>
            <div className={styles.scanBar}>
                <span className={styles.scanPrompt} aria-hidden>
                    ❯
                </span>
                <input
                    type='search'
                    className={styles.scanInput}
                    placeholder='scan transcript…'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') jumpToMatch(e.shiftKey ? -1 : 1);
                        if (e.key === 'Escape') setQuery('');
                    }}
                    aria-label='Search within this transcript'
                />
                {activeQuery && (
                    <span className={styles.scanStatus}>
                        {matches.length === 0 ? 'no hits' : `${matchIndex + 1}/${matches.length}`}
                    </span>
                )}
                <button
                    type='button'
                    className={styles.scanButton}
                    onClick={() => jumpToMatch(-1)}
                    disabled={matches.length === 0}
                    aria-label='Previous match'
                >
                    ▲
                </button>
                <button
                    type='button'
                    className={styles.scanButton}
                    onClick={() => jumpToMatch(1)}
                    disabled={matches.length === 0}
                    aria-label='Next match'
                >
                    ▼
                </button>
            </div>

            <ol className={styles.blocks}>
                {blocks.map((block) => (
                    <StoryBlock
                        key={block.key}
                        block={block}
                        characters={data.characters}
                        players={data.players}
                        targetNo={targetNo}
                        query={activeQuery}
                        currentMatchNo={currentMatchNo}
                    />
                ))}
            </ol>
        </div>
    );
}
