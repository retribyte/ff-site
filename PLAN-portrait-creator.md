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
- **Race table:** a JSON file in the repo (`src/data/portrait/races.json`), not a DB table.
  Revisit if editing it by hand becomes a chore.

## How it works

```
Starbound paks + mods ──extract.py──> one folder per mod (mod.json, items.json, sprites.pack)
                                              │
                    folders present ──merge.ts──> species, clothing, where each sprite is
                                              │
races.json, curation.json (names, hidden) ────┤
                                              ▼
            recipe ──humanoid.ts──> layers ──compose.ts──> 43x43 RGBA
```

- **A mod is a folder.** It holds only what that mod's own files contribute; the site merges
  the folders that are present in the game's load order. Deleting a folder removes the mod
  (checked: deleting Cuter's folder gives exactly the bundle of an extraction without Cuter).
- **Sprites are fetched as byte ranges** of each mod's pack; ranges close together share a
  request (`pack.ts`). The same click-through went from 420 requests to 123, and page load
  from 140 to 25. One request per mod per screenful is the floor while each mod is its own file.
- `portrait-extract/` (Python, stdlib): see its README.
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
2. **ff-server:** serve the bundle from a directory outside the deployed site (the site deploy
   mirrors its folder with `--delete`), members only, in the same shape as the static files
   (`mods.json`, `items.json`, `<mod>/sprites.pack` with `Range`), built from the folders
   present and the mods switched on. Settings tables to replace `races.json` and
   `curation.json`. A prod-sql file. Optionally one endpoint that returns several sprites at
   once, to get under one request per mod.
3. **`/admin` panel:** mods (enable, disable, delete), races and categories, hidden items,
   per-species clothing limits, pixel repairs.
4. **A script to push mod folders to the server.**
5. **Member modpack uploads** (last): keyed by mod id so a new version replaces the old one;
   the same component also sits on the admin panel.

Still open from before:

- **Check against the game.** One check so far: Trey's Avian screenshot (Matthias Lewkey); the
  head reproduced, body, clothing and poses are unchecked.
- **Trey's pass with the resolver:** human (Starface vs Cuter), floran, dragon. Settled: Avian
  and Glitch leave Cuter out (Avian is Bird Up); Blazekid is Novakid with Novaskin, no Cuter,
  no brand.
- **Saving:** `Portrait` in ff-server (owner, name, recipe JSON, rendered PNG, optional
  character), list and reopen. Until then "Copy recipe" and "Paste recipe" carry a portrait as text.
- **`npm run build` and the Next 16 guides** before a PR: only the dev server has been run.
- **Wardrobe polish:** virtualised lists, favourites or a curated shelf, back items checked.
- **14x14 avatar modal** with eraser; "apply to character" through the existing avatar upload.
- **Index size:** `mods.json` is 3 MB and `items.json` 3.9 MB before compression.
- **Vesperian's sprites are 5 MB** on their own (unoptimised PNGs in the mod).

## Open questions

- Whether Zander's machine also builds mod folders (the per-mod layout makes that additive).
- Whether saved portraits are public, and whether a character page shows its full portrait.
- The extractor has only been run on Linux; Windows and macOS paths are written but untested.
- Curating the wardrobe: 2,930 head items and one mod with about 2,400 items.
