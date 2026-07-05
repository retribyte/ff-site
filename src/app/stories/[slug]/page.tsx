import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Story } from '@/lib/types';
import { chapterSlug, countVoices, fetchAllLines, slimStoryChapter, storyColors } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import StoryReader from '@/components/story/StoryReader';
import ChoiceJump from '@/components/story/ChoiceJump';
import styles from './story-page.module.scss';

interface Props {
    params: Promise<{ slug: string }>;
}

// Content comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    try {
        const story = await api<Story>(`/stories/${encodeURIComponent(slug)}`);
        return { title: story.title, description: story.blurb ?? undefined };
    } catch {
        return { title: 'Stories' };
    }
}

export default async function StoryPage({ params }: Props) {
    const { slug } = await params;

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
    const colors = storyColors(story);
    const style = {
        '--story': colors.primary,
        '--story-2': colors.secondary,
        '--scan-accent': colors.primary,
    } as React.CSSProperties;

    // Single-chapter stories read on one page, straight through
    if (chapters.length === 1) {
        const data = slimStoryChapter(slug, chapters[0].chapter_no, await fetchAllLines(slug, chapters[0].chapter_no));
        const choices = data.lines.filter((l) => l.type === 'ACTION').map((l) => ({ no: l.no, text: l.text }));
        const voices = countVoices(data);

        return (
            <main className={styles.main} style={style}>
                <nav className={styles.breadcrumb}>
                    <Link href='/stories'>← all stories</Link>
                    {choices.length > 0 && <ChoiceJump choices={choices} />}
                </nav>

                <header className={styles.header}>
                    <p className='pixel-label'>
                        {data.lines.length} lines
                        {choices.length > 0 && <> · {choices.length} choices</>}
                        {voices > 0 && <> · {voices} voices</>}
                    </p>
                    <h1 className={styles.title}>{story.title}</h1>
                    {story.blurb && <p className={styles.summary}>{story.blurb}</p>}
                </header>

                <StoryReader data={data} />

                <footer className={styles.footer}>
                    <span className='pixel-label'>end of story ⌁ signal terminates here</span>
                </footer>
            </main>
        );
    }

    // Multi-chapter stories get a table of contents
    const lineTotal = chapters.reduce((sum, c) => sum + (c._count?.lines ?? 0), 0);

    return (
        <main className={styles.main} style={style}>
            <nav className={styles.breadcrumb}>
                <Link href='/stories'>← all stories</Link>
            </nav>

            <header className={styles.header}>
                <p className='pixel-label'>
                    {chapters.length} chapters · {lineTotal} lines
                    {story.author && <> · by {story.author.username}</>}
                </p>
                <h1 className={styles.title}>{story.title}</h1>
                {story.blurb && <p className={styles.summary}>{story.blurb}</p>}
            </header>

            <ol className={styles.toc}>
                {chapters.map((chapter) => (
                    <li key={chapter.id}>
                        <Link href={`/stories/${slug}/${chapterSlug(chapter)}`} className={styles.tocLink}>
                            <span className={styles.tocNo}>{chapter.chapter_no}</span>
                            <span className={styles.tocTitle}>{chapter.title ?? `Chapter ${chapter.chapter_no}`}</span>
                            <span className={styles.tocMeta}>
                                {chapter._count?.lines ?? 0} line{(chapter._count?.lines ?? 0) === 1 ? '' : 's'}
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </main>
    );
}
