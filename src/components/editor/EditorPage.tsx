import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { EDITOR_SCHEMAS, type EditorKind } from '@/lib/editor/schemas';
import RecordEditor from './RecordEditor';

// Server shell shared by every /new and /[id]/edit page: enforces the
// session, loads the record, checks ownership, then hands plain JSON to
// the client-side RecordEditor. (ff-server re-checks all of this on write.)
export default async function EditorPage({ kind, recordId }: { kind: EditorKind; recordId?: number }) {
    const schema = EDITOR_SCHEMAS[kind];
    const user = await getSessionUser();
    if (!user) redirect('/login');

    let record: Record<string, unknown> | null = null;
    if (recordId !== undefined) {
        if (Number.isNaN(recordId)) notFound();
        try {
            record = schema.loadRecord
                ? await schema.loadRecord(recordId)
                : await api<Record<string, unknown>>(`${schema.basePath}/${recordId}`);
        } catch (error) {
            if (error instanceof ApiError && error.httpStatus === 404) notFound();
            throw error;
        }
        if (!record) notFound();
        const ownsRecord = record.creatorId === user.id || user.role === 'ADMIN';
        if (!ownsRecord) redirect(schema.viewPath(recordId));
    }

    const isEdit = record !== null;
    const backHref = isEdit ? schema.viewPath(recordId!) : schema.indexPath;

    return (
        <main style={{ maxWidth: 'var(--reader-width)', margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
            <nav style={{ marginBottom: '1.25rem' }}>
                <Link
                    href={backHref}
                    className='pixel-label'
                    style={{ textDecoration: 'none' }}
                >
                    ← {isEdit ? 'back to record' : `all ${kind === 'species' ? 'species' : `${kind}s`}`}
                </Link>
            </nav>
            <header style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <p className='pixel-label'>⌁ records terminal ⌁</p>
                <h1 style={{ marginBottom: 0 }}>
                    {isEdit ? `Edit ${kind}: ${String(record!.name ?? recordId)}` : `New ${kind}`}
                </h1>
            </header>
            <RecordEditor kind={kind} record={record} recordId={recordId} />
        </main>
    );
}
