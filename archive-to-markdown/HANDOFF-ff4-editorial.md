# Handoff: FF4 editorial pass (started 2026-09-29)

FF4 gets the same editorial treatment as FF2 and FF3, in a different
format. Read these first, in order:

1. `md/ff2/EDITORIAL-STYLE-GUIDE.md`. The house rules. Everything there
   applies unless this file overrides it.
2. `HANDOFF-ff2-editorial.md`, the "Conventions learned in FF3" and
   "FF3-specific conventions" sections.
3. This file.
4. `md/ff4/0-test-one-shot.md`. The finished Pilot, the worked example.
   Diff it against `md/ff4/raw/0-test-one-shot.md` to see every kind of
   edit.

## ▶ Status

| Episode | State |
|---|---|
| 0 (Pilot, "Test One-shot") | Edited by Opus as the template. **Awaiting Trey's review.** Notes are below. |
| 1–23 | Not started. Can go once Trey approves the Pilot. |

Nothing is committed yet. Commit only when Trey says so (`git -C ff-site`).

## How FF4 differs from FF2/FF3

- **The source is DiscordChatExporter JSON**
  (`discord-exports/episodes/*.json`), not HTML. It has everything:
  embeds, slash-command usage, replies and attachments.
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
target.

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

## Pipeline, per episode

All commands run from `archive-to-markdown/`. N is the episode number,
the name is `md/ff4/raw/`'s file name, and `EXPORT` is the episode's
`discord-exports/episodes/*.json`.

1. `python3 ff4-to-md.py --prep "$EXPORT" .editorial-analysis/ff4-epN/prep.md`
2. `python3 editorial/ff4_parts.py split .editorial-analysis/ff4-epN/prep.md .editorial-analysis/ff4-epN`
   - This writes `prep-1.md`, `prep-2.md`, … at about 600 lines each, cut
     at block headers.
3. Read each `prep-K.md` and write `edit-K.md` by hand.
   - Skim the next part before cutting anything that looks like noise
     (FF3's "is stuck in jar" lesson).
   - Keep a running list of review notes as you go.
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
   - Slur flags are handled per guide §4 (gay/homo insults go on Trey's
     list).
6. Add an "### Ep N" review section to this file: judgment calls, kept
   `✂` lines, new NPC tags, cuts worth a second look. Then stop for
   Trey's review before the next episode, or batch them if Trey says so.
   - **After install, `md/ff4/<N>-<slug>.md` is the source of truth.**
     Trey edits it directly, so don't reassemble over it.

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
  - Maxwell: Mateo (0) → Edwin (1+)
  - Silas: Dutch
  - Jonas: Chomsky (0) → Bellow (1+)
  - Michael: Kumdome (0) → Llawdon (1+)
  - Sean: Seth (1+)
  - Brody: Sanya (0) → Morra (1+)
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
