# FF2 Transcript Editing Guide

Derived by diffing the oldest and newest git revisions of episode files in
this directory against the raw Discord export they originated from: five
randomly sampled files (`5-police-brutality.md`, `16-barrier-to-entria.md`,
`3-shady-business.md`, `9-pirates-vs-pummelers.md`, `22-dam-hooligans.md`,
§§1–3), plus a targeted follow-up on `20-rough-resurrection.md` and
`21-deep-space-famine.md` (§4) and on `ff2.md` itself, the pre-split master
document (§5). These files are auto-generated from `discord-exports/` by
`archive-to-markdown`'s conversion script, then hand-edited afterward. This
guide documents the conventions that hand-editing converged on, so future
passes (manual or scripted) stay consistent with existing episodes.

§§1–6 are derived from history — patterns found by diffing what past commits
actually did. §§7–13 are different in kind: they document a live editing
pass on `23-bark-and-bite.md` (2025), watched and then hand-corrected by
`retribyte` (Trey) directly, capturing decisions that don't show up in a
diff of raw-vs-edited text because they're about *judgment* — what to add,
what to cut, what to leave deliberately unclear. Treat §§1–6 as the floor
(every episode should have these) and §§7–13 as the next layer up — a
second pass, after the mechanical one, for an editor willing to spend more
judgment per line.

## 1. What's actually being edited

Two very different kinds of commits touch these files, and it matters which
kind you're doing:

- **Script/format regenerations** — large, mechanical diffs (hundreds to
  thousands of changed lines) from re-running the converter with improved
  logic. Content is preserved; only presentation changes.
- **Manual line edits** — small, surgical diffs (1–10 changed lines) fixing a
  specific wording, name, or continuity error a person noticed on read-through.
  Commit messages for these are often *under-described* — e.g. `3bb6134 "Fix
  another typo in 16"` actually deletes a duplicated dice-reroll block, not a
  typo. Don't trust the commit message's scope; read the diff.

Two known contributors show up across these commits: `retribyte` (the
original conversion + most content) and `Zander Preston` (later typo/format
passes, e.g. commits `8c0f889`, `3bb6134`, `544455d`). Multiple people have
hand-edited these files, so consistency with *existing* episodes matters more
than any single episode being internally perfect.

## 2. Formatting conventions (apply these when editing or converting)

### 2.1 Out-of-character bot commands and bot replies are never blockquoted

Discord bot commands (`t!8ball ...`, `t!choose ...`, `@Magic8Ball ...`) and
their replies (`🎱 | ...`) are OOC mechanics, not in-character speech. They
should be **plain text**, not `>` blockquoted.

```diff
- > t!8ball Does Hector wake up?
+ t!8ball Does Hector wake up?

- > 🎱 | Don't count on it,
- > MultiTheDuck
- > .
+ 🎱 | Don't count on it, MultiTheDuck.
```

The second half of that example is also a separate fix: the raw export
splits a bot's mention-embed reply across three lines (`reply,` / `Name` /
`.`). Collapse these into a single line: `🎱 | <reply>, <Name>.`

### 2.2 In-character spoken dialogue stays blockquoted

Lines a character actually *says* keep the `>` blockquote — this is the one
place blockquote is still correct:

```
> Wake up, sonny boy.
```

### 2.3 In-character actions/narration are italicized, third person, full sentences

Terse or fragmentary action shorthand from the raw chat log (`Shakes his
hand`, `Holds his hand out`) gets rewritten into a complete italicized
sentence naming the actor:

```diff
- > Shakes his hand
+ _Lucian shakes his hand._
```

### 2.4 Name the true in-character speaker/actor when it differs from the Discord header

A message header (`**Brakia** _(timestamp)_`) names the *Discord account*,
which is not always the *character* being portrayed (a player's PC, an NPC
voiced through their account, a ship AI, etc.). When they differ, prefix the
line with the character's name in backticks and a colon — inside the
blockquote for dialogue, inside the italics for action:

```diff
- _Serpile groans._
+ _`Serpile`: Serpile groans._

- > `Please take it back`
+ > `Serpile`: Please take it back.

+ _`Ottori Ringbearer`: The ringbearer holds an ear to the ground..._
+ > `Seth's Mother`: Oh, I do hope he doesn't try eating Morvalus Hallucinatus.
```

Note the colon is required (`8c0f889` exists solely to add a missing one) and
the backtick-wrapped name is the *character*, never the Discord username.

### 2.5 Drop failed/retried dice rolls once a usable result exists

When a player re-rolls a `t!8ball`/`t!choose` because the first result was
ambiguous ("Cannot predict now", "Reply hazy, try again"), delete the failed
attempt (both the repeated command line and its non-answer) and keep only
the roll that was actually acted on:

```diff
- t!8ball Is Emmett asleep in the lounge while half-naked?
- 🎱 | Cannot predict now, Zander.
- **Zander** _(03-Sep-18 02:14 PM)_
- t!8ball Is Emmett asleep in the lounge while half-naked?
- **Tatsumaki** _(03-Sep-18 02:14 PM)_
  🎱 | My reply is no, Zander.
```

### 2.6 Re-attribute misattributed multi-speaker blocks

The converter sometimes merges several people's rapid-fire messages under one
speaker's header. If a block contains lines that clearly belong to a
different, unlabeled character (dialogue self-introducing as "Deyner
Revathen" appearing under `**Bagelwrecker**`), split it into correctly
headered blocks for each real speaker rather than leaving it merged.

### 2.7 Continuity fixes: make the dice roll match what happens next

If the raw dice-roll answer contradicts the scene that follows (bot said
"no" but the action proceeds as if "yes"), correct the roll text to match the
narrative outcome that was actually played out — don't leave the
contradiction standing:

```diff
- > 🎱 | My reply is no, Arky.
+ > 🎱 | My reply is yes, Arky.
  **Arky** _(07-Oct-18 02:46 PM)_
  _Lucian emerges from the ship's busted cryosleep chamber..._
```

### 2.8 Drop dangling/truncated fragments

If the raw export contains a message that was cut off mid-thought and never
completed (e.g. a lone `> Okay, th`), remove it rather than leaving a broken
fragment in the transcript.

### 2.9 Minor mechanical cleanup

- Capitalize and punctuate OOC questions: `does Iris wake up` → `Does Iris
  wake up?`
- Normalize mid-sentence verb capitalization in action lines: `_Jim Uses
  right arm..._` → `_Jim uses right arm..._`
- Fix Discord username capitalization typos where they recur: `RPRetribution`
  → `RPretribution`.
- Replace stray first-person phrasing left over from a player typing as
  themselves with the character's name: `@Magic8Ball Do I go to sleep?` →
  `@Magic8Ball Does Seth go to sleep?`
- Add periods/exclamation points to bare dialogue fragments that read as
  cut off: `Please take it back` → `Please take it back.`

## 3. Prose/voice guidelines for added or rewritten narration

New or rewritten action lines (see §2.3, §2.7 examples, and the larger
additions in `22-dam-hooligans.md`) consistently follow this voice:

- **Third person, present tense**, one beat per sentence.
- **Concrete, sensory, physical detail** over abstraction — what a body or
  object does, not how a character feels in the abstract (`_Iris feels her
  head, it patched up by Hector while she was asleep._` rather than "Iris
  wakes up in pain").
- **Comedic/irreverent tone is preserved, not smoothed over** — vulgar,
  absurd, or juvenile beats from the actual session (bodily fluids, in-jokes,
  crude asides) are kept and sometimes even elaborated on, not censored for
  politeness. (One commit, `c1dbed0`, is explicitly labeled a "censor" pass —
  if you're doing a content-sensitivity edit, treat it as the exception, not
  the norm; it targeted specific content, not blanket tone-softening.)
- **Willing to run long lists/clauses for comic effect** — e.g. an inventory
  dump joined with semicolons and a deliberately anticlimactic tail item
  ("...beans, corn, and oddly enough potato chips and popcorn.").
- **Not rigorously proofread** — small grammatical slips survive into the
  latest revision (e.g. "screams an Zielic obscenity"). Don't assume the
  latest revision is a clean baseline; corrections happen opportunistically
  when someone notices something on a re-read, not via a full copyedit pass.

## 4. Episodes 20 and 21: added actions and quote cleanup in detail

`20-rough-resurrection.md` and `21-deep-space-famine.md` were compared the
same way, but against their true oldest source — not just the earliest
commit of the split file, but the raw text still sitting inside `ff2.md`'s
very first commit (`46d446d`, 2024-05-02), before either episode had a file
of its own. See §5 for why that matters. The diffs are large (~2,600
removed / ~3,180 added lines for ep. 20; ~2,690 removed / ~2,860 added for
ep. 21), and most of the volume is the mechanical stuff already covered in
§2. The two patterns the current pass cares about:

### Added actions

The raw chat log frequently reduces a whole beat to a terse, unpunctuated
action fragment typed by the player (no italics, no third person, sometimes
first person). The edited version keeps that core action but expands it into
one or more full italicized sentences, often adding a consequence, a detail,
or a follow-up beat that wasn't in the original message at all:

```diff
- > Chomsky builds a throne out of the muffins and sits in it
+ _Chomsky builds a throne out of the muffins and sits in it. He uses a
+ muffin as an ashtray of sorts. After a couple of seconds, he starts
+ sinking in the throne._
```

```diff
- > Sanya finds a hotdog on the ground.
+ _Sanya looks at her surroundings and manages to find a perfectly
+ preserved hotdog. She decides to eat it in the hopes that the meat will
+ give her the strength to persevere._
```

Some added actions exist purely to bridge a joke or scene transition that
the raw log leaves implicit — e.g. a block where `**TheBlade**` (the Discord
account for the player of Jim) posts a line as if he were another character
("Emmet, I dont feel so good...") with zero framing in the raw log. The
edited version inserts `_Jim tries his best to mimic Matieu's voice, rolling
his eyes._` immediately before it, and adds a bit ("Wah, wah, wah.") and a
follow-up line (`_Jim's voice becomes gruff._` / `> Nut up, Matieu!`) so the
joke reads coherently to someone who wasn't in the Discord call.

