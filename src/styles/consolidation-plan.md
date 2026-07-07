# Style Consolidation Plan

Audit of the 37 SCSS modules (`~3,300` lines) + `globals.scss` + `_tokens.scss`.
Goal: pull repeated declarations into shared primitives so a visual change happens
in one place, not fifteen.

The tokens layer (`_tokens.scss`) is already healthy — colors, fonts, and sizes are
all variables. The duplication is at the **rule** level: the same *combinations* of
those tokens are re-typed in module after module. Two `globals.scss` utilities
(`.pixel-panel`, `.pixel-label`) already exist and prove the pattern, but almost
nothing consumes them — modules re-declare their contents inline instead.

---

## How to consume the shared layer

CSS Modules can pull shared rules three ways. Recommended split:

- **`@use` + `@include` mixins** (`src/styles/_mixins.scss`) — for parameterized
  primitives (the tint var differs per call: `--char` / `--type` / `--story` /
  `--season`). This is the majority case here. Modules do
  `@use '../../styles/mixins' as m;` then `@include m.tinted-card;`.
- **`composes:` from a shared module** (`src/styles/shared.module.scss`) — for
  identical, parameter-free class bodies (`.error`, `.breadcrumbLink`, `.grid`).
- **Global utility classes** (`globals.scss`) — only for things applied straight in
  JSX across many components (`.pixel-label`, `.pixel-panel`). Extend the two that
  exist rather than adding many.

Prefer mixins over globals for anything scoped, to keep CSS-Module encapsulation.

---

## Mapping — by UI element

Severity = how much pain a change causes today. ★★★ = edit in ≥7 files.

### ★★★ 1. Page container `.main`
**12 files.** `max-width: <token>; margin: 0 auto; padding: 1.5rem 1.25rem 3rem;`
(some use `--content-width`, some `--reader-width`; a few tweak padding).

Files: `archives/[season]/[episode]/episode`, `archives/[season]/season`,
`characters/characters`, `characters/[id]/character`, `characters/[id]/quotes`,
`items/[id]/itemDetail`, `items/items`, `species/[id]/speciesDetail`,
`species/species`, `stories/[slug]/story-page`, `convert/converter`, (+`stories/stories`, `import` variants).

→ **Mixin** `page-main($width: content)` taking a width keyword. ~60 lines removed.

### ★★★ 2. Breadcrumb / pager pixel-nav link
**9 files.** The identical block:
```scss
font-family: var(--font-pixel); font-size: 0.72rem;
text-transform: uppercase; letter-spacing: 0.06em;
text-decoration: none; color: var(--text-muted);
&:hover { color: var(--link-hover); }
```
Files: episode (×2 — `.breadcrumb a` + `.pager a`), season, character, quotes,
speciesDetail, itemDetail, story-page (×2 — `.breadcrumb a` + `.chapterNav a`), login.
Same shape also in `.quotesLink`, archives `.stripTitle`.

→ **`composes:` `.pixelNavLink`** in shared module, or a `pixel-link` mixin (the
`0.72`/`0.06em` vs `0.7`/`0.06em` drift is noise — normalize it). ~80 lines removed.

### ★★★ 3. Glow-shadow display heading (`.title` / `.name`)
**10 files.** Colored heading with the signature double text-shadow:
```scss
color: var(--X);
text-shadow:
    calc(var(--px) * 1.2) calc(var(--px) * 1.2) 0 var(--shadow),
    0 0 18px color-mix(in srgb, var(--X) 40%, transparent);
```
`X` = `--season` / `--char` / `--type` / `--story` / `--accent`.
Files: episode, season, character, quotes, itemDetail, speciesDetail, story-page,
archives (title strips), + `page.module` and `storyIndex` use the sibling
1px-shadow variant.

→ **Mixin** `glow-heading($color)`. Also add a lighter `chunky-shadow($color)`
mixin for the `text-shadow: 1px 1px 0 var(--shadow)` / `var(--px) var(--px) 0`
variants used on card titles, speaker names, tocNo, episodeNo, cardName (≈12 spots).

### ★★★ 4. Infobox block (`.infobox` / `.infoboxHeader` / `.facts` / `.fact` / `.infoboxGlyph` / `.factLink` + `@media 860px`)
**3 files, but ~85 lines each, near-verbatim:** `characters/[id]/character`,
`items/[id]/itemDetail`, `species/[id]/speciesDetail`. The `.facts`/`.fact`
(grid `7rem 1fr`, `:nth-child(even)` tint, `dt` pixel-label, `dd`) and the mobile
`@media (max-width: 860px)` reorder are identical; only the tint var differs.

