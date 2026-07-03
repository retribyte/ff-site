export default function CyoaLoading() {
    return (
        <main
            style={{
                maxWidth: 'var(--reader-width)',
                margin: '0 auto',
                padding: '4rem 1.25rem',
                textAlign: 'center',
            }}
        >
            <p className='pixel-label'>
                recovering broadcast<span className='blink'>▌</span>
            </p>
        </main>
    );
}
