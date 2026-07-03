import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Keep `next build` output away from the dev server's .next — running a
    // build while dev is up otherwise clobbers dev manifests and the browser
    // reload-loops on stale chunk references.
    distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
    async redirects() {
        // Legacy ff-site URLs: /ff2/<episode> → /archives/ff2/<episode>, /vm → /cyoa
        return [
            ...['ff1', 'ff2', 'ff3', 'ff4'].map((season) => ({
                source: `/${season}/:path*`,
                destination: `/archives/${season}/:path*`,
                permanent: true,
            })),
            {
                source: '/vm/:path*',
                destination: '/cyoa/:path*',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
