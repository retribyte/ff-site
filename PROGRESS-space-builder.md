# Space Builder — Implementation Progress

> Tracks the work described in `PLAN-space-builder.md` (design mockup:
> `space-builder-mockup/space-console.html`, artifact link in the plan).
> Check tasks off as they land. Phases are ordered; modules within a phase
> can interleave where dependencies allow.

**Status: in progress — Phase 1 (ff-server API) and Phase 2.1/2.2 (frontend libs) running in parallel via Sonnet 5 agents.**

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

## Phase 3 — Authoring

### 3.1 Editor schemas (flat records → RecordEditor)
- [ ] `landmarkSchema` in `EDITOR_SCHEMAS` (name, description, xPos, yPos,
      wikiArticle) + create/edit routes
- [ ] `starSystemSchema` for system **metadata** (name, description,
      wikiArticle) — body tree stays in the builder
- [ ] Confirm RecordEditor handles the nested create path
      (`POST /galaxies/:slug/systems`) or add basePath override

### 3.2 SystemBuilder (`/galaxy/systems/[id]/edit`, `/galaxy/systems/new`)
- [ ] Client route, auth-gated via `useSession` (creator/admin for edit)
- [ ] Local tree state (ids or temp keys, no name-keyed identity);
      live `SystemDiagram` preview
- [ ] Contextual creation: empty state renders the star form; `+ planet`
      under the star, `+ moon` under each planet — inline form pre-scoped to
      parent, controlled inputs throughout
- [ ] Star form temperature field shows the **live star-color chip**
- [ ] Edit + delete of bodies in the rail detail section
- [ ] Save via whole-tree `PUT /systems/:id/bodies` through `/api/ff` proxy;
      `SAVED!` text swap; unsaved-changes indicator in the toolbar crumb;
      Exit action
- [ ] Toolbar actions (Save / Exit), not floating buttons

### 3.3 Map authoring (GalaxyMap upgrades)
- [ ] Click-to-place for the selected owned/admin system or landmark —
      stamps with the two-blink confirm (`steps(1)`), sends `{xPos, yPos}`
- [ ] Drag-to-move existing owned/admin markers
- [ ] xPos/yPos plain number fields in the rail detail (keyboard path)
- [ ] `New system` / landmark-create entry points from the map toolbar/rail
- [ ] Permission gating: placement/drag/delete only for creator or admin;
      read-only pointer behavior otherwise
- [ ] `DeleteControl` wired for systems + landmarks

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
