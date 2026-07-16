import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { EDITOR_SCHEMAS, type EditorKind } from '@/lib/editor/schemas';
import RecordEditor from './RecordEditor';

// Server shell shared by every /new and /[id]/edit page: enforces the
// session, loads the record, checks ownership, then hands plain JSON to
// the client-side RecordEditor. (ff-server re-checks all of this on write.)
// recordParam is the raw route segment — numeric id or slug, both accepted
// by the GET endpoint; PUT/DELETE need the numeric id, taken from the
// fetched record once it's loaded.
export default async function EditorPage({ kind, recordParam }: { kind: EditorKind; recordParam?: string }) {
    const schema = EDITOR_SCHEMAS[kind];
    const user = await getSessionUser();
    if (!user) redirect('/login');

    let record: Record<string, unknown> | null = null;
    if (recordParam !== undefined) {
        try {
            record = await api<Record<string, unknown>>(`${schema.basePath}/${recordParam}`);
        } catch (error) {
            if (error instanceof ApiError && error.httpStatus === 404) notFound();
            throw error;
        }
        const ownsRecord = record.creatorId === user.id || user.role === 'ADMIN';
        if (!ownsRecord) redirect(schema.viewPath((record.slug as string | undefined) ?? recordParam));
    }

    const isEdit = record !== null;
    const recordId = isEdit ? (record!.id as number) : undefined;
    const backHref = isEdit ? schema.viewPath((record!.slug as string | undefined) ?? recordId!) : schema.indexPath;

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
