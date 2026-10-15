# FF2 Transcript Editing Guide

How the FF2 episode files in this directory get turned from raw Discord logs
into readable transcripts. Every rule here is **measured**, not remembered:

- **Baseline ("before")** — `ff2.md` in this directory. It is a clean
  regeneration of the original Discord export
  (`ff-site-old/archive-to-markdown/ff-archive/ff2.html` through `ff2.py`).
  Re-running the converter and diffing confirms it differs only in username
  mapping (`Santa is Dead`→`PlasmaPerson`, `Treydel (Retribution)`→`RPretribution`)
  and italicized `*asides*`. It carries no hand edits, so it's a valid "before".
- **"After"** — episodes 1–22 (`[0-9]*-*.md`), aligned line by line against
  their slice of `ff2.md`. Episode 23 is a partial pass by an LLM editor
  (§10), and episodes 24–25 are still identical to raw.
- **Process evidence** — per-commit history in `../ff-site-old` (§1). The
  single most informative commit is `4e1c24b`, which is literally titled "add
  more contextual actions to Mousehole". It is a second pass over an
  already-edited episode 7 that does almost nothing *but* add contextual
  actions.

The numbers below come from a line-provenance alignment of each episode
against its raw slice (scripts not committed).

## 0. The target: what a finished episode looks like

Editing intensity drifted a lot over the project:

| Episodes | New action lines per 100 lines | Notes |
|---|---|---|
| 1–2 | 1–4 | Mostly mechanical. First-person 8ball questions left as typed (ep 1: 43, ep 2: 73). |
| 3–4 | 7–10 | Transitional. |
| 5–11 | 18–28 | Full treatment begins. |
| 12–14 | 30–36 | Peak density. Ep 12 averages roughly one added beat per player turn. |
| 15–22 | 24–32 | Most recent finished work (20–22: 25–29). |
| 23 (LLM pass) | 0.4 | Far under house style. See §10. |

**Aim for episodes 20–22**: roughly one synthesized action for every three to
four lines of transcript, on top of every action the players typed
themselves. Episodes 1–4 are *not* a model. They predate most of these
conventions.

Across episodes 1–22 there are **5,261 action lines with no counterpart in
the raw log**, plus 236 brand-new dialogue lines. Adding material is the
normal job, not an exception.

## 1. Who edits, and what kinds of passes exist

- **Zander Preston** (the GM, who plays Emmett) is the majority author of
  every episode file and the sole author of `ff2.md`'s history. Most of the
  voice described here is his.
