# Buzzcut identity audit — Zander's second FF4 character

**Status: implemented, applied.** See "Resolution" at the bottom. Zander plays two characters
concurrently across FF4: Vec (his registered `cast` default from episode 2
on) and a second PC who spends "Goblinators" without a name at all, briefly
tries on "X-ander" mid-episode, settles on "Buzzcut" by the end of
"Goblinators", and carries that name through at least "Don't Weld Yourself".
Requested scope was Goblinators (ep 12) → Crashlanded (ep 16); checked one
episode past that too since the same bug pattern kept appearing.

Two separate problems, found by searching Zander's FF4 messages ep 12–17 for
`bee emmett`, `clone`, `\bBE\b`, `emmett`, and `buzzcut`, then checking every
hit's current attribution against the raw Discord export.

## Problem 1 — the character is fragmented across 4 rows

| Character row | id | Messages | Episodes | What it actually is |
|---|---|---|---|---|
| `BE` | 3564 | 43 (all QUOTE) | 12 only | Pre-naming identity, correctly parsed via `BE:` tags |
| `X` | 3539 | 3 (all QUOTE) | 12 only | One-line "X-ander" naming attempt, mid-scene |
| `Buzzcut` | 3577 | 36 | 15–16 | Settled name, from "Sir, This Is A Chilzor's" on |

**Correction, checked before touching anything:** a fourth row, `Bee Emmett`
(id 3568), looked like dead weight at first glance (0 FF4 messages) and my
first draft of this doc said so. It isn't — it's a real, distinct **FF2**
character (53 messages, "Take Two," a robotic wasphive-styled being).
Zander's FF4 narration ("Bee Emmett gets the ship started...") and Buzzcut's
own line ("I'm not the real Emmett, am I?" / "a clone of someone else") are
an in-fiction *reference* to that FF2 character, not a reuse of the same
Character row — the FF4 pipeline already created its own separate `BE` row
rather than colliding with it. `Bee Emmett` (3568) is untouched by anything
below.

The naming happens on-screen, in order, all within Goblinators:

```
1020 BE    "I need a different name. Something more meaningful to me as a clone of someone else."
1029 BE    "I want to be named X-ander. Call me that from now on."
1033 X     "Fine. Two syllables is better anyways."
1040 X     "Well. Actually, Buzzcut doesn't sound too bad. Has a nice ring to it, albeit offensive."
1043 X     "As Seth says, who the fuck cares. It's Buzzcut."
```

`BE`'s 43 QUOTE lines and `X`'s 3 QUOTE lines are all *correctly parsed* —
they just landed on their own separate `Character` rows instead of being
recognized as earlier names for the same PC who becomes `Buzzcut`. Same
fragmentation shape as the "S" → Sanya Dreadflower merge from
`REVIEW-finale-sanya-morra-attribution.md` Group C, and the "Fungus" → Vec
alias already in `NAME_ALIASES`.

## Problem 2 — narrated (untagged) action lines default to Vec

Every one of Buzzcut's own **spoken** lines (`BE:`, `Buzzcut:` tags) is
attributed correctly. But when Zander narrates what Buzzcut/Bee Emmett
*does*, in third person, with no `Name:` tag at all, it falls through to
`character = cast_character(...)` — Zander's registered default, Vec — the
same way Hunt520's untagged Jack Madison lines needed the scoped
`JACK_LINES` / `TERRY_CHILZORS_LINES` treatment in
`REVIEW-hunt520-terry-zach-jack.md`.

Confirmed this really is a tagging inconsistency, not a parser bug: when
Zander *does* tag it (Crashlanded raw msg 759 — `` Buzzcut: *Pulls a Bellow
and starts to breakdance.* ``), it already comes out correctly as `ACTION
Buzzcut`. He just doesn't tag most of them.

Every misattributed line found has Buzzcut/Bee Emmett as its own
grammatical subject — a plain "line starts with `Bee Emmett`/`Buzzcut`"
rule (scoped to `player == "Zander"`, same episode-scoping style as the
Jack Madison rules) would catch all of them and nothing else — but see
"Resolution" below for why this ended up hand-listed in a seed script
instead of a text-matching rule in the converter. 31 lines found, all
currently `ACTION`/`Vec`; 29 confirmed and reattributed, 2 left alone:

**Goblinators (10):** #379, #388, #434, #615, #693, #786, #842, #906, #978,
#1019 — "Bee Emmett gets the ship started...", "...launches the ship...",
"...realizes the problem...", "...gets woozy and pukes.", "...is on the
floor, sobbing.", "...has a depressed look.", "...just sits under the
console, sad.", "He gives Bee Emmett the seat." *(subject is "He" — worth a
second look, see below)*, "...looks over the controls...", "...was quiet,
listening to MC."

**Sir, This Is A Chilzor's (16):** #105, #254, #307, #347, #393, #460,
#488, #494, #542, #563, #658, #680, #833, #845, #859, #884 — all "Buzzcut
[verb]..." action lines (crossbow work, holding Seth's leg, climbing,
grabbing a Duckett, flying, reaching the door, etc).

