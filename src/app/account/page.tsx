import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import ProfileForm from '@/components/account/ProfileForm';
import PasswordForm from '@/components/account/PasswordForm';
import styles from './account.module.scss';

export const metadata: Metadata = { title: 'Your account' };

export default async function AccountPage() {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <p className='pixel-label'>⌁ crew dossier terminal ⌁</p>
                <h1 className={styles.title}>{user.username}</h1>
                {!user.mustChangePassword && (
                    <Link href={`/users/${encodeURIComponent(user.username)}`} className={styles.publicLink}>
                        view public profile →
                    </Link>
                )}
            </header>

            {user.mustChangePassword ? (
                <>
                    <p className={`pixel-panel ${styles.notice}`} role='status'>
                        Your account was set up with a temporary password. Pick your own before continuing — the
                        rest of the archive unlocks once it&apos;s changed.
                    </p>
                    <PasswordForm setup />
                </>
            ) : (
                <>
                    <ProfileForm user={user} />
                    <PasswordForm />
                </>
            )}
        </main>
    );
}
