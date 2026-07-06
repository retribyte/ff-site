'use client';

import { useState } from 'react';
import EpisodeImporter from './EpisodeImporter';
import StoryImporter from './StoryImporter';
import styles from './importConsole.module.scss';

type Mode = 'episode' | 'story';

// Switches the import terminal between the two archive-to-markdown pipelines:
// episode transcripts (md-to-api.py) and stories (story-md-to-api.py).
export default function ImportConsole() {
    const [mode, setMode] = useState<Mode>('episode');

    return (
        <div>
            <div className={styles.tabs} role='tablist' aria-label='Import type'>
                <button
                    type='button'
                    role='tab'
                    aria-selected={mode === 'episode'}
                    className={mode === 'episode' ? styles.tabActive : styles.tab}
                    onClick={() => setMode('episode')}
                >
                    Episode
                </button>
                <button
                    type='button'
                    role='tab'
                    aria-selected={mode === 'story'}
                    className={mode === 'story' ? styles.tabActive : styles.tab}
                    onClick={() => setMode('story')}
                >
                    Story
                </button>
            </div>

            <p className={styles.hint}>
                {mode === 'episode' ? (
                    <>
                        Feed an episode JSON from <code>archive-to-markdown/md-to-api.py</code> into the archive.
                    </>
                ) : (
                    <>
                        Feed a story JSON from <code>archive-to-markdown/story-md-to-api.py</code> onto the shelf.
                    </>
                )}
            </p>

            {mode === 'episode' ? <EpisodeImporter /> : <StoryImporter />}
        </div>
    );
}
