# Plan: in-app story import (Google Doc → shelf)

Goal: a contributor goes from a Google Doc to a published story entirely in the
web app. Today that takes two Python CLIs plus a hand-reviewed markdown file
in git (`archive-to-markdown/story-docx-to-md.py` → `md/stories/<slug>.md` →
`story-md-to-api.py --upload`). Feasible: both scripts are stdlib-only, run
without side effects, and total about 940 lines. The only interactive part is the
docx wizard (metadata plus a **text color → character** map). That becomes a
form.

## Shape

```
upload .docx ──▶ POST /api/stories/convert  (analyze: no map yet)
              ◀── { defaults: title/blurb/format, colors: [{hex, count, samples}], warnings }
form: metadata + color→character map
              ──▶ POST /api/stories/convert  (same file + map)
              ◀── { payload (story + chapters + lines), unresolved speakers, warnings }
preview (rendered with the real StoryReader components)
              ──▶ POST /api/stories/import  (exists; atomic, 409 on dup)
```

Conversion stays **stateless**. The browser keeps the file and re-sends it, so
there's no temp storage or cleanup on the server. The markdown step drops out
of the web flow: docx goes straight to the import payload. The preview takes
over markdown's job as the review format. "Download as markdown" can stay as
an export.

## Phases

1. **Port the converter to TypeScript in ff-server** (`src/story/convert/`).
   - Port both scripts as two pure functions:
     - `docxToManuscript(buf, meta) → md`
     - `manuscriptToPayload(md) → payload`
   - The web flow chains them. The split keeps the md→payload half
     golden-testable against the 37 existing `md/stories/*.md` →
     `api/stories/*.json` pairs, byte for byte.
   - The docx half needs sample `.docx` sources. Only one story has a saved
     meta (`meta/stories/still_waters.json`), so ask for a few real Google
     Docs exports, including a script-format one.
   - Libraries: `fflate` (unzip) and `fast-xml-parser` (DTD/entities off).
   - Security limits: 10 MB upload cap, a cap on total uncompressed size
     against zip bombs, and only `word/document.xml` + `styles.xml` read.
2. **Convert endpoint.**
   - `POST /api/stories/convert`, with the raw `.docx` body via
     `express.raw` (10 MB). Options go in the query/JSON (`?map=` or a
     multipart field; pick one).
   - Same auth as import.
   - Speakers resolve to characters with the same exact-name/alias logic
     `StoryImporter` uses now, moved server-side.
3. **Import wizard UI** (replaces today's "select a story .json" importer):
   1. Upload.
   2. Metadata (slug derived live via `lib/slug.ts`, authors, season,
      format, theme colors).
   3. Color table: swatch, sample lines, and a dropdown of character /
      display name / narration.
   4. Preview.
   5. Publish.

   The existing JSON upload stays as an "advanced" path for the CLI pipeline.
4. **Revisions (needed at go-live).** There's no line-editing UI, so
   re-importing a revised draft is the only way to fix a story.
   - `PUT /api/stories/:slug/import`: atomically replace chapters and lines,
     keeping the story id, slug and authors. Exclude the story itself from the
     content-hash check.
   - Save the color map and metadata on the story (`Story.importMeta Json`),
     so a revision skips the form and only asks about new colors.
   - Line deep links (`line_no`) can shift after a replace. That's acceptable,
     since no commentary hangs off story lines.
5. **Optional later: pull straight from Google.** Fetch
   `https://docs.google.com/document/d/<id>/export?format=docx` server-side
   for docs shared as "anyone with the link". That needs no OAuth, and the
   contributor just pastes the URL. The full Google Picker/Drive OAuth route
   is only worth it if private docs matter.

## Decisions needed

- **Who can import?** Today it's `isAdmin`. Contributors are `USER`. Options:
  - any logged-in user imports and is auto-credited as author, with
    replace/delete limited to the authors and admins (fits the existing
    creator-or-admin pattern); or
  - a contributor role.
- **Go live immediately, or draft → review?** `Story` has no status field. A
  `draft` flag (hidden from the shelf and search, visible to authors and
  admins) is cheap now and painful to retrofit.
- **Where does the source of truth live?** Today it's git markdown. With web
  import it becomes the DB, plus the stored `importMeta` and, optionally, the
  original `.docx` (a `bytea` or file column) so a story can be re-converted
  after converter fixes. Decide whether `md/stories/` keeps being maintained.
  An `export:stories` script could regenerate it from the DB.

## Fallback if the port slips

Shell out from ff-server to the existing Python with `--batch` and a temp
meta file. This needs `story-docx-to-md.py` refactored so its file paths are
arguments, and it needs `python3` on the NFSN host (unverified). It gets to
go-live faster but leaves two runtimes in production. I'd only do this as a
stopgap.

## Rough size

- Port + golden tests: about 1–1.5 days.
- Convert endpoint: half a day.
- Wizard UI: 1–1.5 days.
- Revisions + `importMeta`: about 1 day.
- Permissions/draft: half a day to 1 day, depending on the decisions above.
