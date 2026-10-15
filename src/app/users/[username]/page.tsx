import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import { booruPostUrl } from '@/lib/booru';
import SignalLost from '@/components/SignalLost';
import CharacterCard from '@/components/characters/CharacterCard';
import styles from './user.module.scss';
import RichText from '@/components/RichText';

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
    try {
        profile = await getProfile(decodeURIComponent(username));
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!profile) notFound();

    const joined = new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    return (
        <main className={styles.main}>
            <div className={styles.layout}>
                <article className={styles.article}>
                    <h1 className={styles.name}>{profile.username}</h1>
                    {profile.role === 'ADMIN' && <p className={styles.roleChip}>archive admin</p>}

                    {profile.bio ? (
                        <RichText html={profile.bio} className={styles.bio} />
                    ) : (
                        <p className='pixel-label'>no bio on file</p>
                    )}

                    {profile.characters.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Characters</h2>
                            <ul className={styles.characters}>
                                {profile.characters.map((character) => (
                                    <li key={character.id}>
                                        <CharacterCard character={character} />
                                    </li>
                                ))}
                            </ul>
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
                            <img src={profile.icon} alt={profile.username} width={128} height={128} />
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
                </aside>
            </div>
        </main>
    );
}
