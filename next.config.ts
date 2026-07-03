import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
