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
  humanoid, fantasy, mechanical.
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
Starbound paks + mods ──extract.py──> public/portrait-bundle/ (manifest, items, sprites)
                                              │
races.json (names, categories, exclude) ──────┤
                                              ▼
            recipe ──humanoid.ts──> layers ──compose.ts──> 43x43 RGBA
```

- `portrait-extract/` (Python, stdlib): see its README.
- `src/lib/portrait/`: the engine, no DOM.
  - `directives.ts`: Starbound colour directives (replace, hueshift, saturation, brightness,
    multiply, setcolor: all that the installed species and items use).
  - `humanoid.ts`: recipe to layers. Port of `createHumanoid` (which option colours which part)
    and `renderPortrait` (layer order, pose frames and offsets, helmet masks).
  - `compose.ts`: layers to pixels; picks each sprite's mod given the recipe's `exclude`.
  - `png.ts`: own PNG reader, because a canvas alters exact colours and colour swaps need them.
  - `races.ts`, `browserBundle.ts`.
- `src/components/portrait/`, `src/app/portraits/`: the page.
- A **recipe** (`Recipe` in `types.ts`) is everything needed to redraw a portrait: species,
  which mods' sprites to use, gender, pose, hair, colour picks with hand edits, worn items. Hand edits are a
  colour swap applied after the chosen option, so one model covers body, hair and clothing.

- **Choosing between mods:** for each sprite the manifest lists every mod that ships it, in load
  order. A race or recipe may `exclude` mods and may `prefer` some (first preferred mod that has
  the sprite wins); otherwise the last in load order wins, as in the game. `prefer` is what makes
  "Starface faces on Cuter bodies" possible, since leaving Cuter out would lose its bodies too.
- **Species follow the choice too.** The bundle carries each `.species` file unpatched plus
  every mod's patch; `species.ts` applies only the patches of mods a race keeps. This matters:
  Cuter's patch turns Avian beaks, fluff and feather colours into human hair options, so an
  Avian without Cuter needs the species without that patch, not just other sprites. `prefer`
  changes sprites only.
- **Known limits:** frame layouts come from the load-order winner; the six frames files that
  more than one mod ships are identical today. Poses come from the fully patched humanoid config.
- **Costumes:** an item marked `hideBody` hides the whole body, as it does in the world (the
  game's own portrait view ignores the flag; world behaviour matches the old screenshots).
- **Canvas:** 43x43, the game's frame size. It grows evenly, only when a sprite would otherwise
  be cut off (a few items have larger frames).

Numbers on Trey's machine: 159 mods, 70 species (57 in the game's own creator), 6,802 wearable
items, 27,100 sprites, 84 MB. Extraction takes about 10 seconds.

## Done

- [x] Extractor with tests; bundle built locally.
- [x] Engine with tests; every species renders with its starting outfit.
- [x] First page: race picker (search, categories, NPC toggle), stage (randomise, gender,
      clothing toggle, poses, expression, PNG download), body options, wardrobe by mod with
      search, palette editor, mod sources view. Draft kept in the browser.
- [x] Draft race table (71 races; descriptors and categories are guesses to correct).

## Next

1. **Check against the game.** One check so far: Trey's Avian screenshot (Matthias Lewkey). A
   search over feather colour, beak, fluff and crest reproduced the head (227 of 252 pixels in
   the head rows, allowing 4 levels of colour drift in the screenshot; the rest is the crest
   style, not identified). Body, clothing and poses are still unchecked: the screenshot is a
   walking frame with clothes on.
2. **Trey's pass with the resolver:** settle human (Starface vs Cuter), novakid (Novaskin, Alt
   Heads), floran (Better Florans), dragon, and which species become two races. Settled:
   Avian and Glitch leave Cuter out (Avian is Bird Up). Fill in
   Final Frontier names.
3. **UI design round.** The current layout is one proposal; try variants before polishing.
4. **Saving:** `Portrait` in ff-server (owner, name, recipe JSON, rendered PNG, optional
   character), list and reopen, prod-sql file. Members only.
5. **`npm run build` and the Next 16 guides** before a PR: only the dev server has been run.
6. **Bundle on production.** Not in git and not built in CI. Needs a static location on the
   NFSN site that deploys leave alone, an upload script, and `NEXT_PUBLIC_PORTRAIT_BUNDLE_URL`.
   Until then the page is not linked from the navbar.
7. **Wardrobe polish:** virtualised lists, favourites or a curated shelf, back items checked.
8. **14x14 avatar modal** with eraser; "apply to character" through the existing avatar upload.

## Open questions

- Where the bundle lives in production, and whether Zander's machine also builds one (two
  machines with different mods would need merging).
- Whether saved portraits are public, and whether a character page shows its full portrait.
- The extractor has only been run on Linux; Windows and macOS paths are written but untested.
- Curating the wardrobe: 2,930 head items and one mod with about 2,400 items.
