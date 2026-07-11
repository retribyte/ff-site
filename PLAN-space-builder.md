# Plan: integrate space-builder (galaxy map + solar-system authoring)

## What space-builder is today

`space-builder/` is a standalone Vite + React 18 SPA (reference-only, gitignored,
nested git repo — like the other legacy dirs, **never import from it**; port code
by rewriting). It has two views:

- **SystemView** — build one solar system: exactly one star (name, radius km,
  temperature K), planets under it (name, radius km, distance AU, composition
  `gas|terrestrial|ice`), moons under planets (name, radius km, distance km,
  composition). A `<canvas>` draws the system edge-on: star color derived from
  temperature, log-scaled orbit rings, labeled planets/moons. Side panels:
  tabbed create forms (star→planet→moon progression), an overview tree for
  selection, an info panel showing *derived* stats (mass, gravity, day/year
  length, habitability score) from `utils/calc.js`.
- **GalaxyView** — place saved systems and **landmarks** (name + description)
  as dots on a static 1000×1000 galaxy image canvas. Placement is currently
  `Math.random()*1000` — there is no click-to-place. Selection happens only via
  the overview list, never by clicking the canvas. **Regions** appear in the UI
  but are unimplemented (`bounds: "This data does not exist yet."`).

Persistence is Firebase: auth via FirebaseUI, and the user's whole galaxy
stored as **one JSON string blob per user** in Realtime Database
(`{systems[], landmarks[], regions[]}`). All object identity is by `name`
(rename/duplicate hazards throughout `utils/factory.js`). Styling is Bootstrap
utility classes + a big hand-rolled stylesheet.

Nothing in `FF design document.md` covers this feature-set — it is net-new
scope beyond the FR-* list.

## Chosen approach

### One shared canonical galaxy, not per-user sandboxes

The legacy app was "every user builds their own galaxy" because it was a
standalone toy. In ff-site everything (characters, species, items, stories) is
a **shared universe with creator attribution**, and the point of integrating
this is mapping *the* Final Frontier galaxy. So: a `Galaxy` table (id + slug +
name + description + map image) seeded with the one FF galaxy, systems and
landmarks belong to a galaxy and carry `creatorId`. Multiple galaxies remain
possible (satellite galaxies, what-if maps) without schema changes.

Permissions match the character convention: any member creates; creator or
admin edits/deletes.

### Normalize into Prisma; one self-referential `CelestialBody` table

Replace the JSON blob with relational rows, numeric ids, and (per the Story
precedent) stable ids so renames never cascade. Instead of separate
Star/Planet/Moon tables, use **one `CelestialBody` table with a `type` enum and
a self-referential `parentId`**:

```prisma
enum CelestialBodyType {
    STAR
    PLANET
    MOON
}

enum BodyComposition {
    TERRESTRIAL
    GAS
    ICE
}

model Galaxy {
    id          Int          @id @unique @default(autoincrement())
    slug        String       @unique          // e.g. "ff"
    name        String       @unique
    description String?
    image       String?                       // background map, e.g. /space/galaxy.png
    systems     StarSystem[]
    landmarks   Landmark[]

    @@map("galaxies")
}

model StarSystem {
    id          Int             @id @unique @default(autoincrement())
    galaxy      Galaxy          @relation(fields: [galaxyId], references: [id])
    galaxyId    Int
    name        String
    description String?
    // Map position normalized to 0..1 of the galaxy map (legacy 0..1000 / 1000)
    xPos        Float?
    yPos        Float?
    creator     User            @relation(fields: [creatorId], references: [id])
    creatorId   Int
    bodies      CelestialBody[]
    wikiArticle String?

    @@unique([galaxyId, name])
    @@map("star_systems")
}

model CelestialBody {
    id           Int               @id @unique @default(autoincrement())
    system       StarSystem        @relation(fields: [systemId], references: [id])
    systemId     Int
    parent       CelestialBody?    @relation("orbit", fields: [parentId], references: [id])
    parentId     Int?              // null = orbits nothing (the star); planet→star, moon→planet
    type         CelestialBodyType
    name         String
    radiusKm     Float
    // Orbital distance from parent: AU for planets, km for moons (unit implied by type), null for stars
    distance     Float?
    composition  BodyComposition?  // planets/moons only
    temperatureK Float?            // stars only (drives rendered color)
    color        String?           // optional render override
    description  String?
    wikiArticle  String?

    @@unique([systemId, name])
    @@map("celestial_bodies")
}

model Landmark {
    id          Int     @id @unique @default(autoincrement())
    galaxy      Galaxy  @relation(fields: [galaxyId], references: [id])
    galaxyId    Int
    name        String
    description String?
    xPos        Float
    yPos        Float
    creator     User    @relation(fields: [creatorId], references: [id])
    creatorId   Int
    wikiArticle String?

    @@unique([galaxyId, name])
    @@map("landmarks")
}
```

