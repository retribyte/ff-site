import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Story } from '@/lib/types';
import { storyColors } from '@/lib/stories';
import { seasonDisplayName } from '@/lib/seasons';
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

    // Shelf sections follow campaign order; stories without a campaign go last.
    const seasonOrder = (title: string | undefined) => {
        if (!title) return [2, ''] as const;
        const ff = /^FF(\d+)$/.exec(title);
        return ff ? ([0, ff[1].padStart(3, '0')] as const) : ([1, title] as const);
    };
    const sorted = [...stories].sort((a, b) => {
        const [ra, ka] = seasonOrder(a.season?.title);
        const [rb, kb] = seasonOrder(b.season?.title);
        return ra - rb || ka.localeCompare(kb) || a.title.localeCompare(b.title);
    });
    const anySeason = stories.some((s) => s.season);

    const indexStories: IndexStory[] = sorted.map((s) => ({
        slug: s.slug,
        title: s.title,
        blurb: s.blurb,
        authorName: s.author?.username ?? null,
        publishedDate: s.publishedDate,
        chapterCount: s.chapters?.length ?? 0,
        lineCount: (s.chapters ?? []).reduce((sum, c) => sum + (c._count?.lines ?? 0), 0),
        colors: storyColors(s),
        group: anySeason ? (s.season ? seasonDisplayName(s.season.title) : 'Other') : null,
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
