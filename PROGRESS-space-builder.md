# Space Builder — Implementation Progress

> Tracks the work described in `PLAN-space-builder.md` (design mockup:
> `space-builder-mockup/space-console.html`, artifact link in the plan).
> Check tasks off as they land. Phases are ordered; modules within a phase
> can interleave where dependencies allow.

**Status: in progress — Phases 1, 2, 2.5, and 3 (3.1+3.2+3.3) done (implemented + verified, uncommitted — pending PM review/commit). Phase 4 (polish) next.**

## IMPORTANT NOTE FOR NEXT FABLE ADVISOR
Hello, this is a message from the user that invoked you.
I have a new requirement for the layout of the `/galaxy` page.
I dislike that the entire space builder application is contained inside a small window.
The space builder should fill the entire screen. It should BE `<main>`, not live inside of it.
`--content-width` can be ignored. This page isn't content like a text transcript. It's an application.
The `<header>` can be completely removed. It takes up valuable screen real estate.
I know this might change some of your layout decisions.
You are free to add new items to the progress list, even a new phase if you need to.
The aforementioned requirements must be fulfilled before you begin Phase 3.

> **PM note 2026-07-11:** acknowledged — captured as **Phase 2.5** below.
> User clarified: the site Navbar **stays**; it's the page-level `<header>`
> (the big "Galaxy" `<h1>` + stats) that goes. The console becomes a
> full-bleed `<main>` filling the viewport below the navbar; `--content-width`
> does not apply on `/galaxy` routes.

## Standing constraints (apply to every phase)

- `nvm use` before any npm/next command (system node is 18, need 22).
- ff-server is a **separate git repo** — commit its changes with `git -C ff-server`,
  never in this repo. Its dev script has **no file watching**: restart after edits.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next.js code (this Next has breaking changes vs. training data).
- Never import from `space-builder/` (or any symlinked legacy dir) — port by rewriting.
- No Bootstrap/MUI/Tailwind. SCSS Modules + `_tokens.scss` custom properties only;
  4-space indent, single quotes.
- API-backed index pages need `export const dynamic = 'force-dynamic'`.

---

## Phase 1 — Schema + API (ff-server repo) — DONE 2026-07-11 (uncommitted)

### 1.1 Prisma schema
- [x] Add `CelestialBodyType` (STAR/PLANET/MOON) and `BodyComposition`
      (TERRESTRIAL/GAS/ICE) enums
- [x] Add `Galaxy` model (slug, name, description, image)
- [x] Add `StarSystem` model (galaxyId, name, description, xPos/yPos 0..1,
      creatorId, wikiArticle, `@@unique([galaxyId, name])`)
- [x] Add `CelestialBody` model (systemId, self-ref `parentId` "orbit" relation,
      type, radiusKm, distance, composition, temperatureK, color, description,
      wikiArticle, `@@unique([systemId, name])`) — plus a
      `children CelestialBody[] @relation("orbit")` back-relation the plan's
      snippet omitted (Prisma self-relations need both sides)
- [x] Add `Landmark` model (galaxyId, name, description, xPos/yPos, creatorId,
      wikiArticle, `@@unique([galaxyId, name])`)
- [x] Add `User` back-relations: `starSystems`, `landmarks`
- [x] `prisma db push` (no migrations dir) + regenerate client
- [x] Seed the one FF galaxy row (slug `ff`, image `/space/galaxy.png`) —
      `prisma/seed-galaxy.ts` + `npm run seed:galaxy`, idempotent upsert

### 1.2 `space/` module (galaxy.controller.ts + galaxy.service.ts)
- [x] `GET /galaxies` — public list
- [x] `GET /galaxies/:slug` — public; slim systems + landmarks (id, name,
      position, star color inputs, creatorId)
- [x] `POST /galaxies` / `PUT /galaxies/:slug` / `DELETE /galaxies/:slug` — admin
- [x] `GET /systems/:id` — public; full nested body tree + creator {id, username}
- [x] `POST /galaxies/:slug/systems` — authenticated; sets `creatorId: req.user.id`
- [x] `PUT /systems/:id` — creator/admin; metadata + `{xPos, yPos}` partial update
- [x] `PUT /systems/:id/bodies` — creator/admin; **transactional whole-tree
      replace**, validation before write (delete-and-recreate in one
      transaction; body ids not stable, system id is the handle)
