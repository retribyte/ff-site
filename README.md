# Final Frontier: the site

Next.js frontend for the Final Frontier lore archive and campaign reader. It
renders on the server and reads everything from the `ff-server` API (a
separate repo, checked out next to this one).

## Development

Node 22 via nvm (system Node is too old):

```bash
nvm use
npm ci
npm run dev        # http://localhost:3001
```

It expects ff-server's dev server on http://localhost:3000 (see that repo's
README). From the workspace root, `./dev.sh` starts Postgres, both servers and
their logs together. Tests: `npm test` (vitest); `npx tsc --noEmit`; `npx eslint .`.

The episode-import pipeline (Discord export → markdown → API JSON) lives in
`archive-to-markdown/`; see its README.

## Production

The live site is https://vortox.space, on NearlyFreeSpeech.NET (FreeBSD)
behind Cloudflare. The setup is documented in ff-server's
[`docs/deploy-nfsn.md`](../ff-server/docs/deploy-nfsn.md). Deploying an update,
from a clean, committed, pushed checkout (needs the NFSN SSH key,
`~/.ssh/booru` by default, or set `NFSN_KEY`):

```bash
scripts/deploy-nfsn.sh
```

It builds `HEAD` in a temporary worktree (your checkout and a running dev
server are untouched), uploads the result, restarts the `ffsite` daemon and
waits until the site answers.

How the production build differs from dev:

- **Standalone server:** `next.config.ts` sets `output: 'standalone'`, giving
  one `server.js` plus only the dependencies it uses (~21 MB, no native
  modules). Images are served unoptimized: the optimizer needs `sharp`, which
  has no FreeBSD build.
- **One domain for site and API:** the host's proxy sends `/api/` to ff-server
  and everything else here, so this app's own route handlers live under
  **`/site/`** (`/site/auth/*`, `/site/ff/*`), never `/api/`.
- **API address:** server code reads `API_URL` at runtime (loopback to
  ff-server in production); browser code uses `NEXT_PUBLIC_API_URL`, which
  the deploy builds as `/api`. Both default to `http://localhost:3000/api`.
- **`CANONICAL_HOST`** (set in production): `src/proxy.ts` 308s requests that
  arrive by any other name (NFSN's `*.nfshost.com`, `www.`) to it, so
  nothing skips Cloudflare.
