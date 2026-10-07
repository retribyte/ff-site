# Handoff: FF4 editorial pass (started 2026-09-29)

FF4 gets the same editorial treatment as FF2 and FF3, in a different
format. **Episode-editing subagents: read `editorial/FF4-AGENT-BRIEF.md` instead of
this list** (see "Resume here"). The advisor session reads these first, in order:

1. `md/ff2/EDITORIAL-STYLE-GUIDE.md`. The house rules. Everything there
   applies unless this file overrides it.
2. `HANDOFF-ff2-editorial.md`, the "Conventions learned in FF3" and
   "FF3-specific conventions" sections.
3. This file.
4. `md/ff4/0-pilot.md`. The finished Pilot, the worked example.
   Diff it against `md/ff4/raw/0-pilot.md` to see every kind of
   edit.

## ▶ Status

| Episode | State |
|---|---|
| 0-6 | Edited, imported and committed; Trey hand-tuned them after review (per-episode notes are below). Eps 1–2 re-imported 2026-10-05 with Zander as `Vec as Llafay Terrels`. |
| 7 ("Marv Attacks!") | Edited by Sonnet 5.5, imported (761 messages). Trey's rulings applied (Vec as Marv audit, `…` → `...`, Morra pronoun audit), re-imported. **Awaiting Trey's review.** Notes: "Ep 7" section. |
| 8 ("Don't Be a Shitty Dad") | Edited, reviewed by Trey, fixed per review (joke `/dmg` cut; guide lines retagged `Olag`), re-imported (559 messages), then `Vec as Marv` always + `...` swap, re-imported again. Notes: "Ep 8" section. |
| 9 ("Are You Not Entertained?!") | Edited by Sonnet 5.5, re-imported with `Vec as Marv` always + `...` swap (794 messages). **Awaiting Trey's review.** Notes: "Ep 9" section. |
| 10 ("High Roll on D100") | Edited by Sonnet 5.5, imported (778 messages). Re-imported after Trey's review rulings (Vec as Sascha always, `...`). **Awaiting Trey's review.** Notes: "Ep 10" section. |
| 11 ("Wrong Answer") | Edited by Sonnet 5.5, imported (956 messages). Re-imported after Trey's review rulings (Vec as Sascha always, 14 DM NOTE headings applied and removed, `...`). **Awaiting Trey's review.** Notes: "Ep 11" section. |
| 12 ("Goblinators") | Edited by Sonnet 5.5, imported (1000 messages); re-imported after review rulings 2026-10-05. **Awaiting Trey's review.** Notes: "Ep 12" section. |
| 13 ("Tawfeek Residence", export `Side Episode 1`) | Edited by Sonnet 5.5, imported (221 messages); re-imported after review rulings 2026-10-05. **Awaiting Trey's review.** Notes: "Ep 13" section. |
| 14 ("Lights Out", export `Side Episode 2`) | Edited by Sonnet 5.5, imported (258 messages); re-imported after review rulings 2026-10-05. **Awaiting Trey's review.** Notes: "Ep 14" section. |
| 15 ("Sir, This Is A Chilzor's", export `Episode 13`) | Edited by Sonnet 5.5, imported (752 messages); re-imported after review rulings 2026-10-05. **Awaiting Trey's review.** Notes: "Ep 15" section. |
| 16 ("Crashlanded", export `Episode 14`) | Edited by Sonnet 5.5, imported (793 messages). **Awaiting Trey's review.** Notes: "Ep 16" section. |
| 17 ("Don't Weld Yourself", export `Episode 15`) | Edited by Sonnet 5.5, imported (496 messages). **Awaiting Trey's review.** Notes: "Ep 17" section. |
| 18 ("Mutiny", export `Episode 16`) | Edited by Sonnet 5.5, imported (1045 messages). **Awaiting Trey's review.** Notes: "Ep 18" section. |
| 19 ("Rumble Baby", export `Episode 17`) | Edited by Sonnet 5.5, imported (957 messages). **Awaiting Trey's review.** Notes: "Ep 19" section. |
| 20 ("Event Horizon", export `Episode 18`) | Edited by Sonnet 5.5, imported (1074 messages). **Awaiting Trey's review.** Notes: "Ep 20" section. |
| 21 ("Welcome To Elf Heaven", export `Side Episode 3`) | Edited by Sonnet 5.5, imported (471 messages). **Awaiting Trey's review.** Notes: "Ep 21" section. |
| 22 ("Usurper", export `Side Episode 4`) | Edited by Sonnet 5.5, imported (395 messages). **Awaiting Trey's review.** Notes: "Ep 22" section. |
| 23 ("Finale", export `Episode 19`) | Edited by Sonnet 5.5, imported (1327 messages). **Awaiting Trey's review.** Notes: "Ep 23" section. |

Nothing is committed yet. Commit only when Trey says so (`git -C ff-site`).

## How FF4 differs from FF2/FF3

- **The source is DiscordChatExporter JSON**
  (`discord-exports/episodes/*.json`), not HTML. It has everything:
  embeds, slash-command usage, replies and attachments.
- **Files are named `<N>-<slug>.md` from the episode's meta `title`** (Trey,
  2026-09-29), apostrophes dropped: `4-blackjack.md`,
  `8-dont-be-a-shitty-dad.md`. `file_name` ("Episode 4") is only the
  Discord-export channel key; `api/ff4/` JSON still uses it.
- **The editable source of truth is markdown**, `md/ff4/<N>-<slug>.md`,
  imported with `md-to-api.py` like FF2/FF3. The JSON stays as reference
  material. The old direct path (`discord-json-to-api.py` plus
  `messageBlacklist`) is retired for edited episodes.
- **`md/ff4/raw/<N>-<slug>.md` is the frozen "before".** It's produced by
  `ff4-to-md.py`, contains everything (no blacklist applied), and
  round-trips exactly through `md-to-api.py`
  (`editorial/ff4_roundtrip.py`). Never edit it. Regenerate it only if the
  converter is fixed, and only for episodes not yet edited.
- **Keep FF4 looking the way it appeared in play (Trey).** Vortox's embeds
  stay embeds. That includes 8ball answers, dice rolls, and combat
  hits and misses, HP lines and all.

## FF4 markdown format

```
**Zander** _(10-May-22 07:46 PM)_ [973747991540269157]     one block per Discord message; [ID] = its Discord message ID

> Dialogue.                                                 as FF2/FF3
_Action._
> `Seth`: NPC or alternate-form dialogue.                  as FF2/FF3 (tags are sticky for the rest of the block)
> `Vec as Marv`: …                                          Vec speaking through a Ravens host (character Vec, persona Marv)

↪ Trey: opening words of the message being replied to…     Discord reply marker     } metadata: md-to-api.py
⌘ Brody used /8ball                                         slash command behind the }  skips these lines;
📎 goat_butt.png                                            attachment                }  keep them

<embed>                                                     Vortox output (or a player's link embed)
<title>8ball Response</title>                               title/footer are strings; one-line sections allowed
<description>Da.</description>
<footer>Brody asked: "Does Sanya wake up?"</footer>
<color>#50C878</color>                                      only when it isn't Vortox's everyday orange: green hit/heal, red failed/miss
</embed>
```

Embed `color` lives inside the EMBED message's JSON text. The reader draws
it as the embed's left stripe. Only colors that carry meaning are kept,
such as green hits and red misses. Keep those verbatim.

**Vortox is merged into FF 8 Ball** (Trey, 2026-09-29). It's the same bot
under FF2's name, and the DB has a single user for both. Headers still
say **Vortox**, as Discord showed it, and `meta/ff4.json` maps "Vortox" →
"FF 8 Ball" at import. On the site FF4's bot shows as "FF 8 Ball" in
FF 8 Ball's purple (`#ce78ff`; `#6e4694` in light mode).
- **On record: Vortox's own color was orange, `#FFA500`.** Every
  ordinary Vortox embed (8ball answers, rolls, turn notices) was orange
  in Discord.
- The converter leaves that orange out of the markdown
  (`meta/ff4.json` → `defaultEmbedColors`), so those embeds take the
  bot's purple.
- To bring the orange back, delete `defaultEmbedColors` and regenerate
  the raw files. Embeds would then carry `<color>#FFA500</color>` again,
  and the edited episodes would need the same lines restored.

- **Header IDs anchor text to the export.** A block that keeps an ID
  holds text derived from that message, even if it's edited, converted
  or moved.
- **A block with no ID is editor-added.** Every new action, new line or GM
  embed goes in its own ID-less block, under the right player's header
  with the neighbouring timestamp. Don't put new lines inside an ID'd
  block. The reader regroups consecutive same-speaker blocks, so this
  doesn't show on the site, but it keeps provenance clean.
- **Converted blocks keep their ID.** For example, Trey's plain "The group
  hears the cellar-like door creak open" became a Vortox action that
  still carries Trey's message ID.
- **Replies are addressee evidence.** A `↪` line is often the only record
  of who a line was meant for. Use it when writing addressee cues
  (guide §5.1 trigger 3). Delete a `↪` only together with its message.

## FF4 conventions (decided 2026-09-29)

