import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Story } from '@/lib/types';
import { storyColors } from '@/lib/stories';
import { seasonDisplayName, seasonOrder } from '@/lib/seasons';
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

    // Stories without a campaign (VM) go first as an unheaded shelf, then campaign order.
    const sorted = [...stories].sort((a, b) => {
        const noneA = a.season ? 1 : 0;
        const noneB = b.season ? 1 : 0;
        const [ra, ka] = seasonOrder(a.season?.title);
        const [rb, kb] = seasonOrder(b.season?.title);
        return noneA - noneB || ra - rb || ka.localeCompare(kb) || a.title.localeCompare(b.title);
    });

    const indexStories: IndexStory[] = sorted.map((s) => ({
        slug: s.slug,
        title: s.title,
        blurb: s.blurb,
        authorNames: (s.authors ?? []).map((a) => a.username),
        publishedDate: s.publishedDate,
        chapterCount: s.chapters?.length ?? 0,
        lineCount: (s.chapters ?? []).reduce((sum, c) => sum + (c._count?.lines ?? 0), 0),
        colors: storyColors(s),
        // No-campaign stories form an unheaded shelf (sorted first, above the campaign sections)
        group: s.season ? seasonDisplayName(s.season.title) : null,
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
