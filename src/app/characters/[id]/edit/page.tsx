import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'Edit character' };

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditorPage kind='character' recordParam={id} />;
}
