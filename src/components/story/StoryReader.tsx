'use client';

import Link from 'next/link';
import { memo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme, type ColorMode } from '@/components/theme/ThemeProvider';
import { characterColor } from '@/lib/characterColors';
import type { SlimLine, StoryData } from '@/lib/stories';
import { Highlighted, ScanBar, scrollToMessage, useScan } from '@/components/transcript/ScanBar';
import styles from './story.module.scss';

// Stories read as prose: NARRATION is narrator voice, ACTION is a command the
// protagonist (or the readers, in a CYOA) chose, DIALOGUE is a character
// speaking, TRANSCRIPT is an in-universe recording fragment, BREAK is a
// scene break.

const Line = memo(function Line({
    line,
    characters,
    colorMode,
    query,
    highlighted,
}: {
    line: SlimLine;
    characters: StoryData['characters'];
    colorMode: ColorMode;
    query: string | null;
    highlighted: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const copyAnchor = () => {
        const url = `${window.location.origin}${window.location.pathname}?line=${line.no}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        });
    };

    let content: React.ReactNode;
    switch (line.type) {
        case 'ACTION':
            content = (
                <p className={styles.action}>
                    <span aria-hidden>❯ </span>
                    <Highlighted text={line.text} query={query} />
                </p>
            );
            break;
        case 'DIALOGUE': {
            const character = line.characterId !== null ? characters[line.characterId] : null;
            const name = character?.name ?? line.speaker ?? '?';
            const color = characterColor(name, character?.color ?? null, colorMode);
            content = (
                <p className={styles.dialogue} style={{ '--char': color } as React.CSSProperties}>
                    {line.characterId !== null ? (
                        <Link href={`/characters/${line.characterId}`} className={styles.dialogueName}>
                            {name}:
                        </Link>
                    ) : (
                        <span className={styles.dialogueName}>{name}:</span>
                    )}{' '}
                    <Highlighted text={line.text} query={query} />
                </p>
            );
            break;
        }
        case 'TRANSCRIPT':
            content = (
                <div className={styles.vcomm}>
                    <p className='pixel-label'>⌁ vcomm broadcast fragment ⌁</p>
                    {line.text.split(/\n{2,}/).map((paragraph, i) => (
                        <p key={i}>
                            <Highlighted text={paragraph} query={query} />
                        </p>
                    ))}
                </div>
            );
            break;
        case 'BREAK':
            content = (
                <p className={styles.sceneBreak} aria-hidden>
                    ✦ ✦ ✦
                </p>
            );
            break;
        default:
            // NARRATION — long-form prose
            content = (
                <p className={styles.narration}>
                    <Highlighted text={line.text} query={query} />
                </p>
            );
    }

    return (
        <div id={`m-${line.no}`} className={styles.line} data-target={highlighted || undefined}>
            {content}
            <button
                type='button'
                className={styles.anchor}
                onClick={copyAnchor}
                aria-label={`Copy link to line ${line.no}`}
                title='Copy link to this line'
            >
                {copied ? '✓' : '#'}
            </button>
        </div>
    );
});

export default function StoryReader({ data }: { data: StoryData }) {
    const { colorMode } = useTheme();
    const searchParams = useSearchParams();

    const lineParam = searchParams.get('line');
    const targetNo = lineParam ? parseInt(lineParam) : null;
    useEffect(() => {
        if (targetNo !== null && !Number.isNaN(targetNo)) {
            requestAnimationFrame(() => scrollToMessage(targetNo, false));
        }
    }, [targetNo]);

    const scan = useScan(data.lines);

    return (
        <div>
            <ScanBar scan={scan} />
            <div className={styles.prose}>
                {data.lines.map((line) => (
                    <Line
                        key={line.no}
                        line={line}
                        characters={data.characters}
                        colorMode={colorMode}
                        query={scan.activeQuery}
                        highlighted={line.no === targetNo || line.no === scan.currentMatchNo}
                    />
                ))}
            </div>
        </div>
    );
}
