import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'Edit item' };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditorPage kind='item' recordParam={id} />;
}
