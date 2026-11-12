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

By default `public/portrait-bundle/` (gitignored; `--out` changes it):

| File | Holds |
|---|---|
| `manifest.json` | mods, every species (its unpatched file, each mod's patch to it, poses), frame rectangles, and for each sprite the mods that ship it |
| `items.json` | every head, chest, legs and back item with its colour options and sprite sheets |
| `sprites/<mod id>/<asset path>` | the PNGs, untouched, one copy per mod that ships that path |

A mod's id is its workshop number, `vanilla`, or a slug of its name for local mods.

**Every mod's version of a sprite is kept.** When several mods redraw the same species, the
manifest lists them in load order and the site picks one per race (`exclude` and `prefer` in
`src/data/portrait/races.json`), so one species can be offered as two races and nothing is
lost to load order. Species files work the same way: patches are shipped per mod, not applied,
so a race that leaves a mod out also drops what that mod changed about the species.

Re-running only rewrites files that changed and removes ones no longer used. `build` in the
manifest changes whenever anything does; the site uses it to bypass the browser cache.

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

Tests: `python3 -m unittest discover portrait-extract`.