→ **Mixin bundle** `infobox($tint)` covering panel + header + facts + glyph, or a
shared `infobox.module.scss` the three pages `composes:` from. Biggest single win —
**~200 lines** collapse to one definition. `.layout` (grid `1fr 19rem`), `.article`
(`min-width:0`), `.nameRow` are also identical across the same 3 files → fold in.

### ★★ 5. Tinted hover card (`.card`)
**4 files.** characterCard, itemIndex `.card`, speciesIndex `.card`, storyIndex
`.card`. Shared skeleton: tinted `color-mix` background, `border-top: var(--px)`
accent, `box-shadow: 2px 2px 0 0 var(--shadow)`, `transition: transform .12s`,
hover `translateY(-0.5px)` + glow, plus a per-file `prefers-reduced-motion` reset.

→ **Mixin** `tinted-card($tint)` with the hover + reduced-motion baked in.
`.cardName` (display font + `1px 1px` shadow + tint) is its own repeated sub-pattern
→ fold into the `chunky-shadow` mixin from #3.

### ★★ 6. Grid list (`.grid` / `.memberGrid` / `.shelf`)
**5 files.** `list-style:none; margin:0; padding:0; display:grid;
grid-template-columns: repeat(auto-fill, minmax(<X>rem, 1fr)); gap:0.9rem;`
Only `minmax` min differs (10.5 / 11 / 15rem). characterIndex, itemIndex,
speciesIndex, speciesDetail `.memberGrid`, episodeImporter `.mappings`.

→ **Mixin** `auto-grid($min: 10.5rem, $gap: 0.9rem)`. The bare
`list-style:none;margin:0;padding:0` reset alone recurs ~10× → tiny `reset-list`
mixin.

### ★★ 7. Sticky scan / filter bar
**3 files, verbatim:** indexScan `.controls`, itemIndex `.filters`, transcript
`.scanBar`. `position:sticky; top:var(--navbar-height); z-index:5; …
border-left: var(--px) solid var(--accent); box-shadow: 2px 2px 0 0 var(--shadow);`
Their inner `.prompt`/`.scanPrompt` (mono, accent-soft) and
`.search`/`.scanInput` (transparent borderless mono input) also match.

→ **Mixin** `scan-bar` + share the prompt/input children. ~40 lines.

### ★★ 8. Primary gradient CTA button (`.submit` / `.save` / `.upload` / `.tabActive`)
**4 files.** Identical accent gradient, `var(--px)` border, white text, drop shadow,
`:hover:not(:disabled)` brightness+glow, `:disabled` dim.
login `.submit`, recordEditor `.save`, episodeImporter `.upload`, importConsole
`.tabActive` (gradient half).

→ **Mixin** `cta-button`. ~55 lines.

### ★★ 9. Mono form field (input / textarea / select + focus ring)
**5 files.** `font-family: var(--font-mono); color:var(--text); background:var(--bg);
border:1px solid var(--border-loud); border-radius:var(--radius); &:focus{ outline:none;
border-color:var(--accent-soft); box-shadow:0 0 0 2px var(--highlight); }`
login `.field input`, converter `.field input` + `.eraRow select`, recordEditor
`.field input/textarea/select`, episodeImporter `.mappings select`, commentary
`.editRow textarea` (partial). The wrapping `.field` flex-column also repeats 3×.

→ **Mixin** `form-field` (+ `field-stack` for the label wrapper). ~50 lines.

### ★★ 10. Pixel error text (`.error`)
**7 files.** `margin:0; font-family:var(--font-pixel); font-size:0.7rem;
letter-spacing:0.05em; color:var(--ff1);` (commentary uses 0.65rem).
login, recordEditor, episodeImporter, deleteStoryButton, navbar (partial),
commentary, + story deleteStoryButton.

→ **`composes:` `.pixelError`** from shared module. ~35 lines.

### ★ 11. Dashed pixel chip / tag
**~15 files** carry a "pixel-label text + `1px dashed` border + `radius` + small
padding" chip, tinted differently: actionChip `.chip`, `wikiLink`, itemDetail
`.typeChip`, speciesIndex `.classChip`, character `.alias`, itemIndex `.cardType`,
characterCard `.cardAlias`, page `.seasonChips li`, episodeImporter `.badge`,
legendChip, commentary `.chip`.

→ **Mixin** `pixel-chip($tint: var(--border-loud))`. Highly variable, so param the
border color + optional hover; still removes a lot of near-dupes.

### ★ 12. Small pixel `<select>` dropdown
**3 files, near-verbatim:** choiceJump `.select`, episodeSelect `.select`,
indexScan `.filterSelect`. Pixel font, uppercase, `surface-2` bg, `border-loud`,
hover accent.

→ **Mixin** `pixel-select`. ~40 lines.

