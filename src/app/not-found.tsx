export default function NotFound() {
    return (
        
        <div
            className='pixel-panel'
            style={{ maxWidth: '28rem', margin: '4rem auto', padding: '1.5rem', textAlign: 'center' }}
        >
            <p className='pixel-label' style={{ color: 'var(--accent-2)' }}>
                ⚠ 404 not found ⚠
            </p>
            <h2>Page Not Found</h2>
            <p style={{ color: 'var(--text-muted)' }}>
                What are you looking for? This page doesn&apos;t exist.
            </p>
            <img src='https://booru.vortox.space/_images/9ba1671830f52c3fc1d7bd204e90740e' alt="Emmett looking uncomfortable"></img>
            <p className='pixel-label'>error code: VCOMM-404</p>
        </div>
    );
}