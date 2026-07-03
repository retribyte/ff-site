import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'New species' };
export const dynamic = 'force-dynamic';

export default function NewSpeciesPage() {
    return <EditorPage kind='species' />;
}