- [x] `DELETE /systems/:id` — creator/admin; cascades bodies
- [x] `POST /galaxies/:slug/landmarks` — authenticated
- [x] `PUT /landmarks/:id` / `DELETE /landmarks/:id` — creator/admin
- [x] Creator-or-admin gating follows the character.controller pattern;
      `description` fields run through `sanitizeText()` (character precedent)
- [x] Register routes in `app.ts`; add paths to `openapi.ts` (Space tag)

**Whole-tree PUT payload (frontend builds against this):**
`{star: {name, radiusKm, temperatureK, color?, description?, wikiArticle?,
planets: [{name, radiusKm, distance /*AU*/, composition, color?, description?,
wikiArticle?, moons: [{name, radiusKm, distance /*km*/, composition, ...}]}]}}`
— `star` is a single object. GET returns the inverse:
`{...system, creator: {id, username}, bodies: [{..., children: [...]}]}`.

### 1.3 Verify (curl against :3000)
- [x] Public reads work logged-out; galaxy slim payload shape is right
- [x] Create system as `Trey`, whole-tree PUT round-trips (star + 2 planets + moon)
- [x] Validation rejects: zero stars, two stars, moons on star, duplicate
      names, negative radius — tree untouched after rejected PUTs
- [x] Non-creator non-admin (`Bill`) gets 403 on PUT/DELETE; admin succeeds
- [x] DELETE system cascades bodies (0 orphan rows); landmark CRUD round-trips
- [x] `tsc --noEmit` clean; test records cleaned up (DB: 1 galaxy row only)
- [x] Commit in ff-server repo — `8fc786f` on its `space-builder` branch.
      **Policy from here on: commit at the end of each completed phase**
      (ff-site-new and ff-server separately)

---

## Phase 2 — Frontend read path

### 2.1 Libraries — DONE 2026-07-11
- [x] Mirror new models/enums in `src/lib/types.ts`
- [x] `src/lib/space.ts`:
  - [x] `starColor(temperatureK)` — ported as-is
  - [x] mass: M⊕ × (r/r⊕)³ × composition density factor
        (densities: TERRESTRIAL 5514, GAS 1326, ICE 1850 kg/m³)
  - [x] surface gravity ∝ M/r²
  - [x] year length: Kepler `a^1.5` → `{days, equinoxes}`
  - [x] day length: **dropped** (legacy formula arbitrary; not in mockup telemetry)
  - [x] habitability: equilibrium-temp + gravity heuristic, 0–100
        (Earth 97, Jupiter 0, Luna 26, 0.1 AU hostile 0)
  - [x] `formatMass` / `formatGravity` helpers (mass shows one decimal,
        e.g. `6.0×10²⁴ kg` — bump to two if telemetry wants it)
- [x] Spot-check numbers against Earth/Jupiter/Luna for sanity
      (Luna g=2.68 not 1.62 — expected: fixed-density buckets, g ∝ r; fine)

### 2.2 Tokens + assets — DONE 2026-07-11
- [x] `--space-*` tokens in `_tokens.scss`: dark block carries all four;
      light block overrides only orbit/grid (marker colors theme-stable)
- [x] `galaxy_blank.png` → `public/space/galaxy.png`

### 2.3 `/galaxy` — the map page — DONE 2026-07-11
- [x] Route: server shell (`page.tsx`, force-dynamic) + client `GalaxyConsole`
- [x] `GalaxyMap.tsx`: map image + graticule + markers, DPR-aware,
      ResizeObserver, 0..1 positions, mono labels, canvas hit-testing
      (selection syncs canvas ↔ rail both ways)
- [x] Crosshair + live grid-ref in toolbar (callback-prop pattern — React
      Compiler eslint forbids child-mutated refs; zero re-renders confirmed)
- [x] Rail via shared `ConsoleShell` (`[rail][viewport]` grid, railCollapsed)
- [x] Toolbar: scan-bar idiom (`Toolbar.tsx`, actions-prop extension point)
- [x] Shared `space.module.scss` (toolbar/rail/tree/telemetry/meter/
      viewport/crosshair)
- [x] Navbar `Galaxy` link
- [x] Canvas `aria-label`; unplaced systems listed but not plotted

