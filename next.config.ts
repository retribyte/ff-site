import { execFileSync } from 'node:child_process';
import type { NextConfig } from 'next';
import { parseDescribe } from './src/lib/version';

// The site's version for the footer, from git tags (docs/versioning.md). Falls
// back to "unknown" when there's no git or no tags (a shallow clone).
function gitVersion() {
    try {
        const describe = execFileSync('git', ['describe', '--tags', '--long', '--dirty', '--match', 'v[0-9]*'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return parseDescribe(describe);
    } catch {
        return null;
    }
}
const appVersion = gitVersion() ?? { version: 'unknown', commit: 'unknown' };

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: appVersion.version,
        NEXT_PUBLIC_APP_COMMIT: appVersion.commit,
    },
    // Keep `next build` output away from the dev server's .next — running a
    // build while dev is up otherwise clobbers dev manifests and the browser
    // reload-loops on stale chunk references.
    distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
    // A self-contained server.js + only the dependencies it needs, for the
    // NFSN daemon (ff-site/scripts/deploy-nfsn.sh)
    output: 'standalone',
    // There are lockfiles above this repo (the workspace), which Next would
    // otherwise take as the root and nest the standalone output under
    outputFileTracingRoot: process.cwd(),
    // Serve images as-is: the optimizer needs sharp, a native module with no
    // FreeBSD build (production is NFSN), and resizing would cost CPU there.
    images: { unoptimized: true },
    // ...so leave sharp's Linux binaries out of the standalone bundle
    outputFileTracingExcludes: { '*': ['node_modules/sharp/**', 'node_modules/@img/**'] },
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
