import Link from 'next/link';
import RichText from '@/components/RichText';
import UserLink from '@/components/UserLink';
import type { MessageType } from '@/lib/types';
import LineJumpLink from './LineJumpLink';
import styles from './noteList.module.scss';

// Commentary notes gathered from many lines, each line shown once with its
// notes under it: the episode page lists its own notes up top, a profile lists
// a user's notes across the archive.

export interface NoteGroup {
    key: string;
    /** Where the line lives: `?line=N` on the same page (with `jump`), or a full lineUrl */
    href: string;
    /** Same-page link: moves to the line without reloading the transcript */
    jump?: boolean;
    /** e.g. "line 40" or "FF3 Star Struck, line 40" */
    where: string;
    speaker: string | null;
    excerpt: string;
    notes: { id: number; author: string; html: string }[];
}

const EXCERPT_CHARS = 160;

/** A line's text as one short plain line (an EMBED's text is JSON: use its title or first description line). */
export function messageExcerpt(type: MessageType, text: string): string {
    let plain = text;
    if (type === 'EMBED') {
        try {
            const embed = JSON.parse(text) as { title?: string; description?: string[] };
            plain = embed.title || embed.description?.[0] || '';
        } catch {
            // not JSON after all: show it as is
        }
    }
    plain = plain.replace(/\s+/g, ' ').trim();
    return plain.length > EXCERPT_CHARS ? `${plain.slice(0, EXCERPT_CHARS - 1).trimEnd()}…` : plain;
}

export default function NoteList({ groups, showAuthors = true }: { groups: NoteGroup[]; showAuthors?: boolean }) {
    return (
        <ol className={styles.list}>
            {groups.map((g) => (
                <li key={g.key} className={styles.group}>
                    <p className={styles.where}>
                        {g.jump ? (
                            <LineJumpLink href={g.href} className={styles.lineLink}>
                                {g.where}
                            </LineJumpLink>
                        ) : (
                            <Link href={g.href} className={styles.lineLink}>
                                {g.where}
                            </Link>
                        )}
                        {g.speaker && <span className={styles.speaker}>{g.speaker}</span>}
                    </p>
                    {g.excerpt && <blockquote className={styles.excerpt}>{g.excerpt}</blockquote>}
                    <ul className={styles.notes}>
                        {g.notes.map((n) => (
                            <li key={n.id} className={styles.note}>
                                {showAuthors && (
                                    <span className={styles.author}>
                                        <UserLink username={n.author} /> says:
                                    </span>
                                )}
                                <RichText html={n.html} className={styles.content} />
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
        </ol>
    );
}