### 2.4 `/galaxy/systems/[id]` — read-only system page — DONE 2026-07-11
- [x] Route + fetch, `notFound()` on missing id
- [x] `SystemDiagram.tsx`: legacy geometry port, dashed `--space-orbit` rings,
      mono labels + pixel star label, getComputedStyle colors, redraw via
      existing `useTheme()` hook + ResizeObserver; also canvas click-to-select
      (bonus, read-only). Moons get composition colors (legacy flat grey
      dropped — deliberate). Selection ring 2px+glow (1px dashed illegible
      on nebula ground — deliberate)
- [x] `BodyTree.tsx`: recursive, keyboard-navigable, type dots
- [x] `BodyInfoPanel.tsx`: spec-sheet rows, `838 d · 838 eqx`, LED meter
- [x] `WikiLink` where set; creator attribution ("charted by Trey")
- [x] Playwright-verified both themes (screenshots reviewed vs mockup);
      tsc + eslint clean. Demo data left in DB: system Herakl (id 3,
      star/Cinder/Ash/Vell), landmark Cassin Deep (id 3)

---

## Phase 2.5 — Full-screen console layout (user requirement; blocks Phase 3)

- [x] `/galaxy`: drop the page `<header>` (h1 + stats); `<main>` becomes the
      console itself — full-bleed width (no `--content-width`), filling the
      viewport height below the navbar (no page scroll; the canvas viewport
      absorbs the space, rail scrolls internally if needed)
- [x] Move the "N systems · M landmarks charted" stat line into the console
      toolbar (pixel-label status idiom) so the info isn't lost
- [x] `/galaxy/systems/[id]`: same treatment — header gone, system name lives
      in the toolbar crumb (already does), full-viewport console
- [x] `SignalLost` fallback on both pages still renders acceptably in the
      full-bleed main
