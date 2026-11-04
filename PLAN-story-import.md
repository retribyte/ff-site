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

## Progress (2026-11-03, branch `story-docx-import`, both repos)

Neither repo is merged to `main` or pushed. `main` (with `mvp-lockdown` and
`slug-transliterate`) is merged *into* this branch in both repos.

**Done**
- **Python converter fixed** against the 23 Drive docx that have reviewed
  manuscripts (`archive-to-markdown/REVIEW-docx-conversion.md`):
  - scene breaks
  - soft breaks
  - the title line
  - heading levels
  - Google horizontal lines
  - quote marks outside spans and emphasis
  - link text
  - monospace body
  - blank segments
  - frontmatter `#`
- **Manuscripts:** 17 patched on the branch.
- **Dev DB:** 18 stories re-imported. Text was verified unchanged against a
  pre-write snapshot.
- **ff-server:**
  - `PUT /stories/:slug/import` (atomic revision), plus `chapter_no` 0 now
    allowed (`main` still rejects it).
  - `src/story/convert/{py,manuscript,docx,index}.ts`: a TypeScript port of
    both scripts. `npm test` is golden-tested: 69 tests, all 37 manuscripts
    and all 23 docx, byte for byte.
  - `POST /stories/convert`: analysis, or `{payload, markdown, warnings}`.
    Admin-only, writes nothing.
- **ff-site `/import` (wired, verified end to end):**
  - The Google Doc form (`DocxStoryForm`) is the main path. The CLI `.json`
    upload sits under an "advanced" `<details>`. Both go through one
    `loadPayload` + speaker resolution in `StoryImporter`.
  - The slug placeholder shows the live `slugify(title)`, which is what the
    server derives when the field is blank.
  - On a slug collision, Upload becomes a confirm-style **Replace its text**
    (`DeleteControl`), calling `PUT /stories/:slug/import`. It keeps the
    title, blurb, authors and season. A title collision under another slug
    stays an error.
  - Verified with headless Playwright against an isolated dev pair: API
    :3100 and site :3101 on DB `final-frontier-docx`, restored from
    `pre-npc-personas-2026-11-03.dump` and using a minted admin JWT. The
    replace path keeps the story id. The create path makes a new story. The
    same text under a new title returns the server's 409 duplicate message.
    The JSON path still offers Replace. No sideways scroll at 390px, in both
    themes.

- **NPC voices (2026-11-03, user-designed):** a color that several NPCs share
  (gray `#666666` defaults to "several NPCs (name each line)") imports as
  unnamed NPC voices.
  - **Manuscript:** `{?}` / `> ?:`.
  - **Storage:** a segment `npc: true` / `StoryLine.npcVoice` (a new column,
    on `final-frontier-docx` only so far).
  - **Naming:** in the importer's optional modal (Enter carries a name to the
    next quote), or later by the story's authors or an admin, clicking the
    quote in the reader (`PATCH /stories/:slug/voices`, with an "also the next
    N unnamed" option).
  - **Cursors:** viewers get the `help` cursor and a name tooltip. Editors
    get a `pointer`, and unnamed quotes a dotted underline.
  - **Re-imports** keep names by text occurrence and skip placeholder voices
    such as the legacy "NPC" character.
  - **Verified** on Horizon Meets Dawn (163 NPC quotes) and two synthetic
    stories (prose and script) with Playwright, as anonymous, non-author,
    author and admin.

**Merge notes**
- When this merges after Beta's `npc-personas`: in
  `prisma/scripts/seed-npc-personas.ts`, add `npcVoice: false` to the
  `voicelessDialogue` count's `where`. Otherwise unnamed NPC DIALOGUE lines
  trip that assertion. Agreed with Beta.
- `StoryLine.npcVoice` needs a `db push` on whichever DB this lands on (it's
  additive), then `npm run db:search-indexes`.

**Done 2026-11-03 (branch `story-import-next`, both repos)**
- Vortox Machina's unknown voices seed as unnamed NPC voices
  (`vm-speakers.ts`), and the dev DB's 7 lines were converted.
- **Rendered preview**: `/import` renders the resolved payload with
  `StoryReader`'s `preview` mode, chapter by chapter, before the upload.
- **`Story.importMeta`**: a Google Doc import saves `{format, colors}`; the
  docx form pre-fills a revision's colors from it and marks new ones.
- **Pictures**: `IMAGE` lines point at booru.vortox.space posts (`booruId`,
  resolved to `imageUrl` at import). The converter emits `![alt](docx:N)`
  plus the picture bytes; the importer asks for each one's post number.
  Manuscripts write `![alt](booru:<post>)`.
- **Decisions (the user's)**: any member imports and is credited as an
  author; replacing a story's text is for its authors and admins; stories go
  straight to the shelf (no drafts) now that previews work; story NPC voices
  stay plain text, never NPC persona rows.

**Next**
1. **Picture backfill: manuscripts done.** Deafening Silence → post 118;
   Bellow's Journal → 1122–1126 (uploaded by the booru's `bot` account,
   `artist:plasmaperson`); Final Pummel → 1127 (the greyscale copy of 510,
   same tags). Each story's text on a DB is replaced through `/import` →
   advanced → the `story-md-to-api.py` JSON → **Replace its text**.
2. Deleting a story is still admin-only. Decide whether its authors may
   delete too.
3. Script format on a prose Doc fails with "chapter 1 has no lines" (seen on
   *Still Waters*). Pre-existing converter behavior: worth a clearer message.
