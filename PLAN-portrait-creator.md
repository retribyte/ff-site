# Portrait creator plan

Replaces the "open Starbound, cheat in clothes, screenshot, erase the background" routine with
a character creator inside ff-site. Branch `portrait-creator`. Decisions are Trey's, 2026-11-12.

## Decided

- **Output:** the full-body portrait and the 14x14 head. The 14x14 crop is a modal that can be
  opened at any time, with an eraser for stray pixels. It is built last.
- **Who:** every member. A portrait need not belong to a character (GMs make NPCs). The 14x14
  can be applied to a character straight from the creator.
- **Assets:** an extractor builds a sprite bundle; it runs on any machine with Starbound and
  picks up new races by re-running. Compositing happens in the browser.
- **Races:** every species on disk, NPC-only ones included. Shown as Final Frontier name,
  one-word descriptor, then the mod's name where it differs; grouped by animal, insect,
  humanlike, halfling (part-human, as opposed to fully anthropomorphic animals), fantasy,
  mechanical. Duplicates and unwanted species are `hidden` in the race table.
- **Curation:** `src/data/portrait/curation.json` lists mods left out altogether (read by the
  extractor), clothing that is hidden (invisible items, by name pattern and id list), mods
  whose clothing only their own species may wear (Playable Alpaca), and single-pixel sprite
  repairs. The site applies all but the first when it loads a bundle (`curation.ts`).
- **Mod conflicts:** every mod's sprites are kept. A resolver shows the versions; a species can
  be offered as one race or several (vanilla Novakid and Cuter "Blazekid").
- **Wardrobe:** everything on disk, grouped by mod of origin.
- **Colours:** the species' and items' own colour options, plus free edits through a palette
  editor (body has its palette, each clothing item its own).
- **Poses:** yes. Back items: yes, low priority. Randomise: yes.
- **Race table:** tables in ff-server (since step 2 below). `src/data/portrait/races.json` and
  `curation.json` are what those tables were first filled from; the site does not read them.

## How it works

```
Starbound paks + mods ──extract.py──> one folder per mod (mod.json, items.json, sprites.pack)
                                              │   in a directory ff-server reads; members only
        folders present and switched on ──merge.ts──> species, clothing, where each sprite is
                                              │
settings tables in ff-server (names, hidden) ─┤
                                              ▼
            recipe ──humanoid.ts──> layers ──compose.ts──> 43x43 RGBA
```

