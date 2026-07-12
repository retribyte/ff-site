import type { Metadata } from 'next';
import EditorPage from '@/components/editor/EditorPage';

export const metadata: Metadata = { title: 'New landmark' };
export const dynamic = 'force-dynamic';

export default function NewLandmarkPage() {
    return <EditorPage kind='landmark' />;
}
