import type { Metadata } from 'next';
import AdminNav from '@/components/admin/AdminNav';
import { requireAdmin } from './requireAdmin';
import styles from './admin.module.scss';

export const metadata: Metadata = {
    title: { default: 'Admin', template: '%s - Admin' },
    robots: { index: false, follow: false },
};

// The admin console fills the window: a fixed sidebar, and the section beside it at
// full width (no --content-width cap).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    await requireAdmin();
    return (
        <div className={styles.shell}>
            <AdminNav />
            <main className={styles.content}>{children}</main>
        </div>
    );
}
