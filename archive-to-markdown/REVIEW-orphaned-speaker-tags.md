# Orphaned speaker tags — root cause

**Status: fixed, corpus-diffed, not reseeded.** Follow-up to
`ff-server/FF4-orphaned-speaker-tags.md`
(12 FF4 messages that are just `CharacterName:` with the real line either
unattributed or misattributed on the next row). Traced each of the 12 against
the raw Discord export it came from. Three separate, unrelated bugs in
`discord-json-to-api.py` converge on the same surface symptom — none of them
is the previously-fixed `SPEAKER_PREFIX` space-after-colon bug (Group B of
`REVIEW-finale-sanya-morra-attribution.md`).

## Bug 1 — `MULTILINE_CODE` mispairs backticks across unrelated lines (7 rows)

`split_multiline_spans()` runs this regex over a message's *entire* raw text
before splitting it into lines:

```python
MULTILINE_CODE = re.compile(r"(`{1,2})([^`]*\n[^`]*?)\1")
```

Intent (per its own docstring): rewrite a single inline code span that itself
spans a line break — `` `line one\nline two` `` — into one wrapped span per
line. But the regex has no way to know whether the backtick it just matched
already *closed* a complete, single-line span earlier in the message. When a
message is several independent `Name: `"quote"`` lines back-to-back —
Tawfeek Residence's actual raw text:

```
Squina: `"Squolo asleep?"`
Emmett: `"Yeah."`
Squina: `"I brought some drinks, despite this buffoon crashing our ship who knows where."`
Emmett: `"Thanks Squi."`
```

— the regex greedily pairs the **closing** backtick of one line's span with
the **opening** backtick of the *next* line's span, because the text between
them (`` ` ``...`\nEmmett: `...`` ``) is backtick-free and contains a
newline, which is all the pattern requires. Confirmed by running
`split_multiline_spans()` directly on the raw content:

```
'Squina: `"Squolo asleep?"\n`Emmett:`"Yeah."\n`Squina:`"I brought some drinks...\n`Emmett:`"Thanks Squi."`'
```

Line 2's closing tick is gone; line 3 now opens with a stray backtick that
wraps only `Emmett:`, leaving `"Yeah."` outside any span. Downstream:
`Emmett:` becomes its own fake code span (`` `Emmett:` `` → classified as a
QUOTE, inheriting whatever character was already active — Squina, from the
line above), and `"Yeah."` — no longer wrapped, `quote_ctx` never set —
falls through to `OTHER` with `character = None` (by the deliberate
"OTHER never carries the ambient PC" rule in `emit_line`).

Same mechanism, worse fallout, on a longer run (Crashlanded, converted #990,
raw one message):

```
John: `"I see you didn't learn your lesson Zacharias... What did I say about talking?"`

`Enough to know that I don't have to listen to you!`

*John gets angry*

