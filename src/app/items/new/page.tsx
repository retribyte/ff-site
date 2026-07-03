import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'New item' };
export const dynamic = 'force-dynamic';

export default function NewItemPage() {
    return <EditorPage kind='item' />;
}
