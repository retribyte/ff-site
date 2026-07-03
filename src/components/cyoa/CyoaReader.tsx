'use client';

import Link from 'next/link';
import { memo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme, type ColorMode } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import type { SlimMessage, TranscriptData } from '@/lib/transcript';
import { Highlighted, ScanBar, scrollToMessage, useScan } from '@/components/transcript/ScanBar';
import CommentaryThread from '@/components/transcript/CommentaryThread';
import styles from './cyoa.module.scss';

// The chronicle reads as prose: BOT_RESPONSE is narration, ACTION is the
// command the readers chose, QUOTE is character dialogue, EMBED is a
// VCOMM broadcast fragment.

function parseVcomm(text: string): string[] {
    try {
        const parsed = JSON.parse(text) as { description?: string[] };
        return parsed.description ?? [text];
    } catch {
        return [text];
    }
}

const Line = memo(function Line({
    message,
    episodeTitle,
    characters,
    colorMode,
    query,
    highlighted,
}: {
    message: SlimMessage;
    episodeTitle: string;
    characters: TranscriptData['characters'];
    colorMode: ColorMode;
    query: string | null;
    highlighted: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const copyAnchor = () => {
        const url = `${window.location.origin}${window.location.pathname}?line=${message.no}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    };

    let content: React.ReactNode;
    switch (message.type) {
        case 'ACTION':
            content = (
                <p className={styles.action}>
                    <span aria-hidden>❯ </span>
                    <Highlighted text={message.text} query={query} />
                </p>
            );
            break;
        case 'QUOTE': {
            const character = message.characterId !== null ? characters[message.characterId] : null;
            const name = character?.name ?? '?';
            const color = characterColor(name, character?.color ?? null, colorMode);
            content = (
                <p className={styles.dialogue} style={{ '--char': color } as React.CSSProperties}>
                    {message.characterId !== null ? (
                        <Link href={`/characters/${message.characterId}`} className={styles.dialogueName}>
                            {name}:
                        </Link>
                    ) : (
                        <span className={styles.dialogueName}>{name}:</span>
                    )}{' '}
                    <Highlighted text={message.text} query={query} />
                </p>
            );
            break;
        }
        case 'EMBED':
            content = (
                <div className={styles.vcomm}>
                    <p className='pixel-label'>⌁ vcomm broadcast fragment ⌁</p>
                    {parseVcomm(message.text).map((line, i) => (
                        <p key={i}>
                            <Highlighted text={line} query={query} />
                        </p>
                    ))}
                </div>
            );
            break;
        default:
            // BOT_RESPONSE and OTHER — narration prose
            content = (
                <p className={styles.narration}>
                    <Highlighted text={message.text} query={query} />
                </p>
            );
    }

    return (
        <div id={`m-${message.no}`} className={styles.line} data-target={highlighted || undefined}>
            {content}
            <CommentaryThread episodeTitle={episodeTitle} messageNo={message.no} initial={message.commentaries} />
            <button
                type='button'
                className={styles.anchor}
                onClick={copyAnchor}
                aria-label={`Copy link to line ${message.no}`}
                title='Copy link to this line'
            >
                {copied ? '✓' : '#'}
            </button>
        </div>
    );
});

export default function CyoaReader({ data }: { data: TranscriptData }) {
    const { colorMode } = useTheme();
    const searchParams = useSearchParams();

    const lineParam = searchParams.get('line');
    const targetNo = lineParam ? parseInt(lineParam) : null;
    useEffect(() => {
        if (targetNo !== null && !Number.isNaN(targetNo)) {
            requestAnimationFrame(() => scrollToMessage(targetNo, false));
        }
    }, [targetNo]);

    const scan = useScan(data.messages);

    return (
        <div>
            <ScanBar scan={scan} />
            <div className={styles.prose}>
                {data.messages.map((message) => (
                    <Line
                        key={message.no}
                        message={message}
                        episodeTitle={data.episodeTitle}
                        characters={data.characters}
                        colorMode={colorMode}
                        query={scan.activeQuery}
                        highlighted={message.no === targetNo || message.no === scan.currentMatchNo}
                    />
                ))}
            </div>
        </div>
    );
}
