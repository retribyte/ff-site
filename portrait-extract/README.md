# portrait-extract

Builds the sprite bundle the portrait creator (`/portraits`) draws from, out of a Starbound
install and its mods. Python 3.9+, standard library only, so it runs on any machine that has
Starbound (Linux, Windows, macOS).

```sh
python3 portrait-extract/extract.py --mod ../squoatling-mod
```

It finds Starbound through Steam (or `--starbound <folder>` / `STARBOUND_DIR`), then reads, in
the game's load order:

1. `assets/packed.pak` (the base game)
2. everything in `<Starbound>/mods`
3. every subscribed workshop mod (`steamapps/workshop/content/211820`; `--no-workshop` skips them)
4. each `--mod PATH`: a `.pak` or an unpacked mod folder (one with a `_metadata` or `.metadata`).
   A `--mod` with the same name as a workshop mod replaces it, which is how the working copy of
   `squoatling-mod` stands in for its published version.

Nothing is unpacked to disk first; paks are read in place. A full run takes about ten seconds.

## Output

By default `public/portrait-bundle/` (gitignored; `--out` changes it). **One folder per mod**,
holding only what that mod's own files contribute:

| File | Holds |
|---|---|
| `<mod id>/mod.json` | the species files it ships (unpatched), its patches to other mods' species, the frame rectangles of its `.frames` files, and where each of its species sprites sits in the pack |
| `<mod id>/items.json` | the head, chest, legs and back items it defines, with colour options, and where their sprites sit in the pack |
| `<mod id>/sprites.pack` | its PNGs, untouched, end to end |
| `mods.json`, `items.json` | every folder's file of that name, concatenated: what the site fetches |

A mod's id is its workshop number, `vanilla`, or a slug of its name for local mods.

**Nothing is merged here.** The site combines the folders that are present
(`src/lib/portrait/merge.ts`), applying the game's rule that mods load in order and the last
one wins. So:

- **Removing a mod is deleting its folder** (and leaving it out of the two concatenated files,
  which a server builds from the folders it finds). Its species, clothing, sprites and patches
  go; every other folder is untouched and byte-identical to an extraction without that mod.
- **Every mod's version of a sprite is kept.** When several mods redraw the same species the
  site picks one per race (`exclude` and `prefer` in `src/data/portrait/races.json`), so one
  species can be offered as two races and nothing is lost to load order.
- **Species patches stay with the mod that makes them**, unapplied, so a race that leaves a mod
  out also drops what that mod changed about the species.
- **A mod that patches another mod's clothing** in a way the creator can see gets its own
  version of that item, marked `patch` (Cuter gives base-game clothes different sheets). The
  item still belongs to the mod that defines it. Patches that change nothing the creator reads
  are dropped.

The site never downloads a whole pack. It asks for the byte ranges of the sprites it needs,
and ranges that sit close together go out as one request, so the pack is ordered with a mod's
item icons first and then folder by folder. The server must answer HTTP `Range` requests (a
plain static file server does).

Re-running only rewrites files that changed and removes the folders of mods that are no longer
extracted. `build` in each `mod.json` changes whenever anything in that folder does; it is part
of the pack's URL, so a new index is never paired with cached bytes of an old pack.

Mods listed under `skipMods` in `src/data/portrait/curation.json` are left out before anything
is read from them (`--curation none` ignores the list).

## Adding races or clothing

Subscribe to the mod (or pass `--mod`), run the extractor again, reload the page. A new species
appears under "uncategorised" until it gets a line in `src/data/portrait/races.json` (Final
Frontier name, one-word descriptor, category).

## What it reproduces from the game

`sbassets.py` follows OpenStarbound's `StarAssets.cpp` and `StarRoot.cpp`: case-insensitive
paths, JSON with comments, load order by `priority` then path with `includes`/`requires` first,
`.patch` files from every source applied in load order (including batches and `test` with
`inverse`), and `.frames` lookup (`<image>.frames`, else `default.frames`, walking up).
A file that fails to parse or a patch that fails to apply is reported and skipped.

Not handled: species built by Lua scripts (`createScripts`; none installed today), `.patch.lua`,
and item `builder` scripts (the item's plain config is used).

Tests: `python3 -m unittest discover portrait-extract` (made-up mods only; no game file is ever
committed).
