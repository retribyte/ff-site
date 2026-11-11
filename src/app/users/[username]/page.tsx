import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import { booruPostUrl } from '@/lib/booru';
import SignalLost from '@/components/SignalLost';
import { compareByQuotes } from '@/lib/characterSort';
import CharacterCard from '@/components/characters/CharacterCard';
import ResetPasswordControl from '@/components/users/ResetPasswordControl';
import styles from './user.module.scss';
import RichText from '@/components/RichText';
import { imageSrc } from '@/lib/images';
import NoteList, { messageExcerpt, type NoteGroup } from '@/components/commentary/NoteList';
import { lineUrl } from '@/lib/seasons';
import { storyQuoteUrl } from '@/lib/stories';
import type { MessageType } from '@/lib/types';

// GET /users/:id/commentaries: a note with its line, either a transcript
// message (with its episode) or a story line (with its chapter and story)
interface UserNote {
    id: number;
    content: string;
    messageNo: number | null;
    message: {
        type: MessageType;
        text: string;
        character: { name: string } | null;
        persona: { name: string | null } | null;
        player: { username: string } | null;
        episode: { title: string; slug: string | null; episode_no: number; seasonTitle: string };
    } | null;
    storyLine: {
        line_no: number;
        text: string;
        character: { name: string } | null;
        persona: { name: string | null } | null;
        chapter: { chapter_no: number; title: string | null; story: { slug: string; title: string } };
    } | null;
}

interface Props {
    params: Promise<{ username: string }>;
}

async function getProfile(username: string): Promise<UserProfile | null> {
    try {
        // ff-server treats a bare integer as an id; usernames go through as-is
        return await api<UserProfile>(`/users/${encodeURIComponent(username)}`, { cache: 'no-store' });
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username } = await params;
    try {
        const profile = await getProfile(decodeURIComponent(username));
        return { title: profile ? profile.username : 'Crew' };
    } catch {
        return { title: 'Crew' };
    }
}

export default async function UserPage({ params }: Props) {
    const { username } = await params;

    let profile: UserProfile | null;
    let notes: UserNote[] = [];
    try {
        profile = await getProfile(decodeURIComponent(username));
        if (profile) {
            // A failed fetch just leaves the notes section out
            notes = await api<UserNote[]>(`/users/${profile.id}/commentaries`, { cache: 'no-store' }).catch(() => []);
        }
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!profile) notFound();

    const joined = new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    // Same default order as /characters: most quoted first
    const characters = [...profile.characters].sort(compareByQuotes);

    return (
        <main className={styles.main}>
            <div className={styles.layout}>
                <article className={styles.article}>
                    <h1 className={styles.name}>{profile.username}</h1>
                    {profile.role === 'ADMIN' && <p className={styles.roleChip}>admin</p>}
                    {profile.inactive && (
                        <p
                            className={`${styles.roleChip} ${styles.inactiveChip}`}
                            title='Still on the starting password, so they have never signed in'
                        >
                            inactive
                        </p>
                    )}

                    {profile.bio ? (
                        <RichText html={profile.bio} className={styles.bio} />
                    ) : (
                        <p className='pixel-label'>no bio on file</p>
                    )}

                    {profile.characters.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Characters</h2>
                            <ul className={styles.characters}>
                                {characters.map((character) => (
                                    <li key={character.id}>
                                        <CharacterCard character={character} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {notes.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Commentary</h2>
                            <NoteList groups={noteGroups(notes)} showAuthors={false} />
                        </section>
                    )}

                    {profile.stories.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Stories</h2>
                            <ul className={styles.stories}>
                                {profile.stories.map((story) => (
                                    <li key={story.id}>
                                        <Link href={`/stories/${story.slug}`} className={styles.storyLink}>
                                            {story.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        {profile.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc(profile.icon)} alt={profile.username} width={128} height={128} />
                        ) : (
                            <span className={styles.infoboxGlyph} aria-hidden>
                                {profile.username.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <dl className={styles.facts}>
                        <div className={styles.fact}>
                            <dt>role</dt>
                            <dd>{profile.role === 'ADMIN' ? 'Admin' : 'Crew'}</dd>
                        </div>
                        <div className={styles.fact}>
                            <dt>joined</dt>
                            <dd>{joined}</dd>
                        </div>
                        <div className={styles.fact}>
                            <dt>transmissions</dt>
                            <dd>{profile._count.messages.toLocaleString('en-US')}</dd>
                        </div>
                        {profile.wikiUser && (
                            <div className={styles.fact}>
                                <dt>wiki</dt>
                                <dd>
                                    <a
                                        href={`https://wiki.vortox.space/wiki/User:${encodeURIComponent(profile.wikiUser)}`}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className={styles.factLink}
                                    >
                                        {profile.wikiUser} ↗
                                    </a>
                                </dd>
                            </div>
                        )}
                        {profile.iconBooruId && (
                            <div className={styles.fact}>
                                <dt>avatar</dt>
                                <dd>
                                    <a
                                        href={booruPostUrl(profile.iconBooruId)}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className={styles.factLink}
                                    >
                                        booru #{profile.iconBooruId} ↗
                                    </a>
                                </dd>
                            </div>
                        )}
                    </dl>
                    <ResetPasswordControl userId={profile.id} targetIsAdmin={profile.role === 'ADMIN'} />
                </aside>
            </div>
        </main>
    );
}

// One group per line, newest note first (the API's order); a user's notes on
// the same line sit together
function noteGroups(notes: UserNote[]): NoteGroup[] {
    const groups = new Map<string, NoteGroup>();
    for (const n of notes) {
        const group = n.message ? messageGroup(n.message, n.messageNo!) : n.storyLine ? storyLineGroup(n.storyLine) : null;
        if (!group) continue;
        let g = groups.get(group.key);
        if (!g) {
            g = group;
            groups.set(g.key, g);
        }
        g.notes.push({ id: n.id, author: '', html: n.content });
    }
    return [...groups.values()];
}

function messageGroup(m: NonNullable<UserNote['message']>, messageNo: number): NoteGroup {
    const ep = m.episode;
    return {
        key: `e:${ep.title}#${messageNo}`,
        href: lineUrl({ title: ep.title, episode_no: ep.episode_no, slug: ep.slug ?? undefined, seasonTitle: ep.seasonTitle }, messageNo),
        where: `${ep.seasonTitle} ${ep.title}, line ${messageNo}`,
        speaker: m.persona?.name || m.character?.name || m.player?.username || null,
        excerpt: messageExcerpt(m.type, m.text),
        notes: [],
    };
}

function storyLineGroup(l: NonNullable<UserNote['storyLine']>): NoteGroup {
    const { story, chapter_no } = l.chapter;
    return {
        key: `s:${story.slug}#${chapter_no}#${l.line_no}`,
        href: storyQuoteUrl({ storySlug: story.slug, chapterNo: chapter_no, line_no: l.line_no }),
        where: `${story.title}, ${l.chapter.title ? `${l.chapter.title}, ` : `chapter ${chapter_no}, `}line ${l.line_no}`,
        speaker: l.persona?.name || l.character?.name || null,
        excerpt: messageExcerpt('QUOTE', l.text),
        notes: [],
    };
}
