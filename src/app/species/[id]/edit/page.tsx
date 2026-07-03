import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'Edit species' };

export default async function EditSpeciesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditorPage kind='species' recordId={parseInt(id)} />;
}
