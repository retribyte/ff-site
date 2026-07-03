'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SlimMessage, TranscriptData } from '@/lib/transcript';
import { ScanBar, scrollToMessage, useScan } from './ScanBar';
import StoryBlock from './StoryBlock';
import styles from './transcript.module.scss';

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

    const scan = useScan(data.messages);

    return (
        <div>
            <ScanBar scan={scan} />
            <ol className={styles.blocks}>
                {blocks.map((block) => (
                    <StoryBlock
                        key={block.key}
                        block={block}
                        episodeTitle={data.episodeTitle}
                        characters={data.characters}
                        players={data.players}
                        targetNo={targetNo}
                        query={scan.activeQuery}
                        currentMatchNo={scan.currentMatchNo}
                    />
                ))}
            </ol>
        </div>
    );
}