**GM narration is a Vortox action** (Trey). Cold opens, scene cuts,
ambient events ("The group hears the cellar-like door creak open from
afar.") and rulings go in a `**Vortox**` block as `_action_` lines.
`md-to-api.py` imports a bot's `_action_` as an ACTION with no character.

```
**Vortox** _(10-May-22 07:46 PM)_

_It's morning aboard the crew's ship. …_
```

- It replaces FF3's `🐐 |` lines. It isn't an embed: an earlier
  embed-based convention was reversed.
- An added line gets an ID-less block. A line converted from a player's
  message keeps that message's ID.
- **Space Rules are plain text, not actions:** `Space Rule #553: Beware
  the Cum.` under Vortox, which imports as a bot response.
- **Recaps and Mission Control transmissions are embeds** (Trey). This
  covers "Last episode, the [HORIZONERS]…", "In the ending of the last
  story…" and "Attention [HORIZONERS]…". Trey and Zander posted them as
  Discord code blocks, where `[BRACKETS]` highlight text.
  - The converter makes each one an EMBED with the brackets kept verbatim
    and the fence language in `<code>` (`<code>ini</code>`, or
    `<code></code>` for a plain fence). It has no title or footer.
  - Prep moves them under Vortox, keeping the message ID. Verify reports
    this as "moved from Trey", which is intended.
  - Don't strip or reword the brackets: they're the highlight markup. The
    reader shows a `code` embed in monospace, and in `ini`/`md` embeds it
    colors each `[…]` run.
  - **Code-block narration the converter doesn't catch** follows the same
    rule. Example: ep 1's opening "The date is 35-7, 3024 GUY…", which
    comes out as plain Trey lines. Rebuild it by hand as a Vortox embed
    with `<code></code>`, keeping the ID. Check the JSON for the original
    fence.

**An NPC voiced by more than one player.** The reader merges consecutive
messages only when both player and character match, because each block
shows "played by". So consecutive lines for the same NPC must sit under
one player: whoever voices the NPC (guide §5.3). Move the other player's
line into that player's block, keeping its message ID. For example, in
the Pilot, Brody's action for the Mother moved under Zander, who voices
her. `ff4_verify.py` lists such moves as "moved from … (check intended)".

**GM banter is cut too** (Trey, 2026-09-29). The GMs (Trey, Zander) aren't
exempt from the noise rules. Their gag actions that pile on a joke without
moving the scene ("Fungo massages Dutch's fingies", "smooches Dutch on the
lips") get cut, even when another player plays along for a line. Keep the
beat only if the fiction depends on it. Read GM lines as critically as
player lines.

**Flag anachronisms; don't fix them.** Real-world names and references
break the setting: "Christ", "Jesus", "Discord", "Internet Explorer",
Earth brands, memes. Note each one, with a suggested in-universe
replacement, in the episode's review notes, and leave the text as is.
Trey decides case by case. Guide §4's "Jesus → Jeez" softening is the
kind of change he may pick.

**8ball embeds** (Trey: "clean question only"):
- The answer (`<description>`) stays verbatim. That includes the joke
  answers ("N Word. (No).", "Yabumba. (Yes)", "Ґɍ@ (Yes).").
- The asker in the footer is the **player name**. `ff4-to-md.py --prep`
  does this automatically from the `⌘` line ("Horny Sexwell MAX asked" →
  "Maxwell asked").
- Clean the quoted question per guide §2.3. Use third person ("Am I
  well-disguised" → "Is Kumdome well-disguised"), capitalization,
  punctuation and typos. Reword it when it contradicts what's played
  (§2.5).
- "No, but something that the person before/after you decides upon
  happens." stays verbatim. The other player's following action is the
  outcome; keep it in that player's block even though it narrates
  someone else's character.

**Combat embeds** (Trey: "keep verbatim"):
- Successful `/dmg` hits and misses stay exactly as posted, HP lines
  included.
- Cut junk: failed commands (prep already drops "… not found!" and
  "Invalid dice format!"), retries (for example an untargeted roll
  immediately redone with a target) and joke targets. In the Pilot, that
  was the damage to sleeping, offscreen Garrick.
- Add an outcome beat when the embed alone doesn't show what happened
  (guide §5.1 trigger 6).

**Plain `/roll` embeds** stay when something follows from them. Cut them
when nothing can be tied to them.

**What prep already removes:**
- Episode Turn, Skipping Turn and Turn List embeds
- Resetting and Stopping embeds
- Adding/Editing Succeeded embeds
- `/list` tables
- failed commands
- the `⌘` lines that went with any of these

**`✂ ` lines are Trey's `messageBlacklist`.** Before FF4 went to
markdown, Trey pre-flagged these as cuts. Cut them by default. Keep one
only when later lines depend on it, and list every kept `✂` line in the
episode's review notes. `ff4_verify.py` fails while any `✂` remains.

**Out-of-character material means player-not-character messages** (Trey).
These are the main cut category, and most of Trey's blacklist. In FF4,
players marked in-character speech with formatting (backticks, italics,
`Name:`), so a player message is usually a **plain unformatted line**: an
OTHER line in the raw file. Examples from the Pilot:
- "Mateo", "kumdome", "Kahreen", "BLAXWELL", "crab" (typed names and
  typo corrections)
- "@Zander", "@Michael you attack jorpa", "roll d6" (pings and turn
  direction)
- "(Switching from Garrick to Dr. Jorpa Scouloneus now)"
- "Kinda sussy", "What's a seeion?", "Stop lying" and memes, gifs and links
- "I love you" / "I miss you", ".", "d:"

**Most of these are cut, but not all. Read each one; don't bulk-delete**
(Trey). About 95% are noise. The rest matter, especially the GMs talking
to the players:
- clarifying what's in a room
- ruling on a roll
- explaining what a character knows
- correcting a misunderstanding the next lines depend on

Losing those would lose the context that makes the scene readable. For
each player message, decide:
- **Noise** (the examples above): cut it, together with its `↪` and `📎`
  lines.
- **Carries information the transcript needs:** keep it. Where it reads
  as narration, move it to Vortox as GM narration (see above; Brody's
  "Space Rule 553" became plain Vortox text). Otherwise leave it as a plain
  line; it imports as OTHER.
- **Unsure:** keep it and list it in the review notes for Trey.

`ff4_verify.py` lists every surviving plain line under `OTHER (review…)`.
That list doesn't have to be empty, but every entry must be a deliberate
keep. The `✂` marks are Trey's own pre-flagged cuts; they aren't a
complete list in either direction.

**Leave in-character lines alone, even when they sound meta** (Trey).
Examples: Mateo's "That was pretty good, huh, guys?" after his
monologue, and the "Seeion" typo bit that Emmett and Garrick play in
character. If it's formatted as dialogue or action and the character
could say it, it stays. Also, discord ~~strikethrough~~ joke asides are
already removed by the converter.

**Density.** FF4 players roleplayed better than FF2/FF3 players, and Trey
expects less adding. Tier 1 (guide §5.1) is still required everywhere.
Tier 2 is light: add a reaction or business beat only where a line would
otherwise read flat. The Pilot went from 0.37 to 0.49 actions per quote.
Anything in the 0.45–0.6 range is plausible. It's a sanity check, not a
target. Some FF2 episodes get up to the 0.7–0.8 range; use discretion.

**Speaker tags. Only use:**
- tags that already appear in that episode's raw file;
- the canonical short names md-to-api knows: `Emmett`, `Seth`, `Chomsky`,
  `Sanya`, `Zach`, `Dutch`, `Bellow`, `Llafay`, `Llawdon`, `Zion`;
- established NPCs (check the wiki first, as in FF2/FF3).

Why the list matters: `md-to-api.py` doesn't have `discord-json-to-api.py`'s
special cases. A hand-typed `` `Dread` `` in ep ≥1 creates a new "Dread"
row instead of folding into Sanya (they merge after ep 0). A `` `Fungus` ``
or `` `S` `` tag isn't aliased either. The raw files are correct because
the converter baked those mappings in. Check the `characters` line
`ff4_verify.py` prints.

**Personas.**
- Vec's timeline personas (Fungus, Fursean, Argonian) are applied by
  `meta/ff4.json` → `personaTimeline`, matched on anchor text:
  - "Fungo takes some time to get adjusted" (ep 4: Vec takes the Llamanian
    corpse body, persona `Drowned Llamanian`, until ep 5's Fursean)
  - "Fursean scratches his head"
  - "Fursean falls apart"
  - "An Argonian in a parka appears"
  - "fell back, slamming into the side of the sofa"
- **Don't reword an anchor line.** Or if you must, update its
  `anchor_contains` in the meta file. Compare the `personas` line from
  `ff4_verify.py` against raw.
- Ravens hosts use the explicit `` `Vec as Marv` `` / `` `Vec as Sascha` ``
  tag.

**Brody's italic lines in ep 0** are Dread speaking, as in FF3. Make them
`` `Dread` `` dialogue. From ep 1, Dread and Sanya are one character
(Sanya Dreadflower), so there's no separate tag.

## Reordering: grouping split thoughts

FF4 players roleplay in bursts, so one thought often arrives as several
messages with other people's messages, rolls or GM lines wedged between them.
Half of Trey's hand edits are moves that put a whole thought back together.
Two tools help; neither edits by itself.

**`editorial/ff4_merge_candidates.py <md>`** only flags. It reports two
consecutive messages by the same author, within `--window` seconds (default
30) of each other, with at most `--max-between` other blocks (default 4)
between them. Exact times come from the Discord ID in the header, since header
times are only minute-precision. ID-less (editor-added) blocks can't anchor a
pair but do count as interruptions. Each hit is tagged by what sits in the gap:

- `[bot]`: a Vortox block (8ball, `/dmg`, GM narration) lands mid-thought. The
  strongest signal, and most of the good moves.
- `[action]`: another player's `_action_` lands mid-thought.
- `[talk]`: someone else spoke dialogue in the gap. Usually a real
  back-and-forth, so it's hidden unless you pass `--all`.

Defaults were chosen by reading ep 0 and ep 1 output at 15–60s. At 30s nearly
every hit was a genuine split thought. 45–60s mostly adds 8ball-wait gaps, so
use `--window 45` only for a second, looser sweep.

**`editorial/ff4_move_blocks.py <md> MOVE_ID:AFTER_ID …`** does the move.
It needs the **full** Discord IDs (not the last-6 suffixes the patch tool
takes); expand suffixes with a small script over the installed file. When
one move targets a block you're also moving, list them in order. It
puts the block with header ID `MOVE_ID` directly after the block with
`AFTER_ID`, keeping the moved block's header and timestamp, and carries any
ID-less blocks that directly follow it (an added outcome beat stays with its
8ball). It prints what it carried; check that. It never touches text.

**Judgment: a hit is a candidate, not an order.** Move when the gap block is
independent of the thought. Leave it when the gap block is a reply or reaction
to the first message (Emmett's "Watch the horns" after the doctor pats his head).

- **Usual fix: move the interrupter, not the thought.** Push the 8ball, `/dmg`
  or side action to *after* the second half:
  - `OW!` / `/dmg` embed / `GOTDAMMIT!` → the embed goes after `GOTDAMMIT!`
  - `Where'd they go?` / 8ball / `Hmph. Must've been the wind.` → 8ball goes
    after the `Hmph`
  - the doctor's "points it at the kid" / 8ball / "Put this in your mouff…" →
    the 8ball goes after the doctor's line
- **Answer follows question:** an 8ball asked about X sits after the line that
  asks or narrates X. Where two 8balls are stacked and only one belongs, move
  the other.
- **A reaction goes after the thing it reacts to:** Bellow's "looks impressed"
  belongs after Zion's "seems confused", not between Zion's two messages.
- **Don't reorder replies.** If the gap is spoken dialogue answering the first
  message, it's a conversation. Leave it.
- **Timestamps may end up out of order.** That's expected, as in FF2 guide §6.5.
- **Run it after the text edit and before verify**, on the installed
  `md/ff4/<N>-<slug>.md` (it's the source of truth once installed), then
  re-run `ff4_verify.py`. Compare a re-run of the flagger: what's left should be
  replies you meant to leave.
- **Apply liberally.** Ep 4 lesson: only the `[bot]` hits were moved and the
  `[action]` hits were left as "probably replies", so Trey reordered the rest by
  hand. Default to moving, and leave a hit only when the gap block is spoken
  dialogue answering the first message (a real exchange):
  - every `[bot]` hit: move the bot block (8ball, `/dmg`, `/choose`, GM narration)
    to after the second half
  - every `[action]` hit where the gap is a reaction, prop beat, roll outcome or
    side action: move the action after the second half of the thought
  - a short interjection that is itself the reply ("What??" / "_Morra jumps._" /
    "You'll sink!"): leave
- **Log every leftover hit** in the episode's review notes with a one-line
  "left because…", so Trey can see what was judged. Don't just write a count.
- **Applied so far:** 7 moves in ep 0 and 7 in ep 1 (ep 0: 13 → 8 hits; ep 1:
  9 → 2). Both were re-imported afterwards.

## Pipeline, per episode

All commands run from `archive-to-markdown/`. N is the episode number,
the name is `md/ff4/raw/`'s file name, and `EXPORT` is the episode's
`discord-exports/episodes/*.json`.

1. `python3 ff4-to-md.py --prep "$EXPORT" .editorial-analysis/ff4-epN/prep.md`
2. `python3 editorial/ff4_parts.py split .editorial-analysis/ff4-epN/prep.md .editorial-analysis/ff4-epN`
   - This writes `prep-1.md`, `prep-2.md`, … at about 600 lines each, cut
     at block headers.
3. Read each `prep-K.md` and write `edit-K.md`. **Use `editorial/ff4_patch.py`**
   (`python3 editorial/ff4_patch.py prep-K.md ops-K.txt edit-K.md`) to apply
   ops instead of retyping 600 lines: `cut ID…`, `keep ID…` (drop `✂`),
   `sub ID :: old => new`, `set ID` (replace body, ends at a line `.`),
   `who ID Name` (retag header, e.g. to Vortox), `ins ID Name` / `insb ID Name`
   (new ID-less block after/before). IDs are last-6-digit suffixes. Ep 4
   was done this way, one ops file per part.
   - Skim the next part before cutting anything that looks like noise
     (FF3's "is stuck in jar" lesson).
   - Keep a running list of review notes as you go.
   - **Reading a part cheaply:** `python3 editorial/ff4_view.py prep-K.md`
     prints one line per block with its last-6 ID (ep 5 was done this way,
     without opening the raw parts). Copy the IDs straight into the ops file.
4. `python3 editorial/ff4_parts.py join md/ff4/<N>-<slug>.md .editorial-analysis/ff4-epN/edit-{1..K}.md`
5. `python3 editorial/ff4_verify.py N`
   - It must show: no `CUT MARKS LEFT`, no unresolved speakers, no BAD
     HEADER or UNKNOWN ID, no LINT.
   - Every `OTHER (review…)` entry must be a deliberate keep, noted for
     Trey.
   - The characters must be cast names or intended NPCs, and the personas
     must match raw.
   - Every `UNMATCHED RAW` line must be a deliberate cut or rewrite.
   - **Embed audit:** there must be no `EMBED CHANGED` (title, description
     and color are verbatim), no `EMBED FOOTER` (the asker must be a
     player name), and no `COMMAND MARKER` (a `⌘` line kept or dropped
     without its embed).
   - Every `CUT EMBED` must be a deliberate cut.
   - Every "moved from … (check intended)" line must be a deliberate move:
     GM narration taken over by Vortox, or NPC lines consolidated under
     their voicer.
   - **Punctuation and capitalization pass (mandatory, Trey 2026-09-29):** run
     `python3 editorial/ff4_punct.py md/ff4/<N>-<slug>.md` and fix everything it
     lists, then read the episode once more for sentence case, proper nouns
     (Zion, Moldarr, Llamanian), `Its`/`Thats`/`Im` contractions, ellipses
     (`...and` → `... And`), ALL-CAPS lines ending in `!`, and typos in
     dialogue and actions (guide §2.4). Do it on the installed file before
     re-import, not only in the patch stage.
   - Slur flags are handled per guide §4 (gay/homo insults go on Trey's
     list).
   - **Then run the merge flagger and apply the moves that fit** (see
     "Reordering" above), and re-verify. This step is mandatory for every
     episode (Trey, 2026-09-29: he was reordering by hand after Ep 4).
     Sweep at the default 30s, then again with `--window 45`, apply, and
     re-run to see what's left.
6. Add an "### Ep N" review section to this file: judgment calls, kept
   `✂` lines, new NPC tags, cuts worth a second look. Then stop for
   Trey's review before the next episode, or batch them if Trey says so.
   - **After install, `md/ff4/<N>-<slug>.md` is the source of truth.**
     Trey edits it directly, so don't reassemble over it.

After import, `python3 editorial/ff4_set_personas.py N` sets Vec's persona rows
(the importer ignores `persona`; `messages` is keyed by `messageNo`, not `id`).

Import: `python3 md-to-api.py ff4 md/ff4/<N>-<slug>.md` writes
`api/ff4/<N>-<file_name>.json` for the `/import` page. The DB is
disposable, so delete the old directly-imported episode first.
API import script: `python3 editorial/ff4_import.py api/ff4/<N>-<file>.json` (deletes and
recreates the episode; see its docstring), then `ff4_set_personas.py N`.

`.editorial-analysis/` is local-only scratch (gitignored). The tools that
matter (`ff4-to-md.py`, `editorial/*.py`) are in the repo.

## Gates

- **The Ravens note in `CLAUDE.md` was stale** (Trey, 2026-09-29) and has
  been removed. The two fenced lines that come out unattributed are not
  converter bugs:
  - Ep 23's "Get wrecked, kid." is Zander's out-of-character reply to
    Silas's "This is going to take forever". Cut it as table talk.
  - Ep 10's "[I AM GOING TO KILL YOU DUTCH!]" follows Zander's "The VR
    headset on the ship emits:". Tag the voice by context, and ask Trey
    if the speaker isn't clear.
- **Pilot review first.** Trey should approve the Pilot's conventions
  before a batch of episodes copies them.

## Known limits (not bugs to fix mid-edit)

- Header times are minute-precision local times with no timezone, as in
  FF2/FF3. The old JSON path imported exact, timezone-aware times. A
  header ID could give the exact time (a Discord snowflake), but ID-less
  blocks couldn't, so this was left alone.
- Replies, slash-command users and attachments are kept in the markdown
  but not imported. The DB has no column for them.
- Seven bot "List of All Weapons/Characters" and info embeds have
  multi-line field values that split into separate description lines in
  markdown. That's cosmetic, and those embeds are bookkeeping to cut
  anyway.

## Cast and continuity

- **Cast** (`meta/ff4.json`):
  - Zander: Emmett (ep 0) → Llafay (1) → Vec (2+, personas above)
    - Ruling (2026-10-05): Zander's ep 1–2 Llafay is `Vec as Llafay Terrels`, never bare `Llafay Terrels`
      (meta cast ep 1 + ep 2 `Llafay` tags retagged; persona row id 7, named `Llafay Terres` in the DB;
      `ff4_set_personas.py` maps it). Eps 1–2 re-imported.
  - Zander's clone PC is `Buzzcut` (character 1709) from ep 12 on. Pre-reveal ep 12 lines carry persona
    `Bee Emmett` (12). Never tag `Bee Emmett`; that's a distinct FF2 character (1700). See
    REVIEW-buzzcut-identity.md for the untagged-action list for eps 12-17. Tag Buzzcut's own
    untagged third-person actions as `_`Buzzcut`: text_` (no persona after ep 12's reveal).
  - Trey: Garrick, then Dr. Jorpa (0) → Zion (1+)
  - Maxwell: Mateo (0) → Edmin Kalvanzas (1+)
  - Silas: Dutch
  - Jonas: Chomsky (0) → Bellow (1+)
  - Michael: Kumdome (0) → Llawdon (1+)
  - Sean: Seth (1+)
  - Brody: Sanya (0) → Morra (1+). Brody and Sean weren't in ep 1; Morra and
    Seth debut in ep 2 as the two recruits the crew must find.
  - Hunt520: Terry (3), then Zach (4+); Jack is content-matched
- **The Pilot is a standalone FF3-era one-shot**: the FF3 crew, plus
  Dutch's debut and Kumdome. FF4 ep 1 starts fresh with the Llamanian
  Armada recruits (Operation EVENT HORIZON), so nothing needs carrying
  over. Ep 1 opens with Trey's intro fences ("The date is 35-7, 3024
  GUY…"). That's code-block narration, so rebuild it as a Vortox
  `<code></code>` embed (see "Recaps" above). The "Attention HORIZONERS"
  transmission after it is already an embed.

## Ep 0 (Pilot): judgment calls for Trey to review

- **Garrick, then Dr. Jorpa.** Trey plays Garrick until "(Switching from
  Garrick to Dr. Jorpa Scouloneus now)" at 08:13, which was cut.
  - Every earlier Trey line is tagged `` `Garrick` ``. The raw file
    defaulted them to Dr. Jorpa.
  - Garrick's lines at the end (back on the ship: "Weird, Emmett", Seeion,
    "the weirdest dream") are tagged too.
  - An added beat has Garrick waking on the couch as Sanya hauls Emmett
    and Dutch aboard.
  - Trey's receptionist lines and actions are tagged `` `Receptionist` ``.
  - The `Loudspeaker` and `Doctor` tags are dropped. Both are the doctor
    (Trey's default), and each would otherwise have created a Character
    row.
- **Narration says "the doctor"** until he introduces himself. "Dr. Jorpa
  puts his hands on…", two lines before his introduction, became "The
  doctor…".
- **Dread.** Brody's seven italic lines are `` `Dread` `` dialogue.
  An added beat has Dread clamping onto Emmett's cheek before "Get off my
  cheek, ass."
- **`✂` lines kept, overriding the blacklist:**
  - Dutch's "With all of this commotion, I could probably steal from that
    Squoatling...". His next line ("He's rare. Rare folks have money,
    right?") depends on it. It's framed as muttering to himself.
  - Silas's 8ball "Does Dutch… try to pickpocket Emmett? Yes, but in a
    monotonous tone." Zander's earlier roll was only about grabbing his
    butt (No), and this one sets up the hand in Emmett's mouth.
  - Kumdome's cumweapon hit on Jorpa (81 damage). It's the only cause for
    "Avenghe me..." and the doctor fainting.
- **`✂` lines cut, as flagged:**
  - Emmett taking his prescription at the sight of the blob
  - the receptionist jumping in front of the shot, and "ah...."
  - Mateo's Contessa hit on Dr. Jorpa (Mateo's "Prick." now reads as a
    parting shot at the doctor who lasered him)
  - Chomsky's "It wasn't me!"
  - all the name and ping fragments
- **Continuity fixes:**
  - "The receptionist is vaporized by cum" became "engulfed", because he
    falls out of Kumdome's corpse alive ("Gross, salty.", now tagged
    Receptionist).
  - "Does Emmett leave the doctor's office?" became "…get out of the
    doctor's office right away?", because he leaves two messages after the
    No.
  - The "Does Emmett scream like a goat and faint…" question: "weapon"
    became "wand", since the doctor is holding a scanning wand.
- **Cut:**
  - All tenor gifs
  - Trey's "Emmett's cushioned" and "Stop lying" images
  - "Dr. Jorpa Scouloneus", "roll d6", "@Michael you attack jorpa"
  - Maxwell's "Kinda sussy" and "What's a seeion?"
  - Trey's `/add weapon…`
  - Zander reading Michael's roll aloud in Kumdome's voice
  - Zander's "Sanya says the previous statement in a GU Morgan Freeman
    voice"
  - Brody's "Does the seeion end, right now?", plus Michael's two "will
    kumdome return" rolls (session meta)
  - Zander's first, untargeted flamethrower roll, Maxwell's untargeted
    Contessa roll, and Zander's Strauss miss (retries)
  - The Delete and Finger Family Pew Pew damage to offscreen Garrick
  - Zander's cumweapon miss during the receptionist beat
  - Trey's 08:17 and Michael's 09:49 `/roll`s, which nothing ties to
- **Kept, though they sound meta (Trey):**
  - Emmett and Garrick's "Seeion" bit
  - "That was pretty good, huh, guys?"
  - "What's the deal today?"
  - "He'll be back." / "Certainly." / "Nah, he's gone."
- **The closing Space Rule** is now plain Vortox text: "Space Rule #553:
  Beware the Cum."
- **Added GM narration** (Vortox actions since Trey's 2026-09-29 note):
  - the cold open
  - Kumdome watching from a ship parked nearby
  - the cellar door (converted from Trey's line)
  - the fall: Sanya slips in cum, taking Emmett and Dutch down with her.
    This ties together the "take Emmett back safely? N-O" roll and the
    three d6 fall rolls.
- **The Mother's first action** (Brody's message) moved under Zander, who
  voices her, so her two lines merge in the reader.
- **Anachronisms to decide:**
  - Mateo's "Christ, so many culturally insensitive people."
  - Kumdome "opens Internet Explorer and moderates his various Discord
    servers"
- **The fainting mother** is placed "still in the doorway", which
  reconciles her leaving at 08:44 with Brody's "The Mother faints" at
  09:19. That's an invention.
- **Silas's second Strauss miss** (09:47, a `✂` line) was cut as
  flagged. The hit that precedes it is kept.
- **Inventions worth a glance:**
  - the mug Emmett throws through Garrick
  - Kumdome slamming the dead cloaking console
  - Mateo writing "MOTHER"
  - the duel paced off in the parking lot
  - Kumdome slurping Dutch's… contribution to heal (the 8ball "I'LL ALLOW
    IT!")
  - the receptionist sifting the ashes for the final "I don't get paid
    enough"
- **Density:** 213 actions to 431 quotes (0.49), up from 0.37 in the raw.
  There are 33 added (ID-less) blocks.

## Ep 1: judgment calls for Trey to review

`md/ff4/1-welcome-new-recruits.md` is installed and verified: 0 unresolved speakers, no
cut marks, no OTHER lines. `api/ff4/1-episode-1.json` is generated and imported (old direct import deleted). Nothing is committed.

- **Intro fence** (Trey's "The date is 35-7, 3024 GUY…") is rebuilt as a Vortox
  `<code></code>` embed, keeping the ID. An added Vortox line seats the recruits
  before Llashii speaks. The "Attention HORIZONERS" transmission was already an
  embed; I moved it under Vortox and dropped the "_Mission control:_" lead-in.
- **GM narration converted to Vortox** (IDs kept): the commander's holoprojector
  and his two-Llamanians entrance (Trey), the empty weapons room and sentries
  (Zander), the undocking (Zander), the intercom blast, BOOOOM, the Shark Tank
  clones and "They will return…", "The aquarium is no longer visible", and the
  "Find out next time, on… Final Frontier 4!" sign-off. Trey's "(Context, if you
  didn't read Final Pummel…)" became "_The Llamanian Republic is at war with the
  GU._"
- **`✂` lines kept** (later lines depend on them):
  - Llafay's "You know I can crumple you up like a piece of paper right now,
    Dutch." (Edmin's "Solace Protocol 4" and Dutch's reply answer it)
  - Llafay's "What are you looking for, bug?" (Bellow's "botany room?" answers it)
  - Edmin's "Would you reiterate?" and Dutch's "Wh... Where'd it go?"
  - Dutch's "Y'all heard Cap'n! Kill the fish!" (Trey's "You'll flood the hull!"
    answers it)
- **`✂` lines cut, as flagged:** Zion's "turns around to see Llafay glaring" (the
  "Yes sir" line stays), Dutch's "Whaddaya mean?", Bellow's "You ok, Llafay?",
  Edmin's "Obscenities do not deter my processes", three joke 8balls (Bellow
  narrating aloud, Llafay heading to the console, "obliterating the asteroid"),
  and the Doodorb / french / foop / "why does zion talk like an anime character"
  fragments.
- **Cut, not flagged:** the Google-sheet links and Weapon List embed; the three
  `/info` embeds (Contessa, Flamethrower, Edmin); the "Edmin speaks like Joshua
  Tomar" / "talks like Chills" / "Cockenballen" / "finger but hole" meme run (and
  its Nabumba 8ball); "(a Labrador)"; "alot riding on this message"; "I FARDED";
  "Ending episode!"; "bals"; the "Dutch dies instantly / nerf war / coping"
  jokes; three of Dutch's nine "Ow"s and two "Agh"s.
- **Kept though it sounds meta:** Michael's "Does Llafay leak mushrooms?" 8ball
  (Yes, but in a monotonous tone). It may be lore, so I added no outcome beat.
  Llafay's "It's a coping mechanism", now framed as Llafay reading Bellow's action
  aloud (the raw had "(Bellow said the action message above)").
- **Inventions worth a glance:** Llawdon's failed first lift-off after the "It
  won't happen" 8ball (the question was reworded to "…get the ship off the ground
  on his first attempt?"); Llafay lifting Dutch by the scruff; empty space outside
  the viewport after the "arrive at the exchange center? N" roll; Zion's armor
  unscratched; Edmin overhearing Llafay from the corridor; the flicker of emotion
  in Edmin's voice; the Kevin O'Leary voice confirmed as intercom interference;
  the man loitering in the adjacent sector.
- **Narration fixes:** "Llafay shuffles the papers" became Llashii (he's the one
  briefing); Dutch is flung "into" (not "back into") the weapons room.
- **Name fix (Trey):** the character is Edmin, not Edwin. `meta/ff4.json` now casts Maxwell as "Edmin Kalvanzas" from ep 1.
- **Tags used:** `Llashii` (Zander's commander NPC, already in raw) and
  `Kevin O'Leary` (Michael's intercom voice). Llafay's untagged Zander lines are
  the cast default.
- **Anachronisms to decide** (left as is): Shark Tank / Kevin O'Leary, Popeye,
  Looney Tunes, "Applebee's Grill And Bar", "Joshua Tomar" (cut), "Cia-knows-what"
  (unclear, possibly in-universe).
- **Slurs:** none. "gay/homo": none.
- **Density:** 181 actions to 327 quotes (0.55), up from 0.48 in the raw. The ep
  is talky and the players already gave a lot of business, so I added mostly Tier
  1 beats.

## Ep 2: judgment calls for Trey to review

`md/ff4/2-fun-guy.md` is installed and verified: 0 unresolved speakers, no cut
marks, no OTHER lines, no EMBED CHANGED/COMMAND MARKER. `api/ff4/2-episode-2.json`
is generated but **not imported**. Nothing is committed.

- **Debuts:** Morra (Brody) and Seth (Sean) first appear here. Narration doesn't
  name them before they introduce themselves: the 06:05 GM line became "Two
  strangers are inconspicuously loitering…" and Seth "squints at the one-eyed
  stranger next to him".
- **Tool change:** `ff4_verify.py` no longer flags `/choose` embeds under EMBED
  FOOTER (they have no asker; footers start "The choices were:" and stay
  verbatim). Ten `/choose` embeds are kept. Cut: the malformed first
  `bar|food court…` retry, the "Black (not really, reroll)" retry, and Zander's
  `/choose` of a player name at the end.
- **GM narration converted to Vortox** (IDs kept): the 06:02 station cold open,
  the "two strangers" line, Dutch's spore waft, the potted-plant/marble
  hallucinations, "eyes extend 50 feet", the drive whirring and black mist,
  Dutch's chicken-dance twitch, "Edmin finds the equipment instead", the
  auto-landing, Bellow catching a whiff, the Seth's-ship-near-the-plains ruling,
  Bellow's super sight, Zion taking Llafay's intercom, and the sign-off. Fungo's
  own actions stay in Zander's block. The Space Rule is plain Vortox text:
  "Space Rule #8009: Always trust a fun guy."
- **Llafay's note** is an `<embed>` under Zander (in-world written note, as in
  FF2 ep 14). "Farwell" became "Farewell".
- **`✂` lines kept** (later lines depend on them): Zion's loudspeaker "SOMEONE
  WAKE UP LLAWDON" and "Someone go get Llawdon" (Edmin's poke and grab answer
  them); "Where is Edmin? I need him to scan the area" (Edmin's biome report
  answers it); Morra walking out (now "with Fungo") and Morra seeing the twig
  (Brody's reply and the "Find body" 8ball need them); Jonas's jumpscare caveat
  and Dutch's "GAAGH!!", "FUNGUS JUMPSCARE!" and "Wait, is that…?" (Bellow's
  "Are you alright?" and Zander's "just Dutch being a dummy" answer them).
- **`✂` lines cut, as flagged:** Michael's "uhh", "I knew this ship was a piece
  of shit" and its meta 8ball (with Trey's "It's Seth's ship"), the whole
  "squoat" edit squabble, "Cap'n Llafay!? Where you be at sir?", "Tell your
  friends to come to me", Morra's "If we have suits, Bellow…", "Detailed
  analysis is irrelevant", "That is… not good", "Whose… ship is that, again?",
  "This corpse is moving." / "or, it was.", Silas's "The hell?", and two 8balls
  (Dutch noticing Fungo escape; the factory-entrance roll).
- **Cut, not flagged:** the tenor gifs and links, `📎` files (including Edmin's
  "Boowomp" sound reply), `/info` Edmin embed, ";;skip", "poopy" / "i shieit" /
  "poop" ×2, the "Fortnite, fortnite" and "backin dat ass on dis dick" bits,
  "Fishlegs from How to Train Your Dragon" (Zander's joke on Jonas), Michael's
  "wait why am I gaY?)", "i did", "cursed" and turn pings, Jonas's "some carnage
  v5", the Silas "I DON'T WANT IT" / "You do" / "nooooo" / ":bruh:" run and
  Zander's "Dutch twerks" (its setup is that run; **second look?**), Trey's
  "Edmin, do you—", "Ok", "one sec" and "…", six of Dutch's "Ouch"s, and the
  repeated "Enter." / "Come on".
- **Kept though it sounds meta:** Maxwell's plain "Put him in a jar" (now Edmin
  dialogue; it seeds the jar plot), Edmin's dictionary definition of carnage.
- **New NPC tags:** `Cephalopean` (Silas, already in raw), `Launch Control`
  (Sean voices the controller while Seth bluffs as "Captain Swanson"), `Llawdon`
  on Zander's and Trey's lines while Michael is away, `Emmett` (Zander, Seth's
  caller; `Llafay` tags on Trey's comms lines were already in raw).
- **Inventions worth a glance:**
  - Fungo pushing Dutch out "out of remorse" (Zander's raw line had no subject)
  - Dutch peering over Zion's shoulder into the armory
  - Llafay pulling the trigger after the "I'LL ALLOW IT!" 8ball
  - the Boowomp trombone
  - the drunk left unhelped after the Nabumba 8ball
  - "the tasty fellow is a Suchan corpse" after the `/choose`
  - a phaser bolt from the rooftop under the first `/dmg`
  - Fungo teleporting into Seth's jar
  - Zion holding *Llafay's* blaster (his line about "how he got it")
  - Edmin listening before "Sound."
- **Guesses:** Trey's plain "Instead, Edmin throws the Cephalopean…" is the
  8ball outcome and stays in his block; "Excuse me?" is tagged `Cephalopean`
  under Maxwell (the raw action says the man "makes his statement");
  Zander's "The hexgot leaves the engine room" became "Zion leaves the armory"
  (Zion is the hexgot and was in the armory); Seth's "Sorry, ex…" became "Sorry.
  My ex…"; Dutch's "I dunno, kid" and "Come check with the rest of us" imply Seth
  is within earshot on his ship, which the raw never shows.
- **Moves applied:** four (Seth's ID-chip scan after "Fungo?"; Zion exiting the
  cockpit after "Ow… very weak"; Dutch's hazmat after Llawdon's "Where we be?";
  Seth's call after the 8ball so "Better pick up" follows it). Within the edit I
  also regrouped Sean's king and ex lines, Edmin's "analyze… with words", the
  Brody "mirror" run, and the sequence of Bellow's two four-arm lines. Three
  flagger hits are left on purpose (replies).
- **Anachronisms to decide** (left as is): "Fortnite" (cut), "Joe Swanson" (Family
  Guy), "Merriam Webster", "Maleficent", "Fishlegs / How to Train Your Dragon"
  (cut), "Sprite" in the `/choose` list. Suggested
  in-universe swaps: "Joe Swanson" → a made-up launch alias, "Merriam Webster" →
  "the Galactic Standard Lexicon".
- **Gay flags** (your list): Seth's "That sounds gay." and Dutch's "You sound
  gay." (an insult-y docking joke). Left as is.
- **Slurs:** "bingy" (already substituted in the raw, in a `/8ball` question,
  kept).
- **Density:** 266 actions to 590 quotes (0.45), up from 0.37 in the raw. The
  players gave plenty of business, so most additions are Tier 1 cues.
- **GM/NPC attribution fix (Trey's note):** untagged Zander/Trey actions default
  to Vec (Fungo) and Zion. Scanned both. Zander's phone-call and ambient beats,
  "Zion goes to check up on him", the door unlocking, the purple haze, the twig
  and the corpse beats, plus Trey's "Instead, Edmin throws…", the mouth-to-mouth
  gag and "The crew approaches the ship" moved to Vortox actions (IDs kept).
  Llafay's and Llawdon's actions under Zander/Trey are now tagged
  (`` _`Llafay`: …_ ``). Watch for this in later episodes: any GM-flavor action
  in a Zander or Trey block.
- **Fake flavor text (Trey's note): a common gotcha in FF.** The GM (Trey or
  Zander) sometimes posts a gag action that screws with a player, and everyone
  understands it isn't canon: "Bellow does passionate mouth-to-mouth with Dutch",
  "Dutch raises a hand… doing the chicken dance motions", "Jonas turns into
  Fishlegs", "Dutch twerks". **Cut these; don't convert them to Vortox actions**
  (that makes them look canon). Scan every GM-flavor action for them. Judge by
  whether the fiction reacts to it: a line that Dutch or others play along with
  as an in-character experience ("AWOOGA" eyes, the potted-plant hallucination,
  the corpse jumpscare that Zander then debunks) stays. In Ep 2 the mouth-to-mouth
  and chicken-dance lines were cut; the AWOOGA and jumpscare lines were kept.

## Ep 3: judgment calls for Trey to review

`md/ff4/3-ambush.md` is installed and verified: 0 unresolved speakers, no cut
marks, no OTHER lines, no EMBED/COMMAND flags. `api/ff4/3-episode-3.json` is
generated but **not imported**. Nothing is committed. Ep 3 is the Hunt520 (Terry)
debut and a combat episode: the KYL factory fight against the Ravens, Marv, the
Llamanian raid captain, and Bellow's shopping.

- **Combat embeds:** hits and misses stay verbatim, HP lines included. Cut: the
  four `does not exist` / `Unable to Roll Damage` failures, all `/info` and
  failed `/heal` embeds, and Edmin's `8` damage to `Enemy_b` at 08:46. That one
  hit a target already dead (-5/20); the fight's own text has Edmin hammerfisting
  Raven D there, so it read as a wrong-target roll. Also cut: the "did Bellow
  spend all his personal money?" 8ball and Trey's `/choose` of a player name.
  Ten `/choose` embeds stay (the ground, pocket knife, body, weapon and
  healing-timing rolls).
- **GM/NPC attribution (from the Ep 2 lesson):** Zander/Trey scene description and
  outcomes became Vortox actions; subject-is-an-NPC actions carry that NPC's tag.
  **New NPC tags** (each new Character row): `Suchan` (Zander, the walking corpse
  the fungus rides), `Worker` and `Hostage` (factory workers), `Raven A`–`D`
  (raw tags `A`/`B`/`C`/`D`, both players voice them), `Squi` (Emmett's background
  voice), `Llao Khug` (raw tags `CF`/`LK`/`Conspicuous Figure` merged into one).
  `Marv`, `Sascha`, `Odran`, `Ravens Leader`, `Emmett` were already in the raw.
  Fungo's own actions (fungus, jar, levers) stay Zander's.
- **Fake flavor cut (Ep 2 note applied):**
  - Trey's four `Bellow` lines after the shopkeeper's "call me" note ("You guys
    get a whole month?", "I just don't agree with the lifestyle", "Pack it up,
    skittles squad", "I just don't want to see it in public"), plus Silas's
    "when Bellow remembers February" and Trey's "Bellow is the kind of guy…" quote.
    These put words in Bellow's mouth, and some are gay-insult adjacent. Jonas's
    real reaction ("looks confused… considers the request") stays.
  - Trey's `Morra` line "Ouchie wowchie! That SMARTS!" (Brody answered with a
    "dead" gif).
  - Zander's "slaps the Seth out of Seth", "Seth starts to sing the 'Baby Bottle
    Pop' song", "Dutch is reminded of the time he was blasted by cum".
  - Sean's "He says it all in 1 second" and Jonas's "Seth scares everyone" and
    "Seth gives a little kiss :)".
  Kept as GM-plot flavor because the fiction uses it: Fungo/Seth/Morra darkness and
  water beats, the incinerator aside, and "Seth falls asleep" (converted to Vortox;
  **second look?** it may be the GM ending Sean's session).
- **`✂` lines kept** (later lines depend on them): "You guys have fun" (merged with
  "and don't die"); "Now we should conduct the Ceremonial Kicking of the POWs"
  (Zion's "I am not doing that" answers it); Jonas's "You'll thank me later!"
  (paired with Bellow lifting Dutch); "Bellow walks into a store…" and "Bellow
  heads back to the ship to find Dutch" (the store scene's setup); Edmin's "Zion. I
  still require a purchase." (Zion answers it).
- **`✂` lines cut, as flagged:** Sean's "Bigga", "IEEOEOW", "/kill u", "HMMM", "Maybe,
  we should wait for one to leave", the Fortnite run ("number 1 fortnite royale",
  "tilted tower", "build ramps", "we are under fortnite attack", "fartnite"),
  Jonas's "hmm?" and "Heh.", Edmin's "Are all of our compatriots out?", Trey's
  "The duo walk up to the station", the enemy_b/c/d name fragments, and all the
  gifs and links.
- **Also cut:** noise ("suchahndeeznuts", "poop", "Yigga", "Nes."), the
  Jew/"spacejews"/"anti-Semitism" jokes and "Who is Zander?" (OOC), Jonas's
  "(About 100 bucks…)" and Trey's "He has 5 tickets left" (accounting asides),
  "Hazmat suits / Spacesuits", "apol", "finger" x2, "Brodingus", ";;" and pings.
- **Kept though they sound meta:** "8ball Brody moment" / "It's my catchphrase" (Seth),
  Seth's "Narutoball Prime-Z" and "disturbance in the force" (Earth references,
  flagged below), the Seth P.I. noir narration (Sean's own bit), and Morra joining
  it. Seth's necrophilia, piss-and-cum charging and diaper baby bits are kept but
  trimmed of duplicate lines.
- **Terry:** Hunt520's shopkeeper is untagged, so he imports as Terry (the cast
  default). His `↪` reply lines are kept.
- **Inventions worth a glance:** Seth crouching by the twitching corpse; Raven B's
  "his gorgeous hair" graze on Morra (Trey's joke, kept; **possible fake flavor**);
  the Suchan pulling out the pocket knife after the `/choose`; Seth wrapping the
  hostages' mouths (from the "Sí" 8ball); the tagged `Marv` actions on Trey's
  narration; the shop elf's gesture beats.
- **Guesses:** who voices which Suchan/worker line (Suchan: the corpse, workers: the
  hostages); "The corpse muffles, Shut up elf" became a tagged Suchan mutter;
  "Squi" as the name of
  Emmett's family voice (the raw had "Squem, language!" with no tag).
- **Anachronisms to decide** (left as is): Fortnite (cut), Invader Zim, Boogie
  Wonderland by Earth Wind and Fire, Michael Jackson "Billie Jean", Naruto/
  "Narutoball", "force", "Space Marines from 40k", "power ranger", "PTSD", "Baby
  Bottle Pop" (cut), "condom" in the Space Rule.
- **Gay/slur flags:** none left. (The "lifestyle" lines were cut with the Bellow
  bit.)
- **Density:** 209 actions to 437 quotes (0.48), up from 0.45 in the raw. Most of
  the raw was noise, so the count fell in both columns.
- **Moves applied:** five (the Marv narration after Seth's crying; Bellow and Zion's
  ship beats after Seth's "get on your knees"; the pocket-knife `/choose`; Bellow's
  store entry after Seth's question). Five flagger hits are left on purpose.

## Ep 4: judgment calls for Trey to review

`md/ff4/4-blackjack.md` is installed and verified: 0 unresolved speakers, no cut
marks, no OTHER lines, no EMBED/COMMAND flags. `api/ff4/4-episode-4.json` is
generated and **imported** (after Trey's own edits; 888 messages). Nothing is committed. The episode is the Torrid
ambush on Barbona, Zach (Hunt520's first real episode as Zach), the tower dive
for the Llamanian weapons, and the Fungo-spore blackjack game.

- **Trey's correction applied:** the Suchan "cause some havoc" pair is real. It's
  now a Vortox action ("...He wakes to find Dutch cuddled up against him.") plus a
  `Suchan` line, and the Jonas 8ball behind it (reworded "Is Dutch caught cuddling
  the Suchan when the crew wakes up?") was kept. The `Suchan` lines and the intercom
  lines the host speaks ("Get out of my head, pest!", "GET OUT GET OUT GET OUT!",
  "IT'S EATING ME!") are all tagged `Suchan`.
- **New NPC tags** (each a new Character row): `Torrid A`, `Torrid B`, `Torrid C`,
  `Torrid Voice` (Hunt520's unseen voices outside the ship), `LS` (Llamanian
  Strategy, on the comm; already in raw), `Intercom` (the ship's computer, already in
  raw), `Garrick` and `Jess` (Trey's cutaway), `Emmett` (Trey's "feels a
  disturbance" line moved under Zander, who voices him). `Squi` is only mentioned.
- **GM narration converted to Vortox** (IDs kept): the cold-open wake-up and comms
  note, the flooding hangar, Torrid arrivals and the tower, the banging outside,
  the reinforcements, "Dutch's body floats", Seth's Harlem Shake, the blackjack
  deals, hands and turn calls, the tractor beam beats, the four Space Rules
  (plain text). Torrid attack lines by Zander/Trey are `Torrid A/B/C` actions.
  Fungo's own actions stay Zander's.
- **Fake flavor cut** (Trey then removed more by hand, including Trey's Fungo
  fingies/smooch lines, which I had wrongly kept): Zander's "Zion's hands are erased by a DM", "The DM
  screams", "Dutch blanks out... 'work'ing on himself"; Trey's cum-rain on the
  Torrid (and Zander's Harlem Shake reply); "Dutch rips a phat one" / the
  exploding-hull line; Zander's "Bellow was actually smelling his own odor";
  Trey's `Zach` "My bingies hurt / Ow" x6 and the `Morra`/`Bellow`/`Dutch`...
  "I think I just him splat" run; "Fungo latches itself onto Trey"; "Fungo likes the
  name Xander". **Second look:** the Harlem Shake + `Emmett`/Squi call are kept
  (Emmett's call at 06:28 ties to it), and the bong bit is kept because Dutch and
  Zion react to it in-fiction. The Garrick/Jess cutaway rides on it.
- **`✂` lines kept** (later lines depend on them): Pauline's hit on Zach and
  Oblivion's on Dutch (Dutch collapses, Zach at 5/20 is referenced), Dutch's
  "THIS SHIT AGAIN", the Zach-hits-Zion beat, Zion's ✂ heal (Dutch 9 hp), Bellow's
  "Dutch, please calm down!", the Morra-sank/Zion-moping/bong exchange ("A what?",
  "A bong…", "You guys smoke?"), Bellow's Go Fish, "Another time, then" and "the
  three of us have arrived", the second `/choose` cannon, the pants-bet `/choose`
  and "Give me that", Morra's 21 8ball, "MORRA, YOU ARE GOING TO SINK US ALL." (Brody's
  answer needs it) and Jonas's "You're so good at this…" (Brody's "Thank you?"
  answers it).
- **`✂` lines cut, as flagged:** the "LOWERCASE" run, Jonas's "No, you don't need
  to kill. You need to live.", Silas's "He'll be fine", "I don't know" and "Hm?",
  Trey's "Cry about it", the repeated happy-dance line, Count Chocula ignoring Zach,
  "You're just in time for blackjack", and Bellow staring at his cards.
- **Also cut:** all tenor/giphy gifs and `📎` files, `/info` and failed-command
  embeds, the `/delete fungo` bit, the "Fungo pop / Hezzy / Chungus" name riffs that
  address the players, Trey's fandom-wiki Torrid link embed, "Balls", "butt",
  "Cock", "Penis", "FUNGO"x200, keyboard mashes and pings, the ✂-less "READ"
  reminder, "not true", and "garricks sheer willpower prevented the bong from
  breaking" (Jonas playing GM).
- **Continuity fixes:** Morra is they/them throughout (Zion's "He'll be OK" →
  "They'll be okay", "bring them back up", "Morra just jumped"). "Torrids'" side
  8ball footer, "descent", "turbulence" typo fixes. Hunt520's 8ball "Does Zach
  enter the Ship?" etc. stay. Trey's `/choose` "the tractor beam throws Morra,
  Xander, and Zach…" keeps Trey's nickname "Xander" for Fungo verbatim (embed titles
  aren't editable).
- **Morra's Note** is an `<embed>` under Zander ("Pick me up.").
- **Guesses:** Silas's "I'm not hit pet 'r anythin'" became "I'm not a pet 'r
  anythin'"; "Get a bucket and a mop, that's a wet-ass verinian" (unclear); the
  Torrid C slingshot line ("snatches up a fallen Torrid's slingshot") reconciles
  the B/C mix-up in the raw; Zion's "Bellow, you're winning right? I bet for you."
  reads oddly because Bellow already left for his nap (left as typed).
- **Inventions worth a glance:** "Zion glares at Dutch", "Dutch tries to bring
  Pauline to bear, and misses", Zion's hard look on the "I'LL ALLOW IT!" 8ball,
  "Zion has bags under his eyes", "the water stays where it is", the autopilot
  docking Seth's ship, Fungo lowering the Splinter Blaster.
- **Anachronisms to decide** (left as is): Count Chocula / Count Fungula / Count
  Chungus, John Wick, "John Fortnight", Harlem Shake, NES, HVAC, Minecraft ("minecraft
  splashes"), Jesus (x2), "skill issue", "Royal Flush"/poker/blackjack (fine),
  "Apex", "Torrid" wiki link (cut). Suggested swaps: Count Chocula → Baron Sporeula,
  HVAC → "climate control".
- **Gay/slur flags:** "fungal fudgepacker" (Zion's insult); left as is for your list.
- **Density:** 349 actions to 458 quotes (0.76), raw 352/478 (0.74). The players
  gave a lot of action lines already, and the many cuts (gifs, gags) took away as
  many quotes as actions. I added only Tier 1 beats.
- **Post-review:** Trey hand-edited the file (removed banter, reordered), re-imported
  it (888 messages). New rows: `Torrid A/B/C`, `Torrid Voice` (character names are
  globally unique, so `Torrid A` is one row). The `Jess` tag imports as existing
  `Jessica`. Persona `Drowned Llamanian` (Vec, from "Fungo takes some time to get
  adjusted", meta + DB row `vec_drowned_llamanian`) is set by SQL. Wiki: the
  "unnamed corpse" page is wrong (see below).
- **Moves applied:** seven (the `/dmg` after "Or airlocks", the 8ball after "hairless
  Apex", Zach's lift after his "Self defense", Bellow's confusion after "Guess
  you'll be taking a swim", the tower fall after the cigar, the bong 8ball after
  "It is deep", the turbulence after the "FUNGOOO"). Ten flagger hits are left on
  purpose (replies and short interjections).

## Ep 4 continuity for later episodes

- **Fungo/Vec bodies:** in Ambush the Suchan (a walking KYL corpse) is the host the
  fungus rides. At its end Fungo stows a second KYL corpse in the engine room; it is
  never animated. In Blackjack the moving corpse is the Suchan; Fungo's connection
  falters, the host regains motor function, and Fungo bursts out of its back onto Zion
  (later his head). Fungo is bodyless (rides Morra) until it takes a Llamanian corpse
  from the wreck at the end (persona `Drowned Llamanian`). The wiki page "An unnamed
  corpse from the KYL Trade Center" says it was animated at the start of Blackjack,
  which is wrong. A correction is drafted; it is unpublished (needs Trey's go-ahead
  and the MediaWiki MCP, not loaded in that session).
- **Recurring nicknames for Fungo** (Trey/Zander): Count Chocula, Count Fungula,
  Hezzy Mushroomula, Fungobelingoid, Fungadunga, Mushy-boy. Anachronism flags apply.

## Resume here (session handoff)

State (2026-10-05, end of session): eps 0-6 are edited, imported and committed
(Trey hand-tuned them; never regenerate over them). Eps 7-20 are edited, verified
and imported, and await Trey's review; Trey's first-round rulings on eps 7-15 are
applied (see the ✅ lines in `REVIEW-ff4-trey-queue.md`). Nothing from eps 7-20 is
committed. **All FF4 episodes edited. Trey's review of the queue is done (2026-10-07): every `- [x]` item is applied (✅), and every unchecked `- [ ]` item stands as-is by his ruling. Eps 18-23 re-imported.**

**How to run the next episode (token-lean workflow, Trey 2026-10-05):** the main
session is only the advisor, and one Sonnet subagent edits one new episode, then
stops. The agent reads ONLY `editorial/FF4-AGENT-BRIEF.md` (it replaces this file
and the style guide), greps `meta/ff4.json` for the episode's title, file_name,
export number and personaTimeline, and greps the previous episode's section here
for continuity. It reads parts only with `editorial/ff4_view.py --short`, verifies
with `editorial/ff4_verify.py N --brief`, and appends its notes to this file and to
`REVIEW-ff4-trey-queue.md`. That is about 115-180k tokens per episode, against 248k
before. Review-ruling passes over already-edited episodes may batch several
episodes per agent. Before any re-import, check the episode's commentaries.

**Settled (Trey, 2026-10-06): "no host, just Vec".** Once Vec leaves a body he has
no persona; an unnamed body he occupies (ep 20's mercenary) is not a host persona.
The timeline now ends Argonian at "husks as Vec pops out of him" (ep 18), restarts it
at the top of ep 19 and ends it at "Vec pops out of the argonian and throws the body"
(ep 19); eps 18-21 re-imported. `ff4_import.py` aliases `GU News` (Trey's retag in
ep 19) to the existing `GU News reporter` character. **Seth's `Sethkinki` persona (Trey, 2026-10-06):** every Seth
message after he is named in ep 21 carries persona `Sethkinki` (personas id 27,
slug `seth_sethkinki`, character 1920), via a `Seth Im'Kin'ki` personaTimeline span
anchored on "Seth's chin has become more gigachad"; `ff4_set_personas.py` handles
Seth. Ep 23's one `Sethkinki`-tagged line is now `Seth`; the DB character 1925
`Sethkinki` has no messages left. The DB persona row 7 is
spelled `Llafay Terres` (Trey hasn't said whether to rename it).

**Rules learned since the Pilot** (also in the Claude memory files):
- **Unwrapped player text is OOC by default** (Trey, 2026-10-05). In-character
  speech was wrapped in backticks/quotes (the converter makes it `>` lines), so a
  plain unwrapped line is table talk: cut it, don't keep it as OTHER.
- **Morra is they/them** (Brody). The raw says he/him a lot. Fix in text and
  8ball footers; grep near "Morra" after each episode.
- **GM attribution.** Untagged Zander/Trey lines default to Vec/Zion. Scene
  description and outcomes → Vortox; NPC-subject actions → that NPC's tag; an
  `<embed>` can take a speaker via a lone `` `Name`: `` line above it
  (`md-to-api.py`).
- **"Black" is a canon eldritch species** (like an eldritch god), never a slur or
  racial joke. Keep every reference ("a hologram of a Black", "BLACK IS REAL!",
  "SWEET BLACK NO", `/choose` options); never cut or reword it.
- **Fake flavor text is cut, never converted** (see Ep 2 notes).
- **/choose embeds** have no asker; `ff4_verify.py` no longer flags their footer.
  Cut retries and junk (`/info`, "does not exist", "Unable to Roll", wrong-target
  hits), keep hits/misses verbatim.
- **GM attribution, refined (Trey, 2026-10-05).** An untagged GM line that narrates one player character's own action or outcome can go to that character (tag it `` `Name`: `` under the typist's block). It goes to Vortox only when its scope goes beyond that character: an environmental hazard/occurrence, a scene change, or an outcome affecting others. List every such attribution (line ID, text, whom) in the episode's review section. (This replaces the older "outcomes go to Vortox" wording above.)
- **Hunt520 = Terry** (ep 3); his untagged lines import as Terry.
- **Duplicate block IDs** (a converter quirk on a Trey action + Vortox embed pair)
  make `ff4_move_blocks.py` assert; rename one temporarily.
- **Sean and Brody** debuted in ep 2; **Hunt520** in ep 3.

**Import:** `python3 md-to-api.py ff4 md/ff4/N-slug.md`, then
`python3 editorial/ff4_import.py api/ff4/N-<file>.json` (it deletes and recreates
the episode, so check commentaries first), then `python3 editorial/ff4_set_personas.py N`.
A new `Vec as <Host>` persona needs a `personas` row plus a `pid` entry in
`ff4_set_personas.py`; check for an existing row first.

**Open questions for Trey:** the fake-flavor list in ep 3's notes; NPC tag names
(`Suchan`, `Raven A`–`D`, `Squi`, `Llao Khug`); avatars for Edmin, Llawdon, Vec;
the `Edwin` (127 msgs) vs `Edmin` duplicate character in the DB.

## Ep 5: judgment calls for Trey to review

**Update (after Trey's review):** Trey hand-edited the installed file (for
example, the tongue/"Ew." foot beat and the `:)` line were removed or
reworked), asked to keep the Morra "pelvis" exchange, and asked for a
punctuation and capitalization pass. Done: Zander's "Seth turns to Morra and
attempts to find a cock." and Morra's "I don't have a pelvis…" are restored
(the "second look?" item below is settled), 78 lines got punctuation and
capitalization fixes, and the episode was re-imported (784 messages,
personas reapplied). Trey's edits were preserved. Never regenerate over the
installed file.

`md/ff4/5-diplomacy.md` is installed and verified: 0 unresolved speakers, no cut
marks, no OTHER lines, no EMBED/COMMAND flags. `api/ff4/5-episode-5.json` is
generated and **imported** (783 messages, 784 after the review pass; the old direct import was deleted, 0
commentaries). Vec's persona rows are set (Drowned Llamanian 54, Fursean 46,
Fungo 20). Nothing is committed. Episode: Moldarr. Fursean (Fungo in a
Llamanian researcher's body) reunites with Remmond, Seth's Miny/Megah Seth
rampage covers the Moldak capitol in fluid, Dutch bluffs the council as "Baron
von Shambassador", the fungus bursts out of Fursean, and the crew flees an acid
storm.

- **Density:** 278 actions to 438 quotes (0.63), raw 300/497 (0.60). Mostly
  Tier 1: the raw was already action-rich and half of it was table noise.
- **New NPC tags** (each a new Character row): `Remmond` (Trey; the Llamanian
  survey leader, Zion's old classmate; raw called her "Llamanian woman"/"Rem"),
  `Neljis Boplily` (Trey; Moldak council head). Both created as Trey. `Guard 1`,
  `Guard 2`, `Random minister`, `Emmett` (Zander's phone call), `Miny Seth`
  already existed. `Feet goblin` was cut with its joke.
- **GM narration converted to Vortox** (IDs kept): the cold-open scene line,
  docking hatch, "autopilot lands terribly", "ship is now on Moldarr", the
  outpost description and Remmond's approach, the AC in view, the bomb on the
  ground, the church collapse, guards grabbing Dutch, the council chamber,
  Megah Seth's heal, the semen flood, the acid/magma storm, Seth teleporting,
  and the closing Space Rule ("Space Rule #2392: Do not try diplomacy with a
  minyiac on the loose."; the raw had two competing versions and a typo).
  Fungo's and the researcher's own actions stay in Zander's block.
- **Fake flavor cut** (per the Ep 2 note): "Dutch is mysteriously penetrated
  suddenly", "Zach has a giant human boner, and the other 8 councilmen do, as
  well" (Zach's plain blush 8balls stay), "Dutch now earns the title:
  Real-Estate Agent", "Dutch's pinky toe tickles the councilman's armpit",
  Dutch twerking (again), "Fungo high fives Dutch with a foam finger",
  "Xander the Fungus… moves Seth's legs like a helicopter" (Zander's follow-up
  that the spores push Seth away stays), "Bellow has the meme Epic Face" and the
  "shrug his balls" run (a table running gag about waking up). **Second look:**
  the "Seth turns to Morra and attempts to find a cock" action was cut together
  with Morra's "I don't have a pelvis" reply; the pair may be worth keeping as a
  joke, since Morra reacted in character.
- **`✂` lines kept** (later lines depend on them): Zion's holodeck button
  (opens the docking hatch); Llawdon's "Landing could've been smoother…"
  (Zion's "Maybe if you hadn't hibernated" answers it); "Apparently it's a
  really hot planet"; Fursean grabbing Zion by the throat and "You won't touch
  me" plus Zion throwing the body off (Dutch's "What's with the aggression?"
  and Zion's "You got some nerve now" answer it); Llawdon's "Yes sir!?" salute
  (rewritten as an action: he mistakes the researcher for Llafay); Guard 2's
  "They just entered without our approval!"; Zion's "Zion, help!" aside and
  reply; Fursean's "Zion, help!"; Morra's and Bellow's Shambassador lines and
  Dutch's "Yes, Quite."; Zion running back "bloodied by the Fungal explosion";
  "Wait, what I mean is-"; Bellow digging for salves; Morra spotting corpse
  candidates; Dutch's "Gee, thanks."; the Kahbrun corpse line (now a Vortox
  action); Zander's "fungus explodes out the body" `/choose`.
- **`✂` lines cut, as flagged:** the comms-noise / Fortnite bit, the turn-order and
  mic-fix chatter, "Is it my finge- I mean, my turn?" 8ball, Zion's "Morra,
  what are you looking at?" (replaced by an added "Morra stares blankly into
  space." so Dutch's "Nice eyeball" still lands), eggs one-liners, the "RACE
  WAR!" / "KILL ALL WHO OPPOSE!" run, "i 1 pumped a kid with shomtegun" and
  "accident maybe lol", "I'm coominggggg", the long "AHHHH" screams, Zander's
  "the researcher stood, towering up" line, "A-", "Ending episode!", the Photone `/choose`.
- **Cut, not flagged:** every gif/link/attachment, Trey's `@Michael do an 8ball`
  pings, Michael's mic/PC chatter and the whole "who is captain" OOC thread,
  the "override 8ball" exchange (Llawdon simply stays asleep), the "Dutch is a
  verinian… (Wolverine)" table aside, the "Your"/"Yourself"/"Killyourself" fragments, Sean's "Epic", "Eww", "Brb", "Kk thx man", "Almost done eating",
  the Genius lyrics link, the rain-of-glass 8ball ("Nyet", overridden by Trey's
  ruling; the storm stays as Vortox actions), Zander's `/8ball` "Say yes" (a meta ruling),
  the Rem-singed 8ball, and "er, ship." typo fix.
- **Combat:** Spear and heal hits on Megah Seth stay verbatim (90 → 1/90). Cut:
  the duplicate `Megah_seth` 15-damage roll and Sean's overkill hit on `Enemy_a`
  (-18/20); Sean's 16-damage hit (4/20) stays and "Guard 1 falls" follows it. The
  failed `/dmg fungo` (does not exist) is cut; the `Fungus` 2-damage bite stays.
- **Kept though it sounds meta:** Miny/Megah Seth is Sean's own bit and the plot
  spine of the episode (incl. the crude cum/piss beats, kept as source
  material); Seth's "Lots of building and battle royaleing" (anachronism, below).
  Jonas's `/8ball` "does Bellow finally speak up" (No, monotonous tone); Michael's
  "Is there a random bomb where the crew is?" 8ball (Yup) kept for the bomb.
- **Guesses:** "Remmond" is Rem's full name (Fursean says "Remmond! It's me!");
  her `Remmond` tag is used on every Rem line/action (the raw used `Llamanian
  woman`, `Rem`). "Zion, contact intelligence" etc. all read as Fursean.
  Sean's "Dutch becomes a human-sized marble with a mouth" (the 8ball caveat) was
  merged into one action, and Trey's/Zander's marble beats follow it. Trey's
  "Have we found Joseph yet?" became "Have we found Fungo yet?" (Fungo's nickname
  in the raw is unclear); Brody's "Jack Black" nickname for Fungo became
  "Fungo" in dialogue and the 8ball question. The "248.169.196.224" whisper from
  Morra was cut as unexplained. The raw has Zander in Trey's "Seth teleports
  into his ship" beat twice; only Trey's stays.
- **Inventions worth a glance:** "Llawdon is fast asleep." (from Michael's
  `_sleeps_`), "Dutch wanders into the kitchen to help Morra.", "Morra stares
  blankly into space.", Llawdon mistaking the researcher for Llafay.
- **Anachronisms to decide** (left as is): "battle royaleing" (Seth's Fortnite
  joke, kept; the bare "fortnite"/"Fortnite Fingies" lines were cut), "Sarah Palin
  mech" (Sean's action; suggested swap: "a guard mech"), "mimicking Homelander"
  (suggested: "mimicking a cape hero"). The Wolverine, Jack Black and Genius/rap
  lyric references were cut or reworded.
- **Gay/slur flags:** none found. Sean's "slut fun guy" isn't a slur and stays;
  the "RACE WAR!" run was cut as noise.
- **Morra pronouns:** scanned; the only he/him near Morra was the (pre-existing)
  recap embed, which is verbatim and doesn't refer to Morra that way.
- **Moves applied:** 47 (2 passes). The flagger went from 36 hits at 45s to 4, all
  replies or reactions left on purpose: Zion's hatch exit before "Dutch, might
  be good to get a spacesuit" (a sequence), Zion stepping back then whispering to
  Dutch after "Dutch is wheezing" (reply), Dutch's "gas" line then "Dutch gulps"
  (reaction), and Dutch's "DAMMIT FUNGO" after the corpse explodes (reply).
- **Import notes:** created `Remmond` and `Neljis Boplily` as Trey (species 7)
  before uploading. The importer's character selects all resolved by name (no
  remaps needed; Edmin isn't in this episode).

## Ep 6: judgment calls for Trey to review

`md/ff4/6-obligatory-shopping-episode.md` is installed and verified: 0 unresolved
speakers, no cut marks, no OTHER lines, no EMBED/COMMAND flags.
`api/ff4/6-episode-6.json` is generated and **imported** via the API (681
messages; the old direct import was deleted, 0 commentaries; Vec's Fungo persona
set on 56). Nothing is committed. Episode: diner and billiards at a station (Terry
meets Zach), the fungus wrecks Bellow's day, the crew lands on Fleex for the
Zennigan smith Ziga's hyperdrive, Fungo kills the shopkeeper and rides his corpse,
the Xurgate thugs, then Los Yelsi (Llamanian spec-ops, Emmett's contact) reveals
Emmett is alive, hands out gifts, and the crew's ships are tractor-beamed into a GU
station. Brody and Maxwell are absent (Morra and Edmin only get gifts via Zion).

- **New NPC tags** (Character rows): `Hellus` (Zander; a Nagavari who lives in the abandoned building next to the smith's,
  a new NPC fully taken over (revived) by Fungo; **Trey confirmed 2026-09-29:** Hellus is
  not the smith, and the shopkeeper the crew talks to is Ziga), `Nagavari Woman`,
  `Burly Reptile` (Trey), `Ziga` (the smith; merges raw `Zennigan smith`/`Ziga`), `Tacengi`
  (merges raw `Teethy one`/`Teeth Monster`, named mid-scene), `Los` (Los Yelsi), `Shopkeeper`
  (the Schlok Slime dealer; raw `Shopkeep` merged). `Miny Seth` tags cover Sean's small-voice
  lines; `Emmett` is the phone voice. The dealer's own corpse is the one Fungo rides, and
  Hellus's lines/actions ("finds his brother... probably overdosing") are the revived body.
- **GM narration converted to Vortox** (IDs kept): the cold open, the outpost/streets,
  the shop description, the Nagavari reveal and the shopkeeper's death, the transmission
  volume, orbit arrival, the hoodlums, the convulsing body, Miny Seth being shredded,
  the jar lid, Los's arrival, the closing Space Rule ("Space Rule #721: Barter
  carefully."). Zach's loudspeaker summons became "Zion speaks over the ship's
  loudspeaker" (Trey's block, `Loudspeaker` tag dropped as in ep 0).
- **Fake flavor cut:** Trey's `Terry` smooch/suckle actions and `Terry: They're
  minerals, Zach! Jesus.` (with the "polish his Rocks" line); the `Bill Nye` bit;
  `Movie character` / `MJ: Time for the prostate exam`; Trey's `Bellow: No, i Have to
  PEE!` and Zander's bladder/tingle lines (the pee gag); the `Dutchina` gender-pill
  pair (Trey and Zander); Trey's `Emmett: Los, are you the feet goblin?`; Fungo
  twerking; the "Seth pets Emmett (a rock with googly eyes)" run; the height-gag
  numbers; the Rick / Obama / lego-figures riffs. **Second look:** Trey's "Zion goes
  to Hellus and kills him for interrupting the smith" was Zander's line (with an
  `@Trey` ping); I moved it to Trey's block because Fungo's chestburst needs it.
- **`✂` lines kept** (later lines depend on them): Zion's "We're good. We have
  places to be."; Fungo on the shopkeeper's head; Silas's pickpocket 8ball and Dutch
  pointing the knife; Bellow taking the knife and Fungo's throw ("Um..." answers);
  Zion's/Bellow's "Let's get moving" pair; the smith's first greeting; Zion's
  "That would be karma, my friend."; Zach paying the bill; Zach's typed "same reason...
  I just want a place I belong, sir"; Zach turning to Bellow and his "can I have that
  back" lines; Sean's Miny Seth 8ball (Dutch's "small man in my ear" answers it);
  Bellow's "We met at a shop..."; Zach's "principal's office" walk; the "three figures"
  line; Los's "I will give you something" and "some other trinkets"; the golden
  robot-squoatling model; Bellow's Bellow-and-Zion "Bad knife" pair was cut, not kept.
- **`✂` lines cut, as flagged:** the new-orders `/choose`, the Fungo-shopkeeper 8ball
  ("No, but something..." contradicted the jump), the Hellus-residence 8ball and Zander's
  "overriding it" aside, the failed-deal 8ball, the ticket 8ball plus Dutch's jig, the
  embarrassing "Still calling out" line, Dutch's "run along... uglier than him", "Zach
  is confused" fragments, Fungo pets Zion (the 8ball said no), Zach/Bellow emoji spam,
  and SQUID plus the bot's reply.
- **Cut, not flagged:** all gifs/links/📎 recordings, `/roll 5d100` and the 1810-damage
  `/dmg` on Los (joke; Los is just "scratched"), the failed `/dmg paulina`, the "An ant"
  and reptile-corpse `/choose`s with the Fungo-corpse 8ball, Sean's gibberish (Nyeh,
  wewewo, Awoooo, "Fart sound effect", pirate/dougie/fortnite dances, "GOOD MORNING USA"),
  "Seth creams", "Seth gropes", "Seth balances the model on his penis", "Ending episode!"
  and the Schlok-Slime-era pings.
- **Kept though it sounds meta:** Seth's crude "I pissed on his corpse" and "stuck my fat
  cock up that lady's hooha" (crude source material, as in ep 5); Seth's "Los it is not,
  fuck boi." (ambiguous, **second look?**); "My porno collection!"; Dutch's "Skill issue".
- **Continuity fixes:** Fungo's 8ball footer "Zion's sword" became Zach's; "Darth funger"
  became Fungo in the jar 8ball; Zach's sword hand-off rewritten so Fungo keeps it until Zion
  throws it; "the drug dealer" became the dead shopkeeper. Nagavari narration kept
  ("The shopkeeper is a Nagavari."); Trey's pasted Nagavari species description was cut (Trey: it's a wiki paste, so
  removal is right).
- **Inventions worth a glance:** "Dutch sinks three billiard balls with one masterful shot."
  (after the 8ball), "Seth thinks better of sneaking Miny Seth into Dutch's nose.",
  "Bellow pulls Dutch back out of the Nagavari's wings.", "Zion kills the burly reptile."
  (after the /choose pair), the ships pulled up by the tractor beam, Zion taking Morra's
  and Edmin's gifts, "Zach isn't wearing one [a badge]".
- **Anachronisms to decide** (left as is): "Count Chocula" (Fungo nickname, kept once in
  an action), "Skill issue", "Jack Black" (rewritten to Fungo in the slipping line), the
  WALL-E/M-O simile, "Kraken" (probably the smith's keyword), "Hypernet", "Titans' power",
  "GMod" (cut), Rick/Morty and Nye (cut), "Michael Jackson" (cut), "Now and Later" (cut),
  "Fortnite" (cut).
- **Gay/slur flags:** the "Loud Nigra Scream" link embed and Zander's "loud nigra" line
  were cut as a slur meme. No gay-insult uses left. "spazz" (the smith's knife, Trey's
  word) is left as typed.
- **Morra pronouns:** none referenced with he/him in this episode (Morra is absent).
- **Density:** 278 actions to 354 quotes (0.79), raw 327/434 (0.75). Mostly Tier 1: many
  raw lines were already actions and much of the raw was noise.
- **Moves applied:** 23 (after the Zander fungus interruptions, Seth's phone beats, Zach's
  8ball run, Ziga's price talk and others). The flagger went from 30 hits at 45s to 18,
  left on purpose: Zach mirroring Bellow's stare, "Fungo shakes" then Bellow's jump (cause
  and effect), the Hellus/Ziga parallel scene, Fungo's reactions after Zion's sword throw,
  Fungo/Bellow set-down ruling, Miny Seth's nose beats (reactions), the thugs' back-and-forth,
  and Dutch's "...Ow." then Bellow's 8ball (a sequence).
- **Split-voice fix (Trey caught it after import):** the first `Ziga` action was left in
  Zander's block (his Discord message) while Trey voices Ziga, so the reader showed two
  blocks. Moved it under Trey, and moved Trey's `Tacengi` "My teeff..." under Zander (who
  voices Tacengi). Re-imported. **Lesson: after editing, scan every NPC tag for lines
  under more than one player**; adjacent lines for one NPC must sit under one player.
  A quick check: group tagged lines by tag and list tags with 2+ block owners.

## Ep 7: judgment calls for Trey to review

`md/ff4/7-marv-attacks.md` is installed and verified: 0 unresolved speakers, no
cut marks, no EMBED/COMMAND flags. Imported via the API (Trey/
trey123; episode deleted first, 0 commentaries; 761 messages: 287 ACTION, 402
QUOTE, 70 EMBED, 2 BOT_RESPONSE; Jonas's two bare "BLACK!"/"BLACK IS REAL!" shouts were later cut under the unwrapped-text-is-OOC rule, re-imported). Vec personas set (Fungus 56, Marv 2). Nothing is
committed. Episode: the crew split in two while the GU tows the ship. Zion, Dutch,
Bellow, Seth and Fungo wait in Los's two-seater; Morra and Llawdon are on the
towed ship. Seth's Batman bit (Dutch is Robin) leads to a zombie "Joker" in the
warehouse; Marv (Ravens) ambushes them behind a hologram and dies (Dutch, Seth's
cum beam). Seth breaks his neck and visits Elf Heaven (Ameno's new husband, the
Shadow). Zion finds the keys in the cash register. Morra's wormhole powers swap
Emmett and Seth by accident.

- **Density:** 287 actions to 402 quotes (0.71), raw 304/502 (0.61). Mostly
  cuts; additions are few Tier 1 beats (see below).
- **New tags / casts:** `Joker` (maps to existing "The Joker"), `Voice`
  (Zander, Marv's hologram voice), `Shadow` (Sean voices both Seth and the
  Shadow in Elf Heaven), `Marv` (Trey's NPC; his actions are tagged
  `` _`Marv`: ..._ ``), `Los`, `Emmett`, `Squina`, `Squi`. `Squi` imports as the
  existing `Squina` (remapped in the import script). `Vec as Marv` (Fungo in
  Marv's corpse, 2 lines) uses persona row 10; **`ff4_set_personas.py` now knows
  `Marv` (10) and `Sascha` (11)**.
- **GM narration converted to Vortox** (IDs kept): scene-setting, rulings after
  8balls (docking distance, wormholes, "It's a zombie", barricades, keys in the
  register, "hallucinatory dreams", Emmett's wet hand, the swap cause),
  environment beats (gas, alarm, breach, SPLAT, CRASH, Marv's armor), and the
  "Dutch has leveled up!" notice (plain bot text). Marv's own actions are
  `Marv`-tagged; Fungo's and the reptile corpse's stay Zander's.
- **Fake flavor / noise cut:** Zander's "Dutch farts in Bellow's face", Fungo's
  "Princess Peach"/"funny little dance", "Mario paint" lines (dialogue kept),
  the "Zander"/Africa dream bit, Seth's size gags (1 nanometer, super Saiyan,
  armor and fire, booger, chicken sandwich), baby Joker, "BIRD PERSON" run,
  Bellow's "nightmare marrying Terry" (the "dreaming of Terry" line stays;
  **second look?**), "Answer Emmett, damnit" with Brody's reply, all joke
  8balls about the table ("is trey stinky?", "does Zion kill Bellow this
  episode?", ship gets smaller), Trey's "I'm so happy... I could cream" and "sex?".
- **Black is canon (Trey's review):** "Black" is an in-universe eldritch species,
  not a slur. Restored: Sean's `/choose` "Hologram of a Black", Jonas's "BLACK!"/
  "BLACK IS REAL!", Dutch's "...hologram of a Black", Brody's "SWEET BLACK NO!" (Jonas's bare "BLACK!" and "BLACK IS REAL!" were removed again as unwrapped OOC),
  and Zander's follow-up back to "The hologram reaches out to Seth..." (Vortox).
- **Two restores (Trey's review):** Vortox "It's still ringing." (sets up Seth's "I gotta
  take this call"; "Answer Emmett, damnit" stays cut) and Trey's "Zion is tossing a
  golden ball up and down, fighting monotony." (the snitch reply stays cut).
- **`✂` lines kept** (later lines depend on them): Los's Joker entrance, Zion's
  bag/Llafay's Plasma Blaster pair (Fungo aims it), Fungo splatting Morra's
  eyeball, "Bellow, are you-" / "Bellow is unconscious", Bellow falling when Dutch
  is thrown, Emmett's "Who's Marv?" and Seth's "Some Raven.", Zion's "Oh, right,
  where'd Seth go?", Bellow trembling in his dream, Dutch's snapping-out line.
  All other `✂` lines were cut as flagged.
- **Combat:** hits/misses verbatim (Marv 80 -> -11; Bellow burned and rocketed;
  Dutch 8/25). Cut: five "does not exist" failures, the failed `/heal marv`
  retry, a joke `/8ball`. Kept the Brody `/choose` "marvin's toes are exposed"
  (joke options in the footer, verbatim) and the Zander `/choose` that decides
  who the thrown crate hits.
- **Inventions worth a glance:** Marv snatching Seth before "Seth struggles out
  of Marv's grip"; "Marv fires a rocket launcher at Bellow" before the rocket hit;
  "Seth decides that Dutch is Robin" after the `/choose`; "Llawdon's shot goes
  wide"; "Morra and Llawdon search the ship but find nothing of use";
  "Llawdon murmurs something about a B plot"; "Zion glares at the reptile".
- **Rewrites/guesses:** Brody's "Fuck You Fungus" / "Friday Night Fungus" /
  "Five Nights at Fungus" became plain "Fungo" (8ball footer reworded to "Does
  Morra catch Fungo?"); the Brody teleport 8ball reworded ("...teleport Morra and
  Llawdon to the Joker?"); the "Hologram" voice lines are `Voice`; "Well, Seth, it
  was nice meeting you" is tagged `Shadow` (it was untagged Seth); "Clever..."
  also `Shadow`; Fungo's "pull a Dutch on... Dutch" is unclear and left as typed.
  Morra is they/them (scanned; "outstretches his hand" fixed).
- **Anachronisms to decide** (left as is): Batman / Joker / Robin / Gotham /
  Sethman / Rachael (the whole bit), Sherlock/Holmes/Watson/"Elementary!", Looney
  Tunes, Expo marker, 19th-century (cut), Super Saiyan (cut), "Thank god" (cut),
  Lovecraftian (cut), "Africa" (cut), "wolverine" (Dutch is a verinian), Happy
  Meal, "Princess Peach" (cut), "bone fuser" (in-universe). Suggested swaps:
  Joker -> "the Grinner", Batman/Robin -> invented caped-hero names.
- **Gay/slur flags:** none. Crude cum/piss beats are kept as source material.
- **Meta-sounding keeps (Trey's rule):** Morra/Llawdon's "B plot" lines.
- **Moves applied:** 41 (two passes plus fixes). The flagger went from 28 hits
  at 30s to 13 at 45s. Left on purpose: Dutch's fidget/Seth peeing (cause and
  reaction); Bellow/Seth "Hi Seth" (reply); Zion/reptile pillow; Brody's door
  and "manually" ruling; Marv/Joker stomp sequence and Seth's grip; Dutch
  carrying Bellow/Marv crawl; Marv's hyperventilating and Bellow's weak grab;
  the Dutch/Fungo spore run; Dutch "Ack-" / `/dmg` Morra / Bellow falls;
  Fungo into Marv's chest (moved once, left).
- **Duplicate IDs:** Trey's two ID `...846351000` blocks (an `AARRAGAGHH` line and
  an action) make `ff4_move_blocks.py` assert; I renamed one temporarily in a
  wrapper script (rename, move, restore). Check none stayed renamed (`...999`).
- **Import notes:** most NPCs already existed (The Joker, Voice, Shadow, Marv,
  Los, Squina). The importer was driven by a small API script mirroring
  `EpisodeImporter.tsx` (login, DELETE, POST episode, POST messages in 500s).
  Ep 8 will need the same.

## Ep 8: judgment calls for Trey to review

**Resolved by Trey (2026-10-05 review):** the joke `/dmg` on Bellow (108646) was cut; Zander's guide lines are all `Olag` now (the `NPC` crowd lines by Trey/Sean stay `NPC`); "Someone stays behind. It's Edmin." stays; the Jack Black cut stays; "he's here" refers to Emmett; the rewording of the Zach button 8ball question is accepted (rewording an 8ball question to fit what's played is allowed; note each in the episode section). Re-imported: 559 messages (190 ACTION, 328 QUOTE, 39 EMBED, 2 BOT_RESPONSE).

`md/ff4/8-dont-be-a-shitty-dad.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER). Imported via `ff4_import.py` (0 commentaries; 560 messages: 190 ACTION, 328 QUOTE, 40 EMBED, 2 BOT_RESPONSE). Personas: Fungus 8, Marv 28, Sascha 2. No new characters (NPC, Olag, Loudspeaker, Computer, Miny Seth, Squorchy, Squina, Los, Marv all existed). Nothing committed. Episode: after the swap Emmett meets the crew; Seth and Emmett fight; Marv, revived by the fungus, joins the crew; Gelfi-2 crash; Olag III guides them into the catacombs.

- **Tool fix:** `ff4_set_personas.py` now escapes apostrophes in the title (the title "Don't Be A Shitty Dad" broke the SQL).
- **GM/NPC attribution:** Zander's NPC-subject actions are tagged (`Emmett`, `Squina`, `Squorchy`, `Los`, `Marv`, `Miny Seth`). Zander/Trey narration and rulings are Vortox (crowd arrival, comm vibration, ankle bracelet, ship wreckage, "Seven hours later", etc.). Outcome lines after 8balls ("same happens to Marv", "Zach keeps them", "It's Olag III") became Vortox actions.
- **Kept `NPC` tag** for Olag III's lines until Brody's 8ball reveals him (Zander then tags `Olag`). Trey's/Sean's crowd lines are `NPC` too. Open question: retag Zander's guide lines as `Olag`?
- **Cuts judged table talk/fake flavor:** Seth uvula/ear/booger/penis/"1 microsecond" gags, banana, "Seth did 1/6" jokes, the Jack Black/Jack Purple bit (**second look?** real-world actor, but reads as a gag), monkey-noise spam (kept 3 hop actions), Zion licks Jonas, Dutch fart 8ball was KEPT (Los reacts), "Spongebob narrator voice", the d1 joke roll, the Fungaloid typed command, joke 8ball about Dutch's rubble, the Ow/OW spam (8 each -> 3 each).
- **Kept `✂` lines (later lines depend):** Emmett's family answer ("Seth's my adoptive father"), Dutch's pink-haired altruist reply, Zion's "Is this Gelfi-2?", the Seraphine damage line (Vortox), Trey's "Someone stays behind. It's Edmin." (Vortox; **open question:** Edmin is not otherwise in the episode, meaning unclear), Trey's Republic-ding 8ball.
- **Kept joke combat embed:** Trey's `/dmg` Bellow for 108646 (crash damage, green). **Second look?** it may be a joke number.
- **Rewrites:** 8ball question for Zach's button reworded to "stay calm" (the 8ball said no, he panics); Zach's italic flashback quotes framed as memories; Brody's cut-off "But I know th" trimmed; "Loudspeaker"/`Computer` tags kept.
- **Moves:** ~50 (two sweeps at 30s and 45s). Left on purpose: Zach/Emmett/Zion reactions (reactions to the first line), Emmett dashing through the wormhole, Marv/Squorchy knife beats, the 8ball for Zion/Morra and its outcome, the Silas caveat crash.
- **Morra they/them** scanned: fixed "looks up at him" and "follows him".
- **Anachronisms (left):** Jack Black, Spongebob (cut), Minions (cut), Among Us (cut), "ptsd", "default dance", "Pauline" (Dutch's gun; fine), "sovereign citizen" (cut).
- **Gay/slur flags:** none. "Plus, my wife has left me for a Black" kept (canon species).

## Ep 9: judgment calls for Trey to review

`md/ff4/9-are-you-not-entertained.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER). Imported via `ff4_import.py` (0 commentaries; 794 messages: 293 ACTION, 435 QUOTE, 65 EMBED, 1 BOT_RESPONSE). Personas: Marv 29, Fungus 13. No new characters (Owner, Bartender, Bouncer, Busboy, Bobert, Crowd, Reptile, Villager, Shadow, Miny Seth, Olag, Marv all existed). Nothing committed. Episode: the crew follows Olag into the catacombs to a Boneyard casino (the owner is the zombie Joker with a rotting face); Seth's ape-suit/Batman bit gets them drugged and chained; they wake as arena fighters ("Batape" vs Killer Croc), Zion is the surprise opponent, the owner's cure-quest is revealed, Miny Seth crashes the ship onto him, and Zion takes the vaccines.

- **Tool reminder:** this episode has a duplicate block ID (`...41104283795467`, a Marv line plus a Marv action, converter quirk); `ff4_move_blocks.py` asserts on it, so I renamed one to `...999` for the moves and restored it (confirmed none left).
- **Owner / Bartender / Bouncer voiced by several players:** Trey and Sean also voiced the Owner, the Bartender, a Bouncer and the Crowd. Consecutive `Owner` lines were moved under Zander (the main voice); Sean's Bartender line and his two Owner lines (piss shot) too. Trey's single "Bouncer: No, it does not." stays under Trey.
- **GM attribution:** Trey's and Zander's scene description (catacombs, casino layout, arena, cage, crowd, rubble, lab) is Vortox. NPC-subject actions are tagged (`Owner`, `Bartender`, `Bouncer`, `Busboy`, `Bobert`, `Olag`, `Reptile`, `Miny Seth`). Marv's actions are `Marv`, his speech `Vec as Marv`. Fungo's own actions stay Zander's. Sean's `Seth`-subject Miny Seth beats are `Miny Seth`. The Elf Heaven "Shadowy Figure" is `Shadow` (as in ep 7).
- **Fake flavor / noise cut:** Bellow "I poop on te ground" and "That's our word, Dutch" (Trey voicing Bellow) and the joke 8ball "do Bellow and Dutch kiss after the save?" with its reply, the "casino owner is/isn't Zombie Joker" Trey/Silas banter, Seth's apesuit pissing, "farts for 5 minutes", the penis drawing, tenor/YouTube/Spongebob links, the Israel/antisemitism bits, Zander's "Seth ... has shit his ape suit" and Seth pooping on Fungo ("Fungo enjoys the bath"), Fungo's little dance, "Ouchiewawa" and the Ow lines Trey typed for Bellow/Dutch/Seth, "THIEF/DIE/INSTANTLY" (bare caps), most of the breakdance spam (kept the first mention and the backflip), the cum-piss-beam percentage, "Is the DM turn skipped?" and "Does Dutch's turn get skipped" 8balls, and Zander's "Can I make Seth do damage on my turn?" 8ball. Dutch's jokey "Fungo's Ow x3" kept at 3 (Bellow's `/dmg` hits).
- **Kept `✂` lines (later lines depend):** Seth's Indiana Jones theme and owner "follows Dutch" were cut; kept the owner pretending to drink (Seth: "You spilled some!"), goblins' chloroform, Zion itching/stomping in, Marv's helmet remark, the stage cage, the corpse lowered, Fungo following Zion, the owner's "That was a great sight", Dutch's "HOWDY!" and "Now's our chance!", the screens showing the helmet symbol, the `Pauline` hit on Enemy_b and the Owner's "FUCK!", the bouncer's lab offer and "better labeled stuff" lines, Miny Seth's crash 8ball (`Ja.`), the `/dmg` on Zion, and Zion's "stumbles over".
- **Rewrites/inventions worth a glance:** the owner's "too caught up in their own business" line (raw said "too invested in their own story", reworded); "More bouncers begin to block the exits" (outcome of Trey's 8ball); "Dutch speeds up, trying to edge past Zion" (outcome); Marv's chain-breaking line kept as "like Superman" (anachronism); Seth's "Call me Batape from now on." (the raw was a YouTube link; the owner then calls him Batape); "Fungo carries Seth into the lab." (raw: "Seth is in the lab, as Fungo was carrying him"); "Miny Seth speaks over the comms." added before his line; "Seth launches his spear at the owner, but it misses and hits Dutch." (raw: "It misses..."); the Space Rule #50 line after the goblin 8ball (Trey's plain reply, made a Vortox action); the "Morra's only slumber" `/choose` reply turned into a Vortox action. Zander's `Seth` actions at the arena (throws spear at Dutch again) are tagged `Seth` though Zander typed them (likely Zander controlled Seth by the owner's effect; unclear).
- **Rewords of 8ball questions (rewording is allowed now, noted):** only copyedits (case, "?", typos, Tiny to Miny Seth, "ampitheatre", the Bellow ticket question reordered). No meaning inverted.
- **Orphan/contradiction notes (left):** Zander's 8ball "Does Zion reconsider taking off his helmet?" ("Yes, but in a monotonous tone.") has no visible outcome; Trey's `/dmg` on Seth shows 23/45 then 40/45 (a heal not in the log); Trey's "does the owner raise the stakes" and the kiss 8ball cut; Sean's Miny-Seth-into-brain 8ball ("Outlook not so good") kept with no follow-up.
- **Cut attachments:** four Zander `unknown.png` blocks (images I can't see); the arena may have been illustrated (second look?).
- **Slur flag:** Seth's "you fucking retard" became "stupidloid" per guide §4; "slorpigger" (in-universe) kept.
- **Anachronisms to decide (left as is):** Batman / Batape / Killer Croc / Joker / Zombie Joker, Superman, Omniman (Invincible), "McGuire's Irish Pub" (busboy's cart), Indiana Jones (cut), Futurama link (cut), "cancer, coronary disease, arthritis", "Hunger" cure list, "legal repercussions" (fine), `Roulette`/casino tropes, "Mr. Fancyson". Suggested swaps: Batman -> a caped-hero invention, Killer Croc -> "the Croc", Omniman -> "a caped giant".
- **Morra they/them** scanned (one fix: "him and Morra" about Zach and Morra became "he and Morra"; "their slumber").
- **Moves:** ~30 (30s and 45s sweeps). Left on purpose: bartender mixing (reaction), Bobert hearing his name (reply), the bouncer's elbow and "GAH!" (cause/effect), Miny Seth opening his eyes (cross-conversation), the owner's lines around the reptile 8ball, the Marv helmet sequence, Silas's /8ball mid-chloroform, the crowd/dealer/seat scene blocks.
- **Gay/slur flags:** none beyond the above. Crude beats kept where reacted to (Seth's piss shots, the cum-piss cage, a single fart).

## Ep 10: judgment calls for Trey to review

`md/ff4/10-high-roll-on-d100.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER). Imported via `ff4_import.py` (0 commentaries; 778 messages: 283 ACTION, 398 QUOTE, 94 EMBED, 3 BOT_RESPONSE). Personas: Fungus 61, Sascha 9. New characters: `VR Player` (Zander) and `Armor Speaker` (Trey). Nothing committed. Episode: the crew relaxes on the ship (Dutch/Seth in VR); Mission Control orders an assassination of Sergeant Major Bobed Ustrrot; Zion's autopilot mistake lands them at a gas station; fashion/disguise comedy; they enter a burning government building and fight the Raven Sascha; Morra is blown into 69 obsidian shards; the fungus takes over Sascha's body (`Vec as Sascha`); Zion's helmet is dented; Dutch starts rebuilding Morra.

- **Gate resolved:** "[I AM GOING TO KILL YOU DUTCH!]" is tagged `VR Player` (an angry teammate from Dutch's VR game; the same voice as the earlier "fix your callouts, bruhgingi" headset line, also `VR Player`). The brackets were dropped. **Second look?** if it should be Fungo or someone else.
- **Refined GM-attribution rule applied** (untagged GM line about one PC's action goes to that PC; Vortox only for wider scope). Lines given to a **PC/NPC** (all under the typist's header):
  - `Seth`: 879643 "Virtual Seth produces Virtual Miny Seth and sends him to attack Dutch" (Zander); 150501 "King Seth is asleep in the common block with his hand at his crotch" (Zander).
  - `Miny Seth`: 683456 "Virtual Miny Seth plants a bomb near Dutch" (Zander).
  - `Bellow`: 697616 "Bellow, without thinking, takes some of Dutch's clothing…" (Zander); 156180 "Bellow clicks the button again… volume 50%" (Trey, raw said "Jonas clicks"); 192272 "Bellow builds Morra back right this second" (Zander); 780702 / 352944 "Bellow is blocked / still blocked by the hatch" (Zander); 070948 "Bellow finds some gray sweatpants" (Zander); 444295 "Bellow slides to the left…" (Zander); 655898 "Bellow's arms are put into a fighting stance…" (Zander); 708052 "Bellow rips one of his balls off and pulls the pin…" (Zander); 319079 "The dents are bad, but Bellow doesn't really know how…" (Trey).
  - `Zion`: 568448 "Zion plots a course to a gas station…" (Zander); 409119 "Zion notices Bellow panting" (Zander); 333826 "Squished fungus is in Zion's peripheral vision" (Zander). Trey's own untagged lines (autopilot, armor blackened, helmet dented) stay Trey's (Zion).
  - `Morra`: 972487 "Morra looks like a Lego set" (Zander); 017095 "Morra walks to the fire" (Zander).
  - `Dutch`: 573632 "Dutch tours the station in VR…" (Zander); 205376 "Dutch just rips apart the bodysuit and fires once" (Zander); 494484 "Dutch cannot breathe" (Trey); 633609 "Dutch works on the Morra sculpture…" (Zander, with its `unknown.png` kept).
  - `Zach`: 145072 "Zach is now on fire", 979998 "Zach is moderately dizzy" (Trey).
  - `Sascha` (Trey's and Zander's actions about her): 141064, 678289, 937744, 201897, 088174, 006986, 113056, 004338, 566657, 502642, 999568, 293983, 959100, 407505, 219685, 732247, 147277, 194132, 730868, 562910, 165208, 039043, 575386, 392449, 211358, 033428, 321428, 956792. After Fungo takes her over, Sascha's actions stay `Sascha` and her speech is `Vec as Sascha` (the ep 9 Marv convention).
  - `Emmett`: 143579 and 162823 (Emmett's messages to Morra, Zander). `Officer`: 385371 (Zander).
- **Lines given to Vortox** (scope beyond one character): 692896 opening ship scene; 222194 "This occurs in the VR game…" (explains the shoulder-sitting); 494503 Mission Control notices the gesture; 726096 telenovela on the TV; 124673 bottle rumbles on the Commander's desk; 265310 message on Morra's device; 483930 holonet notification; 302076 Bellow trips with Morra ("makes it through the door", raw said "there"); 210964/064242 room heating; 001606 CRASH; 994698 holodeck warning; 045900 plasma burns Zion; 779930 pin melts; 541244/331520 air swapped/suits; 244520 gas station; 749018 couch noise; 213911 ship jolts; 447504 parks illegally; 074761 couch topples; 516196 "Squished Fungo is found"; 532089 burning building; 073435 route in; 769119 escalator; 649758 figure down the hall; 518460 person wormholed/pukes; 054659 obscured figure; 157120 figure is 9 ft tall; 486800 figure steps out; 018522/829086/939068 the Sascha reveal; 793707 Zion held up by spores; 749012 Fungo slides to Dutch's head; 400283 fungus visible on Sascha; 200849 Morra sees Fungo digging (+hint); 071554 building explodes; 889374/572840/608252/770409 reporters; 468928, 233735 (Morra pieced back together), 772683 (lasting damage); 908688 Space Rule #187 (Jonas's joke, kept as plain Vortox per the Space Rule convention).
- **Invented or reworded bridging lines** (all short): ID-less `_Fungo grabs Dutch and slams him around the room for a few seconds._` (outcome of Zander's 8ball); `_Bellow is in Morra's room, speaking to their headless body._` (replaced the raw "_In Morra's room_"); `_Zion turns away from the screen to speak aside._` (raw "_aside:_"); `_Bellow attempts an expert distraction._` (raw "_expert distraction_"); `_Bellow, nearly annihilated, panics._` (from Jonas's OOC "omega annihilated… panic"); `_Bellow has only half a mind to try to heal himself._` (cut the turn-order wording); Morra's "Please help us, Zach." gets `_Morra wormholes Zach to them._`; `_Morra is still conscious while being pieced back together._` and `_Morra will be about two-thirds rebuilt by the start of the next episode._` (restating Trey's and Zander's rulings after the 8ball and d80 roll); `_Both characters have lasting damage. Morra's is psychological._` (Trey's unwrapped "Lasting damage / To both / (Morra's is psychological I guess)", a GM ruling kept as Vortox); `_The VR headset on the ship emits a muffled voice._` and `_Another player speaks, and he can faintly hear this from the headset._`; "Morra, as Santa, takes off the hood"; "Sascha stomps towards Morra" (raw "him"); `_Fungus vibrates Sascha's heart._` (dropped "and Trey's balls"); "Zion picks up Fungo" (raw typo "Jonas").
- **8ball questions reworded:** Jonas's truncated "Is Bellow" became "Does Bellow have a codename?"; Zander's "build at least d80 percent of Morra" became "rebuild a good portion of Morra"; Silas's Pizza Hut/Taco Bell blast became "a devastating combined blast"; Trey's "does Zion move everything aside, obstructing Fungus…" became "no longer obstructing Fungus, and let everyone leave"; the rest are copyedits.
- **Cut attachments (images I can't see):** 320009 Trey `unknown.png` (05:27, Mission Control call); 040404 Trey `unknown.png` (06:11, after "armor is blackened"); 366221 Zander "Emote sent to Morra" `unknown.png` (06:17); 298752 and 498006 Zander `unknown.png` (06:47, 06:49, around the aliases); 593642 Jonas `unknown.png` (07:25) and 157649 Jonas "BOTTOM LEFT" + `unknown.png` (07:19); 579359 Zander `bum.png` (08:08); 039686 Zander `drawd.png` (08:19). Kept: 633609 Dutch's Morra sculpture (`unknown.png`). Also cut one `.mp4` (`Plankton_YES_Chroma_Key.mp4`, Silas, 08:49). **Second look?** these may be drawings or emotes that carried a joke.
- **Fake flavor / noise cut:** the book falling on Bellow thread, Fungo-as-plasma-person gag (plus the `@Jonas` spam), Fungo "smooches her heart", "Bellow licks pipis", "Dutch cannot ejaculate / Seth empath" run, banana-flavored bodysuit, the "Bellow is turning into Emmett" line, Zion punching Dutch (with its d10), the Gaster and "pocket sans" 8balls (and the Sans mech line), the `d10000000000` "omega charge" 8ball, Dutch's "phat brap" 8ball, the ghillie-suit 8balls, a Brody `/choose` of 5-8 with no context, the parking-note "BALLS" gag, "Morra will return in Final Frontier 2" (meta joke after the `/choose` "not living"), `/dmg` jokes (0 and -1 damage on Dutch, 2.9e21 on Fungus, -82/40 on Morra, a -14 on Bellow), "Zion probably cares where his pet is", "Bellow spits on Dutch's jumpsuit". The "silly" `/choose` for Zander's Heal Zion daddy menu and the Trey `/choose` for the post-fight target (no outcome) were cut too.
- **Kept `✂` lines (later lines depend):** 305001 was cut; kept 993602 (Dutch's first VR callout, Bellow quotes it), 724914, 017748, 693204, 601280, 483930, 568448, 797652, 180136 (roll), 452048, 994698, 992485, 680371, 064232, 541244, 528617 (ship speaker, now `Computer`), 573632, 435979, 954749, 661087, 148063, 036614, 036423, 020618, 149358, 806723, 118212, 080356 (restored: later lines show Zion held aloft), 782376, 874260, 248647, 226451, 783781, 897254, 198200, 310330, 052029, 420547, 063895, 024017, 605854, 839296, 293983, 434532, 669719, 935026, 470924, 131804, 888778, 033428, 731068, 562070, 456960, 536498, 835328, 407505, 769401, 318117, 779274, 732247, 260739, 451179, 524530, 312000, 211358, 162823, 871276, 338424, 027093.
- **Tag choices:** `Llashii` (raw had both `Commander Llashii` and `Llashii`; normalized), `Mission Control`, `Virtual Zion` (kept from raw), `Loudspeaker`, `Computer` (raw `Ship speaker`), `Armor Speaker` (raw `Armor's speaker`), `VR Player`, `Officer` (Zander and Trey both voice it, not consecutive), `Reporter`, `Emmett`.
- **Orphans/contradictions (left):** Sascha's `/heal` embeds are out of HP order (25 and 17 both end at 53/150); Zach's critical-hit 8ball was cut because the next `/dmg` is "Oblivion Attack Missed"; the `/dmg` on Morra (89, -69/40) is the kill, with Morra's explosion into 69 shards kept as Brody's own action; Trey's `/choose` "Morra" (07:27 etc.) cut; Zander's d80 roll (66) outcome is the "two-thirds" line.
- **Morra they/them** scanned: fixed "his head" -> "their head", "what happened to him" -> "them", "his family's" -> "their family's", "leaves their lead" -> "head" (typo), "morra mom house" cut.
- **Slur/crude flags:** none removed. "homoerotic roleplay/call-outs" kept (in-character reactions to Dutch's VR callouts). Crude beats (Dutch's callouts, the licked bodysuit, "Bellow rips one of his balls off") kept where the fiction reacts.
- **Anachronisms (left):** Superman (Morra's "Superman suit-up spin"), Choco Taco, Pepsi (Sascha's dispensed Pepsi), "Burger Dictator order", "McDonald/Minecraft/Stranger Things/Sans/Undertale/Futurama" links (cut), "Final Fantasy extra" in the `/choose` (verbatim), "Pauline" (Dutch's gun, fine), "Bollock"/"that one TV hero". Suggested: Superman -> a caped-hero invention, Pepsi -> "a fizzy energy drink", Choco Taco -> "a frozen taco".
- **Moves:** 16 (30s and 45s sweeps): the 8ball for Morra's torso, the pin-melting action, the ticketing `/choose`, Bellow's panic, Fungus's rise and `/heal`, Fungus braces, Bellow's self-heal thought, the Sascha `/choose`, the escalator, the Quadpistols `/dmg`, the Sascha-arm action, the Clown Outfit `/choose`, Fungo's pesticide. Left on purpose: Morra's hood, the Zion/Bellow/Zach heal sequence, the `/dmg` cause-effect pairs, the building explosion between Morra's lines, the reporter's "cameras shut off", the helmet 8ball/Bellow-follows block, Dutch ripping the helmet.

## Ep 11: judgment calls for Trey to review

`md/ff4/11-wrong-answer.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER). Imported via `ff4_import.py` (0 commentaries; 952 messages: 310 ACTION, 607 QUOTE, 33 EMBED, 2 BOT_RESPONSE; no UNMATCHED characters). Personas: Sascha 63 (`Vec as Sascha`, same as raw). New characters: `Bucket Fungo` and `Dutch's Fungo` (both created as Zander). `Chindle`, `Mayor`, `Loudspeaker`, `Miny Seth`, `Emmett Tawfeek` already existed. Nothing committed. Episode: the crew wakes up injured after ep 10 (Dutch and Zach rebuild Morra, Seth hijacks the ship as Captain Seth); Fungo (riding Sascha's body) rants at the crew in a tactics meeting; Miny Seth flies them to a Vega-5 beach resort; fungus ooze spawns mini-Fungos on everyone; Seth woos and kills the mayor's daughter Chindle and puppets her corpse; Dutch demands Zion ditch the fungus ("Wrong answer." and a sucker punch), Dutch shoots and kills Sascha, and Fungo ("VEC") writes in Morra's book and makes peace with Zion.

- **Tool change:** `editorial/ff4_patch.py` now accepts `KEY#2` (second block carrying a duplicate ID) because this episode has 7 consecutive same-ID block pairs (a dialogue + action from one message). `ff4_move_blocks.py` still asserts on duplicates, so I renamed the dupes temporarily for the moves and restored them (confirmed).
- **Sascha convention (extends ep 10):** after Fungo took her body, every Zander `_Sascha ..._` / `_She ..._` action is tagged `Sascha` (37 messages), her speech is `Vec as Sascha`. Zander's own fungus actions (the fungus on Zion's shoulder, Fungo tossing Oblivion, Fungo writing in the book) stay untagged (Vec). The split-off mini fungi that act on their own are tagged `Bucket Fungo` (249958, 334538, 559737, 821204, 906648, 643074) and `Dutch's Fungo` (518719, 366844, 075039, 172676, 035819). **Second look?** you may want one `Mini Fungo` tag, or no tags.
- **GM attribution, refined rule applied.** To a PC/NPC (under the typist's header): `Morra` 865374 ("Morra contracts legfoot", Trey), 278632 ("Morra brings their duffelbag", Trey); `Sascha` (Zander, all `_Sascha_` lines, e.g. 047976, 956467, 361667, 451647, 746159, 549480, 603847 and the rest); `Miny Seth` 622971, 226441, 052584, 818598 (Sean's own); `Chindle` 686074, 619095 (Sean's own); `Emmett` 058955 (Zander, see below); Trey's "All the cream that Sascha applied is washed off" (334738) stays Zion's. **Vortox** (scope beyond one character): 887303 recap embed; 514414 opening ship scene; 416262 common room/ooze; the ooze and mini-fungi spreading (558740, 076378, 453234, 346266, 598928, 809940, 650882, 428621, 747011); 387709 line of glass where Zion shot; 859665 ooze moving toward Fungo; 511655 fungus slithers around Zion; 333148 Sascha dies; 760061 Chomsky note; Space Rules 633444 (#387) and 180352 (#94934).
- **Invented or reworded bridging lines:** Vortox `_Sascha, it turns out, is a lioness._` (Trey's unwrapped aside "(I just decided that Sascha is a lioness)", placed before Zion's "Don't like the lioness?"); Vortox `_Chomsky's public information is basically his time as VP, with nothing recent._` (760061, Trey's unwrapped "(for everyones info: chomskys public info is basically his VP time back, nothing recent)". **Second look?** Is "VP" vice president?); `_Dutch points Pauline at Sascha._` (091689, was Silas's plain "It's Sascha" answering the `/choose`); `_Emmett sees the "D:" for about half a second before Morra quickly removes it._` (058955, Zander's unwrapped ruling after the "D:" 8ball); `_The fungus starts slithering around Zion's arms._` (511655, Trey's plain "Yes, but it starts slithering around" = the 8ball caveat) plus `_The fungus is tube-like, like an ouroboros._` (reworded); `_Sascha is dead._` (raw "Sascha's dead."); `_Bellow arrives in the room with Dutch and Morra._` (raw "Now in the room..."); `_Bellow turns to Dutch, trying to get through to him._`; `_Zach hears the name Vec and commits it to memory._`; `_Fungo heals the cut on the eye._` (dropped Zander's "Okay, fine."); `_Dutch mumbles._`; `_Zion mutters to himself._`; Sascha's muffled-in-the-sand line reworded; "Morra checks their communicator" (dropped "because of plot convinience"); the strikethrough "SON" gag rewritten as `> I SAW GLEAM. IN YOUR EYES, SON.` + `_"Son" is scratched out and replaced with "Zion."_`; Seth's "Tiny Seth" typos normalized to Miny Seth ("Miny Seth sits on Normal Seth's shoulders" kept the "Normal Seth" joke).
- **8ball/`/choose` rewording (noted):** Hunt520 "Do Zach and Dutch manage..."; Jonas legfoot ("bringing Morra down to 69% and giving them legfoot"); Trey's blaster question became "Does Zion try to get everyone's attention by firing his blaster in the air?" (raw "pull out his blaster and shoot blanks"; the answer "Yes but actually no" is the speakers); Brody "finish up the repairs themself" (raw "completion"); Hunt520 "rest of the day" (raw "rest of the episode"); Sean "across the desk from the mayor"; Jonas "four-armed sand angels"; the rest copyedits. The `/choose` footer "Morra regains 15% of his body" became "their body" (Morra they/them). The `/choose` title "Gives it ttheir book to write" kept verbatim (typo in the options).
- **Fake flavor / noise cut:** Seth's cock-vore Fungo chain and Zander's four-line GM riff on it (922719, 621716, 997880, 658010, 515158, 977864 "Seth's pants start to shake"; **Second look?** it was Seth's own action with the GM playing along, no one reacted); Trey typing the "Ashley / girl next door" lines as Bellow; Seth's "Around the world" spam (about 17 lines, kept only the bee/autotune action) and fortnite/thriller/"Seth dances" actions, the repeated "I'm captain seth" and giant-toenail bits (kept first two beats), VR ASMR line; Zander's Bellow burger gag (609552) and "Bellow isn't slammed to the ground" (748166), the "kissy on his boo boo" (070582); the squoatling-name spam with its bot replies; Dutch's mumbled "Rule 1..Rule FIFE" (unwrapped) and the "WAKE UP"s; joke 8balls: "Do Dutch, Bellow, and Seth pay attention" (Reply hazy) with Zander's "(yes, die)", "impressed by Bellow's ability to breathe" (Norb), Jonas's Morra-or-Zach bump (kept no outcome), Trey's fungi-in-unity ("Call (850)…"). Kept the Hunt520 "Does Zach kill Sascha?" 8ball with its phone-number joke answer (verbatim). Also cut: "HE IS NOT TINY!!!" (685544, Dutch typed unwrapped; **second look?** arguably in character), "ONLY FUNGO / NO VEC" (unwrapped), "rip lion gf", "Purrple", "Final Frontier: Civil War?!" and Zander's "Does he know???".
- **Kept `✂` lines (later lines depend):** 181534#2 (Sascha walks Zion upstairs), 580754, 594634 + 361667 (ground rules / Sascha elbows Dutch), 765672, 941952 (second speaker blare), 601128, 471215 and 112546 (Sean's two 8balls: Miny Seth takes the ship / the mayor's office), 819857, 393490, 559737, 417084, 469072, 920144, 250567, 267271, 119708, 359514, 336704, 296391, 469734, 191346, 180352 (Space Rule #94934), 542100.
- **Cut attachments (images I can't see):** 658388 Zander `unknown.png` (06:38, after "Let us enjoy the beach!"); 728478 Trey `unknown.png` (06:46); 160316 Zander `unknown.png` (07:57); 153666 Zander "Does he know???" + `unknown.png` (08:02, during the Dutch/Zion fight). Also cut: tenor/YouTube/Discord gif links.
- **Anachronisms (left):** SpongeBob (Miny Seth controlling the pilot "like SpongeBob"; suggest "like a puppet"), ouroboros, "swiss cheese", Rocky Road ice cream (fine), "lung cancer" in Space Rule #387, "mushroom". Cut: Fortnite, Ashley meme, Star Trek/Toy Story gifs, "Barbeque Bacon Bunger Burger".
- **"BLACK" check:** Fungo's "LR NOT BLACK. OR WHITE." (813334) is the black-and-white idiom, not the species; kept verbatim. Say if you'd rather it be reworded.
- **Slur/crude flags:** Seth's "Zion, more like gay, am I right?" (175232, Morra answers "Excuse me?") is the gay-as-insult kind, left for you. Crude beats kept where reacted to or as Seth's own actions: Seth humping the pillow (Zach is disgusted), "I like the smell" / "They consented before" (Seth about Sascha's corpse-like body; Sascha and Morra react), Seth pissing on pedestrians (237060) and spitting on an old man (463228) with no reaction (**second look?**), Seth killing Chindle (8ball "bang to death" = "Yay.") and puppeting her corpse.
- **Orphans/contradictions (left):** Sean's tractor-beam 8ball ("Outlook not so good") has no follow-up; "There's where your fuckin' balls are." (396658) lost its context (it replied to Jonas's bare "BALLS"); the fungus `/dmg` and `/heal` HP lines (Fungus 2/5, then 3/5) kept verbatim; Sascha's "hubby wubby" (047976) is assumed to be Zion; Fungo asks to be called "Vec" (the name is kept in the writing); Chomsky dialogue about being "VP".
- **Morra they/them** scanned: fixed Bellow's "he wasn't really all there" -> "they weren't", the `/choose` footer, the legfoot 8ball.
- **Moves:** 31 (30s and 45s sweeps): the head-nearly-complete beat, the dropped-head 8ball, Zach's fist-balling, Dutch's smug stare, the landing 8ball, Miny Seth sitting, the ooze and mini-fungi beats, the mayor's-office 8ball, the Zion-in-water 8ball and its follow-ups, Dutch's Fungo (after "Three!"), Zach's communicator, Morra offering the bucket and Chindle blushing, Sascha's kick/creep/leak with both 8balls, Morra lowering the bucket, Zion shutting his eye, Seth making Chindle dance. Left on purpose: Sascha dropping the rifle at Miny Seth's voice, Zach nodding at Silas, Zach's gunshot reaction, the Dutch cough/suit sequence, Zion splurching the fungus before Morra's book.

## Ep 12: judgment calls for Trey to review

- **Identity fix (Buzzcut):** the clone's lines were first tagged `Bee Emmett`, which imported onto FF2's
  character 1700 (wrong). Now every clone line is `Buzzcut` (1709); pre-reveal lines (before "As Seth says, who
  the fuck cares. It's Buzzcut.") are tagged `Buzzcut as Bee Emmett` (persona 12), the reveal line and later are
  plain `Buzzcut`. Buzzcut's untagged action ("Bee Emmett was quiet...") is tagged too; the "launches the ship"
  beat is Vortox GM narration and stays Vortox; #906 "He gives Bee Emmett the seat" stays Vec. `ff4_set_personas.py`
  now handles Vec and Buzzcut (char 1709, 'Bee Emmett' -> persona 12). Re-imported: 0 Goblinators messages on 1700.

`md/ff4/12-goblinators.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER, punct pass clean). Imported via `ff4_import.py` (0 commentaries; 1000 messages: 284 ACTION, 651 QUOTE, 62 EMBED, 3 BOT_RESPONSE; no UNMATCHED characters; no personas this episode). New characters: `Goblin King` and `Mission Control Aide` (both created as Zander). Everything else (`Bee Emmett`, `Emmett Tawfeek`, `Mission Control`, `Note`, `Goblin`, `Goblin 1/2`, `New Goblin 1`, `SRE Officer 1-5`, `SRE Control`, `Enforcer 1/2`, `ADE Enforcer`) already existed. Nothing committed. Episode: the crew wakes up broke at a free-charging station; Zion's shopping order includes a boxed Bee Emmett clone that Seth revives; Dutch hears the hull and a goblin horde (each wave bigger) floods the ship; Seth steals the cockpit and flies them to a Space Rule Enforcement post (goblins freeze in space); the SRE/ADE officers fight the crew (Zach is shot, Vec is grabbed, officers die); Mission Control makes Seth captain for 3 days after the real Emmett Tawfeek complains; Seth renames the ship "Goblinators" and Morra wormholes Seth to the Tawfeek family door.

- **New conventions this episode:** (1) `BE`, `X` and `B` all became one tag, `Bee Emmett`, even after he picks a new name ("X-ander", then "Buzzcut"); **second look?** you may want a rename. (2) `MC` and `Mission Control` unified as `Mission Control`; `E` became `Emmett Tawfeek` (the real Emmett, Zander); `GK` became `Goblin King`; `Enforcement Officer 1` became `SRE Officer 1`. (3) `ff4_patch.py` also works on the installed md with full IDs (used for the add and the final retag).
- **GM attribution, refined rule applied.** To a PC/NPC (under the typist's header, tagged): `Dutch` 746286 (Zander: Dutch wakes up on the floor); `Bee Emmett` 000322, 127673, 141194, 471992, 485668, 558643, 818667 (all Zander); `Goblin King` 261544 (Zander: GK reawakens); `SRE Officer 3/4/5` 569256, 073822, 945997 (Silas); `SRE Control` 286410 (Silas); `Mission Control` 418196, 998026, 087326 (Zander; 087326 also gives the aide's "Sir! Bad news!" to the new `Mission Control Aide`); `New Goblin 1` 543402, 695656 (Sean); `Note` 343080. Under the PC's own header untouched: Zander's Vec actions (907494, 521876, 291921, 454342 etc.), Trey's Zion actions, Hunt520's Zach lines, Silas's Dutch lines, all of Sean's Seth.
- **Lines given to Vortox** (scope beyond one character): 773180 and 142028 (what the clone box is and its instructions), 283882/880563 (heat shields marble ship, power flickers), 962749/371250 (note on the counter, five minutes pass), 046150/497653/248828/917200/779089/015027/342656/683480/873579 (goblins appear, shoot, wave 2, each larger), 381726, 624862, 776469/714589/005632/399238/776060/280154 (goblin counts, crowd), 152184/753715 (ship launches, waves visible from orbit), 387720, 066640 (cockpit pressurized, goblins freeze), 782402 + 142136 (bathroom locks, ship's reason, kept as `_The ship detected lifeforms in the room and reacted accordingly._`), 835321, 660734, 382411, 425582, 469025/397511/769277 (giant goblin and goblin king), 270249, 270731 (intercom), 760334 (officer 4 dies), 275049, 861982 and 865674 (the two monkey's-paw caveats: gill goblin grabs Zion; Zion loses Vec), 431915 (Goblin King shot), 026792 (Zion makes Mission Control ignore payment arguments), 334126 (**second look?** "Seth gives Bee Emmett the seat", Zander's caveat reading after Sean's "no" 8ball; left under Vortox because it is the monkey's-paw ruling, though it is Seth's action), 481310/990720/641482/977681 (fuel, dinging, lights dim, Mission Control breaks up), 804177 Space Rule #444, 243947 and 576184 Space Rules #50 and #51 (plain Vortox, per the Space Rule convention).
- **Invented or reworded bridging lines** (short): ID-less `_Seth speaks up from elsewhere on the ship._` (Seth answers "Me." with no entrance), `_Morra tries to wormhole the rest of the crew into the cockpit, but nothing happens._` (after the 8ball "does not happen"), `_Vec finishes healing Zion._` (after "Today is the day!"), `_The officers start to look sickly from the spores._` (after "Lady Luck smiles"); reworded `_Vec writes on the notebook on the floor._` (raw "_On the notebook on the floor._"), `_Zion speaks quietly aside to Morra._` (raw "_aside_"), `_Zion speaks to Mission Control._`, `_Zion calls out from the other chair._`, `_Morra knocks again._` (raw typo "Knok Knock Knoc"), `_Seth sets Bee Emmett down in front of the controls._` (raw "He"), `_All 9,381 goblins stop and turn to Morra, and say:_` / `Goblin: Woah.` / `_Then they die to the void._` (split from one Silas message, the dialogue keeps its ID), `_One of the goblins has mutated with..._` (dropped the `Caveat:` label and "(Monkey's Paw)"), "where the Goblinort is" -> "where the goblin hole is" (**second look?** unclear word, probably a typo for goblin fort/hole), "WHAT IF YOU COULD FIRE... / MORE... / DARTS?" (Morra's three shouts, punctuated as a staggered line).
- **8ball questions reworded:** Brody's "does Morra know where to get better Dart Guns" became "Does Morra know exactly where to find a dart gun factory?" (the "N-O" answer fits Morra only knowing generally where the factories are); the rest are copyedits (capitalization and "Does Zion barge through the door to the engine room?", etc.). Silly answers kept verbatim ("Only if Garrick would do it", "Y35.", "Yorb? (Yes)", "Spell it with me now, N-O.").
- **Fake flavor / noise cut:** Seth's puppet-lady sex-toy chain (about 9 lines: "Puppet lady", spanks her, buttcheek falls off, glues it on, retracts hand; **second look?** Seth's own actions but no one reacted), Seth's "ZOMG", Vec playing with tiny goblins like toy cars (206918, ✂), Zander's "Goblins hate cock... See Final Frontier 2... Excelsior!" (010702, GM meta joke), Zander's "one of the space goblins provided its genes to future generations" (041233, ✂), Zion's "Bug sex", Trey's "Zach cries like a widdle baby boy", Zion cradling Zach, Vec "cries like a widdle baby puppy", the `Goblinoid` -123846/10 `/dmg` (123876 damage, joke number), a Trey solar-flare 8ball ("Of course not!"), Zander's "Too easy! Ask again" reroll, Hunt520's "Is Zach secretly rich..." 8ball, Silas's "Vaccuumial Aeration" gills lore, "GUSCP 0050 - Endless Goblin Horde" SCP entry (unwrapped, 638376; **second look?** it was a fun in-world bit), Silas's "Negative One" explanation (875276, unwrapped), the "yorb", "Epicloid", "similair", "D:", "emmettalia", "poopy", "Labumba~!" and "seth proceeds to cum into the room" unwrapped lines, and "Seth with an X" duplicate. Gifs, tenor, YouTube and discord-link lines cut.
- **Cut attachments (images I can't see):** 781696 Silas "IT WAS HIM!!! HE WAS IN THE BOX!!!!!!" + `Real_Zandstare.png` (05:37, after the clone box opens); 887258 Silas "Vec when he takes over the Raven Boss" + `He_Was_The_Ender_of_All_Timelines.png` (05:44); 113538 Silas "sascha when she beat up zion" + `unknown.png` (05:52); 815243 Trey `unknown.png` (08:33, between "Again, mission comes first" and "We didn't even HAVE A MISSION TODAY"). All were meme/gag posts. **Second look?**
- **Kept `✂` lines (later lines depend):** 788160 (Vec's "I MISS HER INSIDES", Morra replies "That she was"), 713252 (Zion on grocery money), 685258 (Seth asks for the blanket), 503406 (Vec "BED NICE. MEAN PERSON."), 256678 (Zion answers Brody on the shipment), 897883 (Brody's "Phony Stations" question), 307482 (Bee Emmett asks about Matthias), 459847 (Dutch "THERE! GIT 'EM!!" with his shot), 585916, 398211 (Zander's taller-goblin 8ball), 870018 (Seth puts Emmett on his shoulder), 387720, 193876, 289834, 753793 (Zach's hood line; **second look?** the context is cut), 820355, 273755 (Oblivion Attack Missed), 865674, 573298, 936775, 945997, 500955, 642712 (Zion's "BLACK HOLE" line, the black hole is the destination, not the Black species), 895667, 142969 (the /choose that names X-ander), 768074, 315850 was cut.
- **Tag choices (second look?):** `Goblin 1/2`, `New Goblin 1` (Seth's pet goblins), `Goblin` (Silas, one "Heh heh!" and "Woah."), `SRE Officer 1-5`, `Enforcer 1/2` and `ADE Enforcer` (Silas; the ADE vs SRE split is as in the raw), `SRE Control`, `Mission Control Aide`, `Goblin King`.
- **Orphans/contradictions (left):** Dutch's two `/dmg` hits are out of HP order in the raw (10/25 then 23/25); Goblinoid `/heal` "30/10"; Trey's Space Rule #444 "LOWERCASE" is a one-line joke rule; the goblin counts are all Zander's gag numbers; Brody's `/flip` heads is never explained; the Hunt520 /dmg "Strauss5v" attacker name is as posted.
- **Morra they/them** scanned: no he/him left on Morra ("the picosecond he teleports" -> "they teleport").
- **Slur/crude flags:** Seth's "retard." (576091) became `Stupidloid.` per the guide §4 table. Zion's "schizophrenic elf" (Mission Control tirade) and Seth's "A goblin tried to rape us" (a lie to the officers) are left for you. Crude Seth/Dutch beats kept where reacted to.
- **Anachronisms (left):** "Russia" / "leader of Russia" / "planet Russia" (Emmett Tawfeek's homeland; suggest a made-up planet name), "Does Russia know about this?", "Earth" (Zach dreaming of home), "Roblox"/"SpongeBob" gifs (cut), "porn" (the clone's shipping company), "Pauline" fine. Space Rule #444 "LOWERCASE" is a meta joke.
- **Moves:** about 67 (30s and 45s sweeps): the Seth-reading-instructions pair, the Dutch signals/hand-sign pair, the goblin entrance with its 8ball, the Seth/Zion 8ball-and-flip chains, the goblin counts after the Seth lines, the bathroom-and-Goblin-2 sequences, Zach's clutching/glaring beats, the monkey's-paw caveats, the PA and Mission Control pairs, Seth's fuel conversation. Left on purpose (16 hits at 30s, 13 at 45s): Zion/Seth entrance pair ("You-" / "Alright."), Morra's hood-welcome, Morra's reply chain ("Then back at Dutch"), the goblin-count/Seth lines after the moves, the "Rude." and "Leave him be." reactions, Morra's disappearing/teleport trio, the Goblin King/Seth/Bee Emmett trio, "Hey Emmett, open up" with Zach's flip-off reply, "What can I do for you Morra?" with Mission Control breaking up, and "I see, understood." with Morra's wormhole.

## Ep 13: judgment calls for Trey to review

`md/ff4/13-tawfeek-residence.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags, 0 OTHER, punct pass clean). Imported via `ff4_import.py` (0 commentaries; 224 messages: 45 ACTION, 170 QUOTE, 9 EMBED; no UNMATCHED characters). DB counts: Seth 110, Emmett Tawfeek 48, Morra 39, Squina 11, Dutch 2, Vortox/none 14. No new characters. No Buzzcut, Bee Emmett or Vec rows. Nothing committed. Episode: Morra wormholes Seth to the Tawfeek family's house; Seth's hand is covered in goblin penises; Emmett hosts them, Seth and Emmett make peace, Emmett invites the crew to Quarterfette, they leave.

- **Gotcha: file naming.** The Discord export for ep 13 is `Side Episode 1` (`meta/ff4.json` `file_name`), not `Episode 13` (that export is ep 15, Chilzor's). `ff4-to-md.py` without `--prep` writes to the auto-named `md/ff4/raw/<N>-<slug>.md` regardless of the output argument (it re-wrote raw 15 byte-identical). Prep ep 14 from `Side Episode 2`.
- **Tags.** Emmett's untagged Zander lines and `Emmett` tags became `Emmett Tawfeek` (as ep 12). `Squina` and `Dutch` tags added to Zander's Squina/Dutch actions. Emmett Tawfeek is a distinct character from Buzzcut; this episode has no Buzzcut lines.
- **GM attribution:** Emmett Tawfeek 490152, 903825, 151840 (Zander); Squina 551569, 010048, 239505; Dutch 546357, 705418; `Seth` for the doorway sentence (ID-less, split from 151840). Vortox: 135744 recap, 590708, 992424, 095387, 178525 (Sean's backyard penis), 289354.
- **Invented or reworded bridging:** none invented. Reworded: Morra's three portal beats (795092/838952/473720), "He looks relaxed" -> "Seth looks relaxed", Emmett "sighed" -> "sighs", 8balls 296850 (outside) and 795532 (typo).
- **Cut:** Sean's `unknown.png` (975036, 05:16), PAOPAL, "fortnie", tenor link + "Seth and Morra rn", Squemder spam and bot reply, channel-rename line, one duplicate line, the "*gods" correction (folded into "thank gods").
- **Kept for second look:** the penis gag (reacted to in fiction), Dutch's retcon line.
- **Anachronisms:** Doofenshmirtz, "touching grass", "flu", "semester".
- **Moves:** 4 (8ball after "Help me, Morra", Seth's penis beat after the go-go-gadget line, Emmett's holodevice beat, Seth's smile). Left: "Write that down"/"You look tired" (door action between), "Shit."/"Fuck." with Morra's beat, Emmett's question/8ball/"Backyard."
- Flagged items are in `REVIEW-ff4-trey-queue.md`, "Ep 13".

## Ep 14: judgment calls for Trey to review

`md/ff4/14-lights-out.md` is installed and verified (0 unresolved, no cut marks, no EMBED/COMMAND flags other than roll/choose footers, 0 OTHER, punct pass clean). Imported via `ff4_import.py` (0 commentaries; 260 messages: 92 ACTION, 141 QUOTE, 27 EMBED; no UNMATCHED characters, no personas, no new characters). DB counts: Bellow 75, Zach (Zacharias Smith) 63, Zion 65, Vec 18, Vortox/none 39. Nothing committed. Episode: a quiet side episode on the stranded Seraphine (Morra and Seth are away): Vec, Bellow, Zach and Zion charge the ship via Edmin's body, Zach confides about his father, a handstand contest, and Zion plots a course.

- **Prep:** from `Side Episode 2` with `--prep` to `.editorial-analysis/ff4-ep14/`; `md/ff4/raw/14-lights-out.md` untouched. Cast has only Vec, Zach, Bellow, Zion (no Buzzcut, Bee Emmett, Emmett Tawfeek or NPC tags).
- **GM attribution:** Zion tag (Zander) 509988, 706536; Zach tag (Trey) 141153. Vortox: 976711 (dark), 120714, 434866, 342352, 920720, 577617, 831740, 201971, 581565, 874836, and Jonas's 230949 d10-handstand caveat (unwrapped OOC but the roll depends on it).
- **Invented bridging:** one, ID-less Vortox "Seven items fall on Bellow's head." after Zander's d10 roll. Reworded: Zach/Bellow/Vec action tenses, 301352 Zach -> Zion (matches the 8ball).
- **8ball rewording / cuts:** see the queue. Meta/next-episode/genital/zandis 8balls and retries cut.
- **Cut attachments:** six `unknown.png` and four `.mp3` posts (filenames and times in the queue).
- **Moves:** 7 (45s sweep); the remainder are reactions/exchanges.
- **Convention note:** a tagged GM action about a single PC under the GM's header is written `_`Zion`: ..._` (as in ep 12).

## Ep 15: judgment calls for Trey to review

`md/ff4/15-sir-this-is-a-chilzors.md` is installed and verified (0 unresolved, no cut marks, 0 OTHER, punct pass clean, merge flagger swept at 30s and 45s). Imported via `ff4_import.py` (0 commentaries; 760 messages: 240 ACTION, 478 QUOTE, 41 EMBED, 1 BOT_RESPONSE; no UNMATCHED characters; no personas). DB counts: Seth 159, Zion 103, Bellow 99, Dutch 83, Zach 66, Vec 33, Buzzcut 42, Morra 22, Angela 18, Chilzor 19, Server 16, Terry 15, Llashii 8, Bartender 4, Dildus Comms 3, Karen 1, Vortox/none 69. Zero lines on Bee Emmett or Emmett Tawfeek. New character: `Server` (id 2039, created as Hunt520). Nothing committed. Episode: the crew finds a dildo-shaped station (Dildus-A5), Seth (captain) dictates a log, Zion/Zach/Bellow/Dutch eat at Chilzor's, Chilzor (a KYL robot) detains LR representatives and is destroyed, the station ejects the crew back into the system.

- **Prep/export:** the export is `Episode 13` (`api/ff4/15-episode-13.json`; an older `15_sir_this_is_a_chilzors.json` was already there, untouched). Prepped with `--prep` to `.editorial-analysis/ff4-ep15/`; `md/ff4/raw/15-sir-this-is-a-chilzors.md` untouched.
- **Buzzcut:** all 16 hand-confirmed untagged Zander actions are tagged `Buzzcut` (IDs 017011, 818597, 067984 incl. its dialogue "SETH GRAB ME!", 692308, 434226, 019138, 825442, 494858, 297553, 854646 action and dialogue, 901062, 945811, 309050, 690178, 737970, 677136). One extra: 968468 "The tiny vespoid hops onto Seth's foot..." (the clone) became `Buzzcut` and was reworded. 350706 "Seth gets onto the ship but manages to drop Buzzcut by accident" is Vortox (outcome of the "won't happen" 8ball). DB: Buzzcut 42 (25 quotes, 17 actions).
- **Hunt520:** Terry (15 lines) follows the existing tags; 110677 (Trey's "Terry kisses Bellow... poisoned by Bellow's venom") moved under Hunt520 as `Terry`. A new unnamed NPC, the well-endowed server, is `Server` (16 lines, Hunt520); her lines were split into tagged blocks, with Zach's own lines in an ID-less block after (845323).
- **GM attribution to PCs/NPCs (under the typist's header):** `Zion` 694343 (crates hit his head); `Dutch` 439700, 763172, 238072; `Bellow` 517098 (trips); `Chilzor` (Zander) 899476, 088276, 722886, 899712, 538037, 276285 and (Silas) 171136; `Bartender` 994516, 305480, 660340, 953242; `Angela` (Sean) 632342, 082625, 590810.
- **Vortox (scope beyond one character):** 313778 cold open, 304008, 953338, 525204, 398247, 127067, 514580, 159219, 772181, 505568, 091166 (Karen arrives), 327840, 855838, 974528, 813888, 440053, 438346, 104546, 626830, 559944, 294908, 190104 (evacuation ruling), 760589 (Dildus patrons morph), 350706, 370906, 103228, 910278, 149298 (Space Rule #850).
- **8ball questions reworded:** 685992 (Zion -> Dutch noticing the system, since Dutch then speaks), 527216, 086463, 737110, 255258, 355108, 242398, 351634, 923610, 533699 ("ship's hull" -> "the Dildus's hull"), plus capitalization/"?" fixes. Moved 583830 (Penis question) before Trey's "Penis." lines.
- **8ball/command cuts:** Trey "should I add the bot?" (520347) and Hunt520 "Will Zach stay by Bellow for the rest of the episode?" (631891; both answered "Do an impression..."; Zach's reply became "Zach stays by Zion instead of Bellow."), Sean's poop-clone 8ball (819336), Jonas's `/choose` (373585), `/list characters`, `/weapon info` x2, Jonas's `/reset` and 1-damage roll, Vec's `/dmg` embeds kept (d1 and 9 on Zion).
- **Fake flavor / banter cut:** "Vec eats Buzzcut in one bite" (693035), "Vec eats the poop" (392914), Vec's bath (788935), "Vec is twerking on Zion" (083479), "Bellow twerks on Chilzor's remains" (155348, Jonas objected) and the "Bellow's flat / no butt / two balls and a bong" chain, "FIST HIM BACK"/"Fist him? That's provocative" (711041, 280066), Seth's bulge (139339), Seth airhumps/counts money (464004, 355760), "Zach feels a sense of pride" (735434), "Zach is sliced into 4 pieces" (683118; unclear), Silas's `Morra` impression (785715; Morra is not aboard), Seth's repeated "I'm Seth" (6 -> 2) and PA "JANITOR" spam (trimmed), Dutch's long order (kept twice of three).
- **Kept for second look:** 712229 Seth's helicopter gag (Zion reacts), 996587 "Chilzor twerks atop of Dutch's body" (Dutch reacts), 691599/818484 Seth's poop orb (Buzzcut and the PA bit react), Seth calling Buzzcut "Emmett" (632342, 252235, 684993, 578816 left as typed).
- **Typos fixed with a judgment:** 459596 "Dutch leaves the table and meets up with Zach" -> Bellow; 281010 Hunt520 "Bellow notices the cracked mirror" -> Zach; 523530 "He shrugs it off" -> Zion; 440053/438346 bot IDs "enemy_b"/"Enemy_B" -> "second form"; 190104 Trey's "Yes, and the Dildus starts to throb..." became a Vortox action (the "Yes, and" dropped); 103050 (Zander's restaurant collapse) cut as a duplicate of 626830; "Zack" -> "Zach" in Zion's narration only where narrated.
- **Invented bridging lines:** none. Small additions: Server's "comes around with Dutch's drink" (157968), "Zach feels the rumbling and sits up" (737156 was "(" and ")" fragments).
- **Cut attachments (images I can't see):** 152731 Silas `chilis.jpg` (12:49 PM, as the crew sits in Chilzor's); 931571 Trey `unknown.png` (01:05, after "Chomsky? Emmett?"); 518056 Sean `Dildus.png` (01:02) and 583435 Sean `Dildus.png` (01:23); 408926 Trey "Chilzor:" + `unknown.png` (01:22); 681987 Silas `unknown.png` (01:58, after the rubble 8ball); 991768 Zander `unknown.png` (02:00); 971961 Trey `the_biggest_orb_ever_created.mp4` (02:16); 806613 Silas `Schlim.png` (02:21); 149909 Zander `unknown.png` (02:24). Tenor/discord gifs and Sean's YouTube fart-link embed (048175) also cut.
- **Kept `✂` lines (later lines depend):** 219082, 197125, 594852, 017011, 407764, 221052, 998940, 964173, 728558, 547019, 845863, 988680, 143301, 376946, 742293, 289636, 243632, 406165, 854646, 171136, 636960, 449788, 255258, 173268, 344538, 492584, 047605, 033749, 252235, 587055, 266098, 006592, 783770, 517098, 327919, 760589, 231091, 416101, 449528, 350460, 070457, 337150, 013605, 691599, 341443, 361509, 818484, 818297, 149298.
- **Anachronisms/slur flags (left):** "reddit moment" (567968), "video game" (272954), "pepsi", "McFlurry", "Hershey Chocolate" (Dutch's/Seth's order), "origami" (Terry), "popcorn", "Mama mia" (Chilzor), and Seth's "gay ass name" (178888, left per guide §4).
- **Moves:** 24 (30s and 45s sweeps). Left on purpose (about 20 hits at 45s): replies and reactions such as Zion/Zach "walks into the Dildus", Dutch's angry beat, Zion's "so hungry" run, Seth's "Captain's log" and Morra's writing, the Chilzor/Zion "Uh.." exchange, Zion's thrown-against-the-wall/Chilzor explodes pair, Seth's PA/Zion knock.
- **Morra they/them** scanned: no he/him on Morra.
- Flagged items are in `REVIEW-ff4-trey-queue.md`, "Ep 15".

## Ep 16: judgment calls for Trey to review

`md/ff4/16-crashlanded.md` is installed and verified (0 unresolved, no cut marks, 0 OTHER, no EMBED CHANGED, punct pass clean, merge flagger swept at 30s and 45s). Imported via `ff4_import.py` (0 commentaries; 793 messages: 266 ACTION, 471 QUOTE, 54 EMBED, 2 BOT_RESPONSE; no UNMATCHED characters). DB counts: Seth 110, Zion 108, Bellow 105, Zach 89, Sonichu 62, Morra 57, Sonic 30, Vec 28, Dutch 26, Shadow the Hedgehog 18, Buzzcut 16, John 15, Jack Madison 10, Big 7, Knuckles 5, John Smith IV 3, 8ball 2, LCM 2, Ship 1, NPC 1, Vortox/none 98. Persona: `Vec as John Smith IV` x3 (new persona row id 25, mapped in `ff4_set_personas.py`). No new characters were needed: every NPC tag already existed from the older direct import. Nothing committed. Episode: the stranded ship coasts toward an ice planet and crashes (Seth's gags, Vec torments Dutch); a Sonic-themed Raven mercenary band (Sonic, Knuckles, Big, Shadow the Hedgehog who is really Sonichu) threatens Bellow's family and demands Victor Chomsky; the crew falls into a sinkhole into a Raven base; Zach's father John Smith wakes from cryosleep and is kidnapped with Zach.

- **Prep/export:** the export is `Episode 14` (`api/ff4/16-episode-14.json`; an older `16_crashlanded.json` was already there, untouched). `md/ff4/raw/16-crashlanded.md` untouched.
- **Buzzcut:** untagged Zander actions tagged `Buzzcut`: 422535 (browsing the Holonet), 993128 (starts to lift off the floor), 351447 (sleeping on Seth's shoulder); 620232 (breakdance, already tagged) got its subject added. 936576 "A box is flipped over Buzzcut" is Vortox (Buzzcut is the object). 762538 is Vortox "Buzzcut also shoots out of the ship" (replaces Trey's bare "since Emmett would do that, Buzzcut also shoots out").
- **Vec as host:** 367969, 862539 (quotes) and 269568 (flashing action) are `Vec as John Smith IV` after 289577 "Vec hops into his gaping maw" (that line stays plain Vec). **Second look?** Vec slipping into Dutch's pants and out of his body (the 'pants' line 195165 and 582270) is left as plain `Vec`, no Dutch-controlled lines exist.
- **GM attribution to PCs/NPCs (under the typist's header):** `Dutch` 959356 (Trey: "Dutch hits his butt really hard", the 8ball's "opposite happens" outcome, turned from bare text into a tagged action), 623780, 904818, 933042 (Zander); `Bellow` 051147, 755676 (Zander); `Shadow the Hedgehog` 960863, 856248, 747348, 145310, 864676, 073226; `Sonichu` 135189, 697567, 776455, 979901, 715014, 943805, 697354, 204200, 810890; `Sonic` 094063, 013314, 675418, 892426, 206265; `Knuckles` 389642; `Big` 192370, 402709; `LCM` 076958; `John` 666325, 929745 (split into John lines plus an ID-less Zach block); `Seth` 605834 (spits up John Smith IV); `Buzzcut` as above.
- **Vortox (scope beyond one character):** 463528, 753216 (ship shakes, dives), 378612, 125776 (crash), 423262, 302194 (second crash), 936576, 988703 (Shadow arrives), 936768 (planet), 997988, 577691, 159230 (Sonic's group), 948223 (hole fills with piss), 376720 (council member splashes Seth), 643183 (Brody's "chucklefucks raise arms", retyped under Vortox), 738064 (magnetic field), 681010, 298954 (the ship's sentient crash), 248883, 315627 (the Sonics fly, then are transported), 316463 (hologram), 096764 (two remotes), 673927 (ice cracks), 679144/016169/645372 (POOMPH, bottom, dark), 289439/788544 (scaffolding), 472360, 914458/941003/759636 (Vec hits Zion, SFX), 088775, 505882, 205696 (base, cryosleep), 597279, 512926 (Sonichu runs off with Zach and John), 411392 (Sonic encapsulated in a casket), and Space Rules #3903 (867550) and #723 (151740), plain Vortox.
- **8ball questions reworded** (capitalization and typos unless noted): 440852 (Dutch floating, "for the good of humanity" dropped), 872756 ("humanity" -> "the galaxy"), 769538 ("Does Morra telekinesis Dutch" -> "use telekinesis on Bellow"), 126933 ("not telekenisis" dropped), 934053, 618728 (Shadow), 432174, 601492, 620190, 708722, 284457. Cut 8balls (no outcome or gag): Rick and Mortus, Seth-sprinkler piss, Morra finger, Sean's "60 minutes of telekinesis", Bellow's pants, Brody's "Liquid", Zach slits Big's throat, Dutch writhes, Bellow breakdance confusion, Bellow grabs Seth, Morra "niddy griddy", Bellow still breakdances, Vec takes over John Smith IV.
- **Fake flavor / noise cut:** Seth's schwifty/sniff/"yum yum pee", second pee puddle and "cleanup on aisle seth", ballsack-with-a-face chain and ballsack lasso, Gangnam Style, pistol firing, second shoe throw, the repeated Seth "WEEEE" lines; Vec becoming a suppository and going into Dutch's intestine; "Morra sex" and sex/smut/"Seth x Morra" spam; Brody's "somewhere in the Universe... shudder" and Morra "marvels at Bellow's new plot relevance"; "Hunter is John's favorite child" and Jonas/Trey "@Trey / loveu" chat; SUS/AMONG US spam; Jonas "Morra finger" bit; all OOC replies to italic actions ("south park episode", "mario when he step in lava", "flowey", "phillip").
- **Kept gags the fiction reacts to:** Seth's first poop/pee (Buzzcut ignores it, Brody reacts), Vec making Dutch float/hard (Zach, Morra and Bellow react), Seth's balls dropping (Zander reacts), Seth peeing in Shadow's hole (it creates Sonichu and the whole fight), the "unclit" knife bit (Seth takes 2 damage), Zach's Jack Madison texts (Dutch and Bellow react).
- **Cut attachments (images I can't see):** 269501 Jonas `garrick_y.png` (08:48 PM), 013525 Zander `unknown.png` (09:44), 755654 Jonas `unknown.png` (09:02, with Brody's "HES GONNA LAY AN EGG" reply).
- **Reworded/unclear (second look?):** 294481 "Morra floats up with Zio..." became "with Zion in their arms" and Brody's "realizes the mistake and grabs Zion instead / leaves Zio in the snow" (379284, 913394) is cut as unclear; 512926 "Bellow can see Hercules" is left as typed (unclear); 206265 "family guy death pose" left (anachronism); 697354 political button now reads "I voted!"; 310358 "Bellow comes back in order to retain plot relevance" -> "Bellow comes back."; 451240 Morra's winter-attire joke trimmed; 016000 Zach's meta "(he is in the dark about the mission)" folded into "...whatever that is?"; Seth's `8ball` tag (Seth voicing an 8ball, 364314, 797320) kept as the existing `8ball` character.
- **Tag choices:** `NPC` (raw `NPC#3`, Brody), `LCM` (raw tag, Llamanian Council Member; rename?), `Ship` (raw), `Shadow`/`Shadow the Hedgehog` unified, `JSIV` -> `John Smith IV`, `Sonic`/`Knuckles`/`Big`/`Sonichu` as in the raw (Trey voices Knuckles/Big in a few lines).
- **Moves:** 21 (30s and 45s sweeps). Left on purpose (about 15 hits): reactions/replies such as Seth's "Turbulence" line after the ship shakes, Zander's cartoon-balls reaction, Zach's "no idea" reaction to Morra, Shadow's rabbit-hole description, Sonichu/Bellow/Dutch exchange, Seth's "Wanna see?" with Trey's freeze reaction, Zion's aim/roll/miss, Vec interrupting Zion's "But here we a-", capsule opening between Morra's "Come, let's-" and "Oh.", Bellow's "What the-" after the ice cracks, the net tossed between John's "You!" and Zach's drop.
- **Morra they/them** scanned: no he/him on Morra (remaining hits refer to Bellow, Dutch, Sonic).
- **Slur/anachronism flags (left):** `retard` (841940) -> `stupidloid`; "gay"-type insults none. Earth IP all left as typed: Sonic/Shadow/Knuckles/Big/Sonichu/Silver/Magichan/Chris-Chan ("Chrisdom"), Kodak Black, Family Guy, Among Us ("Crewmates, am I right?"), "Super Sonic", "Tails/Sonic" (cut), "Gangnam Style" (cut), "Kirby" gif (cut), "middle school", "fanny pack", "political button / I voted", "GU council", "Earth" (John Smith "rising politician on Earth"). Seth's "He's cool, look, he's black." and Sonic's "Disgusting black creature." are kept (Black is a canon species/colour, per the settled rule); say if either reads as a racial joke.
- Flagged items are in `REVIEW-ff4-trey-queue.md`, "Ep 16".

## Open issue for another agent: transcript reader grouping (flagged by Trey)

`groupIntoBlocks` in `src/components/transcript/TranscriptReader.tsx` (~line 23-45)
merges consecutive messages only when **both** `playerId` and `characterId` match.
Trey says that doesn't make sense: consecutive lines from the same character (an NPC
like Ziga or Tacengi voiced by two players) should read as one block regardless of
which player typed each line. Today the workaround is editorial (move the line under
the voicing player, see the Ep 6 split-voice fix and "An NPC voiced by more than one
player" above), which is why the FF4 md moves lines between players' blocks.
The fix belongs in the reader (and the "played by" label needs a rule for mixed
players). Once it's fixed, the editorial moves become optional; don't undo existing
ones without Trey's say-so.

## Ep 17: judgment calls for Trey to review
Export `Episode 15` (`Final Frontier 4 Episode 15 [1032098966273261578].json`). Raw 588 messages in, 496 imported (189 ACTION, 281 QUOTE, 25 EMBED, 1 BOT_RESPONSE). Edited by Sonnet 5.5; md `md/ff4/17-dont-weld-yourself.md`, `api/ff4/17-episode-15.json`. The crew is rescued from the ice planet by Llashii's ship, Vec welds Morra's cracks, and Hanzi is introduced.
- New persona: `Vec as Argonian` (personas id 26, slug `vec_argonian`, character 1961) created in the DB and added to `pid` in `ff4_set_personas.py`; all 109 Vec lines are persona Argonian (timeline anchor, matches raw). `ff4_set_personas.py 17` applied.
- Buzzcut: only in a Vortox scene-setting beat (object, frozen), no Buzzcut-tagged lines.
- GM attributions (to Vortox): 691679 ("Buzzcut is frozen; Seth has been trying to collect firewood..."), 015775 (Sean's "It begins to hail."), 644282 (Zander's "Icicles fall onto Seth."), 619206 (Space Rule #78).
- Vortox beats: the four above; recap embed 043049 stays an embed.
- Reworded 8balls: 714076 (comma, "huge, like a David and Goliath"), 350812 ("Is Zach eavesdropping yet?" so it fits Zach falling in), 796372 (stray quote), 813066, 510430, 747082 ("in their time of trouble"), 121098 (typo), 660394, 229769, 522822, 147712, 310282. Cut 8balls (no outcome or gag): 544144 (✂), 355290, 794563, 227304, 248392, 644098, 477909, 473631, 995284 (incomplete "Does Bellow"), 896064, 609990, 913291, 453332 (✂), 713252, 162164, 962311 and its caveat chain (542588, 898458, 041472, 712174), 415835 and its showdown chain (330034, 223838, 087278, 648222).
- Fake flavor cut: Seth spin/dance/gangnam/weee/haha spam, "fartnite", "nightcore", "Finger hole" x5, "Saul Goodman is the name of the Argonian", "Jack's alias is Huckleberry Finn", "warm wamr heat heat love love", "I love black uole" (769088), Bellow nuts squeeze (820756), `Dutch` "stop stuttering little dumb head" (761940), Morra "Huzzah!"/Zion "Morra, you're the line leader!" (890304, 178876; unwrapped), "yes/no" spam in part 5, Trey's "Bellow's ears cute", "Zach's end has been irreparably damaged..." (820816), "Dutch's dad to ask for permission..." (438598).
- Kept gags (fiction reacts): 385735 (`Bellow`: "Haven't had a proper weiner-sucking in a moment!", Llashii reacts in 386590), Seth's dildo throne (272598, 305290: later "crying for his throne").
- Kept `✂`: 143841 (plasma cutter handed over), 202941 (Bellow help request, answered by 804053), 363368 (Morra's cracks glow dimmer), 120542 (Vec realizes Seth missing), 305290, 577937 (paramedic fake cigarette), 393802 (guards restrain the Argonian), 854346 (Llashii's mission setup).
- Cut attachments: 526278 (Sean, unknown.png, 08:18), 147418 (Trey, brody_susie.mp3, 08:58).
- Unclear rewrites: 252810 ("_Vec scours._" -> "_Vec scours the medbay for real cigarettes._"), 962460 ("but as many" -> "but not as many"), 594468 (Zion in awe), 727609 ("safe than sorry" -> "better safe than sorry"), 416916 (ring beat, cut "You idiots"), 916094 cut (Trey's "Bellow wakes up"), 073532 (added "Zion" subject).
- New NPC tags: `Paramedic` (3 lines; `Parametic` typo fixed), `Hanzi` (2), plus existing `Llashii`, `Jack Madison`.
- Anachronism flags: "Jesus" (802315 "Jesus, man"; 671750 "Jesus you're freezing"; 149397 "IN SPACE JESUS!"), "Thank god" (669952), "Shovel Knight" cut with its message; suggest swaps if wanted. "midget" (489024, kept) and "cripples" (924432) may deserve swaps.
- Slurs: none. "Yo mama says yes" 8balls cut.
- Merge moves (30s and 45s): 150->154, 158->162, 8ball 170->180, 237->241, 8ball 271->281, 413->417, 441->445, 8ball 551->565, 615->619, 758->762, Vec-stops/Zion-fire after Morra blabber (876, 880 after 884), 976->980, 1076->1080, 1216->1220, 1228->1232, 8ball 1687->1697. Left hits (14): hail/icicles outcome (the "Oh fuck!" reacts to it); Zion/Bellow actions around oxygen tank and sword toss (chronological); cutter handoff then eyeballs; Morra crippled reactions (822/830, answered in sequence); Zion mothership landing (948); Llashii/Zach nod reply (1184); Jonas protest after Llashii's shove (1814); "Albeit messily" (1856); Vec flip (1864).
- Morra scan: fixed he/him/his on Morra (878, 685, 603-ish text, unwelds, 344031, 242432, 270899, 814441, 771133 footer). Final grep clean. Duplicate IDs 078652 and 240704 (split Hunt520 messages) were renamed temporarily for moves and restored.

## Ep 18: judgment calls for Trey to review
Export `Episode 16` (`Final Frontier 4 Episode 16 [1037175111280754760].json`), "Mutiny". Raw 319 actions / 782 quotes; imported 1045 messages (294 ACTION, 711 QUOTE, 39 EMBED, 1 BOT_RESPONSE). Summary: Llashii briefs the crew, Seth is kept captain with Zion as co-captain, Vec bursts out of the Argonian body, infects Dutch and Bellow, is cornered in the airlock, and the crew splits over killing Vec vs hearing Zach out; Bellow and Morra resign, Zion throws Zach down, Dutch knocks him out, and Vec escapes and draws Zion on the walls.
- **Buzzcut / Vec-as-host:** no Buzzcut in this episode. All 125 Vec messages carry persona `Argonian` (id 26) by the timeline, including after Vec pops out of the Argonian (block 415484) and as tiny Vec: unchanged, flagged in the queue.
- **GM attributions (ID last 6, whom):** 851335 Seth; 940736, 293032, 254763 Llashii (+ ins before 799003 for the intercom, tag fixed from `Llashii over intercoms`); 157786, 994708, 336272 Hanzi; 489971 Morra; 891970, 181179, 908280 Dutch; 779893 Zion; 745842 Morra (comm rings, OOC aside cut); 836038 Vec (Trey typed); 130708 Zach (Trey typed the 8ball outcome).
- **Vortox beats:** 653500, 825704, 081189, 672724, 843770, 042960, 495134 ("The bag pops."), 957298, 799067 (Hanzi scrambling, from Trey's reply), 144646, 289832 (Space Rule #39).
- **Reworded 8ball questions:** 843742 (dropped the "poopy farty song" reason), 372618, 610906, 523332, 434158; the rest punctuation/caps only.
- **Cut 8balls:** Llashii overrides Seth's controls (494643), Zion tackles Dutch, Vec hardens (N Word. (No)), poopy-farty block, Zach gains Vec as a Stand, "where is she"/(850) number x2, sanyas balls, Seth elven stripper; coin flips x2.
- **Fake flavor cut:** Zach twists off finger, Dutch reeks of garlic, Seth finishes dance/Knight dance, Dutch steps on Zion's back, eating Vec/Morra chews fungus, Seth cums hands free, Seth pees his pants, RDM/FAILRP spam, Mickey Mouse, Dutch "Edmin" spam, Rick and Morty music, "Episode 11" asides, "Seth leaves" etc.
- **Kept gags / fiction reacts:** holographic woman (037417, Seth turns her off); 995570 Zion squats; 757588 Dutch "splooge" jab; 960262 Morra vacuum in mouth; 902225 tiny Vec smudge.
- **Cut attachments:** 544316 Silas `e4z00oci2br91.jpg` (09:13 PM); links only: 741373, 854312, 497023, 346496, 909500, 026996, 632970, 126246, 724550.
- **Kept `✂`:** 702396, 995570, 908840, 825990, 225970, 525891, 102794, 117185, 902225, 502016, 199006, 587281, 127700, 960262.
- **Slur/anachronism flags:** "STUPID HAIRLESS APEX" -> "USELESS" (599890, 399794); "retard" -> "stupidloid" (918258); "gay" lines cut (981264, 311420); "Stand" (JoJo, cut), Mickey Mouse (cut), Rick and Morty (cut).
- **Unclear rewrites:** Merged split lines: Dutch "SUCK ME... IN... ME!" (538237), "CAPTAINS, KILL IT!" (226432), Dutch "KILL IT, FOR FUCK'S SAKE!" (710066), Vec "SHUT UP, DUTCH!" (851274), Vec "ALL I THINK OF IS EAT." (877012); 8ball "forever again" kept verbatim, Zander/Trey clarifications cut.
- **Merge moves:** 8balls moved after the second half: 032612, 778920, 040818, 783519, 042960 (GM block), 437649, 478963, 442857, 828034, and 346452 (Morra smells) before 874134. Leftover hits (interleaved parallel actions/entrances, or stale timestamp on moved 8ball): #1-6, 12-15, 18-20, 24-34, 36-40 of the 30s sweep, and 45s hits #16/#21/#23/#35.
- **Morra scan:** clean (Bellow's "Morra can do, where they open up space" fixed).
- Duplicate IDs 268722 and 856710 are split blocks of one message each (importer fine).

## Ep 19: judgment calls for Trey to review
Export `Episode 17` (`Final Frontier 4 Episode 17 [1042259442768556042].json`), "Rumble Baby". Raw 315 actions / 625 quotes; imported 957 messages (276 ACTION, 593 QUOTE, 86 EMBED, 2 BOT_RESPONSE). Md `md/ff4/19-rumble-baby.md`, `api/ff4/19-episode-17.json`. Summary: the crew guards Zach in the brig while Seth plots to reach Elf Heaven through a black hole and Vec (still in the Argonian) hides in the engine room; Seth's summoned dwarves are airlocked, then the Ravens' Odran ambushes the hangar and the crew beats him back, Seth launching him into space.
- **Buzzcut / Vec-as-host:** no Buzzcut. All 105 Vec messages persona `Argonian` (id 26) by the timeline, including after Vec pops out of the Argonian at the end (049266): unchanged, same open question as ep 18.
- **GM attributions:** to Vortox: 046534 (engine room haze), 758528, 022298, 119986, 135726 (ambient HV/jingle/lights/brig), 353823, 972245 (dwarf rulings), 738748, 007228 (thud, ship shakes), 922876, 961286, 096828, 563058, 169438, 945455, 348979, 572767 (Ravens' attacks), 159296 (magnet-gun merc crushed), 754866 (SPLAT), Space Rules 080063, 381376. To Seth: 302407, 434911 (Seth hears Emmett's line/cabin), 222164, 504852 (Anaphrodisiac, taser). To Bellow: 669706. To Morra: 220271, 913223. To Hanzi: 147079 (+ ID-less Zion line). To Odran: 222186, 995318, 898442, 270170, 868456. To Dutch: 763270. To Dwarf/Dwarves (Seth/Zander typed): 917104, 289874, 297138, 237888, 396800, 619964, 499856 chant, plus ID-less dwarf block after 397520. To Emmett: 849124.
- **Brody's italic Sanya/Dread voice** (453604, 333840, 908234, 238963, 674496, 704334, 163345, 634536, 040973) converted to `Sanya` dialogue; Hunt520's italic quoted replies (337980, 608154, 873375) converted to Zach dialogue/actions.
- **Reworded 8ball questions:** 018113 ("Is the HV really loud?"), 672628 ("Sanya" -> "Does Sanya speak to Zach?"), 793640, 661584 (quote marks removed), 893308 (Odron -> Odran); the rest case/punctuation only.
- **Cut 8balls:** 038613 (toilets, "Bro, your action didn't make it"), 656914, 827146 (+ its /roll 506081), 514699, 409296 ("sussy"), 688660 (lube gag, + /roll 954644), 733126 (Emmett's and Sanya's balls).
- **Cut combat/commands:** /list x2, /character edit/info, /weapon edit x2, /combat turn x2, failed d0 /dmg rolls (329716, 051951, 762835, 481822), bare slash text 590272. Kept /combat start and stop embeds (837565, 379562); kept the Dutch heal/reset/damage trio (478565, 522130, 781214) so HP lines stay consistent.
- **Fake flavor cut:** Seth strips/shits on the captain's chair (694772, 146164, 643036, 101921), nude-camera call chain (885677, 293278, 669830, 974336, 123358, 093972, 566170, 372049), Dutch kissing Morra/Zach (536833, 004254, 378280, 408530, 770463), Cappy/Mario hat gag (155264, 923493, 224966), Morra "10" sign (692275), Zion "Femur breaker"/"Morrioh", Trey dance spam (344892 etc.), Bellow Tums, hi-fives (801016, 940998), Vec doll-smiting (022164), Seth piss/apology chain (420436, 093087, 056232, 091723), "haha penis" (316344), spore-balls gag (934796), "rumble as one" balls (917588, 953448, 993940, 010468), Vec "Ow my dreadballs" reply (489892), keyboard smash (299163 etc.), "ow" spam trimmed to 2.
- **Kept gags (fiction reacts):** Dutch's Defenestration Protocol (765170...), Dutch's "SCHMOOVING" dance (Zach replies), Seth's shrivelled/growing balls and the cum-blast that launches Odran (662954, 507201, 818236; Zion/Zach/Bellow/Morra react), Vec spores in Zion's mouth (525224), Seth "sex-dungeon" threat (645002), "STAR VECIUM"/"ORAAAAA" (873375).
- **Cut attachments:** 837834 (Trey, `morra.mp3`, 09:51 PM), 558036 (Jonas, `the_xeno.png`, 10:52 PM). Link-only/gif: 236235, 364005, 782622, 316264, 836945, 470692, 658910, 051961, 647316, 575804, 085491, 980800, 088852, 070963, 450516, 119179, 073866, 105370, 245103, 979476, 484594, 556352, 433814.
- **Unclear rewrites:** 011152 (bare "Instead, Zion goes back upstairs to see Hanzi" -> Zion action), 976468 (Zach "..... "I understand" / stops typing" -> "... I understand."), 353823/972245 (bare Zander dwarf rulings -> Vortox actions), 090620 ("Scarlett" -> "Scarlet", "what a" -> "What a..."), 174568 ("don't care didn't ask" -> "I don't... care... Didn't... ask."), 510918 ("still naked" dropped), 641034 (halberd "from his asshole" dropped), 957726 ("to make him look more heroic in the scene" dropped), 461962 ("mukbang" -> "meal"), 398228 (Bellow's `*...*` sword actions -> `_..._`), 137970 and 088926 (action moved before dialogue), 861984 (hi-fives action cut), 936361 (Jonas's OOC "bellow was referring to zach" cut, which leaves Vec's "We are not friends." ambiguous).
- **New NPC tags:** `Odran` (character 1869, ~34 lines), `Dwarf` (1744, 4), `Dwarves` (1745, 10); existing `Emmett` (Emmett Tawfeek), `Hanzi`, `Sanya`, `GU News reporter`. Cut `Merc` (358401).
- **Kept `✂`:** 092265 (Zion's stare falters), 603304, 724659, 283786, 932436, 679306, 203590, 612800, 896632, 995594, 834910, 523187, 220359, 459314, 220271, 289641, 915511, 075836, 316288. 
- **Anachronism/slur flags:** "Mein Kampf" and "Juice" (528818, Dutch), "footloose" (870), "STAR VECIUM"/"ORAAAAA" (JoJo, 873375), "tldr"/"don't care didn't ask" (174568 kept), "sussy" 8ball cut, "Mario", "Cappy" cut, "Tums" cut, "Bruh" (932831 reworded), "mukbang" swapped. Slurs: none. Insults left: "Dingaloid" (339497), "Zachaloid", "slimeskin".
- **Merge moves (30s and 45s):** 8balls moved after the line they follow (048967, 993094, 034331 stays after Seth's pair, 573938, 568991, 911038, 863775) plus about 30 action moves (Bellow/Zach reactions, Seth line runs, dwarf scene, Zion/Vec). Leftover hits (11 at 45s): Zion split by Zach's reply (133); Bellow whisper and Zach's head shake (286); Bellow night-vision reaction (776); Vec breaker/Zach "facing away" (814); Bellow looks around/Vec walks up (1122); Emmett line vs Bellow hood (1138); Seth cursed/dwarf side actions (2143); Morra/Zion "I see it" narration (2552); Dutch leap/fall/"Ow." x2 (3779, 3929); Zach "Agreed"/Bellow dash reply (4441).
- **Morra scan:** clean (no he/him on Morra).

## Ep 20: judgment calls for Trey to review
Export `Episode 18` (`Final Frontier 4 Episode 18 [1049885386828152882].json`), "Event Horizon". Raw 313 actions / 799 quotes; imported 1074 messages (292 ACTION, 761 QUOTE, 20 EMBED, 1 BOT_RESPONSE). Md `md/ff4/20-event-horizon.md`, `api/ff4/20-episode-18.json`. Summary: the crew shows off the pod and assigns roles for the final mission, Seth fools Emmett and the crew into launching him into the black hole, and the pod, Seth, Vec and Morra's severed head end up in Elf Heaven while Dutch, Zion and Bellow wonder if they are dead. No new characters or personas.
- **Vec / persona:** no Buzzcut, no new `Vec as <Host>`. 11 Vec messages carry persona `Argonian` (id 26) by the timeline up to the "fell back, slamming into the side of the sofa" anchor (682447); after that Vec has no persona. Vec is actually in a mercenary body in the first half (212242 onward), which is not Argonian; same open question as eps 18-19, left as is.
- **GM attributions:** to Seth (Zander typed): 985321 (snotball lands on Seth's poster). To Emmett (Zander typed, action lines now `Emmett`-tagged): 314070, 183421, 814110, 596564, 224050, 345438, 782800, 487380 (part 8), 923324, 310174, 550603, 392218. To Bellow (Hunt520 typed): 772244 (blaster jammed, the 8ball 946186 outcome). To Morra: 662568 (second line, Jonas typed). To Vortox: 363752 (bare Zander "Roll to see if Pauline goes off accidentally", reworded), Sean's ambient black-hole/Elf Heaven narration 251648, 679978, 180925, 774002, 922760, 328458, 473044, 034438, Trey's 752296 and 388073 (black-hole physics, "might start seeing things"), 016276 (Morra's body dents the brig ceiling), Space Rule 853598 (Seth typed, "Never trust an elf").
- **Vortox beats added (ID-less):** one Silas block after 561099 ("Dutch catches Zach by surprise and pins him to the ground", outcome of the wrestling 8ball).
- **Reworded/cut 8balls:** reworded 091770 (typed question cleaned), 376000 (recieve), 946186 (dropped "saving his progress and refilling his HP"); case/punctuation only on the rest. Cut: 937562 (Dutch strongman pose, no outcome), 230111 (Morra's final power, "sing or hum"), 708315 ("is the crew at the black hole?", same-as-previous answer), 755250 (Bellow finds the pod, "do an impression"), 559455 (comms log, "No moment." contradicted by Zion setting up comms), 380806 ("poopy farty song"). Kept /choose embeds 310948, 236787 (Morra clone power), 251048, 845172 (Zach's role: defense).
- **Fake flavor cut:** Seth cam-site/holo-tv gag (265034, 915841), Seth shower/washcloth bits (319642), Seth poses trimmed to one line, Dutch jumping-jacks/"Chris Pratt Mario World" (542015 action, 563354, 373948), Zion "thirteen inch" gag (675989), Zion "sexy/cute meter" (983454, 638541), "Bellow Zach sex" and similar Trey one-liners (082624, 270875), mercenary belch (560094), Dutch belch (375579), national-anthem links (643403, 381063, 736228), "cum monster" (171861, 004554), second wine-into-pod line (869146), Seth sniffleball/slurping snot (232134, 365914), "Deecol deecol" Zion line (694538, unclear), "Peter Griffin" bit (235394), "KILL THE DMS" (948678).
- **Kept gags (fiction reacts):** Seth shower intrusion/turd (Dutch reacts), Seth muscles jiggle (Bellow: "Stay still, Seth"), Seth snotball (Zander/Seth), Griddy/breakdance (Dutch "SHUT UP"), Seth's 500 bottles (8ball 561439, "WHOOPS"), Dutch kissing Pauline and the mercenary beheading (8ball 674129, Zion/Zach/Dutch react), Morra duplicates (Zach/Bellow react), Seth's lump-with-a-face on his balls (510313, Vec "I don't understand").
- **Cut attachments:** 652167 (Trey, `FcYCEbFacAMsNcl.png`, 09:38 PM), 438258 (Trey, `image.png`, 10:18 PM), 521054 (Silas, `Dutch-Drawing-Head.png`, 10:54 PM), 559262 (Trey, `922.png`, 10:55 PM), 465532 (Jonas, `image.png`, 11:34 PM), 525979 (Zander, `Goat_couple.webp`, 11:40 PM), 439194 (Zander, `tumblr_mn1cpzBDs11qjhlhko1_1280.jpg`, 11:44 PM), 943976 (Zander, `Tails.webp`, 11:44 PM). Links cut: 643403, 381063, 736228, 687424, 911430, 191774, 668234, 732698, 101112, 350155, 059665, 563452, 791232, 684212, 257926, 805802.
- **Unclear rewrites:** 278366 (Jonas "idk where tractor beam controls are lol" -> "Bellow moves over to the cockpit."), 493979 ("Bellow Zach go to rooom" -> "Bellow and Zach go to another room."), 308008 ("He and Morra recommune with Dutchaloid" -> "Zion and Morra recommune with Dutch."), 204975 (typo "Zion punches Zion's shoulder" -> Dutch), 434816 ("sussy" -> "shifty"), 363752 (bare ruling -> Vortox action), 772244 (bare Hunt520 8ball outcome -> Bellow-tagged action), 926592 (Seth's chant `Lorem ipsum dolor sit amet`, kept x2, stray `_'_` dropped), 415242 ("...." line dropped), 797254 (Emmett yawn cut), 1868 area "shoulder(?)" -> "or whatever passes for one". 572682 (Earthen -> Earthican after Trey's typed correction 967666 cut).
- **New NPC tags:** none (`Emmett`, `Llashii`, `Jack Madison` exist). Cut 788658/911120 (bare "Verinian Ale is 37%" and Zander's "Similar to Squis", OOC/ruling not depended on).
- **Kept `✂`:** 887740, 854835, 551744, 560154, 302742, 902376, 040473, 066980, 997998, 823238, 543242, 845172, 478730, 915038, 761247, 223560, 321627, 314631, 360479, 582303, 177320, 091392, 000976, 743390, 638906, 969021, 167169, 224883, 227954, 035785, 989877, 065499, 459142, 359872, 769035, 598750, 605160, 460490.
- **Anachronism/slur flags:** "Hannah Montana poster" (985321), "SPONGEBOB" (729903, Dutch), "Griddy" (047390), "USB slot" (047741), "Palestinians" joke (278420, Seth) and "Earthican" geo-politics, "America" (603338), "final frontier 4: event horizon"/"the west, the deep ocean, the atmosphere" (597737, 181140, Dutch, meta), "Verinian". Slurs: none. 8ball answer "Yigga." (256667) kept verbatim (n-word-adjacent joke answer). Insults left: "Zachaloidius", "Vecaloid", "pussies" (076260).
- **Merge moves (30s and 45s):** about 28 action moves (Seth/Zion/Dutch/Bellow side actions moved after the line they followed; 8ball 561439 moved after Bellow's "How do you drink this??"; Emmett-tagged call blocks left in place). Leftover hits (9 at 45s): Seth "Passing by Zion"/"Ello, Zion" (53), Zion pod lines vs drooling (649), Zion lines split by snotball/Zach flip-off reply (874, 886), Bellow "creep me out"/"Ow" (1411, slap is the cause), Dutch watch-yourself/"Ew" (1513, merc enters), Morra Pardon/voice (1587), Seth/Zion screen reply (3157), Zion "are they both dead?"/"Did you get them!?" (3998, Bellow/Morra narration is the answer), Seth picks up Morra (4338, side actions of other characters).
- **Morra scan:** clean (no he/him on Morra; "puts him on his back" fixed).

## Ep 21: judgment calls for Trey to review
Export `Side Episode 3` (`Final Frontier 4 Side Episode 3 [1052334407832318062].json`), "Welcome To Elf Heaven". Raw 138 actions / 315 quotes; imported 471 messages (134 ACTION, 304 QUOTE, 32 EMBED, 1 BOT_RESPONSE). Md `md/ff4/21-welcome-to-elf-heaven.md`, `api/ff4/21-side-episode-3.json`. Summary: a side episode with Seth (Sean), Morra (Brody) and Vec (Zander, wordless; Zander voices all NPCs). Seth, Vec and Morra's head arrive in an Elf Heaven slum; Seth "cleanses" slumdwellers (Fuglestein), gains a following, climbs into the House of Gods, kills his ex-wife the Goddess of Death, and becomes Sethkinki, Elf God of Death; Morra and Vec fix the pod, fend off goblins and get the artifact (a crystal-encased cylinder). No new Vec persona; no personaTimeline entry for this ep.
- **Advisor fix:** the `/flip` embed 739274 (heads, answering the "Flip a coin to find out" 8ball) was restored and the episode re-imported; `ff4_verify.py` now accepts verbatim non-8ball footers.
- **New characters (created as Zander, species 7 Unclassified):** `Fuglestein`, `Slumdweller`, `Suburban Elf`, `Elf Guard`, `Squoatling`, `Winged Dwarf`. Existing and reused: `Frechelsi`, `Goddess of Death`, `Goblin`. Frechelsi is tagged for the old woman covered in elf ears AND for the courtier/advisor who greets Sethkinki after the promotion (assumed the same NPC, since Seth addresses "Frechelsi" both times); the ex-wife is tagged `Goddess of Death` throughout (intercom voice 072006, elevator lines, Room of Death).
- **Vec / persona:** no Buzzcut, no `Vec as <Host>`, personas none. Vec only acts, never speaks (Zander's quotes are all NPCs).
- **GM attributions:** to Seth (Zander typed, Seth-tagged): 836551 (voice sounds like a goblin), 836344 (counter above the man's head), 619163 (shoots guard in the elf testicle), 756851, 363358 and 509214 (transformation), 890906 (chin/charisma). To Morra (Zander typed): 654953, 201701 (wormhole retrieval slams into Morra's head), 008465 (dagger in eyehole). To Fuglestein: 898026 (runs to the gate). To Elf Guard: 073340, 610587, 475119, 652636, 172993, 937695, 279262, Sean's 322516. To Goblin: 920596, 062108, 447592, 267312, 105277. To Goddess of Death: 117780, 246459, 301724, 008760, Sean's 234065. To Squoatling: 581642. To Winged Dwarf: 063622, 632717. To Slumdweller: 465586 (action line "The crowd calls from the other side of the gate"). Zander dialogue by NPC: Fuglestein (480629, 751779, 912789, 024138), Slumdwellers (358426, 349938, 061332, 991080, 186533, 216801, 406808, 836935, 539280, 365776, 037201, 156821), Elf Guards, Goblin, Suburban Elf (265256), Frechelsi, Goddess of Death, Squoatling (undead summon sounding like Emmett, 279491), Winged Dwarves.
- **Vortox beats (Zander/Sean/Trey typed, untagged GM):** 658849 (slum ghetto, "@Trey" dropped), 017951, 286356, 959112, 441951, 072006, 353135, 010438, 712455, 820130, 506193 ("No.", answer to the Morra-telekinesis 8ball), 976016, 442206, 622100, 713912 (wormhole caveat), 486642, 275001, 777755, 061659, 813288, 706398, 960189 (God of Ears/God of Fingers enter), Trey's 256616 (artifact description) and 984670; Sean's 192256, 327690, 555594, 189002, 503410 (setting narration).
- **Reworded/cut 8balls:** reworded 878707 (telekinetically), 391864 ("he's so sexy and charismatic"), 315881 (doubled quotes), 760829 (Morra "blast the fuck outta these goblins" -> "finally snap at the goblins", played as Morra yelling at the goblins), 870002, 663636, 534622, 218249 (typos). Cut: 320690 and 170344 ("Too easy!" re-rolls), 570826 (talent show, no outcome; Zander's "My talent is programming this bot" 270190 cut with it). Cut /flip embed 739274 (heads, outcome shown by Goddess action 117780) because verify allows footers only for combat embeds. Kept /choose 297877 (Morra clone) and Hebrew/Arabic joke answers 883522, 365716 verbatim.
- **Fake flavor cut:** 900146 and 518426 (Zander "Well, presumably." / "Lame summon." asides), Seth "jaja/haha" 817660, 133480, extra "oh yeah" 226708, 851646, extra "la la la" 171413, Trey's 565514 ("Vec was the artifact all along </3"), 172143 ("Nosedive moment"), 919494 (Rick and Jerry/Sailor Moon transformation link and embed).
- **Kept gags (fiction reacts):** Seth air-humping crowd bit (695902, 671228, 150154: crowd cheers/lifts him), Seth toe-in-ear fish hop (804103, 737068; Brody "Oh, delightful."), Seth's cum-flood kill of the Goddess (950501, 199110; crude source material), handjob "good deed" (017951).
- **Cut attachments/links:** 852190 (Sean, `[link]`, 04:07 PM), 579796 (Trey, `[link]`, 04:35 PM), 919494 embed (Zander, Rick and Jerry/Sailor Moon video link, 05:19 PM). No file attachments.
- **Unclear rewrites:** 984670 (Trey "Morra's body disappears right in front of Zach's eyes", Zach is not in this ep -> "Morra's body disappears from wherever it was." as Vortox); 442644/923925 (Brody's "Now," split by Seth's thank-you; moved "Now, let's see what that item is." into 923925); 185080 and 907072, 786088 (message duplicated its own lines; collapsed to one; 185080 reordered dialogue first, "The clone head poofs from existence."); 820058 (Booga booga); 658849 (dropped "@Trey"); 549700 ("@Brody" dropped).
- **New NPC tags:** see "New characters" above.
- **Kept `✂`:** 856922 (Brody "I always thought you were lying about yourself", Brody's "But no. You actually seem to have power here." depends on it). Cut `✂`: 568650, 935946, 606347, 089428, 000508, 997142, 500993, 463410, 651934, 502524, 171846.
- **Anachronism/slur flags:** "experience orbs in Minecraft" (712455), "90's power rangers" (972517, Seth), "WOULD YOU KINDLY" Bioshock line (316672, Brody), "gigachad" (890906), "firewall/installed" (172783, joke). Slurs: swapped "Stupid fungus" -> "Dumb fungus" (491631) and "That was stupid" -> "That was dumb" (250896). Insults left: "haha fucking idiot", "bitch of an ex-wife".
- **Merge moves (30s and 45s):** 16 moves at 30s plus 5 at 45s (8ball and side actions moved after the second half; e.g. 8ball 932670 after 153792, 870002 after 861636, 828946 after 115038, 391864 after 216801, 315881 after 798279, 312686 after 890300). Leftover hits (8 at 45s): 84 (GM answer to Seth), 265 (Fuglestein runs, Seth reacts), 510 (KAPOW outcome of gunshot), 806 (Vec turns/Brody "hold on"), 846 (wormhole outcome vs "Ow."), 1133 (Vec grabs dagger, Brody thanks Vec), 1750 (dwarves attack, "AH!"), 1816 (/8ball and gunfire outcome chain).
- **Morra scan:** clean (no he/him on Morra).

## Ep 22: judgment calls for Trey to review
Export `Side Episode 4` (`Final Frontier 4 Side Episode 4 [1052377614549008484].json`), "Usurper". Raw 104 actions / 281 quotes; imported 395 messages (103 ACTION, 274 QUOTE, 18 EMBED). Md `md/ff4/22-usurper.md`, `api/ff4/22-side-episode-4.json`. Summary: Zion, Zach, Dutch and Bellow (Morra's body on the floor) decode Seth's elven runes, phone Emmett (via Morra's phone), learn Seth got Emmett to pilot the pod into the black hole, disguise Zach with fake elf ears, and bluff their way into the Lamentria monastery as "Ambassador Baron Von Shambassador" and disciples, until the Goddess of Death vanishes and Sethkinki yells from the heavens; the crew flees. Vec is absent (no Vec, Buzzcut or persona lines); no personaTimeline entry; no new characters (Squorchy, Giant, Messenger, Random bystander, Iris, Ship intercom already existed).
- **Buzzcut/Vec-as-host:** none.
- **GM attributions:** Zander typed, tagged to Emmett: 276414, 146192, 208751, 486814 (sighs/sits/DND/upset); to Squorchy: 228072, 931264; to Giant: 980836, 324862, 850792 (action and "WHO YOU?"), 209642, 388060, 727016, 820958, 545118 (dialogue and exit); to Messenger: 429299; to Zach (fake ears jingle): 013432; to Seth: 517796 ("I DID IT!" yelled from the heavens). Trey typed, tagged to Messenger: 470898, 467520, 639373, 441158; to Giant: 593235, 488410, 811797.
- **Vortox beats:** Trey's 363146 (Morra's phone caveat, rewritten as "Someone on the ship knows Emmett's number, but they have to use Morra's phone."), 675380 (caveat, Zach gains confidence and loves the elf ears), 168597 ("Poof!"), 404226, 366707, 814766 (Zach pink, spectre appears), 509131 (cathedral, "a Elven" -> "an Elven"), 919814 (ground shakes), 369273, 472114 (crew flees); Zander's 004486 (16 hours of customs), 328272 (customs replace the ears). The opening recap embed 077993 is a Vortox embed.
- **Reworded/cut 8balls:** reworded 122552, 382608, 379787, 904006, 802570, 395264, 637958, 255912 (quotes fixed), 883442, 162802, 630278 (all capitalisation/punctuation only; 255912 also reformatted the doubled quotes). Cut: 116005 (does Bellow have eyelids), 399111 (Bellow brap loud enough for Emmett), 937473 (Dutch monocle) as gags with no outcome. Kept joke answers verbatim: 487773 (YAAAAAS!), 162802 ("It's opposite day! No." while the ground shakes, played as yes), 511878 (code answer), 255912 (emoji). Added Zion beat after 630278: "Zion picks up Zach and plants him in front of Dutch." (nothing showed the outcome).
- **Fake flavor cut:** Zander's "The Elf Bible 2..." 478643 and Silas "tome was The Bible 2" 227675 and Trey "It was the Super-Quran" 161490; Jonas "dee nu" 389009 (kept in unmatched raw), "pingor" 617429, "professional sleep driver" 683400, "bellow for 0.00054 picoseconds" 230083.
- **Kept gags:** Zion can't reach Dutch's hands (486384, with the "Yes" 8ball 904006), Zach seppuku (169966), Dutch breaks character (425788/213146, fiction reacts), Zach crushed-plant elf ears (8ball 487773, 180344 "mushy").
- **Cut attachments/links:** 361748 (Silas, [link], 06:26 PM), 125332 (Jonas, [link], 07:12 PM), 052359 (Trey, [link], 07:40 PM), 047549 (Jonas, [link], 07:46 PM), 885782 (Trey, [link], 07:48 PM), 525156 (Silas, [link], 07:52 PM). No file attachments.
- **Unclear rewrites:** 363146/675380 (bare Trey caveat text, converted to Vortox actions); "Messenger 1" in 441158 kept as typed; "Klek'li'more" (Zander bare coordinates 606003) cut because intercom 886046 states it.
- **New NPC tags:** none (all existing DB characters).
- **Kept `✂`:** 319320 (Zion "No, Seth was more prepared than that...", 238429 "I thought he was just rambling" depends on it), 515974 (Zach "I swear to God if anyone tries anything, I'm going to start stabbing.", in-character). 509131 (monastery establishing action, kept as Vortox beat). Cut `✂`: 554271, 241886, 121297, 798733, 155624, 503132, 541278, 116530, 856882, 842610, 471746, 342696, 626351, 561862, 437131, 492018, 134322, 607272, 924635, 309190, 454110, 640468, 175347, 687317, 521843, 611072, 060498, 202755, 671707, 852820, 271583, 562798, 643529, 603968.
- **Anachronism/slur flags:** "Jesus Captain!" (484289, Zach), "Mii" (488410, Giant moving Dutch), "dark-web posts" (386496), "goddamn", "Oh god". Slurs: none. Insults left: "Zacklemore"/"Zachaloid" nicknames, "That crazy bastard".
- **Merge moves (30s and 45s):** 3 moves: customs-ears Vortox 328272 after 268743; 8ball 487773 after 656798; Giant putting Dutch down 811797 after its 8ball 883442. Leftover hits (7 at 45s): Squorchy/Emmett "fluffy cheeks" (Zion throws holodeck interjection), Dutch/Zach pat-down and "blinks" reactions (x2), Dutch with arriving messenger (x2: the messenger interrupts "Not at all!... PUT ME DOWN"), Dutch "He fucking did it" with Messenger crawling.
- **Morra scan:** clean (no he/him on Morra).

## Ep 23: judgment calls for Trey to review
Export `Episode 19` (`Final Frontier 4 Episode 19 [1052413131403558982].json`), "Finale". Raw 472 actions / 773 quotes; imported 1327 messages (441 ACTION, 754 QUOTE, 126 EMBED, 6 BOT_RESPONSE). Md `md/ff4/23-finale.md`, `api/ff4/23-episode-19.json`. Summary: the pod returns from Elf Heaven with Morra and the artifact, Llashii reports the Elf Confederation and Chomsky have joined the LR, Seth (now Sethkinki, God of Death) docks, 10,000 Raven ships attack the mothership, and the crew, Chomsky, Seth and Sanya kill the Ravens Leader (Zach loses an arm, Sanya replaces it); goodbyes and Space Rules close the season. New NPCs: Trenchcoat Kids, Enemy A, Enemy B, Enemy C (species Unclassified, ids 2046-2049). No new personas.
- **Vec / persona:** no Buzzcut, no `Vec as <Host>`, `personas` empty (timeline has nothing for this episode). Vec is in an unnamed Llamanian body from 8ball 362826 ("Does Vec return as a Llamanian commander?") on; Zion calls it "Commander Llorpus" (871228) and 913769 has "Llorpus begins to emit spores". Left as plain Vec (no persona) per the ruling; 037332 ("missile ... through Llorpus's right shoulder") is tagged `Vec`.
- **GM attributions (typist -> tag):** Trey -> Bellow 533062 (items fall on his head); -> Dutch 946084, 514522; -> Seth 206848, 747920 (bare Seth/desert-eagle narration, converted to `_` actions); -> Zach 906152 (bare "arm is sliced clean off"); -> Morra 438790; -> Vec 037332; -> Chomsky 685373; -> Trenchcoat Kids 628850; -> Zion 004992 (Zander); Odran (Trey) 962782, 957322; Ravens Leader (Trey) 535946, 619723, 478248, 576976, 980051, 813460, 598963, 011014, 246195, 713921, 937498, 780294, 744947, 478784, 316594, 050304, 629692, 968616, 149520; Ravens Leader (Silas) 919144. Zander -> Dutch 247838, 286491 (100 ships); -> Seth 726578 (the 60% / 6,000 ships ruling, converted from bare text to "Over the course of the battle, Seth's Death Ship takes out 6,000 ships."), 196349; -> Zach 581737; -> Morra 463060; -> Llashii 911764, 355927, 159360; -> Emmett 562438; -> Chomsky 596168 (pink-haired man), 321246 (tattoo); -> Frechelsi 991774; -> Trenchcoat Kids 532584; -> Enemy A 465705, B 420574, C 435648/991815, D 946930/350410. Jonas -> Chomsky 840134. Tag fixes on Hunt520/Jonas lines that were really NPCs: Jack Madison 705995 ("Is he alive?"), Chomsky 911134, 959592, 016765, 050527, 355412; Jonas 665886 left as Bellow (quadpistols).
- **Vortox beats (GM narration converted/retyped to Vortox):** 011921, 422622, 035146, 572378, 758080, 946005, 593448, 540200, 481064, 694240, 658368, 055154, 607655, 810186, 834314, 230726, 038046, 055111, 781150, 785286, 599986, 730091, 120169, 231400, 198592, 632445, 078910, 789184, 074334, 618206, 872469, 448136, 590356, 861088, 478804, 612992, 096084, 237898, 739910, 882344 (timeskip, OOC aside cut), 824576, 337793, 796032, 232586, 240583. Space Rules typed by players (321280, 867648, 794955, 023636, 640360) and Zander's "Vec Rule #2" (081916) are Vortox plain text. No ID-less beats added.
- **Reworded/cut 8balls:** reworded (case/punctuation/typos only unless noted) 953075, 683260, 275009, 288704, 846790, 928616, 565490, 239912, 554792; 528896 dropped "(if dms allow it)"; 030282, 406706, 769778 ("duplicate?" -> "Does Morra duplicate?"). Joke answers kept verbatim: 895154 (phone number, played as Jack calling), 237969 (Chris Chan bible), 528896 (garbled "(No)"), 989436 ("Y Word."), 694144 ("No moment."). Cut: 711346, 182633 ("Too easy"), 882536 (impression), 731516 (Morra's finger, with Trey's 216912), 500864 (bellbottoms), 199252 ("typing"), 261895 (waves out the window, YAAAAAS), 585980 (Bellow stops flying), 756352 (FF2 payoff, d10 answer), 042047 (Dutch hides behind door), 825938 (duplicate attack, "Call Jonas"), 547496 (Zach loses arm this turn, "Ask the DM"); 138823 kept (see Kept gags). Other embeds cut as mechanics: /quote 095573, /episode mode 971216 and 031017, /list weapons 973136, /weapon add 416832, d50 /roll 597185 (nothing follows), five initiative /rolls (774053, 820928, 440468, 946961, 491058) and Zander's missed plasma cannon 125032. Kept /flip 910602 (Trey, Tails; its question was in a blacklisted/missing message, so it has no visible outcome).
- **Fake flavor cut:** Family Guy / GU Bank gag (991548, 870602), fart gag (303391, 939935, 367474, 009610), tickles Morra's armpit (750250), "fortnitey dance" (671642), Ravens Leader twerks (745790), "vineboom" (555088), "goblin behavior" (374878), Dutch-petting pile-on trimmed to Zion's pet (740938, 509097, 161472, 901993, 314249, 818570), "Ouchie wowchie" (555777), "Private Llachii is asleep" (552020), microscopic object (216912), "ableist slur" (554306), "Cleaveland Brown" Vec line (458320), Zion runs frantically (507840), "Quadruple" (187098), Dutch kills Zach (291753), Soundgarden/Black Eyed Peas bits (924531, 684881, 392744, 010802), "Rise of Skywalker" (045886), "Sexy" (695849), "dorb" (057724), "Bellow so helpful" (194488), "MINE ME FIRST" (028284), "MOTHERFUCKER" (006140), "Fleshball/Fleabag" (760000), Zander "I'm going to cock you" (511859), "Get wrecked, kid" (945266), Dutch "Ow." spam trimmed to 3, "AAAAHHH" duplicate (962731), "lol" Chomsky aside (704150).
- **Kept gags (fiction reacts):** Dutch hits every elevator button (Zion/Bellow/Morra react), trench-coat kids (Zion ejects Dutch, Bellow carries a kid), Vec melting on Dutch's head, Vec's tooth throwing (Bellow/Dutch "Ow."), Morrachu medallion (054730, with kept ✂ 925810/912970), Morras turned into XP orbs (463060), anime pose (917801, Morra "POSE!"), Dutch's "unlimited money" bit, Morra "Eye." (119337), 8ball 138823 ("Will Zach lose a limb?") and /choose 356264 (arm), kept because Zach's arm is sliced off later (906152).
- **Cut attachments:** 281971 (Zander, `dutch.png`, 10:09 PM), 510132 (Zander, `AD.png`, 10:16 PM), 970984 (Zander, `image.png`, 01:06 AM), 722506 (Zander, `image.png`, 11:55 PM), 600542 (Silas, `there_he_goes.webm`, 09:21 PM), 447932 (Trey, `lla_mothership.png`, 10:30 PM). Links cut: 350568, 936125, 163669, 098616, 725821, 495390, 097961, 837333, 659468, 089876, 105010, 375474.
- **Unclear rewrites:** 722232 (Bellow "do the funny on the controls" -> takes the controls), 615919/564988 (customs joke cut, Vec "waiting for help" kept), 038046 ("retrieve the fingle" -> "retrieve Vec"), 505532 ("Zion-Oh" -> "Zion-- Oh"), 302963 (Zach `"Oh thank God"` action -> dialogue), 781864 (Morra wormhole line), 251526/960416/042816/146651/555468 (stripped bare OOC tails), Zach silent-mind lines to Sanya (657990, 971281, 234580, 803516, 291840, 359360, 606131), 980928 (bare Zander "QUADRUPLE CANNON POWER RANGER ATTACK!" -> Vec dialogue), 344990 ("Quick thinking, Zion...!" -> action), 971978/911700/919538 (parenthetical DM notes removed), 900574 (duplicate message ID: second OOC block cut, closing quote fixed), 750992 (cauterize clarification from OOC 210944 folded into the action), 911764 (keyring tag "rosebud"), 516246 ("That was a mistake" -> "Zion realizes that was a mistake."), 612992 + 096084 (helmet reveal as Vortox).
- **New NPC tags:** `Trenchcoat Kids` (three kids in a coat, 532584, 628850), `Enemy A`, `Enemy B`, `Enemy C` (Enemy D already existed). Reused `Llashii`, `Frechelsi`, `Odran`, `Sanya`, `Chomsky`, `Emmett`, `Jack Madison`, `Ravens Leader`, `Sethkinki`.
- **Kept `✂`:** 528465 (part 1 Zach line, Bellow "A very bad time." replies), 011921, 260777, 474002, 825760, 824361, 925810, 912970, 639922, 288370, 168000, 791944, 977856, 133224, 194300, 846790, 396958, 167120, 720306, 002506, 746974, 669322, 686686, 078910, 321246, 684325, 070208, 826752, 413268, 482142, 726578, 099977, 740550, 720740, 140350, 014657, 070005, 421639, 287154, 643998, 154792, 763113, 239814, 759390, 054047, 924625, 754869, 612992, 219230, 160744, 035206, 747732, 104031, 512064, 173417, 470020, 732640. Cut `✂` otherwise, including 450910, 329596, 298506, 741642, 353778, 583134, 161418, 507840, 125032.
- **Anachronism/slur flags:** "Chris Chan bible" (237969 8ball), "Prepare for Trouble! And make it Double!" (101952), "HOLY SPACE SHUTTLE BATMAN" (310854) / "Is batman in there?" (643585), "Ludicrous Speed" (903239), "POWER RANGER" (980928), "gigachad chin" (596168), "XP orbs" (463060), "Go, Morrachu! Go and Arcane" (054730), "wizard of oz" (153769), "Thank God"/"Oh God" lines. Slurs: none added (prep swaps already applied, e.g. "stupidloid" 306452). Insults left: "DUTCHALOID" (454471), "pussy bitch redsuit" (347678), "stupid ass" (312292), "Shitaloid" (900746), "Bugeye".
- **Merge moves (30s and 45s):** about 46 moves (reactions/side actions/8balls/dmg embeds moved after the second half; e.g. 011921, 991528, 722232, 542190, 442044, 035146, 903953, 502245, 356264, 540200, 254844, 248444, 781864, 765514, 628850, 453761, 120169, 362826, 851452, 618206, 696084, 317760, 245569, 388678, 984670, 966086, 685373, 993610, 724840, 111242, 937498, 202920, 785280, 313355, 081586, 309696, 173417, 378089, 355412, 626689, 554792, 137626, 237086, 079155). Leftover hits (21 at 45s) left on purpose: reply chains (Zach reaction to the posters 1117; Vec spin 217), cause-then-effect rolls/dmg (Zion missed/EPIC DODGE, Chomsky armor/stumble/bleed, Dutch healing, arm-slice beat, Zach/Zion grab-Vec roll sequence), 8ball "person after you decides" outcome (3572), Dutch/Zion elevator buttons (1319), Dutch slowdown reply (905), Bellow pod landing (145), Chomsky/Raven stomp reaction chain (4172, 5006), Vec tooth/"Ow." (5980).
- **Morra scan:** clean (no he/him on Morra).
