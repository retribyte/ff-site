import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'New character' };
export const dynamic = 'force-dynamic';

export default function NewCharacterPage() {
    return <EditorPage kind='character' />;
}