- [x] Canvas redraw handles the larger viewport (ResizeObserver already in
      place — verify, don't assume)
- [x] Playwright both pages × both themes: no vertical page scrollbar,
      console fills window, toolbar stats present; tsc + eslint clean
- [x] Commit (ff-site-new only; no server changes) — `66d47dc`

---

## Phase 3 — Authoring

### 3.1 Editor schemas (flat records → RecordEditor) — DONE 2026-07-11
- [x] `landmarkSchema` in `EDITOR_SCHEMAS` (name, description, xPos, yPos,
      wikiArticle) + create/edit routes (`/galaxy/landmarks/new`,
      `/galaxy/landmarks/[id]/edit`)
- [x] `starSystemSchema` for system **metadata** (name, description,
      wikiArticle) — body tree stays in the builder. Routes:
      `/galaxy/systems/new` (create) + `/galaxy/systems/[id]/meta` (edit)
- [x] RecordEditor didn't support the nested create path — added a generic
      `createPath?`/`afterCreatePath?`/`loadRecord?` override triple to
      `EntitySchema` (not a "galaxy" special-case in editor core)

### 3.2 SystemBuilder (`/galaxy/systems/[id]/edit`, `/galaxy/systems/new`) — DONE 2026-07-11
- [x] Client route, gated server-side (mirrors EditorPage's precedent, not
      `useSession` — see route file for why) — any member can create,
      creator/admin can edit
- [x] Local tree state (negative-int temp keys, no name-keyed identity);
      live `SystemDiagram` preview
- [x] Contextual creation: empty state renders the star form; `+ planet`
      under the star, `+ moon` under each planet — inline form pre-scoped to
      parent, controlled inputs throughout
- [x] Star form temperature field shows the **live star-color chip**
- [x] Edit + delete of bodies in the rail detail section (delete confirm
      copy calls out that a planet's moons go with it)
- [x] Save via whole-tree `PUT /systems/:id/bodies` through `/api/ff` proxy;
      `SAVED!` text swap; unsaved-changes indicator (`· UNSAVED`) in the
      toolbar crumb; Exit action
- [x] Toolbar actions (Save / Exit), not floating buttons; added `.btnQuiet`
- [x] Playwright-verified end-to-end as Trey (create → builder → star + 2
      planets + moon → save → reload persists → edit → save → read page
      matches → delete a planet-with-moon → save → verified); permission
      checks (logged-out, Bill) confirmed denied both server-side and via
      the read page's conditional Edit link; both themes screenshotted;
      tsc + eslint clean; test records deleted via API

### 3.3 Map authoring (GalaxyMap upgrades) — DONE 2026-07-11
- [x] Click-to-place for the selected owned/admin system or landmark —
      stamps with the two-blink confirm (`steps(1)`), sends `{xPos, yPos}`
- [x] Drag-to-move existing owned/admin markers
- [x] xPos/yPos plain number fields in the rail detail (keyboard path)
- [x] `New system` / landmark-create entry points from the map toolbar/rail
- [x] Permission gating: placement/drag/delete only for creator or admin;
      read-only pointer behavior otherwise
- [x] `DeleteControl` wired for systems + landmarks

---

## Phase 4 — Polish + verify

- [ ] Empty-state tutorial overlay (port of `CreateTutorial`, console voice:
      "Chart your first system")
- [ ] Mobile/narrow: rail becomes a bottom sheet via CSS breakpoint
- [ ] `prefers-reduced-motion` drops the placement blink
- [ ] Focus outlines (dashed accent) on tree/toolbar/forms; a11y pass on
      both pages (tree = keyboard path to everything the canvas shows)
- [ ] Theme sweep: both themes on both pages, canvas colors from CSS props
- [ ] Headless Playwright end-to-end from the scratchpad: log in → new system
      (star/planet/moon) → save → place on map → reload → verify positions +
      diagram (`.pixel-label` compares case-insensitively)
- [ ] `npm run build` clean (separate `.next-build` distDir)
- [ ] Update ff-server `FF design document.md` if new FR ids are wanted (net-new scope)

---

## Phase 5 — (Optional) legacy Firebase import

- [ ] Only if real data exists in Firebase worth keeping
- [ ] Script/admin path: exported JSON blob (`sample.json` shape) → API posts,
      positions scaled /1000, names de-duplicated

---

## Analysis notes (from the pre-implementation read-through)

- **Confirmed the plan's claims against source**: `calc.js` mass/gravity really
  are broken (`size/7926 + 5.97e24` — addition), `possLife` has unit chaos and
  two half-finished variants (`possLife`, `possLife2`); only `starColor()` is
  sound. GalaxyCanvas has no hit-testing and a stray `window.innerHeight`
  yOffset bug; positions are raw 0..1000 canvas pixels.
- **Legacy moon `distance` (km) is collected but never used in rendering** —
  SystemCanvas spaces moons by fixed 10px increments. Keep collecting it
  (schema has it); decide in 2.4 whether the diagram uses it for ordering only.
- **Mockup's orrery is SVG, plan says canvas** — mockup SVG was illustrative;
  implement as canvas per plan (hit-testing + parity with GalaxyMap approach).
- `--accent-2: #f39e3b` already exists in `_tokens.scss`; the mockup's
  `--amber` was a stand-in for it. Only the four `--space-*` tokens are new.
- Creator/admin gating precedent: `character.controller.ts` (fetch →
  `creatorId !== req.user.id && role !== ADMIN` → 403).
- `RecordEditor` field kinds already cover everything landmark/system metadata
  need (`text`, `textarea`, `number`); no editor-core changes expected.
- Whole-tree PUT transaction precedent: story service does multi-row writes;
  mirror its transaction style.
- Assets: `galaxy_blank.png` lives at
  `space-builder/src/assets/images/galaxy_blank.png` (ours, safe to copy).
- Phase-5 sample shape: `space-builder/src/assets/sample.json`.

## Worklog

| date | phase | notes |
|---|---|---|
| 2026-07-11 | — | Analysis pass; progress file created. No code yet. |
| 2026-07-11 | 2.1+2.2 | Frontend libs done (agent): types.ts mirrors, space.ts (physics verified: Earth 5.97e24 kg / 9.82 m/s² / 365 d / habit. 97), tokens, map asset. tsc clean in src/ (73 pre-existing errors in unexcluded legacy `ff-site-old/` — not ours). Phase 1 agent still running. |
| 2026-07-11 | — | All symlinks added to tsconfig excludes (user request); tsc fully clean. |
| 2026-07-11 | 1 | ff-server done (agent): schema pushed, galaxy seeded, space module + openapi, full curl matrix green (validation, 403s, cascade, sanitize). Uncommitted by instruction. Dev server left running on :3000. `npm run docs` (redocly) breakage pre-exists on base branch. |
| 2026-07-11 | 1 | Committed in ff-server: `8fc786f` (branch `space-builder`). Per-phase commit policy adopted. |
| 2026-07-11 | 2 | Read path done (agent): ConsoleShell/Toolbar/GalaxyMap/GalaxyConsole/SystemDiagram/BodyTree/BodyInfoPanel + both pages + navbar link. Playwright green both themes, screenshots PM-reviewed vs mockup. Committed `e8c84d9` (+ tsconfig fix `7635f87`) on ff-site-new `space-builder` branch (both repos now on same-named feature branches). Phase 3 extension points: Toolbar `actions` prop, ConsoleShell `rail` slot, read-only coord spans to swap, `.btnQuiet` to add. |
| 2026-07-11 | 2.5 | Full-screen console (agent, user requirement): page headers dropped, `console-main` mixin (`100vh - --navbar-height`, flex chain to grid row), stats → toolbar, mobile row `minmax(0,1fr)`. Playwright: both pages × themes × 2 sizes, DPR-2, rail internal scroll, SignalLost, no page scroll. PM-reviewed diff + screenshot. Committed `66d47dc`. Phase 3 unblocked; split as A=3.1+3.2 (schemas+builder) then B=3.3 (map authoring). |
| 2026-07-11 | 3.1+3.2 | Schemas + builder (agent): `landmarkSchema`/`starSystemSchema` with generic `createPath`/`afterCreatePath`/`loadRecord` editor hooks (landmarks have no GET-by-id — loaded via galaxy payload); routes `/galaxy/landmarks/{new,[id]/edit}`, `/galaxy/systems/{new,[id]/meta,[id]/edit}`. Builder: local tree (negative temp keys), contextual `+ planet`/`+ moon` inline forms, live diagram + star-color chip, whole-tree PUT, SAVED!/unsaved crumb, server-side gating (avoids useSession first-paint flash). E2E verified incl. permissions (Bill 403/redirect); DB restored to Herakl+Cassin Deep. PM-reviewed. Committed `d12e80c`. |
| 2026-07-11 | 3.1+3.2 | Editor schemas + SystemBuilder done (agent). Pre-flight curl check found `GET /landmarks/:id` doesn't exist (only `POST .../landmarks`, `PUT/DELETE /landmarks/:id` — landmarks only ever come back nested in `GET /galaxies/:slug`); handled with a generic `EntitySchema.loadRecord?` override (landmarkSchema fetches `/galaxies/ff` and finds by id) rather than touching ff-server. Also added `createPath?`/`afterCreatePath?` to `EntitySchema` for the nested-create-vs-flat-basePath mismatch. Routes: `/galaxy/landmarks/new`+`/[id]/edit`, `/galaxy/systems/new` (metadata create → redirects to builder) + `/galaxy/systems/[id]/meta` (metadata edit), `/galaxy/systems/[id]/edit` (builder, new components `SystemBuilder`/`BuilderBodyTree`/`BodyForm`/`builderTree.ts`). Builder auth is gated server-side in the route's `page.tsx` (mirrors EditorPage's precedent) rather than client `useSession`, to avoid `useSession().loading`'s race flashing unauthorized content; added a small "Edit system" entry point on the read-only `SystemConsole` (creator/admin only, via `useSession`) since nothing else in 3.1/3.2 gave the builder a discoverable entry point (map "New system" buttons stay 3.3's job). Local tree uses negative-int temp keys (real ids are always positive) so the read-only `SystemDiagram`/`BodyInfoPanel` components could be reused unchanged. Playwright end-to-end as Trey (create → builder → star+2 planets+moon → save → reload persists → edit body → save → read page matches → delete planet-with-moon, confirmed via independent fresh load, not just same-session DOM check → save); permission checks (logged-out redirects to /login, Bill redirected off the edit route + API 403, both denied the read-page Edit link); landmark create → edit → verified via direct API read; both themes screenshotted at 1440×900. tsc + eslint clean repo-wide. Test records (systems 4/5, landmark 4) deleted via API; DB back to Herakl (3) + Cassin Deep (3). Uncommitted by instruction. |
| 2026-07-11 | 3.3 | Map authoring done (agent). `GalaxyMap` becomes a pure interaction surface (reports pointer gestures via `onSelect`/`onPlace`/`onCoordsChange` callbacks; never persists), `GalaxyConsole` owns `systems`/`landmarks` as local optimistic state (resynced from the server `galaxy` prop via a render-time adjustment, not an effect — see below) plus the PUT/DELETE calls and revert-on-failure. Interaction design: **armed** is a single piece of state — auto-set the moment an *unplaced* editable system is selected (nothing to accidentally move yet), otherwise toggled explicitly via a rail "Move"/"Cancel move" button; while armed, every click on the map (regardless of what's under the cursor) places the armed marker there, so drag-start is suppressed entirely while armed (resolves the "armed for A, pointerdown lands on B" ambiguity flagged in review). **Drag-to-move**: pointerdown hit-tests an editable *placed* marker, a 5px movement threshold distinguishes click-to-select from drag (live drag position kept in a ref + manual `draw()` call, same zero-re-render trick as the crosshair — never touches React state per pixel), pointerup fires the same `onPlace(sel, coords)` callback drag or click alike. **Two-blink confirm**: a short-lived DOM overlay (not a canvas draw) positioned at the marker's new coordinates, `steps(1)` animation at the same 1.1s-per-cycle cadence as the house `.blink` but bounded to 2 iterations via `animation-iteration-count`; `prefers-reduced-motion` drops it via media query, with a `setTimeout` belt-and-suspenders cleanup since a dropped animation never fires `animationend`. **Keyboard path**: plain 0..1/step-0.01 number inputs + Apply button in the rail, resynced from the live position via the same render-time-adjustment pattern (not effects). **Entry points**: NEW SYSTEM/NEW LANDMARK landed in the *toolbar* (not rail) — matches the Save/Exit precedent from `SystemBuilder`'s toolbar and keeps the rail focused on selection detail; gated on `user != null` (any member can create, not just creator/admin). Selected-system rail detail gets VIEW (always, for editable) + EDIT → the builder route (`/galaxy/systems/[id]/edit`, matching `SystemConsole`'s existing "Edit system" link) + `DeleteControl`; landmark gets EDIT → `/galaxy/landmarks/[id]/edit` + `DeleteControl`. **Landmark xPos/yPos friction**: the schema requires both on create, which fights a genuine place-on-map flow (there's nothing to place until the record exists) — added a generic `default?: string` to `FieldDef`/`recordToValues` (applied only in create mode, never overrides an edit-mode null) and set landmark xPos/yPos to default `'0.5'`; landmarks now create at map-center and get dragged into place afterward. Flagging for the PM: this is a real asymmetry vs. systems (which are *genuinely* unplaced, no default needed) — the center-default is a reasonable smoothing but is itself a product call. **React-Compiler eslint note**: an initial draft used `useEffect` to resync local state from props/selection, which the project's `react-hooks/set-state-in-effect` and `react-hooks/refs` rules rejected (calling `setState` synchronously in an effect body, and a false-positive on refs triggered by wrapping rail JSX in per-render IIFEs); rewrote all three as the React-documented "adjust state during render" pattern (compare current vs. a `prev*` state slot, call `setState` inline, guarded so it only fires on an actual change) and flattened the IIFEs into plain precomputed consts — both `tsc --noEmit` and `eslint` are clean with zero disables needed for this file. Verification: full Playwright matrix from the scratchpad — Trey creates landmark (confirms 0.5/0.5 default) + system (confirms unplaced/auto-armed) → click-places the system → drags it elsewhere → plain click (no movement) confirmed as select-only (position provably unchanged) → coord-field Apply → same drag+coords check on the landmark → deletes both via `DeleteControl`; Bill's drag attempts on Trey's Herakl/Cassin Deep verified numerically inert (position unchanged) with Move/coord-fields/Delete absent from the rail, then Bill creates+moves+deletes his own landmark; logged-out verified read-only (no entry-point buttons, drag attempt inert, no Move/Delete in detail). All assertions read back through the API independently, not same-session DOM state. Screenshots: both themes at 1440×900 (rail detail + Move/View/Edit/Delete visible), 1024×768 toolbar with both entry-point buttons + stats + grid-ref (no overflow, confirmed via `scrollWidth` check), and the armed-state banner. DB restored to Herakl (3) + Cassin Deep (3) only. Uncommitted by instruction. |