### ★ 13. Secondary/ghost button (surface-2, dashed, hover-accent)
`.miniButton` (recordEditor), `.nowButton` (converter), `.tab` (login),
importConsole `.tab`, `.themeToggle`/`.scanButton` (surface-2 solid variant).

→ **Mixin** `ghost-button` with a `$border-style` param.

### ★ 14. Star-texture gradient panel background
**8 files.** `background: var(--star-texture), linear-gradient(<deg>, color-mix(...))
; background-size: 120px, auto;` — archives `.strip`, infoboxHeader ×3,
episodeList `.episode`, speciesIndex `.card`, storyIndex `.card`, story `.vcomm`.

→ **Mixin** `starfield-panel($tint, $angle, $mix)`. Consolidates the magic
`120px, auto` and gradient recipe.

### ★ 15. Quote block (`.quotes` / `.quote` / `.quoteMark` + `blockquote` internals)
**2 files, fully duplicated:** `characters/[id]/character` and
`characters/[id]/quotes` (the latter only adds `content-visibility`). ~50 lines
copied outright.

→ Extract a `quotes.module.scss` both `composes:`/`@include`, or a `quote-list`
mixin. Zero-risk dedupe.

### ★ 16. `@media (prefers-reduced-motion: reduce)` transition kills
**8 files** each append a block zeroing a transition. Where the transition lives in
a mixin (#5, #7, story/transcript anchors), bake the reduced-motion guard into that
mixin so callers get it free.

---

## Proposed shared files

```
src/styles/
  _tokens.scss          (exists — unchanged)
  _mixins.scss          (NEW — parameterized primitives, @use'd by modules)
  shared.module.scss    (NEW — composes: targets: .pixelNavLink .pixelError
                         .grid .resetList .quoteList)
globals.scss            (extend: keep .pixel-panel/.pixel-label, add nothing
                         unless applied directly in JSX)
```

`_mixins.scss` roster (in rough priority order):

| Mixin | Replaces § | Params |
|-------|-----------|--------|
| `page-main` | 1 | `$width` |
| `glow-heading` / `chunky-shadow` | 3 | `$color` |
| `infobox` (+ `dossier-layout`) | 4 | `$tint` |
| `tinted-card` | 5 | `$tint` |
| `auto-grid` / `reset-list` | 6 | `$min,$gap` |
| `scan-bar` | 7 | — |
| `cta-button` | 8 | — |
| `form-field` / `field-stack` | 9 | — |
| `pixel-chip` | 11 | `$tint` |
| `pixel-select` | 12 | — |
| `ghost-button` | 13 | `$border-style` |
| `starfield-panel` | 14 | `$tint,$angle,$mix` |

---

## Rollout order (low-risk → high-value)

1. **Foundations, no visual change:** create `_mixins.scss` + `shared.module.scss`.
   Land the zero-parameter, zero-drift dedupes first — `.error` (§10), quote block
   (§15), grid/reset-list (§6), breadcrumb link (§2). These are literal copies;
   Playwright a couple of pages to confirm pixel-identical.
2. **Parameterized primitives:** `infobox` (§4 — biggest LOC win), `tinted-card`
   (§5), `glow-heading`/`chunky-shadow` (§3), `page-main` (§1). Normalize the
   `0.7`↔`0.72rem` / shadow-offset drift as you go (call it out in the PR — it's a
   deliberate, tiny visual normalization).
3. **Forms & controls:** `cta-button` (§8), `form-field` (§9), `pixel-select` (§12),
   `ghost-button` (§13), `scan-bar` (§7).
4. **Chips & finishing:** `pixel-chip` (§11), `starfield-panel` (§14), fold
   reduced-motion (§16) into the motion-bearing mixins.

Estimated reduction: **~700–800 of ~3,300 module lines (≈22%)**, concentrated in the
detail pages (character/item/species) and the form/button surfaces. Every entry
above is currently a multi-file edit; after this each becomes one.

## Watch-outs
- **Keep the tint indirection.** Every card/infobox/heading is themed by an inline
  `--char`/`--type`/`--story`/`--season`. Mixins must take the *variable* (or read it
  via `var()`), never a literal color — the server sets these per record.
- **Don't globalize scoped classes.** Prefer mixins/`composes:` so CSS-Module hashing
  stays intact; reserve `globals.scss` for classes used directly in JSX.
- **Selector-list `composes:` limits.** `composes:` only pulls a class body, not
  descendant/`&:hover` rules cleanly across files — use mixins where `&:hover`,
  `::after`, or child selectors are involved (most of the button/link cases).
- **story/transcript readers are virtualized** — rows are absolutely positioned by JS.
  Leave their layout/positioning rules alone; only their leaf visuals (chips, anchors,
  command/embed treatments) are safe to share.
