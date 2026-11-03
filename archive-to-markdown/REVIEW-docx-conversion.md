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
| emphasis differences | 62 | 63: 54 are where the quote marks sit relative to the markers, 9 are hand moves of quotes and commas |
| other text differences | — | 12, all editorial (see below) |
| payload issues (blank lines or segments, literal `*` or span markers) | 9 blank segments in the DB | **0** |
| scene breaks | 0 | 59 inserted. All were read in context; they're time skips and scene changes. |

## Converter bugs fixed

1. **Soft line breaks.** Shift+Enter inside a paragraph was collapsed into a
   space. *A Quick Break*, *A Fateful Date*, *Final Pummel*, *Knocked and
   Rocked Asleep* and *Do Emmetts Dream* write whole scenes as one paragraph
   of tab-indented lines, which came out as run-ons ("“Hey, Red? You good?”
   “What? Oh, yes, I’m fine.”"). Each soft break now starts a paragraph.
2. **Scene breaks.** Empty paragraphs were all dropped. Now the doc's usual
   spacing is the most common gap between paragraphs (0 or 1), and any longer
   run of empty paragraphs, or a page break, becomes `***`. A break is never
   placed next to a heading, after another break, or at the end.
3. **Title line.** A first paragraph repeating the story title was kept as
   narration or as "Chapter 1: <title>". This covered Heading 1 (*Cold
   Comfort*, *Deep Pockets*, *Deafening Silence*, *A Quick Break*), plain text
   (*Psychotherapy*, *A Precarious Encounter*), a trailing period (*Any Means
   Necessary.*, *Everything was okay.*) and bold. It's now dropped.
4. **Heading 2 sections.** With the title dropped, a doc whose only headings
   are Heading 2 ("Part 1", "Part 2") is chaptered by them. This matches *Still
   Waters*; *Deafening Silence* is a decision for you (see below).
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

What did *not* need fixing: emphasis around dialogue spans. The 91 hand fixes
from October (`*[“…”]{X}*` → `[*“…”*]{X}`) were from an older converter. The
current one already styles inside each span.

## Decisions for you

- **Quote marks and emphasis.** The docx italicizes or bolds the quote marks
  along with the words, so the converter now writes `*“…”*`. The reviewed
  manuscripts are split: *Omg Zach's Gay, Shocker* moved the marks outside
  (`“*…*”`, 45×), while the Ravens trilogy and *Wes Romaw* kept them inside.
  Both render fine. Pick one if you care; it's a one-line rule either way.
- **"Part N" headings.** Should they be chapters (*Still Waters*) or sections
  within one chapter (*Deafening Silence*)? The converter currently promotes
  them when there's no other Heading 1.
- **Journal entry labels.** *Bellow's Journal*: "(After Episode N)" lines
  became chapters by hand. The converter leaves them as text with breaks
  between entries (33). A rule like "a parenthesized line followed by a gap
  is a chapter" is possible, but it's specific to this one story.
- **Existing stories in the DB.** These fixes don't touch the 35 stories
  already in the DB. Regenerating `md/stories/` from the docx would throw away
  the hand attributions and copyedits. The safe path is a **proposed patch per
  manuscript** that only inserts the detected `***` breaks (and splits the
  `Part` headings if you want), for review, followed by a re-import.

## Judgment calls left alone

- *Final Pummel*'s "Chapter 0: **Preface**" title and its rewritten bloopers
  line.
- The *Omg Zach's Gay* `(“*…*”)` thought-aside: the doc italicizes only the
  parentheses.
- Copyedits: dialogue-tag case, commas, `--` → `—`, "Touche" → "Touché",
  a backwards `”...”`.
