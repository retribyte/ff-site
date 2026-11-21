import type { Metadata } from 'next';
import StoryVoicePanel from '@/components/admin/StoryVoicePanel';
import { requireAdmin } from '../requireAdmin';
import styles from '../admin.module.scss';

export const metadata: Metadata = { title: 'Story voices' };

export default async function AdminVoicesPage() {
    await requireAdmin();
    return (
        <>
            <h1 className={styles.srOnly}>Story voices</h1>
            <StoryVoicePanel />
        </>
    );
}
