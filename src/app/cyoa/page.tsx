import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Vortox Machina',
};

export default function CyoaPage() {
    return (
        <main style={{ maxWidth: 'var(--reader-width)', margin: '0 auto', padding: '3rem 1.25rem' }}>
            <h1>Vortox Machina</h1>
            <p className='pixel-label'>under construction — CYOA reader coming soon</p>
        </main>
    );
}
