// The site's version, derived from git tags (see docs/versioning.md).
// MIRRORED in ff-server/src/utils/version.ts: keep parseDescribe identical.
//
// A release is a tag vMAJOR.MINOR.PATCH. Every commit after the nearest tag adds
// one to the patch, so `git describe` output like v1.1.0-14-g3fa9c2e reads 1.1.14.
// next.config.ts computes it at build time and inlines it as NEXT_PUBLIC_APP_VERSION.

export interface VersionInfo {
    version: string;
    commit: string;
}

/** `git describe --tags --long --dirty --match 'v[0-9]*'` output -> version, or null. */
export function parseDescribe(describe: string): VersionInfo | null {
    const m = /^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)(-dirty)?$/.exec(describe.trim());
    if (!m) return null;
    const [, major, minor, patch, ahead, commit, dirty] = m;
    return {
        version: `${major}.${minor}.${Number(patch) + Number(ahead)}${dirty ? '-dirty' : ''}`,
        commit,
    };
}
