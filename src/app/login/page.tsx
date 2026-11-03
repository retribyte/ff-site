import { api } from '@/lib/api';
import LoginForm from './LoginForm';

// Registration status follows the server's env, so don't prerender it.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
    // ff-server owns the switch (REGISTRATION_OPEN); fail closed if it can't be asked.
    const registrationOpen = await api<{ open: boolean }>('/register', { cache: 'no-store' })
        .then((data) => data.open)
        .catch(() => false);
    return <LoginForm registrationOpen={registrationOpen} />;
}
