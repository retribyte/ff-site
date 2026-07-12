import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'Edit system info' };

// Metadata-only editor (name/description/wiki) — the body tree lives in the
// SystemBuilder at /galaxy/systems/[id]/edit, linked from there and from the
// read-only system page.
export default async function EditSystemMetaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditorPage kind='system' recordId={parseInt(id)} />;
}
