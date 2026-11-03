# DOCX → story conversion: regression against the reviewed manuscripts

Status: **Python converter fixed on branch `story-docx-import` (2026-11-03).
It hasn't been ported to TypeScript yet** (see `../PLAN-story-import.md`).

## Method

- **Inputs:** the FF shared-Drive export (`Final Frontier-20261103T165119Z-1-001.zip`,
  unzipped to `~/Downloads/ff-docs-20261103/`). These are the same docx
  sources the Oct 2 import used.
- **Sample:** 23 of its docx files match stories in the API by title (Event
  Horizon: 14, Vortox Pummelers Arc/FF3: 9). Each one has a reviewed
  manuscript in `md/stories/`.
- **What was compared:** each docx was converted with the color map set to
  placeholders. The output was diffed paragraph by paragraph against the
  manuscript, ignoring speakers: span markers were stripped, so the
  comparison covers text, structure and emphasis. Dialogue attribution was
  done by hand in October and isn't something a color map can reproduce. For
  example, gray `#666666` means "some NPC".
- **Which side to trust:** the manuscripts are the reference for text,
  attribution and emphasis, but **not for structure**. The old converter lost
  every scene break, and nobody added them back. The entire DB holds a single
  BREAK line across 35 stories.
- **Harness:** outside the repo, in `ff-wt/story-docx-import/work/`.
  - `run_branch.py`: converts docx → md → payload and checks the payload
    invariants.
  - `compare.py`: the diff, written to `diff-detail.json`.
  - `docx_dump.py` / `survey.py`: per-document structure dumps.

## Results

