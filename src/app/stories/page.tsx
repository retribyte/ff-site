import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Story } from '@/lib/types';
import { storyBranch, storyColors } from '@/lib/stories';
import { seasonColors, seasonDisplayName, seasonOrder } from '@/lib/seasons';
import SignalLost from '@/components/SignalLost';
import StoryIndex, { type IndexStory } from '@/components/story/StoryIndex';
import styles from './stories.module.scss';

export const metadata: Metadata = {
    title: 'Stories',
    description: 'Short stories and chronicles from the Final Frontier universe.',
};

// Story data comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

// Heading for stories filed under no campaign (sorted after every campaign)
const NO_CAMPAIGN = 'Other stories';

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

    // Mainline campaigns in order, then the spin-offs (T&L, VM), then no campaign
    const branchRank = (s: Story) => (s.season ? (storyBranch(s.season) === 'mainline' ? 0 : 1) : 2);
    const sorted = [...stories].sort((a, b) => {
        const [ra, ka] = seasonOrder(a.season?.title);
        const [rb, kb] = seasonOrder(b.season?.title);
        return branchRank(a) - branchRank(b) || ra - rb || ka.localeCompare(kb) || a.title.localeCompare(b.title);
    });

    const indexStories: IndexStory[] = sorted.map((s) => ({
        slug: s.slug,
        title: s.title,
        blurb: s.blurb,
        authorNames: (s.authors ?? []).map((a) => a.username),
        publishedDate: s.publishedDate,
        chapterCount: s.chapters?.length ?? 0,
        wordCount: s.wordCount ?? 0,
        colors: storyColors(s),
        group: s.season ? seasonDisplayName(s.season.title) : NO_CAMPAIGN,
        season: s.season ? { code: s.season.title, color: seasonColors(s.season.title).primary } : null,
        canon: s.canon ?? true,
        cast: s.cast ?? [],
    }));

    return (
        <main className={styles.main}>
            <div className={styles.header}>
                <h1>Stories</h1>
                <span className='pixel-label'>{stories.length} on the shelf</span>
                <Link href='/import' className={styles.upload}>
                    upload
                </Link>
            </div>

            <StoryIndex stories={indexStories} />
        </main>
    );
}