Also common: giving inanimate/NPC actors (a ship, a space station, a toll
booth operator) their own backtick-tagged action lines that don't correspond
to any single raw chat message — these are pure narrative connective tissue,
synthesized from context (a dice roll, the scene's logic) rather than lifted
from a specific line:

```
_`Panty Slingshot`: The ship manages to make its way into an inhabited
planet's orbit and falls, turning into a firey ball of metal that happens
to protect the crew from the impact._
```

### Quote cleanup

Unlike the five episodes in §1–§3 (which mostly needed blockquote markers
*removed* from OOC lines), the raw ep. 20/21 source also wraps a lot of
in-character dialogue in redundant straight double quotes, and sometimes an
entire stray single-line code fence:

```diff
- > `
- "Where am I?"
- `
+ > Where am I?
```

The rule that falls out of this: a `>` blockquote is sufficient to mark
something as spoken — literal quotation marks around the whole line are
redundant and get stripped, and stray backtick code-fencing around plain
dialogue (an artifact of how the original message was typed in Discord) gets
removed entirely. Quotation marks are *kept* (and sometimes added) only when
they're quoting a specific phrase *within* a line, not marking the line as
dialogue:

```diff
- > "Nice no u loser, I'm like 1 digit away from calling the Police."
+ > `Toll Station Operator`: Nice "no u", loser. I'm like one digit away
+ from calling the cops.
```

(Note this example also folds in other §2 patterns at once: speaker
attribution tag added, "1" spelled out as "one", word choice softened from
"Police" to "cops".)

Quote cleanup also catches small continuity errors that plain proofreading
would miss, like an inconsistent in-fiction ship name:

```diff
- > "Toll Station Y-28 to Vortox Pummeler we hear you loud and clear."
+ > `Toll Station Operator`: Toll Station Y-28 to Panty Slingshot, we hear
+ you loud and clear.
```

`Vortox Pummeler` never appears as the crew's ship name anywhere else in the
edited episodes — it's a discarded early name for what became the *Panty
Slingshot*, caught and corrected only when someone reread this specific
exchange. This is a good reminder that the pass is opportunistic, not
exhaustive: don't assume a name/spelling is consistent elsewhere in an
episode just because it was fixed once.

## 5. `ff2.md` was the real master document — the split files are snapshots of it

`ff2.md` is not "the episode-20/21 predecessor" in the sense of a rough
draft that got replaced once. Its own git history (`git log --follow -- ff2.md`)
runs from `46d446d` (2024-05-02, the very first commit in the repo) through
`90d6fc3` (2025-01-22) — nine and a half months, ten commits, spanning
censoring (`c1dbed0`), typo passes, and incremental "add episodes N and M"
commits. Two things about that history matter for anyone working with these
files:

1. **The entire campaign's raw chat was dumped into `ff2.md` in one shot, on
   day one.** `46d446d`'s copy of `ff2.md` is already 70,567 lines and
   already contains raw, uncleaned episode 20 and 21 content (found by
   grepping for known dialogue lines from both episodes — they're present,
   verbatim-messy, from the very first commit). Nothing about episodes
   20/21 was written after the fact; the whole archive existed up front and
   got cleaned up episode-by-episode, in campaign order, over many months.

2. **Splitting an episode into its own file did not stop `ff2.md` from being
   the live copy.** `06bdd1b` ("Split up the FF2 md into the remaining
   episodes", 2024-05-20) extracted `14-crash-and-burn.md` through
   `25-lap-of-the-gods.md` as copies — but `ff2.md` itself is unchanged by
   that commit, still 70,567 lines on both sides of it. The split files
   (`20-pee-of-life.md`,
   `21-deep-space-dangers.md` at the time — note the working titles, later
   renamed) were snapshots frozen at that moment, while `ff2.md` kept being
   the thing that got hand-edited. Eight months later, `6db4eb5` (2025-01-11,
   "Add episode 19... include all files in selected directory") **deleted
   and regenerated** `20-pee-of-life.md` from the current state of `ff2.md`,
   picking up whatever cleanup had happened to that section in the
   meantime, and renamed it to `20-rough-resurrection.md` in the same
   commit (git records this as an 86%-similarity rename, i.e. a rename plus
   a real content change). `21-deep-space-dangers.md` got the same
   delete-and-regenerate treatment in `90d6fc3` (2025-01-22).

**Practical implication:** if you're ever tracing an episode's edit history
and its own file seems to have a suspiciously clean "day one" commit with no
earlier messy predecessor, check `ff2.md`'s history too — the messy
predecessor likely lived there instead, and the split file's real age is
older than its own git log suggests. For episodes 20 and 21 specifically,
work continued directly on the split files after the January 2025 resync
(`fd0a460` → `62d2a8c` for ep. 20; `e30d2b6` → `cdcdbbc` for ep. 21) — `ff2.md`
was never touched again after `90d6fc3`, so from that point on it's frozen
history, not a live document.

## 6. Practical checklist for editing/regenerating an episode file

1. Strip `>` from OOC bot commands and bot replies; keep `>` only on spoken
   in-character dialogue.
2. Collapse multi-line bot mention-embed replies to one line.
3. Rewrite terse/fragmentary actions into full italicized third-person
   sentences; expand bare action shorthand with an added consequence/detail
   rather than translating it 1:1.
4. Add a backticked `` `CharacterName`: `` prefix wherever the in-character
   speaker/actor isn't the Discord header name — including inanimate/NPC
   actors (ships, stations, AI) that need their own attributed action lines.
5. Delete failed dice-roll retries once a usable roll exists; delete
   truncated/dangling fragments.
6. Re-split any block where the converter merged multiple real speakers
   under one header.
7. Check the dice-roll result actually matches what happens next; fix if not.
8. Strip redundant straight quotes wrapping a whole blockquoted line and any
   stray backtick code-fencing around plain dialogue; keep/add quotes only
   around a phrase quoted *within* a line.
9. Capitalize/punctuate OOC questions and clean up obvious username,
   spelling, or mid-sentence capitalization typos — including in-fiction
   names (ship names, character names) that drifted before settling.
10. Leave tone, crudeness, and comic excess alone — that's the source
    material, not an editing artifact. Explicit slurs can be removed or censored.
11. If an episode file's own git history looks suspiciously clean with no
    messy predecessor, check whether it was actually edited inside `ff2.md`
    first (§5) before being split or resynced out.

## 7. Adding third-person actions where the staging is unclear

§2.3 already covers turning a fragment the raw log *has* into a proper
italicized action. This is different: writing an action that doesn't
correspond to any single raw line, because without it the reader can't
picture what's physically happening or who's doing it. Episodes 20–22
(`ff-site-old` history) are full of these — `_Deyner leaps over Lucian and
into the dirt opposite of him._` before a greeting, `_Hector is shocked to
see Lucian awake!_` before his line. They're short, physical, present tense,
one beat, and they ground the dialogue that follows or resolve the dialogue
that came before — the same voice as §3, just synthesized rather than
translated.

The bar is **unclear**, not **sparse**. Don't add a beat because a scene
could use more flavor; add one because a specific, nameable question is
unanswered:

- **A roll happened and nothing shows the result.** `23-bark-and-bite.md`:
  Sanya rolls a d30 (28) against the beast and says "I got this!" — then the
  scene cuts away. Nothing depicts the swing. Added: `_Sanya charges the
  beast, sword swinging._`
- **Two different actors are both "he" back to back.** Same episode: `_He
  falls and starts crawling towards Chomsky._` immediately followed by `_He
  goes in for the kill._` — one is Emmett, the other is the beast, and
  nothing tells you which. Fixed by naming both: `_Emmett falls..._` /
  `_The beast goes in for the kill._`
- **A roll's outcome contradicts the next 200 lines and nothing bridges it.**
  A roll confirms Seth escapes by pod with Emmett aboard; the very next
  exchange has Emmett still present, getting flung around, and 40 lines
  later says "Put me down!" with no antecedent. Added between the roll and
  the fallout: `_The beast wrenches Emmett up by the horn just as Seth
  reaches the escape pod, cutting the getaway short._` One line resolves the
  contradiction and gives "Put me down!" something to refer to.
- **A bit starts before its subject is on stage.** "Shut up, woman." /
  "BRING ME TO MY HUSBAND!" reads as a character appearing from nowhere. The
  woman is Otter girl, introduced two screens earlier — the text just never
  says so before the bit starts. Added right before it: `_Seth grabs Otter
  girl and starts parading her through the halls, loudly declaring her
  Garrick's secret wife._`

If you can't point to the specific sentence a reader would stumble on, don't
add the line — that's flavor, not clarity, and it's not what this pass is
for.

## 8. The narrator doesn't know what the characters don't know yet

Some transcripts run a mystery the players didn't have the answer to in the
moment (episode 23: who's inside the beast costume). Dialogue and narration
have different epistemic access, and an added action can accidentally leak
the answer where the raw dialogue didn't:

```diff
- _Seth pees on Garrick's foot to get his attention._
+ _Seth pees on the beast's foot to get his attention._
```

```diff
- _Garrick kicks Sanya._
  (cut entirely — see §10)
```

Both named the costume's occupant in the *narrator's* voice, before the
story itself confirms it — a spoiler the raw material didn't contain.
Contrast with dialogue in the same stretch that's left completely alone:

```
> You're gonna kill me, Garrick!
> Garrick?
```

These stay, unedited, because they're a *character's* suspicion or
accusation — uncertain, not omniscient. A player can say "Garrick" while
guessing; the narrator can't confirm it until the scene does. When you add
or touch narration in a mystery stretch, default to whatever noun the
raw material was already using for the unresolved actor (`the beast`,
`it`) — don't upgrade it to the real name just because you, the editor,
already know the answer.

## 9. Naming and attributing a recurring-but-unnamed character

§2.4 covers backtick-attributing an account playing a character other than
the account's usual one. The same convention applies going forward the
first time an unnamed background character (introduced by description —
"the otter girl from the last episode," "a woman," "a man in the corner")
gets enough dialogue to need a name:

```diff
- _Seth picks up the otter girl from the last episode, who was sitting by
- the pool, and starts to run around._
+ _Seth picks up Jessica, who was sitting by the pool, and starts to run
+ around._

- > Please don't.
+ > `Jessica`: Please don't.
```

Tag *her* lines wherever a different account is voicing her (`Bagelwrecker`
speaking as Jessica). Don't tag her own account's lines when she's speaking
under her own header (`ProfessorTree`'s own `> m` stays untagged) — the
header already disambiguates; a tag there is redundant.

Once you name her, rename her everywhere in the episode, including inside
raw bot-command text only if it changes the meaning — a `t!8ball` command
that still says "otter girl" is fine to leave as the literal string that
was typed into Discord, but an added narration line should use the settled
name.

## 10. Cut what's out of scope or not earning its space

Two different reasons to delete a line outright, as opposed to reformatting
it (§2.5, §2.8 already cover deleting failed rolls and dangling fragments):

**Out of the archive's scope.** Per the workspace's own design boundary,
live combat/HP mechanics belong to `vortox-bot`, not this archive — it
records who a character *is*, not their fight-state. A raw damage/HP
bookkeeping thread (`[1 damage]`, `4 health lol`, `92 damage`, `3 HEALTH`,
`-25 HEALTH`, ...) isn't OOC color the way a bot command is; it's the wrong
kind of record for this document. Cut the whole thread, not just its
blockquotes — leave only the actions and dialogue that survive without it
(the punch, the roll, the injection, the fall).

**Not earning its space.** Some bits are complete, on-topic, and still not
worth keeping — a runner that didn't land, a tangent that goes nowhere. Cut
these are the same as any other line: no formatting fix, just gone. This is
a judgment call the mechanical pass (§1–6) doesn't make — that pass never
deletes content that isn't a failed retry or a fragment. This one does,
when a line's absence makes the scene read better than its presence did.

## 11. Consolidate one voice before you consolidate everything else

The raw log interleaves messages by arrival time, which sometimes cuts one
character's sentence in half with someone else's unrelated line. When that
happens and merging doesn't change what anyone actually said, pull the
split lines back together into one block, and move the interrupting content
to before or after — even if that means departing from strict message order:

```diff
  > GARRICK!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  > YOUR
  > WIFE
  > WANTS
- (Hector's action line used to land here, splitting "WANTS" from "YOU")
+ > YOU

  _Hector starts following the trail again..._
```

```diff
  > Sorry, I...
- **Brakia** > Garrick, I will stab you. Profusely.
  > I didn't mean to...
+ (Sanya's threat now follows both lines, instead of interrupting between them)
```

The rule of thumb: if a character has more to say and the *next* thing
they say resolves or continues the *last* thing they said, keep them
together and let the interruption land on either side of the whole
thought, not in the middle of it. This can end up defying literal
timestamp order by a few beats — that's an acceptable cost for a reader
being able to follow one person's sentence.

## 12. Rewrite a flat exchange into a scene when the raw version reads as game mechanics rather than speech

Some raw exchanges are literally two players negotiating game state through
their characters, and cleaning the punctuation alone still leaves it reading
that way:

```diff
- > Does Garrick also fix Chomsky's door?
- > No.
+ _Garrick looks at the big hole where Chomsky's door used to be._
+ > I'm not fixing this.
```

This goes further than §2.3's expand-a-fragment rule — it's replacing a
question-and-answer with an action-plus-fuller-line that a person would
actually say. Reach for this only when the original reads as two players
talking *through* their characters about the fiction, rather than two
characters talking *in* it.

## 13. Small judgment calls worth carrying forward

- **A character's own bodily sound can become narration instead of an
  interjection**, when it describes a state rather than something being
  said: `> Zzzzzzzz.` → `_Emmett snores loudly._`. This is *not* the same as
  external event sounds the raw log already treats as heard/spoken
  interjections (`THUD`, `Roar.`) — leave those blockquoted; don't
  reflexively convert every onomatopoeia to italics.
- **Fix a line to what the joke or logic actually requires, not just what's
  grammatical.** "in possess the costume?" is ungrammatical either way it's
  read; "I possess the costume?" is clean English but doesn't answer "what
  am I supposed to do now?" — "Unpossess the costume?" does. When a raw
  typo has more than one grammatical fix, pick the one that makes the
  surrounding exchange make sense, not just the nearest one.
- **A minor wording softening is a legitimate personal touch, distinct from
  the "leave crudeness alone" rule in §3.** Swapping "Jesus" for "Jeez" in
  an exclamation isn't censoring the source's tone — §3/§6.10 protect
  vulgar, absurd, and crude content because it's *what happened at the
  table*; a single interjection's phrasing is not load-bearing the way that
  content is, and changing it is a style choice, not a violation of the
  "don't sanitize" rule.

## 14. Practical checklist for the structural/creative pass

Do this only after the mechanical pass (§6) is complete — it assumes clean
formatting to work on top of.

1. Read the whole episode once for staging, not wording. Mark every spot
   where you can't answer "what is physically happening right now, and to
   whom" from the text alone.
2. For each marked spot, write one short, physical, present-tense action —
   grounded in what's already true in the scene, naming the actor
   explicitly. If you can't point to the specific confusion it resolves,
   don't add it.
3. If the episode runs a mystery, keep the unresolved noun (`the beast`,
   `it`) in every *added or edited* narration line until the story's own
   reveal — but leave existing character dialogue that names/accuses/guesses
   untouched, even mid-mystery.
4. The first time a recurring-but-unnamed character gets real dialogue,
   name them and backtick-attribute their lines wherever a different
   account is voicing them; leave their own account's lines untagged.
5. Cut, don't reformat: game-state bookkeeping (HP/damage tracking — that's
   `vortox-bot`'s domain, not this archive's) and any bit that's complete
   but isn't earning its space.
6. Where one character's dialogue is split by an unrelated interleaved
   message and merging changes nothing anyone said, merge it and move the
   interruption to either side of the whole thought.
7. If a raw exchange reads like two players negotiating game state rather
   than two characters talking, replace it with an action plus a fuller
   in-character line instead of just punctuating it.
8. Convert a character's own bodily sound-effects to narration when they
   describe a state; leave external event sounds as spoken/heard
   interjections.
9. When a typo or fragment has more than one grammatically valid fix,
   pick the one that makes the surrounding exchange make sense.
