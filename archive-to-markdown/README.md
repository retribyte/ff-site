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

2. **markdown → episode JSON** — `python3 md-to-api.py <season> [file.md ...]`
   (stdlib only). Reads `meta/<season>.json`, writes API-ready payloads to
   `api/<season>/` (gitignored). Episodes without a `title` in the meta file
   are skipped, so fill that in first.

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

## Sanity check

Converting `md/ff2/*.md` reproduces the seeded database exactly: 21,741
messages across 22 episodes, and episode 1 matches the live API
message-for-message (verified 2026-07-04). Episodes 23–25 have markdown but
were never published — fill in their `meta/ff2.json` entries to import them.

Legacy scripts kept for reference: `md-to-json.py` (old ff-site asset
format), `cyoa.py`, `time-calculator.py`, `word-counter.py`.
