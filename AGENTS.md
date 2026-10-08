<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Final Frontier — Web Frontend

Next.js rebuild of the legacy `ff-site` React app. Lore archive + authoring UI for a sci-fi TTRPG universe; consumes the `ff-server` Express/Prisma API.

## Environment
- **Node 22 via nvm required** (system node is 18). Run `nvm use` (there's an `.nvmrc`) before any npm/next command.
- Two dev servers: ff-server API on **:3000** (`npm run dev` in `ff-server/`), this app on **:3001** (`npm run dev` here). `NEXT_PUBLIC_API_URL` points at the API (see `.env.example`).
- ff-server's dev script runs `tsx watch` — it auto-restarts on save.
- Production builds use a separate distDir (`.next-build`) so `npm run build` can't corrupt a running dev server.

## Workspace
- `ff-site/` and `vortox-bot/` are **symlinks to legacy repos** — reference only, gitignored, excluded from tsconfig. Never import from any symlink.
- `ff-server/` is also a symlink but is the **live API we actively develop** — it's a separate git repo; commit its changes there (`git -C`), separately from this one.
- Requirements live in `ff-server/FF design document.md` (FR-* / NFR-* ids). The ff-server Prisma schema is the canonical data model; `src/lib/types.ts` mirrors it. Schema changes go through `prisma db push` (no migrations dir).
  - All FR-* requirements are fulfilled. FR-AUTH-4's "display name" was deliberately dropped: usernames are fixed (the archive import maps players by username) and there's no separate display name.
- `archive-to-markdown/` is the episode-import pipeline (Discord export → markdown → API JSON → admin `/import` page). See its README before touching import/conversion.

## Architecture
- **Auth**: the ff-server JWT lives in an httpOnly cookie `ff_token`, set by the `/api/auth/*` route handlers. Server components call `getSessionUser()` / `getToken()` (`src/lib/auth.ts`); client components read `useSession()` and send authenticated API calls through the generic proxy `/api/ff/[...path]`. Browser JS never sees the token.
  - Password changes go through `/api/auth/password` (not the proxy): ff-server revokes every older token and returns a fresh one, which that route swaps into the cookie.
  - `SessionUser.mustChangePassword` (seeded/reset accounts): `PasswordChangeGate` (in the root layout) pins the user to `/account` until they change it; ff-server refuses their writes meanwhile.
  - `/account` edits the user's own profile (bio, wiki username, booru avatar by post ID) and password; `/users/[username]` is the public profile. Link people with `UserLink`.
- **In-universe dates are GUY calendar integers** (equinoxes since the GUY epoch; 1 equinox = exactly 1 Earth day), e.g. `Character.dob`. Use `src/lib/guy-time.ts` — an identical copy lives at `ff-server/src/utils/guy-time.ts`; keep them in sync. Real-world timestamps (messages, playedDate) stay DateTime.
- **Record editing is schema-driven**: field definitions live in `src/lib/editor/schemas.ts` (`EDITOR_SCHEMAS`); `RecordEditor` renders/validates/submits any registered kind. Add fields there, not in per-page forms.
- **Category search** (FR-SR-1) uses the shared `IndexScan` component; season/episode slugs and deep links come from `src/lib/seasons.ts`.
- EMBED message `text` is a JSON string `{title?, description[], footer?}`; the transcript reader regroups consecutive messages by player+character into Discord-style blocks.
- **Story dialogue presentation**: `Story.format` (`SCRIPT` | `PROSE`) switches script-style vs novel-style rendering. A NARRATION `StoryLine` may carry a `segments` JSON annotation (`[{text, characterId?, speaker?, italic?, bold?}]`) — the universal inline-run primitive for embedded dialogue *and* inline italic/bold — with segment texts concatenating verbatim to `text` (server-derived, so they never desync; search/scan stay on `text`). Block section headings use the `HEADING` line type. Import: `[spoken]{Speaker}` dialogue spans, `*italic*`/`**bold**` emphasis, and `## Title` headings in the story markdown; the docx converter maps Heading 1→chapter, Heading 2→heading line in prose.

## Conventions
- **No MUI, no Tailwind, no component frameworks.** Hand-rolled SCSS Modules + design tokens (`src/styles/_tokens.scss`). Art direction: retro sci-fi × indie-web Neocities.
- Theming: `data-theme` attr on `<html>`, persisted in localStorage key `colorMode` (legacy-compatible). All colors via CSS custom properties — never hard-code.
- API calls go through `src/lib/api.ts` (handles the `{status, data|message}` envelope; `apiPaged` for endpoints that return `total/page/limit`).
- 4-space indent, single quotes (matches legacy codebase style).
- API-backed index pages need `export const dynamic = 'force-dynamic'` or they prerender against a dead API at build time.

## Data & testing
- **The DB is disposable dev data, not canonical — the archives are.** Canonical source for transcripts: `archive-to-markdown/md/` hand-edited markdown, imported via `md-to-api.py` (FF2/FF3; FF4 as episodes get edited — `discord-exports/` JSON is FF4's reference/raw material, converted to markdown by `ff4-to-md.py`; unedited FF4 episodes can still import directly via `discord-json-to-api.py`). See `archive-to-markdown/HANDOFF-ff4-editorial.md`. Postgres `episodes`/`messages` rows are just an import target — freely delete-and-reimport an episode to fix drift between the DB and a pipeline change, no need to preserve DB state for its own sake. Still check for real user-authored data first (commentaries, persona/alias assignments) before wiping — `episode.service.ts`'s `deleteEpisode` cascades those away too.
- The local Postgres is seeded with the real archive: seasons FF2 (22 episodes) and Vortox Machina, ~24k messages. **Never re-run `npm run seed` casually — it wipes user-authored content.**
- Dev logins: username = player name, password = `<lowercase>123` (e.g. `Trey` / `trey123`, role ADMIN) — see `ff-server/prisma/seed-legacy.ts`. Seeded accounts must change their password on first login; to skip that in dev, `UPDATE "User" SET "mustChangePassword" = false;`. The Archivist can't log in.
- Verify UI changes end-to-end with headless Playwright driven from the session scratchpad (`npm i playwright` there; chromium is already cached). `.pixel-label` text renders uppercase — compare `innerText` case-insensitively.
