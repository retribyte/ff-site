import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'Edit landmark' };

export default async function EditLandmarkPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditorPage kind='landmark' recordId={parseInt(id)} />;
}
