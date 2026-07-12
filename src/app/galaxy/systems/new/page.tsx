import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'New system' };
export const dynamic = 'force-dynamic';

// Metadata-only shell (name/description/wiki) — creating this hands off to
// the body-tree builder at /galaxy/systems/[id]/edit (see afterCreatePath
// on starSystemSchema).
export default function NewSystemPage() {
    return <EditorPage kind='system' />;
}