Plus back-relations on `User` (`starSystems`, `landmarks`). Schema goes in via
`prisma db push` as usual, and `src/lib/types.ts` mirrors it.

**Why one body table:** one API resource instead of three, one editor surface,
natural recursion for the tree UI (replaces `factory.findObject`), and it
extends to stations/belts/binary stars by adding enum values — the schema
doesn't hard-code "exactly one star, two levels deep"; the *builder UI*
enforces that today.

**Regions are deferred.** They were never implemented in the source app. When
wanted, they're a `Region` table with a polygon-JSON `bounds` column — nothing
in this design blocks that.

### Alternatives considered and rejected

- **Store the galaxy as a JSON blob (port Firebase shape 1:1)** — fastest, but
  breaks every ff-site convention: no creator attribution, no per-record
  permissions, name-keyed identity, no future FK from lore records
  (`Character.homePlanet` → a real planet) — the single best reason to do this
  integration at all.
- **Separate Star/Planet/Moon tables** — three controllers, three editor
  schemas, three slim types; the recursion the UI wants gets harder, and
  binary stars / body types beyond the original three need new tables.
- **Per-user galaxies (legacy behavior)** — wrong fit for a shared lore
  archive; nothing else on the site is per-user sandboxed.

## API (ff-server)

New `space/` module following the existing controller/service pattern
(`galaxy.controller.ts` + `galaxy.service.ts`, registered in `app.ts`), same
`{status, data|message}` envelope, `authenticate` / `isAdmin` middleware:

- `GET /galaxies` · `GET /galaxies/:slug` (systems + landmarks, slim — id,
  name, position, star color inputs) — public read, like stories.
- `POST /galaxies` / `PUT` / `DELETE` — admin (there'll be one row; this is
  mostly for seeding/admin).
- `GET /systems/:id` — full body tree (nested `bodies` with children).
- `POST /galaxies/:slug/systems` — authenticated; creates the system shell.
- `PUT /systems/:id` — creator/admin; metadata + map position (click-to-place
  sends just `{xPos, yPos}`).
- `PUT /systems/:id/bodies` — creator/admin; **transactional whole-tree
  replace** (validates one STAR root, planets parent to it, moons to planets;
  diff-or-replace children in one transaction).
- `DELETE /systems/:id` — creator/admin, cascades bodies.
- `POST /galaxies/:slug/landmarks`, `PUT`/`DELETE /landmarks/:id`.

The whole-tree `PUT` exists because the builder UX is deliberately local-first
(exactly like the legacy app): you assemble star/planets/moons in client state
and hit **Save** once. Per-body CRUD endpoints can be added later if something
needs them; nothing planned does.

Remember: ff-server is a separate repo (`git -C ff-server`), tsx has no watch —
restart after edits.

## Frontend (Next.js)

### Routes

- `/galaxy` — the galaxy map (server component shell + client canvas). Public.
  Navbar gets a `Galaxy` link.
- `/galaxy/systems/[id]` — read-only system page: system diagram canvas,
  overview tree, info panel with derived stats. Public.
- `/galaxy/systems/[id]/edit` — the builder (client component), auth-gated via
  `useSession`; also `/galaxy/systems/new`.
- Index pages that hit the API get `export const dynamic = 'force-dynamic'`.

### Components (`src/components/space/`)

- `GalaxyMap.tsx` — port of `GalaxyCanvas`: draws map image + system/landmark
  dots. Upgrades over legacy: `useRef` instead of `getElementById`,
  devicePixelRatio-aware sizing, **canvas hit-testing for selection**, and
  **click-to-place / drag-to-move** for systems and landmarks (owned/admin
  only) — replacing the random-position hack. Positions are normalized 0..1.
- `SystemDiagram.tsx` — port of `SystemCanvas` (star color from temperature,
  log-scaled orbits, labels). Pull colors from CSS custom properties via
  `getComputedStyle` so both themes work; redraw on `data-theme` change.
