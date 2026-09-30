# Handoff: FF4 editorial pass (started 2026-09-29)

FF4 gets the same editorial treatment as FF2 and FF3, in a different
format. Read these first, in order:

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
| 0 (Pilot, "Test One-shot") | Edited by Opus as the template. **Awaiting Trey's review.** Notes are below. |
| 1 ("Episode 1") | Edited by Sonnet 5.5 (started on Trey's go-ahead). **Awaiting Trey's review.** Notes are at the bottom. |
| 2 ("Episode 2") | Edited by Sonnet 5.5. Imported; Trey's first-pass corrections applied. Notes are at the bottom. |
| 3 ("Ambush") | Edited by Sonnet 5.5, imported. **Awaiting Trey's review.** Notes are at the bottom. |
| 4 ("Blackjack") | Edited by Sonnet 5.5, imported (after Trey's edits). **Awaiting Trey's review.** Notes are at the bottom. |
| 5 ("Diplomacy") | Edited by Sonnet 5.5, imported. **Awaiting Trey's review.** Notes are at the bottom. |
| 6 ("Obligatory Shopping Episode") | Edited by Sonnet 5.5, imported. **Awaiting Trey's review.** Notes are at the bottom. |
| 7–23 | Not started. |

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

State: eps 0–5 are edited in `md/ff4/`; eps 2–5 are imported into the dev DB.
Ep 5 ("Diplomacy") was done in one pass, prep to import, and awaits Trey's
review. Nothing is committed (Trey commits). Next: ep 6 ("Obligatory Shopping
Episode"), following the pipeline above. Before starting it, re-read
`md/ff4/5-diplomacy.md` if Trey has hand-edited it: his edits are the bar.

**Rules learned since the Pilot** (also in the Claude memory files):
- **Morra is they/them** (Brody). The raw says he/him a lot. Fix in text and
  8ball footers; grep near "Morra" after each episode.
- **GM attribution.** Untagged Zander/Trey lines default to Vec/Zion. Scene
  description and outcomes → Vortox; NPC-subject actions → that NPC's tag; an
  `<embed>` can take a speaker via a lone `` `Name`: `` line above it
  (`md-to-api.py`).
- **Fake flavor text is cut, never converted** (see Ep 2 notes).
- **/choose embeds** have no asker; `ff4_verify.py` no longer flags their footer.
  Cut retries and junk (`/info`, "does not exist", "Unable to Roll", wrong-target
  hits), keep hits/misses verbatim.
- **Hunt520 = Terry** (ep 3); his untagged lines import as Terry.
- **Duplicate block IDs** (a converter quirk on a Trey action + Vortox embed pair)
  make `ff4_move_blocks.py` assert; rename one temporarily.
- **Sean and Brody** debuted in ep 2; **Hunt520** in ep 3.

**Import** (steps and gotchas in the memory file `ff4-editing-and-import-workflow`):
delete the old episode (check commentaries first), create missing NPC characters
as the voicing player, drive `/import` with Playwright, map "Edmin Kalvanzas" →
`Edmin`, then set the Fungo persona by SQL (the importer ignores `persona`) and
set any missing avatars.

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
