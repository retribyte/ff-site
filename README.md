# Final Frontier — web frontend

The [Final Frontier site](https://vortox.space) frontend: a Next.js rebuild of
the legacy `ff-site` React app. It's a lore archive and authoring UI for a
sci-fi TTRPG universe, and it consumes the `ff-server` Express/Prisma API.

Hand-rolled SCSS Modules + design tokens (no MUI, no Tailwind); retro sci-fi ×
indie-web art direction.

## Getting started

Requires **Node 22** (there's an `.nvmrc` — run `nvm use`).

1. `npm install`
2. Copy `.env.example` to `.env` and point `NEXT_PUBLIC_API_URL` at a running
   `ff-server` (defaults to `http://localhost:3000/api`).
3. Start the API first — see the sibling `ff-server` repo (it runs on `:3000`).
4. Start this app:

   ```bash
   npm run dev
   ```

   It serves on **http://localhost:3001**. Production builds use a separate
   distDir (`.next-build`) so `npm run build` can't corrupt a running dev
   server.

## Scripts

- `npm run dev` — dev server on :3001
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier

## Layout

- `src/app/` — App Router pages + API route handlers (auth, and the generic
  authenticated proxy `/api/ff/[...path]` to ff-server)
- `src/components/`, `src/lib/`, `src/styles/` — components, data/logic
  helpers, and design tokens
- `archive-to-markdown/` — the episode/story import pipeline (Discord export →
  markdown → API JSON → admin `/import` page)

See `CLAUDE.md` for architecture, conventions, and the auth/data model.
