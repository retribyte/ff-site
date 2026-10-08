'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';

// Seeded and admin-reset accounts start with a placeholder password. Until
// they pick their own, ff-server refuses their writes — so keep them on the
// account page, where the password form is.
export const ACCOUNT_PATH = '/account';

export default function PasswordChangeGate() {
    const { user } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const mustChange = user?.mustChangePassword ?? false;

    useEffect(() => {
        if (mustChange && pathname !== ACCOUNT_PATH) router.replace(ACCOUNT_PATH);
    }, [mustChange, pathname, router]);

    return null;
}
