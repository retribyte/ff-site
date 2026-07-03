import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Episode } from '@/lib/types';
import { fetchAllMessages, slimTranscript } from '@/lib/transcript';
import SignalLost from '@/components/SignalLost';
import CyoaReader from '@/components/cyoa/CyoaReader';
import ChoiceJump from '@/components/cyoa/ChoiceJump';
import styles from './cyoa-page.module.scss';

const EPISODE_TITLE = 'Vortox Machina';

export const metadata: Metadata = {
    title: 'Vortox Machina',
    description: 'The Vortox Machina chronicle — a choose-your-own-adventure told over a recovered VCOMM broadcast.',
};

// Content comes from the live API — render per-request, not at build time
export const dynamic = 'force-dynamic';

export default async function CyoaPage() {
    let episode: Episode;
    let data: ReturnType<typeof slimTranscript>;
    try {
        episode = await api<Episode>(`/episodes/${encodeURIComponent(EPISODE_TITLE)}`);
        data = slimTranscript(await fetchAllMessages(EPISODE_TITLE));
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }

    const choices = data.messages.filter((m) => m.type === 'ACTION').map((m) => ({ no: m.no, text: m.text }));
    const speakerCount = Object.keys(data.characters).length;

    return (
        <main className={styles.main}>
            <nav className={styles.breadcrumb}>
                <Link href='/archives'>← all archives</Link>
                <ChoiceJump choices={choices} />
            </nav>

            <header className={styles.header}>
                <p className='pixel-label'>
                    recovered chronicle · {data.messages.length} lines · {choices.length} choices · {speakerCount}{' '}
                    voices
                </p>
                <h1 className={styles.title}>{EPISODE_TITLE}</h1>
                {episode.summary && <p className={styles.summary}>{episode.summary}</p>}
            </header>

            <CyoaReader data={data} />

            <footer className={styles.footer}>
                <span className='pixel-label'>end of recovered broadcast ⌁ signal terminates here</span>
            </footer>
        </main>
    );
}
