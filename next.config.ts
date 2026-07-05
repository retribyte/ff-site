import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Keep `next build` output away from the dev server's .next — running a
    // build while dev is up otherwise clobbers dev manifests and the browser
    // reload-loops on stale chunk references.
    distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
    async redirects() {
        // Legacy URLs: /ff2/<episode> → /archives/ff2/<episode>; the old
        // /vm and /cyoa routes both land on the chronicle's story page
        // (query strings like ?line=N are preserved automatically).
        return [
            ...['ff1', 'ff2', 'ff3', 'ff4'].map((season) => ({
                source: `/${season}/:path*`,
                destination: `/archives/${season}/:path*`,
                permanent: true,
            })),
            {
                source: '/vm/:path*',
                destination: '/stories/vm/:path*',
                permanent: true,
            },
            {
                source: '/cyoa/:path*',
                destination: '/stories/vm/:path*',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