| | old converter | fixed converter |
|---|---|---|
| paragraphs (converter / manuscript) | 1,433 / 1,509 | **1,509 / 1,509** |
| extra or missing paragraphs | 79 / 155 | **0 / 0** |
| copyedit-only differences (similarity ≥ 0.9) | 213 | 252, from the Oct copyedit passes, as expected (more now that paragraphs align) |
| emphasis differences | 62 | 32 with the quotes-outside house style: 30 in the Ravens trilogy and *Wes Romaw* (their styled quote marks, the accepted lossy change), 2 editorial |
| other text differences | — | 12, all editorial (see below) |
| payload issues (blank lines or segments, literal `*` or span markers) | 9 blank segments in the DB | **0** |
| scene breaks | 0 | 43 inserted: 40 from gaps (all read in context: time skips, scene changes, *Bellow's Journal* entry boundaries) and 3 from *Final Pummel*'s horizontal lines (its other 2 lines fall where a break already was, or at the end) |

## Converter bugs fixed

1. **Soft line breaks.** Shift+Enter inside a paragraph was collapsed into a
   space. *A Quick Break*, *A Fateful Date*, *Final Pummel*, *Knocked and
   Rocked Asleep* and *Do Emmetts Dream* write whole scenes as one paragraph
   of tab-indented lines, which came out as run-ons ("“Hey, Red? You good?”
   “What? Oh, yes, I’m fine.”"). Each soft break now starts a paragraph.
2. **Scene breaks.** Empty paragraphs were all dropped. Now a run of empty
   paragraphs becomes `***` only when it's longer than the spacing around it,
   or when there's a page break. "The spacing around it" is the most common
   gap (0 or 1) among the three gaps on each side and across the whole doc.
   The local check matters: *Bellow's Journal* types a phone call one blank
   line apart inside otherwise unspaced entries, and a doc-wide baseline
   alone broke every line of it (33 breaks → 14). A break is never placed
   next to a heading, after another break, or at the end.
3. **Title line.** A first paragraph repeating the story title was kept as
   narration or as "Chapter 1: <title>". This covered Heading 1 (*Cold
   Comfort*, *Deep Pockets*, *Deafening Silence*, *A Quick Break*), plain text
   (*Psychotherapy*, *A Precarious Encounter*), a trailing period (*Any Means
   Necessary.*, *Everything was okay.*) and bold. It's now dropped.
4. **Heading 2 sections.** With the title dropped, a doc whose only headings
   are Heading 2 ("Part 1", "Part 2") is chaptered by them, matching *Still
   Waters*. Heading 3 and below are always sections.
5. **Prologue numbering.** Text before an explicit "Chapter 1" became an
   implicit chapter 1, so the upload failed with "duplicate chapter number".
   It's now `Chapter 0`, with a warning to give it a title.
6. **Monospace body.** *Everything Was Okay* is typed entirely in Courier New:
   8,102 characters, against 357 in other fonts. The whole story became one
   TRANSCRIPT line. Monospace now marks a transcript only when it's a minority
   of the text.
7. **Whitespace-only segments.** A space between two styled runs inside one
   voice (`[**a** **b**]{X}`) produced a blank `' '` segment. That's the 9 in
   the DB. The converter folds whitespace into the previous run, and
   `story-md-to-api.py` merges any whitespace-only segment into its
   neighbour. Re-parsing all 37 manuscripts changes 4 payloads, and only in
   how segments are grouped; every line's `text` and `type` is unchanged.
8. **Punctuation-only emphasis.** An italic "(" or "." produced a stray `*(*`.
   Now it's plain text.

9. **Google horizontal lines** were invisible to the converter. They're now
   `***` breaks (see Decisions).
10. **Quote marks at a styled run's edge** now sit outside the styling (see
    Decisions). The converter used to write `[“…”]{X}` (107×) where the docx
    colored the quote marks, and the manuscripts never do.

What did *not* need fixing: emphasis around dialogue spans. October's 91 hand
fixes moved `*[“…”]{X}*` to `[*“…”*]{X}`. The current converter never emits
the outer form, because it styles inside each span, and none of the 23
outputs contain it. I didn't check what produced it in October.

## Decisions (2026-11-03)

- **Quote marks go outside the styling and the voice span:** `“[*…*]{Name},”`.
  A comma before the closing quote goes outside too. Across all 37 manuscripts
  the span form already holds 907 to 0. The converter applies it (commit
  1feb455), and so do the patches. The Ravens trilogy and *Wes Romaw* styled
  the quote marks themselves (bold and colored), 40 cases in 4 stories. They
  lose that styling: a deliberate lossy change for consistency.
- **Headings:** Heading 1 is a chapter, and Heading 2 and below are in-chapter
  sections. The exception is a doc whose only Heading 1 is the title: there,
  Heading 2s are chapters ("Part 1", "Part 2"). *Final Pummel* is the one
  story with both levels. *Deafening Silence*'s Parts become chapters in its
  patch.
- **Horizontal lines are `***` breaks.** Google exports Insert ▸ Horizontal
  line as a VML rectangle (`o:hr="t"`), which the old converter didn't see.
  Of the API stories only *Final Pummel* has them (5). Inside a transcript
  block, a line splits the block.
- **Journal entry labels** (*Bellow's Journal*'s "(After Episode N)") are left
  to review, not converted.
- **Existing stories:** the patches in `ff-wt/story-docx-import/work/patched/`
  start from each reviewed manuscript and only add breaks, quote restyles and
  the *Deafening Silence* chapters. `make_patches.py` asserts that every
  patched payload has the same line text as today (BREAK lines aside). One
  *Give No Quarter* paragraph had nested markers the restyle couldn't handle
  safely, so it's left as-is for a hand fix. A side-by-side review page shows
  all 23.

## Images missing from the archive

The story format has no image line, so pictures in a docx never reached the
API. **7 pictures in 3 API stories** are missing:

| Story | Pictures | Where |
|---|---|---|
| *Bellow's Journal and Audio Logs* | 5 (18–30 KB each) | after four journal entries' closing star-gazing line, and after Terry's call |
| *Deafening Silence* | 1 (642 KB, full width) | at the very end, after "It's nothing but silence." |
| *Final Pummel* | 1 (363 KB) | after "Let's kick some ass.", before the Armada report |

Elsewhere in the Drive export, the FF1 archive docx has 12 picture files and
the FF2 compilation has 1; neither is a story in the API. The other
"drawings" in *A Quarter At Table*, *Horizon Meets Dawn*, *CYOA*, *Hexgots*
and *Every Single Vortox Pummeler* are all horizontal lines, not pictures.

Supporting images needs an `IMAGE` story-line type (or a `segments`-style
attachment), somewhere to store the files, and a converter step that
extracts `word/media/*` with alt text and position.

## Judgment calls left alone

- *Final Pummel*'s "Chapter 0: **Preface**" title and its rewritten bloopers
  line.
- The *Omg Zach's Gay* `(“*…*”)` thought-aside: the doc italicizes only the
  parentheses.
- Copyedits: dialogue-tag case, commas, `--` → `—`, "Touche" → "Touché",
  a backwards `”...”`. The 20 lowest-similarity copyedits were read
  individually; all are tense, wording or punctuation changes. The one
  glued word (`legs.This`) is in the source docx.
