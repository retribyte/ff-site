import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Story } from '@/lib/types';
import { storyColors } from '@/lib/stories';
import SignalLost from '@/components/SignalLost';
import StoryIndex, { type IndexStory } from '@/components/story/StoryIndex';
import styles from './stories.module.scss';

export const metadata: Metadata = {
    title: 'Stories',
    description: 'Short stories and chronicles from the Final Frontier universe.',
};

// Story data comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

export default async function StoriesPage() {
    let stories: Story[];
    try {
        stories = await api<Story[]>('/stories');
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const indexStories: IndexStory[] = stories.map((s) => ({
        slug: s.slug,
        title: s.title,
        blurb: s.blurb,
        authorName: s.author?.username ?? null,
        publishedDate: s.publishedDate,
        chapterCount: s.chapters?.length ?? 0,
        lineCount: (s.chapters ?? []).reduce((sum, c) => sum + (c._count?.lines ?? 0), 0),
        colors: storyColors(s),
    }));

    return (
        <main className={styles.main}>
            <div className={styles.header}>
                <h1>Stories</h1>
                <span className='pixel-label'>{stories.length} on the shelf</span>
            </div>

            <StoryIndex stories={indexStories} />
        </main>
    );
}