- `SystemBuilder.tsx` + create forms — port of `CreatePanel`/`StarCreate`/
  `PlanetCreate`/`MoonCreate`, but with proper controlled inputs (the legacy
  MoonCreate/LandmarkCreate read the DOM directly), contextual creation
  instead of the tab progression (see layout section below), and local tree
  state saved via the whole-tree `PUT`.
- `BodyTree.tsx` (overview/selection tree), `BodyInfoPanel.tsx` (derived
  stats). Landmark create/edit goes through **`RecordEditor`** with a new
  `landmarkSchema` in `EDITOR_SCHEMAS` (it's a flat record — exactly what the
  schema-driven editor is for). System *metadata* (name, description, wiki)
  too; only the body tree needs the custom builder.
- Reuse `DeleteControl` for deletes; reuse `WikiLink`.

### Layout: one rail instead of three overlays

The legacy layout is its weakest part: per view, **three** independently
collapsing panels (Create, Overview, Info) absolutely positioned *over* the
canvas with `translateX` transforms, arrow toggle buttons, floating
Save/Load/New buttons on the edges, and a manual `window.resize` listener that
force-collapses everything below 1260px. Create and Overview share the left
edge, so opening one hides the other; six booleans of collapse state exist
across the two views. The panels themselves are worth keeping — the layout
mechanism isn't.

New structure, per view:

- **CSS Grid, not overlays**: `[rail] [canvas]` — the side panel is a real
  grid column, the canvas takes the remaining track and redraws via a
  `ResizeObserver`. Collapsing the rail collapses the grid column (down to a
  slim icon strip), the canvas widens; nothing is ever covered, no transform
  choreography, no JS resize listeners.
- **One rail, tree as the spine.** Merge Create + Overview + Info into a
  single left rail built around the body tree (system view) or the
  systems/landmarks list (galaxy view):
  - *Selection = detail.* Selecting a node shows its info (derived stats,
    delete, edit) in the same rail beneath the tree — the separate right-hand
    Info panel disappears.
  - *Creation is contextual.* The star→planet→moon tab progression and the
    MoonCreate "To which planet?" dropdown existed only to encode parent
    choice. Instead: `+ add planet` under the star node, `+ add moon` under
    each planet node, expanding an inline create form pre-scoped to that
    parent. The empty state renders the star form directly (what
    `openCreateIfEmpty` was trying to do).
- **Actions in a toolbar, not floating buttons.** Save/Exit (builder) and
  New system / Load (galaxy) move to a slim toolbar above the canvas; Save
  state ("Saved!") renders there too.
- **Mobile/narrow**: the rail becomes a bottom sheet over the canvas — the one
  intentional overlay — switched by a CSS breakpoint, not the resize-listener
  logic.

This drops per-view UI state to a single `railCollapsed` boolean plus the
selected node, and the galaxy and system views become the same shell with a
different tree + canvas plugged in.

### Design direction: the astrogation console

> Interactive mockup of everything in this section (both screens, both
> themes, live crosshair + star-color chip):
> https://claude.ai/code/artifact/efb03af6-e325-4fbc-b77e-cee0e443b855
> Also located at: `space-builder-mockup/`

**No Bootstrap.** SCSS Modules on `_tokens.scss`, inside the existing retro
sci-fi × Neocities identity — this section spends its choices *within* that
system, not on a new one. The framing: this is the site's **astrogation
station**. Lore pages are the archive; this page is an instrument.

**Palette** — new `--space-*` tokens beside the existing ones (dark theme
values; light theme gets muted equivalents):

| token | value | role |
|---|---|---|
| `--space-star` | `#ffcc73` | system markers on the map, star glow core (legacy `#ffcc00` pulled toward the house amber) |
| `--space-landmark` | `#6fb7ff` | landmark markers |
| `--space-orbit` | `rgba(77,77,149,0.45)` | orbit rings, from `--border-loud` |
| `--space-grid` | `rgba(93,75,229,0.10)` | map graticule, from `--accent` |
| `--space-crosshair` | `#f39e3b` | crosshair + live readout = `--accent-2` |

The deliberate move: **amber (`--accent-2`) is the instrument accent** for all
space-page chrome (toolbar readout, selection rings, active telemetry) —
navigation runs on phosphor amber, lore runs on purple. Habitability renders
as a segmented LED meter reusing the theme-stable season colors
(`--ff1` red → `--vm` amber → `--ff3` green) — house colors doing data duty.