- **A mod is a folder.** It holds only what that mod's own files contribute; the site merges
  the folders that are present in the game's load order. Deleting a folder removes the mod
  (checked: deleting Cuter's folder gives exactly the bundle of an extraction without Cuter).
- **Sprites are fetched as byte ranges** of each mod's pack; ranges close together share a
  request (`pack.ts`). The same click-through went from 420 requests to 123, and page load
  from 140 to 25. One request per mod per screenful is the floor while each mod is its own file.
- `scripts/portrait-extract/` (Python, stdlib): see its README.
- `src/lib/portrait/`: the engine, no DOM.
  - `directives.ts`: Starbound colour directives (replace, hueshift, saturation, brightness,
    multiply, setcolor: all that the installed species and items use).
  - `humanoid.ts`: recipe to layers. Port of `createHumanoid` (which option colours which part)
    and `renderPortrait` (layer order, pose frames and offsets, helmet masks).
  - `compose.ts`: layers to pixels; picks each sprite's mod given the recipe's `exclude`.
  - `png.ts`: own PNG reader, because a canvas alters exact colours and colour swaps need them.
  - `merge.ts` (mod folders to one view), `pack.ts` (byte ranges), `curation.ts`, `races.ts`,
    `browserBundle.ts`.
- `src/components/portrait/`, `src/app/portraits/`: the page.
- A **recipe** (`Recipe` in `types.ts`) is everything needed to redraw a portrait: species,
  which mods' sprites to use, gender, pose, hair, colour picks with hand edits, worn items. Hand edits are a
  colour swap applied after the chosen option, so one model covers body, hair and clothing.

- **Choosing between mods:** for each sprite the merged index lists every mod that ships it, in
  load order. A race or recipe may `exclude` mods and may `prefer` some (first preferred mod that has
  the sprite wins); otherwise the last in load order wins, as in the game. `prefer` is what makes
  "Starface faces on Cuter bodies" possible, since leaving Cuter out would lose its bodies too.
- **Species follow the choice too.** Each `.species` file is kept unpatched and every mod keeps
  its own patch; `species.ts` applies only the patches of mods a race keeps. This matters:
  Cuter's patch turns Avian beaks, fluff and feather colours into human hair options, so an
  Avian without Cuter needs the species without that patch, not just other sprites. `prefer`
  changes sprites only.
- **Known limits:** frame layouts come from the load-order winner; the six frames files that
  more than one mod ships are identical today. Poses come from the fully patched humanoid config.
- **Costumes:** an item marked `hideBody` hides the whole body, as it does in the world (the
  game's own portrait view ignores the flag; world behaviour matches the old screenshots).
- **Canvas:** 43x43, the game's frame size. It grows evenly, only when a sprite would otherwise
  be cut off (a few items have larger frames).

Numbers on Trey's machine: 159 mods (2 left out), 70 species (57 in the game's creator; 5
hidden as duplicates or unwanted), 4,376 wearable items (115 of them hidden), 20,489 sprites,
77 MB. Extraction takes about 10 seconds.

## Done

- [x] Extractor with tests; bundle built locally.
- [x] Engine with tests; every species renders with its starting outfit.
- [x] First page: race picker (search, categories, NPC toggle), stage (randomise, gender,
      clothing toggle, poses, expression, PNG download), body options, wardrobe by mod with
      search, palette editor, mod sources view. Draft kept in the browser.
- [x] Draft race table (descriptors are guesses to correct; categories had Trey's first pass).
- [x] Curation file; race list as a list or a grid of squares; swatches sortable by hue,
      saturation or lightness (display order only; recipes keep the option's own index).

## Next

Deployment was decided on 2026-11-12: **the server hosts the assets** (phones and members
without the game must be able to use the creator). Rules: sprites are served to logged-in
members only; game and mod assets never enter version control; removing material must not
need a code change or a deploy. Order agreed with Trey:

1. ~~Per-mod folders with batched sprite fetches (extractor and site loader).~~ Done.
2. ~~**ff-server** serves the bundle and holds the settings.~~ Done 2026-11-14 (branch
   `portrait-creator` in both repos), not deployed. See "Step 2 as built" below. Left out: an
   endpoint that returns several sprites at once (optional; Trey has not asked for it).
3. ~~**`/admin` panel.**~~ Done 2026-11-14: `/admin/portraits` (linked from /admin). Mods:
   switch off or on (at once, for everyone), limit a mod's clothing to some species, delete
   its files from the server. Races: order, name, descriptor, category, hidden, species,
   which mods a race leaves out or puts on top, fixed styles; species in the sprites but not
   in the list are offered to add; a line copied from the creator's Sources tab can be
   pasted in. Categories, the hidden-clothing pattern and list, and pixel repairs are one
   form. Not in it yet: picking a hidden item or a stray pixel by clicking on it in the
   creator (ids and coordinates are typed).
4. ~~**A script to push mod folders to the server.**~~ Written 2026-11-14:
   `scripts/portrait-push.sh` (all mods or the ones named; `--dry-run`; `--prune` to delete
   server folders this machine lacks). Tried against a local folder only: it has not been
   run against the server. The server-side steps are in ff-server's `docs/deploy-nfsn.md`,
   "Portrait creator sprites".
5. ~~**Member mod uploads.**~~ Done 2026-11-14 (Trey: a member gives the .pak; live as soon
   as it is uploaded). `/portraits/mods`, linked from the creator, and the same form on
   `/admin/portraits`. See "Step 5 as built" below.

### Step 2 as built

Three places, three kinds of thing:

- **Assets on disk.** The extractor writes to `ff-site/.portrait-bundle/` by default
  (gitignored; no longer under `public/`, so Next does not serve it). ff-server reads the
  directory named by `PORTRAIT_BUNDLE_DIR` in its `.env`. In production that will be a
  directory outside both deploy folders. Deleting a mod's folder there removes the mod on the
  next request, with no restart.
- **Settings in the database** (ff-server tables `portrait_mods`, `portrait_races`,
  `portrait_settings`): the race list and categories, hidden items, per-species clothing,
  pixel repairs, and an on/off switch per mod. A folder with no row is on. `npm run
  portrait:import-settings` in ff-server fills them from `races.json` and `curation.json`
  (`skipMods` become mods switched off); `PUT /api/admin/portrait/settings` does the same
  over HTTP, which is how production gets its first settings. `/admin/portraits` edits them.
- **Site code.** `/portraits` asks for a login, reads `GET /api/portrait/settings` on the
  server and hands it to the creator. Sprites come through `/site/portrait-bundle/...`, a
  route that adds the member's token and passes `Range` on to ff-server's
  `/api/portrait/bundle/{mods.json, items.json, <mod>/sprites.pack}`. No token, no sprites
  (401), and both are marked noindex.

The two index files go out gzipped (7 MB as files, 0.9 MB on the wire) and are revalidated
with an ETag, so a return visit downloads neither.

To run it on a dev machine: build the bundle (`python3 scripts/portrait-extract/extract.py
--mod ../squoatling-mod`), set `PORTRAIT_BUNDLE_DIR` to the absolute path of
`ff-site/.portrait-bundle` in `ff-server/.env`, apply the schema (`npx prisma db push` in
ff-server on a database that lacks the three tables), run `npm run portrait:import-settings`,
start both servers and log in.

### Step 5 as built

- **The member's browser does the extracting.** `src/lib/portrait/extract/` is a port of the
  Python extractor that reads paks through the browser's file API (only the parts it needs:
  a 900 MB base game and 159 mods take about two seconds). Nothing but the finished folder of
  a ticked mod is uploaded; the server never sees a pak and runs no extractor.
- **It needs the base game's `packed.pak` as well as the mod.** A mod's pak does not say how
  sprite sheets are cut into frames, and it patches species and clothing the base game (or
  another mod) defines. So the form asks for `packed.pak` and then for mods: the workshop
  folder, or .pak files one by one. A mod that builds on another mod reads right only if
  that mod is among the files chosen.
- **A browser cannot open the file window at a given folder** (only at Desktop, Documents and
  the like), so the form shows Steam's usual path for the member's system, Windows first,
  with a copy button, to paste into the file window.
- **The form says what the site already has:** not yet (ticked), already there, a different
  copy, or there as another copy (the same mod under a hand-installed id). Mods an admin
  switched off are left out of the reading, as `skipMods` are in the Python extractor.
- **Upload:** the folder goes up as one file in 2 MB pieces to ff-server, which checks it and
  swaps it in by rename. The mod's row records who uploaded it and when.
- **Load order is worked out by the site** (`loadOrder` in `merge.ts`) from each folder's
  priority, id and the mods it names as loading before it (`modName`, `after` in mod.json),
  not from the `order` one machine gave. On Trey's bundle this picks the same sprite for
  every image and the same patch order as before.
- **The two extractors must stay the same.** `parity.test.ts` compares them on a real
  install, folder by folder (`STARBOUND_DIR=<Starbound folder> PORTRAIT_EXTRA_MODS=../squoatling-mod
  npx vitest run src/lib/portrait/extract/parity`): 75 mods, every pack byte for byte.
- **Known limits.** Two members with different mods installed can build slightly different
  folders for the same mod (which species a "cuter" mod has sprites for; a species' place in
  the game's own creator list). Any member can replace any mod's folder; the row says who.
  The pack's PNGs are not checked on the server (the site decodes them with its own reader).

Still open from before:

- **Check against the game.** One check so far: Trey's Avian screenshot (Matthias Lewkey); the
  head reproduced, body, clothing and poses are unchecked.
- **Trey's pass with the resolver:** human (Starface vs Cuter), floran, dragon. Settled: Avian
  and Glitch leave Cuter out (Avian is Bird Up); Blazekid is Novakid with Novaskin, no Cuter,
  no brand.
- ~~**Saving.**~~ Done 2026-11-14: the creator's **Saved** tab keeps a portrait under a name
  (recipe and rendered PNG, in ff-server's `portraits` table), lists the member's portraits
  with thumbnails, reopens one, saves over it or deletes it. Private to the member who saved
  it, until Trey rules on the open question below. Not done: linking a saved portrait to a
  character. "Copy recipe" and "Paste recipe" still carry a portrait as text.
- ~~`npm run build`~~ passes (2026-11-14).
- **Wardrobe polish:** virtualised lists, favourites or a curated shelf, back items checked.
- ~~**14x14 avatar modal.**~~ Done 2026-11-14: "Make avatar" opens it at any point. The
  square starts on the head and is moved by dragging or the arrow keys; an eraser (and "put
  back") clears stray pixels; the result downloads as a PNG or goes straight onto a
  character the member may edit (their own; any, for an admin) through the existing avatar
  upload.
- **Index size:** `mods.json` is 3 MB and `items.json` 3.9 MB before compression.
- **Vesperian's sprites are 5 MB** on their own (unoptimised PNGs in the mod).

## Open questions

- Whether Zander's machine also builds mod folders (the per-mod layout makes that additive).
- Saved portraits are private (Trey, 2026-11-14); an avatar put on a character is public like any avatar.
- The extractor has only been run on Linux; Windows and macOS paths are written but untested.
- Curating the wardrobe: 2,930 head items and one mod with about 2,400 items.
