'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { SlimMessage, TranscriptData } from '@/lib/transcript';
import { clearScroller, registerScroller, ScanBar, scrollToMessage, useScan } from './ScanBar';
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

    // A block spans several messages; deep links and scan hits target a message
    // number, so map each one to its block's row index for scrollToIndex.
    const noToIndex = useMemo(() => {
        const map = new Map<number, number>();
        blocks.forEach((block, i) => {
            for (const message of block.messages) map.set(message.no, i);
        });
        return map;
    }, [blocks]);

    // ── Windowing over the page scroll ────────────────────────────────────
    const listRef = useRef<HTMLOListElement>(null);
    // Distance from the document top to the list, so window offsets line up.
    // In state (not a ref) so the virtualizer re-renders once it's measured.
    const [scrollMargin, setScrollMargin] = useState(0);
    useEffect(() => {
        const el = listRef.current;
        if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    }, [blocks.length]);
    const virtualizer = useWindowVirtualizer({
        count: blocks.length,
        estimateSize: () => 128,
        overscan: 8,
        gap: 16, // was the flex `gap: 1rem` on .blocks
        scrollMargin,
        // Seed a first screen during SSR so opening content paints pre-hydration
        initialRect: { width: 1280, height: 900 },
    });

    // Expose a virtualizer-aware jump so ScanBar / EpisodeSelect can reach rows
    // that aren't mounted yet (see scrollToMessage in ScanBar).
    const jumpToNo = useCallback(
        (no: number) => {
            const index = noToIndex.get(no);
            if (index === undefined) return false;
            // Always an instant jump: react-virtual can't smooth-scroll to a
            // dynamically-measured row (off-screen heights are only estimates,
            // so a smooth animation never converges). Instant find-next also
            // matches native browser find behavior.
            virtualizer.scrollToIndex(index, { align: 'center' });
            // First scroll uses size estimates; re-issue once the target has
            // mounted and measured so we land exactly on it.
            requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'center' }));
            return true;
        },
        [noToIndex, virtualizer]
    );
    useEffect(() => {
        registerScroller(jumpToNo);
        return () => clearScroller(jumpToNo);
    }, [jumpToNo]);

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
    const items = virtualizer.getVirtualItems();

    return (
        <div>
            <ScanBar scan={scan} />
            <ol
                ref={listRef}
                className={styles.blocks}
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
                {items.map((vi) => {
                    const block = blocks[vi.index];
                    return (
                        <StoryBlock
                            key={block.key}
                            block={block}
                            episodeTitle={data.episodeTitle}
                            characters={data.characters}
                            players={data.players}
                            targetNo={targetNo}
                            query={scan.activeQuery}
                            currentMatchNo={scan.currentMatchNo}
                            measureRef={virtualizer.measureElement}
                            dataIndex={vi.index}
                            positionStyle={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
                            }}
                        />
                    );
                })}
            </ol>
        </div>
    );
}