**Type** — no new faces; character comes from role discipline: Righteous for
the page `h1` only; **Silkscreen** (`--font-pixel`) for console section
headers (`REGISTRY`, `TELEMETRY`), toolbar labels, and the grid-ref readout;
**Geist Mono** for telemetry figures and all canvas labels (legacy used
Arial — mono labels make the diagrams read as chart annotations, not UI text);
Geist Sans for form fields and help text.

**Signature element — the plotting-chart crosshair.** The galaxy map is a
chart, not a picture: a faint graticule over the map, and on pointer-over,
full-bleed hairline crosshairs that track the cursor with a live coordinate
readout in the toolbar (`x .62 · y .41`, pixel font). Click-to-place stamps
the marker with a two-blink confirm (`steps(1)`, like the house `.blink`).
Placement is this feature's whole job, so the one aesthetic risk goes there.
Everything else stays quiet.

**Console details** (restrained, from existing utilities):

- Rail = `.pixel-panel` treatment; section headers as `.pixel-label` rows
  separated by `star-divider`-style dashed rules.
- Telemetry block = spec-sheet rows: label, dotted leader, mono value with
  unit suffix (`gravity ····· 9.62 m/s²`). Year length shows Earth days *and*
  equinoxes (`412 d · 412 eqx`).
- The temperature input in the star form shows a **live star-color chip**
  (the `starColor()` output) next to the field — the one create-form
  micro-interaction.
- Toolbar = the scan-bar idiom (`IndexScan`/`ScanBar` styling): thick accent
  left border, mono prompt, pixel-label status.

**Motion**: pointer-driven crosshair (no animation per se), the two-blink
placement confirm, `SAVED!` text swap on the save button. Nothing else.
`prefers-reduced-motion` drops the blink (position still updates instantly).

**Accessibility floor**: the tree is the keyboard/screen-reader path to
everything the canvas shows; `xPos`/`yPos` are also plain number fields in the
selected-system detail (keyboard alternative to click-to-place); visible
dashed-accent focus outlines per house style; canvas carries an `aria-label`
summary of what's plotted.

Copy `galaxy_blank.png` into `public/space/` (ours, from the legacy repo).
Empty states keep the `CreateTutorial` welcome-overlay idea, rewritten in the
console voice (plain verbs: "Chart your first system").

### `src/lib/space.ts` (port of `utils/calc.js` — with fixes)

`starColor(temperatureK)` ports as-is (it works). The physics functions are
**wrong in the source** (e.g. `calcMass` computes `size/7926 + 5.97e24` —
an addition, so every body "weighs" one Earth) and get reimplemented honestly:

- mass: Earth mass × (r/r⊕)³ × density factor by composition
- surface gravity: ∝ M/r²
- year length: Kepler, `a^1.5` Earth years — **displayed in equinoxes too**
  (1 eqx = 1 Earth day exactly, so year-in-days *is* the GUY figure — the
  lore tie-in that makes these stats fun here)
- day length: legacy formula is arbitrary; either drop it or keep as flavor
- habitability: keep the spirit (temperature + gravity heuristic), fix the
  units so the score is stable

Keep it UI-only (no server copy needed — nothing persists derived values).

## Phases

1. **Schema + API** — Prisma models, `prisma db push`, `galaxy` module
   (controller/service/openapi), seed the FF galaxy row. Verify with curl.
2. **Frontend read path** — `types.ts` mirrors, `space.ts`, `/galaxy` map page
   and `/galaxy/systems/[id]` page with the two canvases, SCSS, navbar link.
3. **Authoring** — SystemBuilder + whole-tree save, landmark/system-metadata
   editor schemas, click-to-place & drag on the map, deletes, permission
   gating.
4. **Polish + verify** — theme-aware canvas colors, empty-state tutorial
   overlay (port of `CreateTutorial`), mobile bottom-sheet rail, headless
   Playwright end-to-end (create system → place on map → reload → verify).
5. **(Optional) legacy import** — small script or admin import path that takes
   an exported Firebase JSON blob (the `sample.json` shape) and posts it
   through the API, scaling positions /1000. Only worth doing if there's real
   data in Firebase worth keeping.

## Out of scope / future

- **Regions** (never implemented in source) — future `Region` table with
  polygon bounds + canvas draw mode.
- **Lore FKs**: `Character.homePlanet`/`pob` and `Species.placeOfOrigin` are
  free-text today; once planets are rows, these can become optional
  `CelestialBody` references with a text fallback. That's its own migration +
  editor change — separate plan.
- Pan/zoom on the galaxy map (legacy `ScaleSlider` was half-wired); nice-to-
  have once the map has enough content to need it.