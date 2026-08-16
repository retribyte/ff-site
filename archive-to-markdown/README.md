# archive-to-markdown

Pipeline for turning Discord session exports into archive episodes. Copied
from the legacy `ff-site` repo; `md-to-api.py` and `meta/` are the new,
API-era additions.

## The pipeline

```
DiscordChatExporter HTML  ──ff2.py / ff3.py──▶  markdown  ──md-to-api.py──▶  episode JSON  ──/import page──▶  database
        ff-archive/                              md/<season>/                 api/<season>/
```

1. **HTML → markdown** — `ff2.py` / `ff3.py` (need `beautifulsoup4`; make a
   venv). Per-season scripts because Discord usernames and export quirks
   changed between campaigns. For a new season, copy `ff3.py` and adjust its
   selectors — the username/cast maps now live in `meta/`, not the script.
   The markdown is the *editing* format: fix typos, reattribute lines, trim
   table talk there.

2. **markdown → episode JSON** — `python3 md-to-api.py` (stdlib only).
   Run it **without arguments for the interactive wizard**: it walks through
   season (existing or scaffolds a new meta file), markdown file, episode
   number, title, and short description, saves the answers back into
   `meta/<season>.json`, and converts. Or batch:
   `python3 md-to-api.py <season> [file.md ...]` converts every episode
   already titled in the meta file. Output lands in `api/<season>/`
   (gitignored).

3. **upload** — log in as an admin on the site and feed the JSON to
   `/import`. It resolves player/character names against the database (with
   manual mapping for anything unknown), creates the season/episode if
   needed, and bulk-posts the messages.

## meta/<season>.json

```jsonc
{
    "seasonTitle": "FF3",              // Season.title in the DB
    "usernames": { "Trey Moment": "Trey" },  // Discord author → player
    "bots": ["FFBot"],                 // players whose lines are BOT_RESPONSE
    "cast": {
        "Brody": { "1": "Serpile", "5": "Bail" }  // character from episode N onward
    },
    "personaTimeline": {                 // optional; character name -> ordered spans.
        "Vec": [                         // real ff4.json entries -- see PLAN-persona-timeline.md
            { "from_episode": 2, "persona": "Fungus" },   // starts at ep2's top, no anchor needed
            { "from_episode": 11, "persona": null }       // self-naming revert to canonical "Vec"
        ]
        // a mid-episode start would add "anchor_contains": "<snippet>" --
        // verify against the raw export first; most of a lore doc's stated
        // host/appearance changes turn out to be narration, not actual
        // `Name:` overrides in the transcript (confirmed for Vec's other
        // hosts -- Argonian, Llorpus, etc. -- which needed no entry at all)
    },
    "episodes": [
        {
            "file_name": "1", "episode_number": 1, "title": "…", "short_desc": "…",
            "messageBlacklist": [12, 88, 90]  // optional; see below
        }
    ]
}
```

`messageBlacklist` (optional, `discord-json-to-api.py` only) drops table talk
/ OOC lines from a direct Discord-JSON import without editing the source
export. Entries are **messageNo** — 1-based position in that episode's
*converted* output (after system messages are dropped and multi-span lines
are expanded), i.e. the same numbering as `GET
/episodes/:title/messages/:messageNo` and the DB's `messageNo` column — not
raw position in the Discord export. It only omits entries from the emitted
episode JSON; the export file itself is never modified. Out-of-range entries
are logged as a warning and ignored (a sign the list may be stale against a
pipeline change) rather than failing the conversion.

`personaTimeline` is keyed by **character**, not player, and is separate
from `cast` on purpose: `cast` tracks which character a player voices, at
episode granularity (every confirmed swap lands on an episode boundary);
`personaTimeline` tracks which *persona* of that character is active, which
often changes mid-episode. A span with no `anchor_contains` starts at the
top of `from_episode`; one with `anchor_contains` starts at whichever
message contains that text (same content-match style as
`FORCE_CHARACTER_CONTAINING` in `discord-json-to-api.py`) — deliberately not
anchored to message position/number, which isn't stable. `persona: null` is
an explicit revert to the character's canonical presentation, not absence.

`file_name` matches the markdown basename, with or without its `NN-` prefix.

## Testing

`cast_character()` (both independent copies) and `PersonaTimeline` have
`pytest` coverage — `test_cast_character.py`, `test_persona_timeline.py`.

```
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
```

## Markdown message format

```
**Author** _(24-Jun-18 05:13 PM)_
plain line                          OTHER
@Magic8Ball … / t!… / 8ball …       COMMAND
> spoken line                       QUOTE (current character)
> `Name`: line                      QUOTE as Name (always trusted)
> Name: line                        QUOTE as Name (only if Name is in the cast)
_action line_                       ACTION (same `Name`: override)
<embed><description>…</description></embed>   EMBED (sections become JSON)
```

A speaker override sticks for the rest of the block. Bare `(edited)` lines
are dropped. Quotes that end up with no character import as OTHER (FR-MSG-4).

## Stories

Short stories (and anything else that reads at `/stories`) have their own
pipeline — no `/import` page:

```
Google Doc  ──File ▸ Download ▸ .docx──▶  story-docx-to-md.py  ──▶  markdown manuscript
                                           meta/stories/<slug>.json   md/stories/<slug>.md
markdown manuscript  ──story-md-to-api.py──▶  story JSON  ──--upload──▶  database
 md/stories/<slug>.md                          api/stories/
```

### Google Docs → markdown

FF stories color-code dialogue, and the ink color is often the only clue to
who is speaking. Of Google's export formats only `.docx` both preserves text
color and parses without dependencies, so that's the input:
`python3 story-docx-to-md.py <manuscript>.docx`.

The first run is a wizard: it prompts for story metadata (title/slug/blurb
default from the doc's Title and Subtitle styles), a `format` (`script` or
`prose` — see below), and shows each distinct text color with sample lines so
you can name the speaker — an empty answer means "narration ink, not a voice".
Answers are saved to `meta/stories/<slug>.json` and reused; `--batch --slug
<slug>` re-converts non-interactively and fails with a report if the title,
format, or any color is missing.

**`script` vs `prose`.** In `script` stories (e.g. Vortox Machina) narration
and dialogue are written as separate whole paragraphs. In `prose` (novel-style)
stories dialogue is embedded inside narration paragraphs — `The man stood up,
"I have something to say," he said.` with only the quote colored. Set
`format: prose` and a mixed paragraph converts to a single narration line with
inline `[spoken]{Speaker}` spans instead of being split into comma-fragment
lines. The reader colors each span and shows a voice legend.

How a Doc is read:

| in the Doc | becomes |
|---|---|
| Title / Subtitle styles | frontmatter `title` / `blurb` defaults |
| Heading 1 | chapter break (`Chapter N: ...` numbering honored) |
| Heading 2 | **prose:** `## Title` in-chapter heading · **script:** another chapter break |
| paragraph wholly in a mapped color | `> Name:` dialogue line (a typed `Name:` prefix is stripped) |
| colored span inside a paragraph | **script:** paragraph splits into narration + dialogue lines · **prose:** kept in one paragraph as an inline `[span]{Speaker}` |
| italic / bold run | **prose:** `*italic*` / `**bold**` emphasis, kept inline (nests inside dialogue spans) · **script:** flattened |
| wholly italic paragraph | **prose:** italic narration · **script:** `_action_` line |
| consecutive monospace paragraphs | one ```` ```transcript ```` block |
| horizontal rule, `***`, `- - -` | `***` scene break |

Underline and other inline formatting is flattened to plain text. Always review
the generated markdown before uploading — in `script` mode, prose-style
paragraphs leave their dialogue tags ("...Vex said.") as small narration
fragments you may want to merge or trim (or switch the story to `prose`).

`python3 story-md-to-api.py md/stories/<slug>.md` converts;
add `--upload [--api http://localhost:3000/api]` to log in and POST the
story, its chapters, and bulk lines directly. Uploading aborts if the slug
already exists (delete the story via the API to re-upload a revision).

Story metadata lives in the manuscript's frontmatter (`slug` and `title`
required; `blurb`, `author`, `published`, `themeColor`, `themeColor2`, `format`
optional — `format` defaults to `script`). Body format:

````
# Chapter 1: The Signal             "# Chapter N[: Title]" starts a chapter;
                                    no headings = one untitled chapter
## The Descent                      in-chapter HEADING line (prose sub-sections)
A plain paragraph.                  NARRATION (one line per paragraph)
> Emmett: line                      DIALOGUE by Emmett
> ?: line                           DIALOGUE, unknown speaker
The lock clicked. ["Move,"]{Emmett} she hissed.
                                    NARRATION with an inline dialogue span —
                                    [spoken]{Speaker}. Stays ONE line; the
                                    span is colored by speaker in the reader.
A *whispered* word, a **shout**.    inline emphasis: *italic*, **bold**,
                                    ***both***; works inside dialogue spans too
_action line_                       ACTION (a choice, CYOA-style)
```transcript … ```                 one TRANSCRIPT line (VCOMM fragment);
                                    interior blank lines = paragraph breaks
***                                 BREAK (scene break)
````

Inline `[spoken]{Speaker}` spans and `*emphasis*` work regardless of `format` —
the segment texts concatenate verbatim (markers stripped) back to the
paragraph's prose, so the server stores the clean paragraph in `text` with the
spans/styling as annotations.

At upload, dialogue speakers — whole `> Name:` lines and inline `[…]{Speaker}`
spans alike — are resolved against `/characters` (exact name, then aliases);
unmatched names are kept as display-name fallbacks and listed in a warning. The
`author` frontmatter is matched against the uploader (or the user list, when
uploading as an admin).

## Sanity check

Converting `md/ff2/*.md` reproduces the seeded database exactly: 21,741
messages across 22 episodes, and episode 1 matches the live API
message-for-message (verified 2026-07-04). Episodes 23–25 have markdown but
were never published — fill in their `meta/ff2.json` entries to import them.

Legacy scripts kept for reference: `md-to-json.py` (old ff-site asset
format), `cyoa.py`, `time-calculator.py`, `word-counter.py`.
