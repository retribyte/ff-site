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
    "episodes": [
        { "file_name": "1", "episode_number": 1, "title": "…", "short_desc": "…" }
    ]
}
```

`file_name` matches the markdown basename, with or without its `NN-` prefix.

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

Short stories (and anything else that reads at `/stories`) have their own,
thinner pipeline — no meta files, no `/import` page:

```
markdown manuscript  ──story-md-to-api.py──▶  story JSON  ──--upload──▶  database
 md/stories/<slug>.md                          api/stories/
```

`python3 story-md-to-api.py md/stories/<slug>.md` converts;
add `--upload [--api http://localhost:3000/api]` to log in and POST the
story, its chapters, and bulk lines directly. Uploading aborts if the slug
already exists (delete the story via the API to re-upload a revision).

Story metadata lives in the manuscript's frontmatter (`slug` and `title`
required; `blurb`, `author`, `published`, `themeColor`, `themeColor2`
optional). Body format:

````
# Chapter 1: The Signal             "# Chapter N[: Title]" starts a chapter;
                                    no headings = one untitled chapter
A plain paragraph.                  NARRATION (one line per paragraph)
> Emmett: line                      DIALOGUE by Emmett
> ?: line                           DIALOGUE, unknown speaker
_action line_                       ACTION (a choice, CYOA-style)
```transcript … ```                 one TRANSCRIPT line (VCOMM fragment);
                                    interior blank lines = paragraph breaks
***                                 BREAK (scene break)
````

At upload, dialogue speakers are resolved against `/characters` (exact name,
then aliases); unmatched names are kept as display-name fallbacks and listed
in a warning. The `author` frontmatter is matched against the uploader (or
the user list, when uploading as an admin).

## Sanity check

Converting `md/ff2/*.md` reproduces the seeded database exactly: 21,741
messages across 22 episodes, and episode 1 matches the live API
message-for-message (verified 2026-07-04). Episodes 23–25 have markdown but
were never published — fill in their `meta/ff2.json` entries to import them.

Legacy scripts kept for reference: `md-to-json.py` (old ff-site asset
format), `cyoa.py`, `time-calculator.py`, `word-counter.py`.