**Crashlanded (4):** #30, #134, #242, #945 — "Buzzcut is browsing the
Holonet...", "...starts to lift off the floor...", "A box is flipped over
Buzzcut..." *(subject is "A box", not Buzzcut — see below)*, "...is
sleeping on Seth's shoulder."

**Don't Weld Yourself (1, just past the requested range):** #15 — "Buzzcut
is frozen; Seth has been trying to collect firewood to thaw him out...".

Two lines flagged above don't cleanly fit a "starts with the name" rule and
need a look before deciding: **Goblinators #906** ("He gives Bee Emmett the
seat.") — Bee Emmett is the *object* here, someone else is the subject, so
this might correctly stay Vec/narrator rather than move to Buzzcut. **Crashlanded
#242** ("A box is flipped over Buzzcut, who is in the dark.") — same
shape, Buzzcut is the object of the sentence. Recommend leaving both on Vec
unless you read it differently — happy to move them if you disagree.

## Correctly excluded (false positives from the keyword search)

- **Tawfeek Residence**, all 9 hits — this episode is about the *real*
  Emmett Tawfeek (Zander's own PC's father), nothing to do with Buzzcut.
  Already attributed correctly (mostly Vec-as-narrator, one `Emmett
  Tawfeek` QUOTE).
- **Sir, This Is A Chilzor's #419** ("Dutch could probably make out Seth
  and Emmett's signatures.") — real Emmett again, unrelated.
- **Sir, This Is A Chilzor's #817** ("Seth gets onto the ship but manages
  to drop Buzzcut by accident.") — Seth is the subject; correctly stays
  Vec-as-narrator.
- Every QUOTE line where another player's character *addresses* Buzzcut
  ("Buzzcut, turn on the porn" — Seth/Sean, "Someone get Buzzcut!" —
  Dutch/Silas, etc.) — already correctly attributed to the speaker, not
  Zander's problem.

## Resolution

Deliberately **not** done via `discord-json-to-api.py` (`NAME_ALIASES` /
a `FORCE_CHARACTER_CONTAINING`-style text rule), the way the earlier
identity fixes (Fungus→Vec, S/Dread→Sanya Dreadflower, Jack Madison, Terry)
were. Zander plays Vec *in these same episodes* — a corpus-wide or even
episode-scoped text-matching rule that reattributes "player X, line
matching Y" can't distinguish "Buzzcut is the subject of this line" from
"Vec is the subject and Buzzcut is incidentally mentioned" robustly enough
to trust unattended, and a false positive there would silently reattribute
a genuine Vec line. Handled instead as a new, idempotent post-import seed
script — same shape as `seed-vec-personas.ts`, which already does exactly
this for Vec's own era names (Llafay Terres, Fungo, Fursean, Marv, Sascha)
via explicit `(episodeTitle, messageNo)` ranges, not text matching:

- **`ff-server/prisma/seed-buzzcut-persona.ts`** (new) — reclaims the 43
  `BE` and 3 `X` messages onto `Buzzcut`; reattributes the 29 hand-confirmed
  untagged action lines (listed above, minus Goblinators #906 and
  Crashlanded #242) from `Vec` onto `Buzzcut`; creates a `Persona` row
  (`name: "Bee Emmett"`, `label: "unnamed clone"`) on the `Buzzcut`
  character and stamps it onto every Goblinators message before the raw
  naming-reveal line (converted #1043, "It's Buzzcut.") — that line itself
  and everything after stays canonical `Buzzcut` (`personaId: null`).
- Wired into the seed pipeline: added to `SEED_SCRIPTS` in `prisma/seed.ts`
  (runs right after `seed-vec-personas.ts` on every full `npm run seed`),
  and a matching `npm run seed:buzzcut-persona` standalone entry in
  `package.json`.
- Ran standalone against the live DB (no full reseed needed — the raw `BE`/
  `X`/`Buzzcut` import from `seed-legacy.ts` was already correct, this only
  needed the persona/reattribution layer on top). Verified: `BE`/`X` now
  have 0 messages each (left in place, unmapped — same as how
  `seed-vec-personas.ts` leaves the emptied `Llafay Terrels` row rather
  than deleting it); `Buzzcut` went from 36 → 111 messages; `Vec`'s own FF4
  count is unchanged at 2402. Spot-checked the two excluded lines
  (Goblinators #906, Crashlanded #242) — still `Vec`, as intended. Spot-
  checked the persona boundary — #1019/#1020/#1029/#1033/#1040 all carry
  the `Bee Emmett` persona, #1043 ("It's Buzzcut.") carries none.

**Naming call made without asking first, easy to revise:** persona
`name: "Bee Emmett"` rather than "Clone of Bee Emmett" — it's what the
character calls himself in-line ("I'm not the real Emmett, am I?") and
what Zander's own narration consistently uses, and `Persona.name` is what
actually renders in the transcript per the schema comment (`label` is
admin-only, set to "unnamed clone" there instead). One line each in
`seed-buzzcut-persona.ts` to change if you'd rather it read differently.
