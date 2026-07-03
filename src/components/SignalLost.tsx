// Friendly error panel for when the ff-server API can't be reached.
export default function SignalLost({ detail }: { detail?: string }) {
    return (
        <div
            className='pixel-panel'
            style={{ maxWidth: '28rem', margin: '4rem auto', padding: '1.5rem', textAlign: 'center' }}
        >
            <p className='pixel-label' style={{ color: 'var(--accent-2)' }}>
                ⚠ signal lost ⚠
            </p>
            <h2>No response from the archive</h2>
            <p style={{ color: 'var(--text-muted)' }}>
                The lore server isn&apos;t answering{detail ? ` (${detail})` : ''}. Make sure ff-server is running,
                then refresh.
            </p>
            <p className='pixel-label'>error code: VCOMM-0</p>
        </div>
    );
}
