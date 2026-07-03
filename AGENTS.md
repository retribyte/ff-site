<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Final Frontier — Web Frontend

Next.js rebuild of the legacy `ff-site` React app. Lore archive + authoring UI for a sci-fi TTRPG universe; consumes the `ff-server` Express/Prisma API.

## Environment
- **Node 22 via nvm required** (system node is 18). Run `nvm use` (there's an `.nvmrc`) before any npm/next command.
- Dev server: `npm run dev` → http://localhost:3001 (ff-server API owns port 3000).
- `NEXT_PUBLIC_API_URL` points at the API (see `.env.example`).

## Workspace
- `ff-site/`, `ff-server/`, `vortox-bot/` are **symlinks to legacy repos** — reference only, gitignored, excluded from tsconfig. Never import from them.
- Requirements live in `ff-server/FF design document.md`. The ff-server Prisma schema is the canonical data model; `src/lib/types.ts` mirrors it.

## Conventions
- **No MUI, no Tailwind, no component frameworks.** Hand-rolled SCSS Modules + design tokens (`src/styles/_tokens.scss`). Art direction: retro sci-fi × indie-web Neocities.
- Theming: `data-theme` attr on `<html>`, persisted in localStorage key `colorMode` (legacy-compatible). All colors via CSS custom properties — never hard-code.
- API calls go through `src/lib/api.ts` (handles the `{status, data|message}` envelope).
- 4-space indent, single quotes (matches legacy codebase style).
