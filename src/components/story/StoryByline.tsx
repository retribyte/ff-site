import { Fragment } from 'react';
import type { PublicUser } from '@/lib/types';
import UserLink from '@/components/UserLink';
import styles from './storyByline.module.scss';

/** "Written by A, B" line linking to author profiles. Hidden for Archivist-only stories. */
export default function StoryByline({ authors }: { authors?: Pick<PublicUser, 'id' | 'username'>[] }) {
    const shown = (authors ?? []).filter((a) => a.username.toLowerCase() !== 'archivist');
    if (shown.length === 0) return null;
    return (
        <p className={styles.byline}>
            Written by{' '}
            {shown.map((a, i) => (
                <Fragment key={a.id}>
                    {i > 0 && ', '}
                    <UserLink username={a.username} />
                </Fragment>
            ))}
        </p>
    );
}
