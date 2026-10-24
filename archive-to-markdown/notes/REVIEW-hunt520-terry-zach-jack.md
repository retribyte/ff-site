# Hunt520: Terry / Zacharias Smith / Jack Madison attribution

**Status: fully implemented and reseeded.** One structural bug fixed
(affected ~1200 lines), a second parser bug found and fixed along the way
(affected 35 other lines across Trey/Jonas/Brody, all pure improvements),
three characters resolved with meta info: Zacharias Smith, Terry, and Jack
Madison (slug `jack_madison`, confirmed auto-derived correctly).

All 8 previously-ambiguous lines were resolved by direct confirmation — see
"Resolution" at the bottom.

## The root bug

`meta/ff4.json`'s `usernames` dict had `"Hunt": "Hunt520"`, but Hunt520's
actual Discord nickname *is* `"Hunt520"` — that mapping never matched
anything, so `player` already resolved to `"Hunt520"` via the identity
fallback. The real problem was one level down: the `cast` dict's per-player
key was also `"Hunt"`, so `cast_character()` looked up `meta["cast"]["Hunt520"]`,
found nothing, and returned `None` for every one of his 972 messages,
always. Every unmarked line — which for a player's own PC is virtually all
of them, per the pattern already established for every other character this
session — silently had no character at all instead of falling back to his
PC.

Renamed the key to `"Hunt520"` in both dicts. Regenerated and diffed the
full 24-episode FF4 corpus before reseeding: **1003 changed lines, all of
them Hunt520's, nothing on any other player.** ~1200 lines moved from
`null` to Zacharias Smith.

## Cast dict

```json
"Hunt520": { "3": "Terry", "4": "Zacharias Smith" }
```
Confirmed: the anonymous elf pharmacist in "Ambush" who gives Bellow his
number is Terry's first appearance, before Zach's cast entry starts at
episode 4. Restored the `"3": "Terry"` entry (I'd initially dropped it and
left those 8 lines unattributed, since nothing in the scene itself names
her — flagged that as a guess rather than deciding silently, and it turned
out I had it wrong). All 19 emitted lines from that scene now correctly
resolve to Terry via the ordinary cast-list fallback, no scoped override
needed.

## Terry — implemented, high confidence

Terry turned out to be a recurring minor NPC (not a "1-2 lines and done"
character) with three scenes:
- **"Ambush"**: her debut, 19 emitted lines, via the cast-list default
  (see above).
- **Episode 6** ("Obligatory Shopping Episode"): 3 lines, already correctly
  tagged via explicit `Terry:` markers — unaffected by any of this, they
  worked before and still do.
- **"Sir, This Is A Chilzor's"**: a full scene. Zach explicitly leaves
  (`Zach walks back to the ship`), and Terry sits down with Bellow in his
  place — confirmed by Jonas naming her directly (`You might want to leave
  now, Terry.`) and Trey's narration (`Terry kisses Bellow on the mouth...`).
  14 lines, none carrying a `Name:` marker, several too generic to safely
  match anywhere else in the corpus (`May I sit?`, `Sorry can't help
  myself!`) — scoped to this one episode+player rather than matched
  globally.

36 lines total now resolve to `Terry`.

## Jack Madison — implemented, high confidence

Jack is Zach's fiance, introduced as a texting-only presence and later
appearing in person from "Don't Weld Yourself" onward — same secondary-PC
pattern as Sanya/Chomsky from the earlier Finale pass. Implemented via two
mechanisms, both scoped to Hunt520's own lines only:
- **Text message headers**: `*Text Message from Jack*` / `*Text from
  Jack*`, and the quote immediately following in the same raw message, are
  Jack's own texted words — 5 instances in "Crashlanded." (Scoped to that
  episode specifically, since the identical header text also appears once
  in "Don't Weld Yourself" wrapping something genuinely ambiguous — see
  below.)
- **Grammatical subject**: wherever "Jack" is the line's own subject
  (`Jack chuckles`, `Jack's eyes widen`, `Jack rushes in`, `Jack manages to
  get on board the mother ship`, etc.) — the same rule already used for
  Chomsky in the Finale. 24 lines across "Don't Weld Yourself," "Mutiny,"
  "Event Horizon," and the Finale, including his self-introduction
  (`"...it's nice to finally meet you though, Jack Madison by the way."`)
  and his full combat arc in the Finale.

30 lines total now resolve to a new `Jack Madison` character.

## Resolution

Confirmed directly, item by item:

**1–3.** All three "Message from Jack"-headed texts in "Don't Weld
Yourself" are **Zach's own words** — confirmed: Zach is texting from his
own phone, currently in Bellow's possession, using Jack's phone out in
space. Left on the ambient default (Zach), as originally guessed for #1
and #3 — #2 also confirmed Zach, resolving that one's uncertainty.

**4.** `"Oh?"` → Jack (Zach had left the room shortly before this line).

**5.** `"Oh, that's nice."` → left as Zach ("I don't know, let's just say
it's Zach").

**6.** `"Should I be here?"` / `"I'm comfortable though"` → both Jack, not
alternating as I'd guessed.

**7.** `"So... mission?"` / `*Zach nods*` / `"Well then..."` → confirmed as
guessed: Jack talks, Zach nods, Jack talks again.

**8.** `"I can do that!"` → Jack.

Implementing #4 and #6–8 surfaced a second, unrelated parser bug: two
adjacent single-line backtick quotes split across a raw Discord newline
(`` `a`\n`b` ``) were being misread by `split_multiline_spans()` as one
deliberate multi-line span whose "content" was just the newline itself —
consuming both real closing/opening backticks and downgrading both lines
to unattributed `OTHER`. This is why `"I'm comfortable though"` and
`"I can do that!"` were showing under the bare `Hunt520` player name with
no character at all rather than failing to match my rules — the character
override was firing, but the mangled line was typed `OTHER`, which
unconditionally nulls the character. Fixed in `split_multiline_spans()` by
leaving a match untouched when its captured "content" is empty. Diffed the
full FF4 corpus before reseeding: **35 more lines fixed for other players**
(Trey/Dr. Jorpa, Jonas/Bellow Brightlight, Brody/Morra) — every single
change was the same `OTHER`/no-character → `QUOTE`/correct-character
pattern, no regressions.

## Verification

Full-corpus content-aware diff before each reseed, confirming every
Hunt520-scoped change stayed isolated to Hunt520, and that the
`split_multiline_spans` fix only ever moved lines from unattributed `OTHER`
to a correctly-attributed `QUOTE` — never the reverse, never a wrong
character. Reseeded; character count 292 → 294 (`Terry`, `Jack Madison`).
Confirmed `Jack Madison`'s slug auto-derived correctly as `jack_madison`.
Spot-checked live via the API: the Ambush pharmacist scene, Jack's
Crashlanded texts, and his "Depends... who's asking?" phone line in Mutiny
all resolve correctly.

## Files touched

- `ff-site/archive-to-markdown/meta/ff4.json` — `usernames`/`cast` key
  fix, cast entries for Zacharias Smith and Terry.
- `ff-site/archive-to-markdown/discord-json-to-api.py` — `TERRY_CHILZORS_*`,
  `JACK_*`, `DONT_WELD_YOURSELF_*` constants and their wiring in
  `emit_line`; `split_multiline_spans()` fix for the adjacent-quote bug.