- **retribyte / Trey Roemer** (one person, two git identities) did first
  passes on episodes 7, 17, 20 and 22, plus targeted fixes (`544455d` "Fix a
  couple action errors", typo commits). Zander then revised those passes; §6.6
  lists what he changed.

Passes seen in the history:

1. **Mechanical** — reformatting, bot-line cleanup, retry removal, quote and
   backtick stripping (§2, §3). Large diffs with no creative content.
2. **Full edit** — everything in §2–§7 at once, episode by episode, in
   campaign order. This is most commits.
3. **Contextual-action pass** — a re-read that only adds actions (`4e1c24b`:
   a net 105 new action lines over an already-edited ~2,200-line episode).
4. **Fix-ups** — small, often under-described commits (`3bb6134` "Fix another
   typo in 16" actually deletes a duplicated reroll block). Read the diff,
   not the message.

## 2. Line types and formatting

Every line in an episode is one of the following.

| Type | Form | Example |
|---|---|---|
| Spoken dialogue | `> text` | `> Wake up, sonny boy.` |
| Action / narration | `_text._` on its own paragraph | `_Seth sips._` |
| NPC or alternate-form dialogue | `` > `Name`: text `` | `` > `Grass Salesman`: We sell grass here. `` |
| NPC action | `` _`Name`: The name does X._ `` | `` _`Robo-Dog`: The robo-dog switches the viewport..._ `` |
| Bot command | plain | `t!8ball Does Seth go to sleep?` |
| Bot reply | plain, one line | `🎱 \| Don't count on it, Zander.` |
| Invented-language line + translation | glyph/gibberish dialogue, then `_<Language> Translation: text_` | `> Penes apis trous Matieu, camos sumtim!` / `_Martian Translation: Matieu get your head out of your pants…_` (also Zielic, Squoatian) |
| In-world written note / message | `<embed>` / `<description>` … `</description>` / `</embed>`, one line per text line; `md-to-api.py` imports it as an EMBED message | Emmett's apology note in `14-crash-and-burn.md` |
| GM narration / editor summary | `🐐 \| text` under the bot's header. FFBot/Tatsumaki is the GM, so world and scene narration that isn't an action by the block owner's character goes here: establishing beats, scene cuts, ambient events, GM rulings and summaries. Only a handful of uses in FF2; FF3 uses it for all GM narration. | `🐐 \| For the sake of readability, Bagelwrecker and Tom Thompson ask the 8ball back and forth… about twelve times until the 8ball finally says no to Bagelwrecker.` |

**Zielic** (Garrick's spectre language, also spoken by Chomsky) isn't raw
gibberish. The raw log has either keyboard mash or a plain message. Editors
write the real meaning in a letter-for-letter cipher and put the meaning in
the translation line. If the players worked out the meaning off-channel (for
example, Chomsky and Garrick's DMs in episode 23), use it. Case, spaces,
punctuation and digits pass through unchanged:

| a | b | c | d | e | f | g | h | i | j | k | l | m | n | o | p | q\* | r | s | t | u | v | w | y | z |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ȝ | Þ | ۳ | Ś | ɍ | м | Ӵ | ɷ | Ͼ | Ҝ | Ɵ | ï | Њ | ԗ | ݛ | ԃ | ϙ | Ƚ | @ | $ | Ǽ | ϰ | Ɣ | Ґ | Э |

\*The table was recovered from the 14 translated lines in episodes 7, 17 and
22. **q** had no sample, so `ϙ` was chosen in episode 23. **x** has no
glyph yet, so rephrase around it or use digits ("6 feet", not "six feet").

### 2.1 Actions are never inside a blockquote, and never inline

- `> _Jim hits Lodas repeatedly…_` → `_Jim hits Lodas repeatedly…_` as its own
  paragraph, with blank lines around it (`544455d`).
- Split inline asides. Name the actor and give the dialogue its own line:

```diff
- > _pulls out family photo_ consider yourself lucky. At least you get good memories.
+ _Chomsky pulls out family photo._
+
+ > Consider yourself lucky. At least you get good memories.
```

- Italics are `_underscores_`, never `*asterisks*` (Zander converted every
  `*action*` in Trey's episode 22 pass).
- **No inline italics inside dialogue.** Emphasis becomes a delivery action,
  because italics mean "action" in this format:

```diff
- > We don't have _that_ much space.
+ _Emmett speaks with emphasis._
+
+ > We don't have that much space.
```

- Raw parentheticals are table shorthand for actions or asides. Convert
  them; don't keep the parens. Of these, 260 became actions and 50 became
  dialogue: `(Emmett shrugs.)` → `_Emmett shrugs and nods._`,
  `(In a whisper) I'm getting us…` → `> I'm getting us…`.

### 2.2 Speaker tags: NPCs and alternate forms only

The block header names a **Discord account**, and the reader resolves it to
that player's current character (`meta/ff2.json` → `cast`). Tag a line with
`` `Name`: `` only when the header wouldn't resolve it:

- **NPCs and GM-voiced characters**: `` `Coalition Doctor` ``,
  `` `Toll Station Operator` ``.
- **A player's alternate form or second character**: `` `Bee Emmett` ``,
  `` `Dread` ``, `` `Floran Assassin` ``, and `` `Serpile` `` / `` `Ibraxas` ``
  while Brakia is between characters.
- **Commands and rolls** made on behalf of such a character:
  `` `Ibraxas`: @Magic8ball Does Ibraxas explore the new ship? ``,
  `` `Llamanian Ship`: t!roll d25 ``.

**Do not tag another player character's action.** An action in Seth's
player's block that names Ibraxas is just `_Seth and Ibraxas finally pull in
Lucian…_`, because the sentence names its actors. Measured: 173 untagged vs
16 tagged. An NPC *action* may go untagged when the sentence names the NPC
(`_The guard pinches her brow…_`). NPC *dialogue* always needs a tag.

Tag names are Title Case and consistent within an episode:
`` `Grass salesman` `` → `` `Grass Salesman` ``. Expand shorthand
(`the MMG` → `the Mickey Mouse Ghost`). The colon is required (`8c0f889`
exists only to add one).

The first time an unnamed background character gets real lines, give them a
name and use it from then on (§10.2).

### 2.3 Bot commands and replies

Rolls stay in the transcript. Of about 1,780 raw commands in episodes 5–22,
about 1,310 survive verbatim, about 305 are rewritten, and the rest are
retries or junk. They're plain text (never `>`) and get cleaned up:

- **Third person, specific, punctuated.** `Do I start a party…` → `Does Seth
  start a party…`. `Are we on the planet yet?` → `Is the crew on the planet
  yet?`. `does jim run dwoards the guy…` → `Does Jim run towards the guy…`.
  From episode 11 onward, essentially no first-person commands remain.
- **Reword the question to match what was played**, not only its grammar:
  `Does Chomsky have a sleepover in his room?` → `Does the scientist take
  refuge in Chomsky and Garrick's room?`. This is the question-side twin of
  §2.5.
- **`t!choose` options must read on their own:** `miss | Jim | Garrick` →
  `Missed shot | Shoot Jim | Shoot Garrick`, `…with our bare hands` →
  `…with Asier and Garrick's bare hands`, `we failed` → `the crew failed`.
- **Collapse bot mention embeds** to one line: `🎱 | <reply>, <Name>.`
- **Normalize dice output.** Raw `[ > d20 > : 14] In the end, the result was:
  14` becomes `🎱 | Rolling a d20... Rolled a 14, Bagelwrecker.` (152 uses).
- **Fold "decides for you" into the bot line.** When Magic8Ball answers
  `Next person decides for you` / `Person who just went decides for you`,
  delete the human's bare `yes`/`no` message and write the answer into the
  reply: `🎱 | Bagelwrecker says no, PlasmaPerson.` If nobody answered:
  `🎱 | Brakia ignored you, Finna Steel Christmas.` No "decides for you"
  line survives in episodes 1–22.
- **Delete failed retries** (`Reply hazy, try again`, `Cannot predict now`,
  `Ask again later` followed by the same question). Keep only the roll that
  was acted on. Also delete junk rolls: `t!8ball d10`, `t!8ball is Mica pp?`,
  a truncated `t!8bal`, and `Invalid formatting` errors.
- **Level-up notices** (`🆙 | TheBlade leveled up!`) are deleted.

### 2.4 Dialogue cleanup

- Strip redundant whole-line quotes and stray backtick fencing from
  dialogue: `` `Let's go check inside.` `` → `> Let's go check inside.` Keep
  quotes only around a phrase quoted *within* the line (`Nice "no u", loser.`).
- Terminal punctuation on everything, including shouting: `NO` → `NO!`,
  `DESPACITO` → `DESPACITO!`, `trEy` → `trEy!`. Caps are kept (41 of 529
  all-caps lines were lowered). A tilde goes *after* punctuation:
  `Woahhh!~`, `Hehehe.~`.
- Ellipses: `...and` → `... And`, `I'm just...a` → `I'm just... a`.
- Proper nouns get capitals (`space disney` → `Space Disney`), and so do
  names and in-universe terms.
- **Keep speech tics; make them consistent.** Sanya's hiss stays and gets
  regularized: `A cccell` → `A sss-cell`, `ssstabed` → `ssstabbed`.
- Merge a message that got split into several lines only when it's one
  thought. Split a merged raw line when two beats are mashed together
  (`` `…PARTY-PLANET` > `Lets have some fun people!` `` becomes two lines).
- **Numbers:** there's a tendency to spell out small numbers in dialogue
  (`2 engineers` → `two engineers`, `a 6` → `a six`), but it isn't a rule:
  57 were spelled out and 166 digits kept, including `20 Ducketts per bag`.
  Either is acceptable. Don't churn it.

### 2.5 Continuity fixes

Fix what contradicts the story, not only what's misspelled:

- **Dice vs. outcome:** if the bot said "no" and the scene proceeds as
  "yes", correct the bot line (`My reply is no` → `My reply is yes`), or
  reword the question (§2.3).
- **Lore retcons in dialogue:** `16 years` → `4 GUYs` (the in-universe
  calendar), `I'm a plant` → `I'm a floran`, `20 days` → `twenty equinoxes`,
  `deep space` → `the Outer Rim`, `Vortox Pummeler` → `Panty Slingshot`
  (a discarded early ship name).
- **Wrong actor or location in an existing action:** `_Asier witnesses the
  romance_` → `_Garrick witnesses…_` (Garrick was the one present).
  `leaves the cockpit` → `leaves the lounge` (where he actually was).
- **Anatomy and props stay true:** Emmett is a squoatling with hooves
  (`stamp out his foot` → `stamp out his hoof`). Name vague objects
  (`Lucian hands it to him` → `Lucian hands his scythe to him`).

### 2.6 Block headers and ordering

- A block you create borrows the timestamp of the block next to it (398 of
  416 do). A block you *move* keeps its original timestamp, even if that
  puts it out of order. That happened 16 times, all deliberate (§6.5).
- Re-split a raw block when the converter merged two real speakers under
  one header.
- Every header needs a timestamp: `**Name** _(dd-Mon-yy hh:mm AM)_`.

## 3. What gets deleted

Anything that is a player talking *as a player* rather than through their
character goes. Measured categories:

- **Turn management:** `your turn`, `Mica, your turn.`, `whose turn is it`,
  `skip my turn`, `do turn`, `if it's my turn, ping me or smth`.
- **Pings and client noise:** bare `@Name` mentions, `Pinned a message.`,
  `Several people are typing...`, `(edited)`, `that was my discord
  glitching`, keyboard smashes (`HDJDJJFK`), truncated fragments (`i’m
  literally h`).
- **Session framing:** `EPISODE, START!`, `~Episode ends there~`,
  `episode?`, `Test Run - 6/21`.
- **Mechanics and meta debate:** `what does the dice roll mean though`, `if
  we disregard the 8ball at will, what's the point of it even being here?`,
  `Tatsu is dead now we have to use another bot`, character-sheet and
  lore-math talk (`An elvish year is 2.89 Earth years…`), `I love the fact
  that my character is basically Robo-cop`, `i'd join if i wasn't at
  chick-fil-a`.
- **Bare reactions** that are the player, not the character: `lol`, `ok`,
  `kk`, `oof`, `brb`, `epic`, and one-word `yes`/`no` answers that get
  folded into a bot line (§2.3).
- **HP and damage bookkeeping:** `[1 damage]`, `4 health lol`,
  `(Ship Health = INFINITE!!)`. Live combat state belongs to `vortox-bot`,
  not the archive. Keep the punch, the roll and the fall; cut the numbers.
- **In-character bits that don't land** (§10.4).

Some OOC lines are *converted* rather than deleted, when they carry in-world
content. The meme `I'm sans.` became `_Garrick takes out a skeletal bone hand
slapper from his pocket._`.

Very long repetitive stretches (a twelve-round 8ball tug-of-war, a loop of
the same arrest repeating) can be collapsed into a single `🐐 |` summary
line. This has been used three times; prefer ordinary cutting.

## 4. Content and tone

- **Crude, absurd and juvenile content is the source material. Keep it,
  and elaborate on it.** Editors routinely extend a gag
  (`_Seth lies back in his chair and exercises his pelvis, air humping to get
  himself pumped for the night._`).
- **Slurs are substituted with FF's in-universe slang, not deleted.** The
  standard (settled 2026-09; see `archive-to-markdown/REVIEW-slur-standardization.md`)
  draws on the wiki's *Interspecies relations § Derogatory Terms Across
  Species*:

  | Raw | Replacement |
  |---|---|
  | f-slur, full / short | **binger** / **bing** |
  | n-word, hard R / "-a" form | **gleemp** / **glimp** (`robo-` + n-word → **robogleemp**) |
  | "retard" (noun) | **stupidloid** (the catalogue's `-loid` suffix; noun only) |
  | "retarded" (adjective) | **stupid** |

  Keep capitalization and stretching (`GLEEEEEMP!`). "Gay" or "homo" used as
  an insult has **no** stock replacement. Leave it for a manual decision,
  line by line. Identity and plot uses ("gay icon", "homosexuality") aren't
  slurs; leave them alone.

  **A hand-crafted, in-voice substitute beats the table.** Zander's
  `robo-bastard`, `robo-bro`, `dick god`, `Yee haw like a bee haw nee haw!`
  and the episode 23 `DEECOLUN` were kept deliberately. Only stock swaps
  (like the old `sleazeball`) were standardized. If a line's rhythm or joke
  suggests something better than the table, write it. A species-targeted
  insult can use that species' catalogue slur (for example, elves →
  *Egokk*, squoatlings → *Fadegoat*).
- Small interjection softening is a legitimate style choice and doesn't
  count as sanitizing: `Jesus` → `Jeez` in several episodes (not all:
  ep 12 keeps `Jesus christ...`).
- Emoji in narration are fine when they're the joke:
  `_Ibraxas makes a face like the following. 😐_`.

## 5. Contextual actions — the core of the job

This is the part of editing that takes the most judgment. Earlier guidance
diverges from the finished episodes here. It said to add an action "only if
you can point to the sentence a reader would stumble on", a rule derived
from the episode 23 pass alone. Episodes 1–22 add actions for **two**
reasons.

- **Tier 1 — clarity (required).** Without the line, a reader can't tell
  who is where, who is talking to whom, or what just happened.
- **Tier 2 — texture (house style).** Reaction beats, physical business and
  narrator color. These keep a chat log reading like a scene. They're most
  of the 5,261 lines and nearly all of Zander's `4e1c24b` pass, so the house
  treats them as part of "contextual actions" too.

Do both; this is the settled standard for every episode, including 23 and
later. Tier 1 is never optional. Tier 2 is what gets an episode to the
density in §0.

### 5.1 Tier 1 triggers: when an action is required

Each trigger below was observed repeatedly. The shape of the fix is in
parentheses.

1. **Someone appears from nowhere** (entrance or location beat, placed
   *before* their first line):
   `_Jim appears from behind Emmett._` before "Emmett, I don't think you need
   anything more to drink.";
   `_Ibraxas sleepily staggers into the common area, where Seth and Emmett
   are._`;
   `_Asier emerges from the janitor's closet, right next to Ibraxas's room._`;
   `_Garrick, tired of the sappiness, heads back to where Sanya and Chomsky
   are._`
2. **A silent character is present but untracked** (keep offscreen
   characters' physical state current, so that when they speak it isn't a
   surprise): `_Steely, in the closet, finds crumbs on the ground…_`, then
   later `_Steely, still in the closet, finds a bug…_`, and finally
   `_Steely speaks up from the corner, having left the closet._`
3. **It's unclear who a line is addressed to** (addressee cue, placed
   before the line): `_Seth smiles at Alli, losing some interest in
   Sanya._`, `_He perks up, shifting back to Deyner._` / `> Yes, Deyner?`,
   `_Iris beams up at Sanya._`, `_Garrick points a big finger at Sanya._`
   This matters most when two conversations interleave in the raw log.
4. **A line only makes sense with a particular delivery or medium**
   (delivery framing): `_Steely is watching porn, but he speaks to the video
   as if it could hear him._` before "Make sure you don't spill your
   milk!"; `_Seth desperately speaks into his comms._`, `_Garrick… speaks
   into his comms._`, `_Emmett speaks into his watch._` (remote lines);
   `_Maia starts to fall asleep, and cartoonishly mutters the following to
   herself._` before `> Zzzz..`; `_Jimm feels the need to repeat himself._`
   before a line the player typed twice; `_Jim tries his best to mimic
   Matieu's voice, rolling his eyes._` before an impression.
5. **A line refers to something that isn't on the page** (referent recall,
   placed before the line): `_Emmett remembers the last space station the
   crew went to and shivers._` before "I was drugged."; `_Chomsky recalls
   seeing bones in the kitchen trash at one point in time._` before "Sanya
   ate it..."; `_Before Garrick got away, Seth was able to grab a napkin from
   the ghost's pockets._` before "Here Emmett. Garrick's ass napkin."
6. **A roll resolved and nothing shows it** (outcome beat, directly after
   the bot reply, in the roller's block, or in the affected character's
   block if someone else is acted upon). 611 actions (12%) sit right after a
   roll:
   `Does Jim get the cell finished?` / `Outlook not so good` →
   `_Jim peers into the cell room, pissed that he wasn't able to get it
   finished in one go._`;
   a `t!choose` landing on Asier → `_Asier shapeshifts into swiss cheese,
   attempting to dodge the hundreds of bullets…_`;
   `Rolled a 28` → `_Finally regaining her prowess over her sword, Sanya
   manages to cut her pirate in half!_`
   Note that a roll can also be *framed in advance*: put the attempted
   action before `t!roll` and the result after it (`_Emmett grits his teeth
   and shoots directly at the toll booth worker…_` / `t!roll 10d75` /
   result / `_Opportunity recoils wildly…a direct hit shattering the
   window…_`).
7. **A roll's outcome contradicts what follows** (bridge beat):
   `_The beast wrenches Emmett up by the horn just as Seth reaches the escape
   pod, cutting the getaway short._` Or fix the roll itself (§2.5).
8. **A reply's joke or logic isn't legible** (explain it with a narrator
   aside): `_Danny is extremely skinny, so Seth is indeed very fat compared
   to him._`; `_Seth says this nonchalantly, like it's nothing._`;
   `_Asier assumed that Lodas's random question was serious._`
9. **An episode or scene opens cold** (establishing beats, one per present
   character, with a recap clause where the previous episode matters).
   `4e1c24b` deleted `EPISODE, START!` and opened with
   `_Steely, having been hiding on the ship this whole time, coughs…_`,
   `_Seth swipes a drink and guts it down._`, and `_Emmett wakes up from one
   of the couches in the lounge, stretching._`. Episode 12 opens with
   `_Jim has already forgotten about Mora-Norap's mission to murder his
   rival._` and `_Emmett… having fixed the navs with the part Ibraxas got
   them, rest his soul._`. Parallel scene cuts get the same treatment:
   `_Hector wakes up in his room, checks his alarm clock, and groans._`
10. **Two actors in a row are both "he"** (name them; see episode 23:
    `_Emmett falls…_` / `_The beast goes in for the kill._`).

### 5.2 Tier 2: texture beats

This is most of what the house adds. The shapes that recur:

- **Reactions to the previous speaker.** These are the most common single
  kind: `_Seth rolls his eyes._`, `_Chomsky shrugs apathetically._`,
  `_Maia gasps._`, `_Emmett grimaces in secondhand embarrassment._`,
  `_Jim gags._`. About 13% of added actions are four words or fewer.
- **Business with props and the set:** `_Seth takes another sip._`, `_Seth
  puts the carton back in the fridge._`, `_Emmett takes out a ladle and drinks
  some of his concoction…_`, `_Sanya bounces on one of the couches._`
- **Physical punctuation for a joke.** This includes splitting a line to
  land it:

```diff
- > This is like, a 6 on the galactic alcohol scale.
+ > This is like...
+ _Emmett takes more of a drink._
+ > A six on the galactic alcohol scale.
```

- **Wry narrator lines:** `_There is not 40 people on the ship._`,
  `_Sanya looks into a room that just so happened to be unoccupied.
  Strange._`, `_He's being awfully polite right now._`, `_Jim hands something
  to the mechanic, something that even you, the reader, should not know about
  at this time._`
- **Brief interior state** is allowed, despite the "physical over abstract"
  preference: `_Sanya was still trying to consider the logistics of
  mammalian mating procedures, not really understanding them._`

Texture should feel like what the character would plausibly do. It must not
introduce plot, contradict a later roll, or resolve something the players
left open (§5.5).

### 5.3 Placement

This is the part a new editor most often gets wrong, and it's highly
consistent in the finished episodes.

- **Put the action in the acting character's own player's block.** 84% of
  added actions name the block owner's character. Emmett's actions go in
  Zander's block, Seth's in Bagelwrecker's, and NPC actions in the block of
  whoever voices the NPC (usually Zander, sometimes the player who
  introduced it: `` `Floran Assassin` `` under Brakia).
- **Lead vs. tail.** 52% of added actions *open* a block, sitting before that
  player's dialogue: setups, entrances, addressee cues, referent recalls,
  delivery framing. 33% *close* a block after the dialogue: reactions and
  consequences. Pick by function. Does the line need the action to make
  sense (lead), or is the action the character's response (tail)?
- **Setup goes in the block of the person who references it.**
  `_Some of the college students back away from Jim once they realize he's
  wearing a cop uniform._` sits in *Seth's* block, right before Seth says
  "Jim, go borrow one of my suits, you freaking all the kids out."
- **Only create a new header block when no adjacent block of that player
  exists** (239 of 5,261 actions). Give the new block the neighbor's
  timestamp (§2.6).
- **Merge back-to-back micro-actions by the same character into one line.**
  Zander's revision of Trey's episode 22: `_Emmett doesn't notice the fire._` +
  `_Emmett rolls his eyes at Danny._` → `_Emmett doesn't notice the fire and
  rolls his eyes at Danny._`

### 5.4 Voice

- **Third person, present tense**, usually one beat. The median is ten words.
  Longer is fine for a big moment, and 3% run past 25 words.
- **Past perfect for backstory is fine**; plain past for the current action
  is a slip. `having left the closet`, `having fixed the navs`, and `Before
  Garrick got away, Seth was able to…` are fine. `Seth… immediately
  interjected` is a slip that should read `interjects`.
- **Name the actor.** Use a pronoun only when the previous line in the same
  block named that same actor (`_He perks up, shifting back to Deyner._`).
- **Concrete over abstract**, but interior states and narrator asides are
  allowed (§5.2).
- **Wink punctuation is okay:** `_Garrick "shrugs"._` (a ghost has no
  shoulders).
- **Keep continuity of held objects and anatomy:** `_He snaps in quick
  succession towards his crewmates, a half-eaten morsel still in his grasp._`

### 5.5 What an added action must not do

- **Must not spoil a mystery.** The narrator knows only what the scene has
  revealed. In episode 23, "the beast" stays "the beast" in narration until
  the reveal, even though characters guess "Garrick?" in dialogue. Keep any
  unresolved noun in added narration.
- **Must not decide something a roll decided differently**, or pre-empt a
  roll that follows.
- **Must not use the wrong actor or location.** Check where each character
  is before writing their action (§2.5).
- **Must not smooth away the joke.** If the raw beat is crude, the action
  can be crude.

### 5.6 New dialogue

Adding dialogue is allowed (236 lines) when it serves the same Tier 1 and
Tier 2 purposes. Common cases:

- A missing response (`> Uh, alright.` from Emmett before he walks Iris over
  to the dam).
- Completing a bit (`> Nut up, Matieu!`).
- Giving an NPC a line that the narration already implied.

Keep it in the speaker's established voice.

## 6. Restructuring

### 6.1 Rewrite fragments into sentences

`> Shakes his hand` → `_Lucian shakes his hand._`. Expand as you go, and add
a consequence when it helps:

```diff
- > Chomsky builds a throne out of the muffins and sits in it
+ _Chomsky builds a throne out of the muffins and sits in it. He uses a
+ muffin as an ashtray of sorts. After a couple of seconds, he starts
+ sinking in the throne._
```

### 6.2 Turn player-to-player negotiation into a scene

```diff
- > Does Garrick also fix Chomsky's door?
- > No.
+ _Garrick looks at the big hole where Chomsky's door used to be._
+ > I'm not fixing this.
```

Use this only when the raw exchange is two players talking *about* the
fiction, rather than two characters talking *in* it.

### 6.3 Consolidate one voice

When an unrelated message splits one character's sentence in half, merge
the halves and move the interruption to either side of the whole thought,
even if that breaks timestamp order by a few beats.

### 6.4 Pick the fix the exchange needs

When a typo has several grammatical fixes, choose the one the surrounding
exchange requires ("in possess the costume?" → "Unpossess the costume?",
not "I possess the costume?").

### 6.5 Moves

Moved lines keep their original header and timestamp. 16 out-of-order
timestamps exist in episodes 7, 11, 17 and 20–22, and every one of them is
a deliberate consolidation.

### 6.6 What Zander changed in Trey's episode 22 pass

This is the best available record of the house standard being applied to
someone else's work:

- `*asterisk*` italics → `_underscores_` (every one)
- `hands it to him` → `hands his scythe to him` (name vague objects)
- `stamp out his foot` → `stamp out his hoof` (anatomy)
- two micro-actions merged into one (§5.3)
- `_Emmett snaps…_` → `_He snaps…, a half-eaten morsel still in his grasp._`
  (prop continuity)
- `_Emmett looks down to his hoof._` → `_Emmett speaks into his watch._`
  (delivery framing for a comms line)
- `t!choose everyone get…` → `Everyone gets…`, and `the fire` → `the
  campfire` (self-contained options)

Of Trey's 198 added lines, 147 survived verbatim. Most of the other 51
differ only by the `*` → `_` swap.

## 7. Sounds

A character's own vocal sound can be **either** kept as dialogue with a
framing action (`_Maia starts to fall asleep, and cartoonishly mutters the
following to herself._` / `> Zzzz..`) **or** converted to narration
(`> Zzzzzzzz.` → `_Emmett snores loudly._`). Both appear in finished
episodes (2 kept, 5 converted). External event sounds (`THUD`, `Roar.`)
stay as heard interjections.

## 8. File history, briefly

- The whole campaign was dumped into `ff2.md` in `ff-site-old` on day one
  (`46d446d`, 2024-05-02). Episodes were split out as they got edited, and
  some (20, 21) were edited inside `ff2.md` before being re-split
  (`6db4eb5`, `90d6fc3`). When tracing an episode's history in
  `ff-site-old`, check `ff2.md`'s log too.
- The `ff2.md` in **this** repo is a clean converter regeneration (see the
  top of this guide). Use it as the raw baseline for any before/after
  comparison.

## 9. Checklist

**Mechanical pass**

1. Take `>` off commands and bot replies. Collapse embeds to one line.
   Normalize dice output. Fold "decides for you" answers into the bot line.
   Delete retries, junk rolls and level-ups.
2. Rewrite commands in the third person, making them specific and
   self-contained. Make `t!choose` options readable on their own.
3. Strip whole-line quotes and backtick fences. Punctuate everything,
   including caps. Put the tilde after punctuation. Normalize ellipses.
   Capitalize proper nouns.
4. Pull actions out of blockquotes. Split inline asides into a named action
   plus the line. Replace inline emphasis with a delivery action. Convert
   parentheticals. Use underscores only.
5. Delete OOC material (§3).
6. Tag NPCs and alternate forms (Title Case, colon). Don't tag other PCs'
   actions.

**Full pass**

7. Fix continuity: rolls vs. outcomes, lore terms (GUYs, equinoxes,
   floran), wrong actors and locations, anatomy, vague objects.
8. Walk the episode line by line and add every Tier 1 action (§5.1).
   Check each character's location and what they're holding as you go.
9. Add Tier 2 texture where a character would plausibly react or handle
   something. Reactions go at the tail of the reactor's block; setups at the
   lead. Use §0 as a calibration check, not a quota. If a finished pass
   lands well under ~20 per 100 lines, you have probably skipped reaction
   and setup beats, so re-read for them. Don't pad to hit a number.
10. Merge split thoughts, and merge back-to-back micro-actions.
11. Substitute slurs per the §4 table (binger/bing, gleemp/glimp,
    stupidloid). Flag "gay"/"homo" insults for Trey. Leave other crude
    content alone.
12. For mysteries, keep the unresolved noun in narration until the reveal.

**Verify** (commands in `archive-to-markdown/HANDOFF-ff2-editorial.md`)

- Parse the episode with `md-to-api.py`'s `convert_file`. It should show 0 unresolved speakers; if not, add a `usernames`/`cast` entry to `meta/<season>.json` or tag the NPC.
- Lint for actions inside quotes, stray backtick fences and unclosed `\*`.
- Check the action share against §0 (about 40% of lines).
- Before tagging a new NPC, voice or deity, look it up on the wiki (spelling, species, what it is).

**Final read**

13. Read the episode as someone who wasn't in the Discord. At every line,
    ask: who is here, where are they, who are they talking to, and why does
    this line make sense? Add a lead action wherever the answer isn't on the
    page.

## 10. Episode 23: lessons from a supervised LLM pass

A 2025 LLM edit of `23-bark-and-bite.md` was reviewed line by line by Trey.
It produced a few judgment rules that still stand, and one open question.

1. **Mystery discipline** (§5.5). `_Seth pees on Garrick's foot_` →
   `_Seth pees on the beast's foot_`; `_Garrick kicks Sanya._` was cut.
   Character dialogue that names or accuses the suspect ("You're gonna kill
   me, Garrick!") stays as written.
2. **Naming background characters.** When "the otter girl from the last
   episode" starts talking, name her (Jessica) everywhere in added
   narration, and tag her lines when another account voices her. A
   `t!8ball` that literally typed "otter girl" can stay as typed.
3. **Tier 1 examples** in §5.1 items 7 and 10 come from this pass, as does
   the Otter-girl setup: `_Seth grabs Otter girl and starts parading her
   through the halls, loudly declaring her Garrick's secret wife._`
4. **Cut bits that don't earn their space.** A complete, on-topic runner
   that didn't land can go.
5. **Density (settled):** this pass added 0.4 new actions per 100 lines,
   against a house norm of about 25–30 in episodes 20–22, because it
   treated "clarity only" as the bar. Trey decided (2026-09) that episode 23
   onward follows the episodes 1–22 norm: Tier 1 and Tier 2 (§5).