John: `"You brat!"` *He starts walking over to Zach*
```

The regex spans from the first quote's closing tick all the way to the
*second* `John:`'s opening tick — swallowing the `*John gets angry*` ACTION
line whole and re-wrapping it in backticks along the way. That's why
converted #989 shows "John gets angry" as a **QUOTE** instead of an ACTION —
same bug, different visible symptom.

**Affected rows:** Tawfeek Residence #98, #100, #102, #118, #142; Crashlanded
#953, #990. (7 of 12)

**Proposed fix (not applied):** replace the whole-text regex sub with a
per-line backtick-parity scan — carry an "inside an unclosed span" flag
forward only when a line has a genuinely *odd* number of backticks, instead
of letting any two backtick occurrences in the message pair up across
however many intervening lines. Corpus-wide change; needs the same
full-corpus dry-run diff discipline as the Group B fix before reseeding.

## Bug 2 — `SPEAKER_PREFIX` is anchored to line start (3 rows)

```python
SPEAKER_PREFIX = re.compile(r"^([A-Za-z0-9][A-Za-z0-9 .,'\-]{0,29}):\s?(.*)$")
```

Only fires when `Name:` is the *first* thing on the line. Several players
wrote the override mid-line, after an action clause, in one message:

```
*Big points a gun at Zach and speaks with a high pitch voice.* Big: `"Pay attention."`
*Emmett sounds a bit annoyed.* Emmett: `"Starting to have second thoughts here...`"
*Chilzor transforms into an augmented KYL Model.* Chilzor: ``INITIATING KILL MODE. I MEAN, "DETAIN" MODE.``
```

Since `Name:` isn't at column 0, `SPEAKER_PREFIX` never matches. The line
instead goes through plain segment tokenization: the ACTION span classifies
fine, the middle unwrapped text (`Big:` / `Emmett:` / `Chilzor:`) comes out
as a bare `OTHER` fragment (no override → no `quote_ctx`), and the trailing
backtick-wrapped quote — still correctly wrapped this time — gets emitted as
a QUOTE, but attributed to whatever `character` was already ambient (the
player's own default PC: Vec for Zander, Dutch Elkins for Silas), because
the override that should have retargeted it never ran.

**Affected rows:** Crashlanded #490 (Big), Event Horizon #536 (Emmett),
Sir This Is A Chilzor's #569 (Chilzor). (3 of 12)

**Proposed fix (not applied):** after tokenizing a line into segments, if the
first *unwrapped* segment matches `SPEAKER_PREFIX` in its own right (name
followed by `:`, nothing else of substance before it), apply the override to
the segments that follow it within that same line — not just when the whole
line matches from character 0.

## Not a parser bug — abandoned tags (2 rows)

Marv Attacks! #327 (`Joker:`, Zander) and Sir This Is A Chilzor's #556
(`Chilzor:`, Trey) are each their own **standalone raw Discord message**,
with nothing resembling the named character's line ever following. In both
cases the very next raw message is unrelated content from a *different
player* (Trey's own aside "Petty w/ a prior"; Silas voicing his own PC Dutch
Elkins's startled reaction) — not a continuation that got mis-split. These
read as the player starting to type a line as that character and either
abandoning it or having someone else jump in first. Nothing to reattach —
recommend just dropping these two rows (or leaving them; they're inert
either way), not touching the fix above.

## Summary

| Bug | Rows | Root cause | Fix scope |
|---|---|---|---|
| 1 | 7 | `MULTILINE_CODE` pairs backticks across unrelated lines | corpus-wide regex/logic change |
| 2 | 3 | `SPEAKER_PREFIX` requires `Name:` at line start | corpus-wide logic change |
| — | 2 | Genuinely abandoned tags, no bug | drop the 2 rows, no code change |

Both code fixes are corpus-wide (same class of change as the earlier Group B
fix), so before reseeding: regenerate `api/ff4/*.json` from the raw exports
with each fix applied individually, diff against the current (unfixed)
output, and confirm every changed line is one of the 10 (7+3) identified
here — or a clear same-bug instance elsewhere in the 24-episode corpus — with
no unrelated collateral changes, same discipline as the prior reviews in
this directory.

## Resolution

Both fixes implemented in `discord-json-to-api.py`:

- **Bug 1**: `split_multiline_spans()` rewritten from a whole-text
  `MULTILINE_CODE.sub()` regex to a left-to-right tick tokenizer
  (`TICK_RUN`) that pairs backtick runs strictly 1st-with-2nd,
  3rd-with-4th, ... — a tick already consumed as one line's *closing* tick
  can never be re-examined as a new span's opener, which is exactly what
  let the old regex reach across unrelated lines.
- **Bug 2**: `classify_line()`'s mixed-segment loop now recognizes a bare
  `Name:` segment (tokenized with an empty remainder) immediately followed
  by a wrapped span as a mid-line speaker override — same "remainder is
  markdown-wrapped" signal the line-start check already used, just applied
  per-segment instead of requiring the name at column 0.

**Full-corpus dry-run diff** (all 24 FF4 episodes, `git stash`-free — ran
`discord-json-to-api.py ff4` against the raw exports before and after,
diffed every episode's message array):

14 of 24 episodes are byte-identical, untouched. **10 episodes changed**,
all traced to one of the two bugs above — including several instances
*outside* the original 12-row list, because Bug 1 in particular doesn't
require a `Name:` tag to bite: any run of same-episode `` `quote` ``
lines separated by a bare narration/action line was vulnerable, whether or
not a speaker override was involved. Spot-checked every changed episode
against its raw export; representative confirmed fixes beyond the
original list:

- **Wrong Answer** (4 spots) — e.g. raw `` `Uh, guys?` *Bellow pulls the
  fungo off his shoulder* `Why is he duplicating?` `` had the ACTION
  clause swallowed into a bogus QUOTE and the second line's real quote
  orphaned; no name tag involved at all, pure Bug 1.
- **Rumble Baby** (raw msg with `Dwarf: `"...quote..."`` / *actionline* /
  `Dwarves `"...quote..."`` — note the **second** `Dwarves` is missing its
  colon in the original message, a genuine player typo, not this bug) —
  Bug 1 correctly recovers the swallowed ACTION line; the untagged
  `Dwarves` fragment correctly stays unattributed since there's still no
  `:` for either fix to key off. Confirms the fixes aren't overreaching
  into typo-correction territory.
- **Event Horizon** (2nd spot, unrelated to the Emmett case) — a 4-line
  message (`` `Ok!` *action* / .... / *action* `Uh... Dutch?!` ``) where
  the bare `....` aside is now correctly `OTHER`/unattributed instead of
  wrongly wrapped into a QUOTE.
- **Mutiny, Don't Weld Yourself, Ambush, Finale** — same ACTION-swallowed
  /quote-orphaned shape, always a narration or action line sitting between
  two backtick-quoted lines in one multi-line message.
- **Crashlanded** also turned up one Bug-2 instance not in the original
  list: raw `LCM: `"Be gone, you."`` embedded mid-line after an action
  clause, previously falling back to Vec (Zander's own PC); now correctly
  attributed to LCM.

No changed line, across all 10 episodes, fell outside the two bug
mechanisms — no unrelated collateral changes. `api/ff4/*.json` (generated,
gitignored) now holds the fixed conversion; a pre-fix baseline is saved
alongside it in `api-baseline/ff4/*.json` for reference.

**Not yet done:** reseeding Postgres. `ff-site/CLAUDE.md` flags
`npm run seed` as never-casually-run since it wipes user-authored content —
that step needs an explicit go-ahead separate from this diff pass.
