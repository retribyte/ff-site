import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Story } from '@/lib/types';
import {
    chapterNoFromSlug,
    chapterSlug,
    fetchAllLines,
    slimStoryChapter,
    storyColors,
} from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import StoryReader from '@/components/story/StoryReader';
import ChoiceJump from '@/components/story/ChoiceJump';
import styles from '../story-page.module.scss';

interface Props {
    params: Promise<{ slug: string; chapter: string }>;
}

// Content comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, chapter } = await params;
    try {
        const story = await api<Story>(`/stories/${encodeURIComponent(slug)}`);
        const no = chapterNoFromSlug(chapter);
        const match = story.chapters?.find((c) => c.chapter_no === no);
        const chapterName = match?.title ?? (no !== null ? `Chapter ${no}` : null);
        return { title: chapterName ? `${story.title} · ${chapterName}` : story.title };
    } catch {
        return { title: 'Stories' };
    }
}

export default async function StoryChapterPage({ params }: Props) {
    const { slug, chapter: chapterSegment } = await params;

    let story: Story;
    try {
        story = await api<Story>(`/stories/${encodeURIComponent(slug)}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) notFound();
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const chapters = [...(story.chapters ?? [])].sort((a, b) => a.chapter_no - b.chapter_no);
    const chapterNo = chapterNoFromSlug(chapterSegment);
    const index = chapters.findIndex((c) => c.chapter_no === chapterNo);
    if (chapterNo === null || index === -1) notFound();

    // Single-chapter stories read inline on the story page — keep one canonical URL
    if (chapters.length === 1) redirect(`/stories/${slug}`);

    const chapter = chapters[index];
    const prev = index > 0 ? chapters[index - 1] : null;
    const next = index < chapters.length - 1 ? chapters[index + 1] : null;

    const data = slimStoryChapter(slug, chapter.chapter_no, await fetchAllLines(slug, chapter.chapter_no));
    const choices = data.lines.filter((l) => l.type === 'ACTION').map((l) => ({ no: l.no, text: l.text }));

    const colors = storyColors(story);
    const style = {
        '--story': colors.primary,
        '--story-2': colors.secondary,
        '--scan-accent': colors.primary,
    } as React.CSSProperties;

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href={`/stories/${slug}`}>← {story.title}</Link>
                {choices.length > 0 && <ChoiceJump choices={choices} />}
            </nav>

            <header className={styles.header}>
                <p className='pixel-label'>
                    chapter {chapter.chapter_no} of {chapters.length} · {data.lines.length} lines
                </p>
                <h1 className={styles.chapterTitle}>{chapter.title ?? `Chapter ${chapter.chapter_no}`}</h1>
            </header>

            <StoryReader data={data} />

            <nav className={styles.chapterNav}>
                <span>
                    {prev && (
                        <Link href={`/stories/${slug}/${chapterSlug(prev)}`}>
                            ← {prev.title ?? `Chapter ${prev.chapter_no}`}
                        </Link>
                    )}
                </span>
                <span>
                    {next && (
                        <Link href={`/stories/${slug}/${chapterSlug(next)}`}>
                            {next.title ?? `Chapter ${next.chapter_no}`} →
                        </Link>
                    )}
                </span>
            </nav>
        </main>
    );
}
