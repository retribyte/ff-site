# Handoff: FF2 editorial pass (2026-09-28)

Status of the FF2 transcript-editing work, what's waiting on Trey, and how to
continue. The style rules themselves live in `md/ff2/EDITORIAL-STYLE-GUIDE.md`.
Read that first, since this file assumes it.

## ▶ RESUME HERE: FF4 has started, see `HANDOFF-ff4-editorial.md`

FF3 eps 1–8 are all edited and committed (`646d69b`, `8cb9b50`). FF4
work (new format, tools and conventions) is tracked in
`HANDOFF-ff4-editorial.md`. The FF3 review notes below remain as
reference.

**Still open for Trey:**
- The importer ignores `persona`.
- The gay/homo manual pass.
- Squoatian with no translation.
- "I'm not black." (ep 5).
- The ep 6 room-list `🐐`: in ep 7, Emmett tells Theylin "You don't have a
  room", but the list pairs him with Vargas. It's left as Emmett being
  wrong.

### Pipeline, per episode

All of this runs from `archive-to-markdown/`. The scripts live in the
local-only `.editorial-analysis/`.

1. `mkdir -p .editorial-analysis/ff3-epN && python3 .editorial-analysis/ff3_mech.py md/ff3/N.md .editorial-analysis/ff3-epN/mech.md`
   - Mechanical pre-pass: converts to FF2 syntax, strips the converter's
     PC tags, merges same-author runs.
2. Split `mech.md` into parts of about 560 lines, cut at block headers
   that aren't FFBot. Every earlier episode used the same inline Python
   snippet for this.
3. Read each `mech-K.md` and write `edit-K.md` by hand.
   - **Also skim the next part, and `grep` later episodes, before cutting
     a line that looks like noise.** The ep 2 "_is stuck in jar_" line
     looked like junk but was Theylin's setup for ep 4.
4. `python3 .editorial-analysis/ff3_assemble.py .editorial-analysis/ff3-epN/assembled.md .editorial-analysis/ff3-epN/edit-{1..K}.md`
   - This splits blocks after NPC tags. `md-to-api.py` carries a
     `` `Tag`: `` over to the rest of its block.
5. `python3 .editorial-analysis/ff3_verify.py N .editorial-analysis/ff3-epN/assembled.md`
   - It should show: 0 unresolved, no OTHER lines, no orphan bot replies,
     no LINT hits.
   - Every `UNMATCHED RAW` line must be a deliberate cut or rewrite.
6. `cp` the assembled file to `md/ff3/N.md`, then add a "### Ep N" review
   section below.
   - **After install, `md/ff3/N.md` is the source of truth.** Trey edits
     it directly, so fix things there rather than reassembling.

### Conventions learned in FF3

These add to the "FF3-specific conventions" section further down.

- **Quoted lines are NPC voices, not the block owner.**
  - Zander's quotes: news anchors, Richard, Fonda, Squoat, Cali, Gretta,
    Olag's Twin.
  - Sean's quotes: Cali, Olag.
  - Trey's quotes: Jessica.
  - Tag each voice with its NPC name.
- **Brody's italic lines are usually Dread** speaking telepathically,
  often to Garrick, who can hear Dread. Make them `` `Dread` `` dialogue.
- **Players narrate as dialogue:** "> Vargas does X". Seth sometimes
  narrates himself in-world, as a bit. Decide which it is, and turn stage
  directions into actions.
- **Inline merges** like "…text.She did X" come from Preston/Charles
  typing actions after dialogue with no break. Split them.
- **FF 8Ball replies stay verbatim.**
  - Some are Zielic ("Ґɍ⚕️ (Yes).") or a joke ("Yigga.", "Nyet", "Da").
  - Fold "Person who's after/before you decides! X says yes." with the
    player's name.
  - For a "caveat" reply, the outcome beat supplies the caveat. It's
    often a `🐐` line.
- **`🐐` (FFBot) is for GM or world narration:** cold opens, scene cuts,
  rulings, hallucination reveals, and every closing "Space Rule #N".
- **Out-of-character material to cut:** junk rolls, links, 8poop, "I just
  lost the game", player-to-player arguments, and meta rolls about
  players ("does Trey turn into a water bottle").
- **Mystery discipline:** keep an unrevealed noun unrevealed in the
  narration, but never foreshadow or deny either.
  - Vargas's hallucination (ep 5) was narrated as it appeared, then
    revealed.
  - Gretta was the "Mysterious Voice" until she named herself.

### Continuity at the end of ep 6 (the Richard Jamerez hit, 4 Jun)

- **The crew:** Seth (captain), Emmett (pilot), Sanya (+ Dread), Garrick,
  Iris, Dakari, Mateo, Volentina (female since ep 5; the persona
  switches at 05:51), Wemmfort, Theylin, Vargas and Jess. Burner and
  Diver (the ducks) are still aboard. Rachell appeared in ep 4.
- **Vargas:** literally an 8-ball head. Nobody takes him seriously; he's
  a plostacian addict and a "Biogenic" (not a robot). After the hit he's
  in the medbay for a week with acid burns, and passes out at the end.
- **Emmett:** weaning off grass (Fetal Grass Syndrome) on Squoat's orders.
  The withdrawal brings back "the Crave" (hulking out), which Jess's
  Anti-Crave syringe treats. He slept with Jess in his wrecked room,
  platonically, for warmth. His room is full of rubble.
- **Jess (Jessica):** the Ottori, rescued from Garrick's pocket. She's
  hurt ("OW, MY LEG"), then unconscious, and sleeping in Emmett's bed.
- **Iris:** can shapeshift (she turns pink when not in her own form) and
  touch ghosts, since absorbing Gretta in ep 3. She's the crew's cook
  and feels threatened by Vargas's cooking.
- **Garrick:** pocket dimension, connected to Dread's (the lock was
  deleted in ep 3's Valetuora Vault `🐐`). He has Emmett's confiscated
  grass. Sanya once pulled out his "true identity" index card and put it
  back (ep 4). He and Sanya are roommates per the ep 6 room list.
- **Room assignments (ep 6 `🐐`):** Seth; Emmett; Sanya + Garrick;
  Chomsky; Iris; Dakari; Volentina; Rachell; Theylin + Vargas.
- **Ship AI:** Cali.
- **Bounty:** the Richard Jamerez job (75–150k Ducketts) is done. Emmett
  killed Richard aboard the ship with the Maggo-Pistol.

---

## State as of the FF2 commit (`2492730`)

| Area | What changed |
|---|---|
| `md/ff2/EDITORIAL-STYLE-GUIDE.md` | Rewritten from a measured raw-vs-edited analysis of eps 1–22. Tier 1 + Tier 2 contextual actions (§5), placement rules, roll/bot conventions, deletion categories, slur table (§4), Zielic cipher (§2). |
| `md/ff2/23–25` | Fully edited to the guide. Trey reviewed and approved ep 23; eps 24–25 still need review (see below). |
| `md/ff2/2,4,6,9–14,17–20,22` | Slur standardization (32 lines, see `REVIEW-slur-standardization.md`) plus formatting fixes (unclosed `\*`, the missing header timestamp in 17, one action inside a quote in 22, `Martian:` → `_Martian Translation:_` in 19). |
| `md/ff3/ff3.md` | Slur standardization only. |
| `md/ff3/0-prep.md, 1.md–8.md` | Now **verbatim slices of `ff3.md`**, which holds Trey's FF3 edits. Before this they were the stale raw export. |
| `meta/ff2.json` | + `Deyner` (username and cast, "Deyner Revathen" from ep 20), + Silas `"25": "Chase Sandeep"`, + episode entries for 23–25 (titles from the wiki's `Final_Frontier_2/Episodes`). |
| `meta/ff3.json` | + `"Maxwell": {"1": "Mateo"}` (was missing; Mateo's edited actions didn't resolve). |
| `REVIEW-slur-standardization.md` | Every slur change with its before and after, Zander's kept substitutions, and the pending gay/homo list. |
| `ZIELIC-CIPHER.md` | The Zielic glyph alphabet with every attested line, for a wiki page. |

`api/ff2/{20,23,24,25}-*.json` were regenerated by `md-to-api.py` and are ready
for the `/import` page. They are gitignored.

## Waiting on Trey

1. **Review eps 24–25.** Judgment calls to check:
   - **Ep 24**
     - `The Crave` is the tag for the voice in Emmett's head during surgery. It's inferred from the wiki's Squoatling/Crave lore and his birth name, Squemfet.
     - "You look gay" (Garrick heckling Emmett) was deleted as out-of-character chatter.
     - "Does Jim fix the glass?" was reworded to "break".
     - Emmett's post-"wakes up Canadian" line gained an "eh?".
     - `Chomsky's Boss` is deliberately left undescribed.
   - **Ep 25**
     - The god is spelled "Kluex". The wiki is inconsistent: `Final_Frontier_2/Episodes` says "Kleux", and the Avian page uses both.
     - Kluex's slap was reconciled with Zander's ruling that a ghost can't be slapped.
     - Emmett's "email" became "notice".
     - Maia's gift and Damien's promise are left as vague as the raw. The Discord server may say more.
2. **Manual gay/homo pass.** Trey wants to decide these line by line; there's no stock replacement. The list is in `REVIEW-slur-standardization.md` §3.
3. **Deferred:** the ep 18 "Yigga like a bigga…" bit keeps Zander's "Yee haw like a bee haw nee haw!" until Trey thinks of something as funny. The lines after it still ask "The hell is 'yigga'?".
4. **Zielic has no glyph for "x"** (q was assigned `ϙ` in ep 23). `ZIELIC-CIPHER.md` is meant for a wiki agent to turn into a page.
5. **Import.** FF2 is committed (`2492730`). Import 23–25 through `/import`. The DB is disposable dev data.

## Verifying an edited episode

Run these after any edit. All of them are stdlib Python, run from
`archive-to-markdown/`.

```python
import importlib.util, collections
spec = importlib.util.spec_from_file_location('m2a', 'md-to-api.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
meta = m.load_meta('ff2')
ep = next(e for e in meta['episodes'] if e['file_name'] == 'feel-the-heat')
msgs = m.convert_file('md/ff2/24-feel-the-heat.md', meta, ep)
msgs = msgs['messages'] if isinstance(msgs, dict) else msgs
print(collections.Counter(x['type'] for x in msgs))
print('unresolved', [x['text'][:60] for x in msgs
      if x['type'] in ('ACTION', 'QUOTE') and not x.get('character')])
```

- **0 unresolved speakers.** An unresolved line means a missing `usernames` or `cast` entry, or an NPC line without a `` `Tag`: ``.
- **Lint:** `grep -nE '^> _|^> \`[^\`]*\`$|\\\*|  $' <file>` should print nothing. Those patterns catch an action inside a quote, a stray backtick-fenced line, an unclosed escaped asterisk, and trailing double spaces.
- **Density:** count `_…_` action lines and `> …` dialogue lines. Finished episodes run about 40% action lines, or 0.8–0.9 actions per dialogue line. Treat it as a calibration check, not a quota (guide §9.9).
- **Slurs:** `grep -niE '\b(fag|nigg|retard)'` should print nothing, except lines Trey deliberately kept.

## How the work was done (reuse for FF3 or new episodes)

- **Use the right "before" file.** `md/ff2/ff2.md` is a clean regeneration of the raw export, so diff against it for before/after. For FF3, `ff3.md` is the frozen raw baseline, and the split files are hand-edited directly (see "FF3 pass" below). **Don't re-slice.** `.editorial-analysis/ff3_resplit.py --apply` would overwrite the edited split files.
- **Look up lore; don't guess it.** Before tagging a new NPC, voice or god, check the wiki. The public API works without auth: `https://wiki.vortox.space/w/api.php?action=parse&page=<Title>&prop=wikitext&format=json&formatversion=2&redirects=1` (note the `/w/` path). The `wiki/` directory also has an MCP connector, and there's a Discord MCP for searching the server. Players often worked out meanings off-channel; for example, the ep 23 Zielic lines came from DMs.
- **Big episodes:** write the edit in parts to a durable folder (not `/tmp`), assemble, then verify. Insert Tier 2 beats afterwards, anchored on exact unique dialogue lines, and re-check continuity: where each character is, who's possessed or unconscious, and anything the narrator must not reveal yet (guide §5.5).
- **Ask Trey rather than deciding** anything that changes lore or tone: slur mappings, which voice a quoted line belongs to, and cutting a bit that might be an in-joke.

## FF3 pass (started 2026-09-28)

FF3 gets the same full treatment as FF2 (Tier 1 + Tier 2, guide §5).

### Workflow (supersedes the "edit ff3.md, then re-slice" note above)

- `md/ff3/ff3.md` turned out to be converter output plus the slur swaps, with
  no hand edits. It is now **frozen as FF3's raw "before"**, the same role
  `ff2.md` plays. Hand edits go straight into the split files (`1.md`,
  `2.md`, …).
- **Don't run `ff3_resplit.py --apply` again.** It regenerates the split files
  from `ff3.md` and would wipe the hand edits.
- The local-only helpers in `.editorial-analysis/` are the pipeline:
  - `ff3_mech.py <in> <out>` is the mechanical pre-pass (below).
  - Edit in parts under `ff3-epN/edit-*.md`.
  - `ff3_assemble.py <out> <parts…>` concatenates the parts. Wherever an
    owner's untagged line follows a `` `Name`: `` line, it opens a new block
    under the same header. `md-to-api.py` carries a tag over to the rest of
    its block, so without the split the owner's lines would be attributed
    to the NPC.
- Verify with the checks above, plus three more: the character set (cast
  full names or intended NPC tags only), OTHER lines from non-bot authors,
  and bot replies that don't follow a command (`🐐` lines excepted). Both
  should come back empty.
- **Once an episode is installed, `md/ff3/N.md` is the source of truth.**
  Trey edits it directly, so the `ff3-epN/edit-*.md` parts go stale. Don't
  reassemble over it.

### FF3-specific conventions

- **Syntax is converted to FF2 house style:**
  - Headers use `_(…)_` with a blank line after them.
  - Actions use `_…_`.
  - Same-author runs within 5 minutes are merged, as FF2's converter did.
  - **PC speaker tags are stripped.** Every `` `Emmett`: `` / `` `Iris`: ``
    tag in the raw file was added by the converter (players typed dialogue
    in inline code). Left in place, `Iris`, `Dakari`, `Wes` and `Wemmfort`
    would each become a second Character row, because they aren't in
    `NAME_ALIASES`. Tags stay only for NPCs and `` `Dread` ``.
- **Quoted Zander lines are NPC voices**, not Emmett:
  - GU News → `` `News Anchor` ``
  - the fuel alarm → `` `Ship Computer` ``
  - the station PA → `` `PA System` ``
  - Silas's race commentary → `` `Race Announcer` ``
- **GM narration is spoken by FFBot as `🐐 | …`** (Trey, 2026-09-28).
  FFBot/Tatsumaki counts as the GM, following FF2's `🐐` lines. This covers
  world and scene narration that isn't an action by the block owner's
  character or NPC:
  - establishing and cold-open beats
  - scene cuts ("Elsewhere on the ship…")
  - ambient events and transitions (the throne toppling, `BOOOOOM!`, the
    ship leaving the station)
  - GM rulings (Zander's "(Given that it's a duck…)")
  - closing lines like the Space Rule

  Write it as its own `**FFBot**` block with the neighbouring timestamp.
  Player-typed narration of their own character or NPC stays in their
  block.
- **8coin folds into one reply** (Trey's precedent, ep 1). The bot's "Flip a
  coin with 8coin…", the player's `8coin` and the bot's `Heads.` collapse
  into a single reply right after the `8ball` command:
  `Flipped a magic 8-coin... It's heads! Yes.`
- **FF 8Ball replies stay verbatim; Tatsu lines are normalized.**
  - Answer-folding follows FF2 (§2.3). "Ask X." becomes "Ask X. X says
    yes." (character name, as the bot uses). "The person who goes after
    you decides." becomes "… Zander says yes." or "… Brody ignored you."
    (player name, as in FF2).
  - Group-vote and poopy-farty-song replies stay verbatim and are followed
    by an outcome beat.
  - "No. In fact, the opposite happens." gets a beat that shows the
    opposite.
- **Wemmfort** (per Trey): he's a stowaway in an unused bathroom on the
  ship, which matches the wiki. In ep 1 he's comatose and then too weak to
  move, in short cutaway beats. The contradictory "too weak? DENIED" roll
  was reworded to "Does Wemmfort manage to get up?".
- **Mystery discipline in ep 1:**
  - The narration doesn't say "duck" until the croissant reveal.
  - The second duck (Burner) stays "the second duck" or "the voice", since
    she refuses to give her name. Bill's own "Burner, knowing the gig is
    up…" was changed to match.
  - Mateo being a shapeshifter isn't mentioned until "Thanks, shifter."

### Ep 1: judgment calls for Trey to review

- **Density:** 607 actions to 781 quotes (0.78). The raw had 290 actions.
  After the `🐐` conversions it's 0.76.
- **Density is a sanity check, not a target (Trey).** The FF2 middle range
  (about 0.7–0.8) is fine. If an episode reads clearly without more
  actions, don't add filler; FF3 players already explain themselves better
  than FF2 players did. Tier 1 clarity beats are still required.
- **FF2 baseline for this ratio** (actions per quote, from `convert_file`,
  measured 2026-09-28):
  - eps 1–4: 0.11
  - eps 5–22: 0.68
  - eps 20–22: 0.89
  - eps 23–25: 0.81
  - FF2 overall: 0.64

  Per episode, it runs from 0.59 to 0.79 in eps 9–18 and from 0.85 to
  0.92 in eps 19–22. Guide §9's "0.8–0.9" is the eps 20–22 figure.
- **Garrick-voice gags kept:** the toenail-fetish narration now comes before
  Chomsky finally pulls his flamethrower, rather than contradicting it. The
  closing `[Space Rule #152…]` became a final narration line.
- **Cut:**
  - The "draws her word" / "Word" / "THAT'S RACIST" typo joke.
  - Emmett punching Jonas through the fourth wall.
  - Silas's backup-generator roll. It wasn't a retry: a different player asked
    the same question Seth had just asked.
  - Sean's unresolved "Does Wes go into the bathroom?" roll. Wes wasn't
    there yet; Sean may have meant Wemmfort.
  - All out-of-character chatter, links and retries.
- **Continuity fixes:**
  - **Diver and the croissant.** The throne topples onto Diver and he's
    carried off as the walking croissant. "Diver returns to the storage
    room" became a crumb trail, so that the croissant-duck is Diver.
  - **Mateo's first exit.** The roll became "Does Mateo stick around after
    Emmett ignores his handshake?", because he had just introduced himself
    before "I lost him".
  - **Seth's line.** "You stole my cheese" became "grass". Emmett ate
    Seth's grass, not his cheese.
  - **Stun order.** Seth's three stun shots are staged in the order the
    victims go silent. "Ah, peace and quiet" was moved after them.
  - **Emmett's buck.** It lands at "That's what you get for stunning me";
    the group vote was never recorded.
- **Invented connective tissue worth a glance:**
  - The screeching 8-ball picture comes with a tiny bug-like Packi in a
    uniform, which Emmett curbstomps.
  - Emmett's "accidental" guard kills: he lands on two, and a door slams on
    a third.
  - The septic-tank smell.
- **Done after review:** the GM narration now uses `🐐`, the 8coin roll is
  folded, and the `meta/ff3.json` cast entry is now `"Mateo Krovak"` (which
  matches FF4).
- **Open:** FF3 episode titles are empty in `meta/ff3.json`, and there's no
  wiki episode list for FF3.

### Ep 2: judgment calls for Trey to review

- **Density:** 517 actions to 735 quotes (0.70). The raw had 250 actions,
  and 79 of the added beats came from a second texture pass. It's lower
  than ep 1 (0.78) because the diner scene is mostly rapid back-and-forth.
- **New NPC tags:**
  - `` `Beanfrank News Anchor` ``
  - `` `Cali` ``: the ship's voice-recognition AI, voiced in quotes by Sean.
    Ep 1's fuel warning was retagged to Cali as well (Trey).
  - `` `Olag` `` and `` `Olag's Twin` `` (the cook)
  - `` `Masked Stranger` ``: see the morph slime below.
- **The morph slime:** Cooldude played a shapeshifting morph slime
  impersonating Wemmfort, until the real one walks out and yells
  "Imposter!". Before that reveal:
  - its lines are tagged `` `Masked Stranger` ``;
  - narration calls it "a familiar masked figure";
  - the "Is Wemmfort out in the junk pit, too?" roll stays as typed.
- **Volonta → Volentina (Trey):** it's the same character, who
  transitions later in the campaign: a gender-change potion, after which
  she suddenly appears as Volentina. Trey doesn't remember which episode.
  - Until that scene, narration uses "Volonta" and he/him, as the raw
    does. After it, use "Volentina" and she/her.
  - The DB character stays the single cast entry "Volentina Constantini"
    throughout.
  - Watch for the potion in eps 3–8 and give it a clear beat when it
    happens.
  - **Use the Persona pattern (Trey), not two characters.** When the potion
    scene turns up, add a `personaTimeline` to `meta/ff3.json`, the same
    mechanism `meta/ff4.json` uses for Vec (see `persona_timeline.py`):
    `"Volentina Constantini": [{"from_episode": 2, "persona": "Volonta"},
    {"from_episode": N, "persona": null, "anchor_contains": "<potion line>"}]`.
    Check whether the "Volonta" persona has to exist in the DB before
    import.
- **gay/homo, left for your manual pass:** Seth's "The gay slime." (about
  Olag) and Zander's narration "Emmett peers at the homo."
- **Collapsed or condensed:**
  - Seth's absurd order is recited three more times: twice by Seth and
    once by Dakari. Seth's repeats became one-line narration. Dakari's
    and Seth's quoted repeats were cut down to their punchline items.
  - The first recital, and the Jimmy Neutron "McSpanky" copypasta, are
    kept whole.
- **Cut:**
  - Cooldude's out-of-character asides.
  - The `8poop` / "No, you are poop." spam, including Sean's "Does Emmett
    eat poop because of a really bad mutation?" roll.
  - The 6ix9ine rat roll, the entire-cast-into-a-pickle roll, and "All the
    nukes on earth launch".
  - Sean's "Seth pees on Trey", Michael's "is stuck in jar", and Cooldude's
    "Does Emmett eat Sanya?" roll.
  - Michael's first, unanswered lightspeed roll and its orphan reply.
- **Continuity fixes:**
  - "Does Emmett go to fix the warp drive?" became "…manage to fix…",
    because he was already working on it.
  - Olag's powers: the two conflicting rolls now read as hallucinations
    (no) and hypnosis (yes), which fits the memory-wiping.
  - The Sanya-becomes-a-toilet roll gets `🐐` beats for the change and
    the change back.
  - The drain roll knocks Emmett out, and he wakes when the penis comes
    off.
  - The blender lid Wemmfort steals is why Sanya flips the blender
    upside down.
  - Emmett's "as a good moirail `friend` should" became "moirail— friend".
- **Closing `🐐`:** Zander's "Space Rule #89: Peeing on someone displays
  ownership."

### Ep 3: judgment calls for Trey to review

- **Density:** 0.63 (raw 245 actions, now 312). It reads clearly, so no
  filler pass was done.
- **Brody's italic lines are Dread.** "_I think she's out cold._", "_The
  hell is he talking about?_", "_Not that I know of._", "_I don't feel
  good._" and "_The fuck is happening?_" became `` `Dread` `` dialogue
  (telepathy to Garrick), not narration.
- **Gretta:**
  - The stalker is a pink ghost in a Mickey Mouse mask. Her quoted lines
    are tagged `` `Mysterious Voice` `` until she introduces herself ("It's
    yo' boy, Gretta!"), then `` `Gretta` ``.
  - Narration calls her "the pink blur" or "the pink ghost". Zander's GM
    lines about her went to `🐐`.
  - The wiki has no page for her yet.
  - "Does the being now reveal herself to Garrick? Outlook not so good"
    is followed a minute later by her revealing herself. The bridge `🐐`
    line says she does it on her own terms, not on his.
- **Wemmfort's grass trip:** he emerges from the cavern wall (Burner's
  "Mr. Wall"). He then decides the real crew are fakes, which reconciles
  "Is Wemmfort here with everyone? No". The fake names are Cooldude's
  (Bemmit, Shangya, Lyrus, Deevrr, Burngner, Garry Hickman). Then comes
  the Squeaky Chicken.
- **Burner is named in narration from here on**, as Bill's own narration
  does. Ep 1 kept her unnamed only up to its reveal.
- **Cut:**
  - All of Seth's fly-by gags except the crater pee, which the others
    react to ("You'd land in pee anyways"). That means the fingernail
    poop, the baby backflip, poop in Garrick's ears and "does the woah on
    minorities".
  - Cooldude's out-of-character asides, including "Sanya turns Emmett into
    a basketball" (Brody's basketball line is kept, as Sanya palming him)
    and "Sanya turns a baby into a beer bottle".
  - Unresolved `t!roll`s with no result.
  - Trey's duplicate booby-trap roll.
  - Orphan bot replies.
  - After the session: Cooldude's "is Emmett homosexual?" roll with
    Zander's reply, and Trey's Chaos Emerald roll.
- **Kept after the session:** Zander's 24 May roll, "Are the locks on all
  pocket dimensions deleted from existence? It is certain." It changes
  the lore on Garrick's pocket lock. The command was rebuilt from
  Zander's "Question to above answer" message.
- **Iris's new abilities:** she gets both chooses, ghost touching and
  shapeshifting at will. The earlier "Iris suddenly has the ability to
  punch ghosts" roll already covered the first.
- **Closing `🐐`:** Brody's "Space Rule #382: We don't fuck with that
  Disney shit."

### Ep 4: judgment calls for Trey to review

- **Density:** 0.57 (raw 328 actions, now 386). It's mostly quick
  dialogue with roll beats, and it reads clearly, so no filler pass was
  done.
- **Retroactive fix to ep 2:** Michael's "_is stuck in jar_", which I had
  cut, turned out to be setup. It's now a beat at 04:37 in `2.md`:
  Theylin, having lost his ship, ends up stuck in a jar, since he's made
  of water.
- **Ep 3 addition (Trey):** a closing `🐐` after the 24 May pocket-lock
  roll describes the catastrophe in the Valetuora Vault.
- **New characters:**
  - Rachell (Hunter): a goopy, research-obsessed girl with no wiki page.
  - Vargas (Charles): a pilot whose ship Seth blows up. He joins after
    apologizing (his best friend Badon died), and he's a galaxy-renowned
    cook. No wiki page. **His head is literally an 8-ball (Trey)**, and
    pretty much no one takes him seriously.
  - **Warning (Trey):** some FF3 episode has Vargas doing completely
    insane things, and at the end it's revealed the whole thing was a
    hallucination. Trey doesn't remember which episode. Keep the
    narration honest until the reveal (§5.5): describe what Vargas
    appears to do, and don't foreshadow or deny it.
  - Theylin (Michael): a Torrid. He's "the puddle" or "the Torrid" in
    narration until he says his name.
- **`` `Squoat` ``:** the Squoatling god, per the wiki a Black on the run.
  He speaks to Emmett. A `🐐` line notes that the others only hear
  buzzing, and another marks where his voice cuts off.
- **Brody's italic lines are Dread** again: five lines of Dread's
  commentary to Garrick during the Squoat scene.
- **Seth (and Sanya, then Wemmfort) narrate themselves out loud** for a
  stretch ("Seth decides…", "says Seth"). This is kept as dialogue, with
  a lead beat establishing the bit.
- **Emmett's Squoatian:** "Squemlax fulag howler." (said in the mirror
  with his translator collar off) has no `_Squoatian Translation:_` line,
  because the meaning is unknown. Supply one if you have it.
- **Olag** "kisses" (vores) Emmett, dies of happiness into space dust, and
  leaves a recorded intercom message saying the asteroid will blow in ten
  minutes.
- **Inventions:**
  - Space Disney's copyright enforcement delivers the shock after Sanya
    sings Mulan (`🐐`).
  - The caveat on "Does Garrick get stuck in his own pocket?" is that it
    only lasts a second. No player answered it.
  - Mateo walks face-first into the doorframe. The roll said "something
    the person before you decides", and Mateo's "Ow" needed a cause.
  - Sanya's "Does Sanya attempt to pull grass out of Dread? Nah" now
    yields the weaponized llama head she later puts back.
- **Reworded:** "Does the warp drive get set into place? Outlook bad"
  became "Is the warp drive already set into place?", because Emmett
  installs it himself a few minutes later.
- **Left as typed:** Charles's "_Vargas gets kidnapped._". No kidnapper
  is ever shown, and nothing follows up on it.
- **Cut:**
  - Out-of-character chatter from Cooldude, Silas and Charles ("Is it my
    turn?", "It says indecisive.", "renowned", ";)").
  - Sean's Minecraft roll.
  - Trey's "_Iris goes to the bottom of the pool and changes._". It
    contradicts Lili's own changing-station line.
  - An orphan bot reply.
- **Closing `🐐`:** Trey's "Space Rule #65: Always trust the voice inside
  your head."

### Ep 5: judgment calls for Trey to review

- **The "Unknown" author is Nick** (`Mr.WobblyShark#1426`, Lodas in FF2),
  a guest using the nickname "!Nick Prime!". I first guessed Michael,
  which was wrong; it's been corrected. `ff3.py` now maps "!Nick Prime!"
  to Nick. `ff3.md` still says "Unknown", because it's the frozen raw
  file. Nick only makes rolls (plus a zalgo "Minecraft" line, "ЊݛЊ" and
  "D:", all cut), so he needs no cast entry.
- **This is the Vargas hallucination episode.** Everything Vargas does
  from the airlock on is his coma dream: opening the airlock, the police,
  the explosives, the warship, "Fonda" (tagged `` `Fonda` ``, voiced by
  Zander) and "WE ARE THE EMPIRE". The narration describes it as it
  appears until Zander's roll "Is Vargas just delusional from the coma he
  was in? Sí". A `🐐` line then states that none of it happened and that
  he's been out cold in the holding cell. Emmett's airlock lines stay as
  played.
- **Volonta becomes Volentina here** (05:51, "I got bored, so I am now").
  There's no potion on screen.
  - The narration switches to "Volentina" and she/her at her entrance.
  - `meta/ff3.json` now has `personaTimeline` for "Volentina Constantini":
    the persona "Volonta" from ep 2, reset to canonical at the anchor "I
    told you I'd be back". `convert_file` emits `persona: "Volonta"` for
    her lines in eps 2, 4 and early 5.
  - **Importer gap:** `EpisodeImporter.tsx` ignores the `persona` field.
    It resolves personas only by matching the speaker name against
    personas that already exist in the DB. The "Volonta" persona has to be
    created, and the importer taught to use `msg.persona`, before this
    takes effect. This is the same "two persona mechanisms" issue noted in
    memory for Vec.
- **Slurs, per the table:**
  - Zander's "Wassup my nig nogs?" became "Wassup, my glimps?". It was
    missed by the earlier standardization pass.
  - Seth's "gleemp" lines were already substituted. Vargas's reply "I'm
    not black." is left as typed; you may want to adjust it now that the
    insult is "gleemp".
  - The bot reply "Yigga." (twice, from FF 8Ball) is kept verbatim. The
    players' echoes of "Yigga" were cut. This ties into your deferred
    "Yigga" bit from FF2 ep 18.
- **Zielic:** Garrick's two Zielic lines got translations: "Bruh moment"
  (the `?` glyph in "Þ?Ǽɷ" is probably a typo for r) and "Why are there
  so many new people. This sucks."
- **Name fix:** Zander's "Robert Jaquerez" became "Richard Jamerez" to
  match the earlier line and all of ep 6. Charles's "Robert sabotage…"
  roll became "Richard".
- **Bot replies:** FF 8Ball's "Ґɍ:medical_symbol: (Yes)." is rendered
  "Ґɍ⚕️ (Yes).". That's Zielic "ye" plus the emoji.
- **Cut:**
  - Undertale jokes: "owo toriel mommy", and the "Trey is a water bottle"
    roll and fridge line. The "Squasriel" roll and its two-second payoff
    are kept.
  - The restaurant-name brainstorm (Zander's `t!choose` is kept).
  - Nick's meta roll about "the child that controls Matteo from another
    dimension".
  - The "doin ya mom" and "Mama jeans" rolls.
  - Charles's "Garrick the all knowing!!!".
- **Density:** 0.43 (raw 101 actions, now 166). There was a second pass
  of 17 lead and addressee beats, where the kitchen, cockpit and comms
  conversations interleave. The rest reads clearly.
- **Closing `🐐`:** Trey's "Space Rule #61: Never trust ball-heads."

### Ep 6: judgment calls for Trey to review

- **New NPC tags:**
  - `` `Richard Jamerez` ``: the Llamanian target, voiced by Zander in
    quotes.
  - `` `Jessica` ``: the Ottori girl from FF2 ep 23, voiced by Trey in
    quotes. She was rescued from Garrick's pocket and is new to the crew
    here.
- **The hit, as played:**
  - Sanya and Garrick lock Emmett (with Jess) in his room. The "does
    Garrick lock Emmett in?" caveat is that the lights go out, given a
    `🐐` line.
  - Sanya and Garrick swap places when Emmett hulks out (the Crave).
  - Vargas poisons and "finishes" the wrong man.
  - Sanya ends up at dinner with Richard. Richard flees to the ship with
    backup.
  - Emmett kills Richard with the Maggo-Pistol.
- **Kept, though it's Trey narrating another PC:** Emmett's
  "AOOOOGA… HOT MAMA" reaction to Jess. Emmett's player plays along, and
  Garrick shuts the door "while Emmett is AWOOGAing". A lead-in, "Emmett
  peeks through his hooves," bridges it from Emmett's "shields his eyes".
- **Folded:** Trey's out-of-character answer ("No, because he got his
  legs slashed") became the bot line: "Trey says no, because his legs
  have been slashed."
- **Zander's plain-text room list** at 05:40 became a `🐐` line listing
  room assignments. Check that it isn't meant for somewhere else.
- **Wording to check:** "Herte? What are you? Fermian?" is rendered
  "Here? What are you, Fermian?".
- **Cut:**
  - The pre-session Zielic ("yo mama jeans"), "FORT INITE" and the
    restaurant list.
  - Michael's out-of-character lines ("Vargas is GAYYYY??????????", "I'm
    doing your mom Trey", "ZZZaaannnder", the cocoa puffs), and the FNAF
    and EmmettFlower rolls.
  - The out-of-character argument between Sean, Charles and Brody about
    the electric hatch, and "I just lost the game".
  - Trey's "Messiah Otter Bath Water", "sloppy richard" and "sanya/garrick
    moment".
  - Charles's keyboard-mash roll.
- **Density:** 0.49 (raw 223 actions, now 292). It's a fight episode and
  reads clearly.
- **Closing `🐐`:** Trey's "Space Rule #92: Don't do drugs, kids."

### `0-prep.md` (Trey's call, 2026-09-29)

- It isn't an episode: it's Zander rolling up the offscreen mothership
  raid, plus out-of-character room logistics. It's no longer in
  `meta/ff3.json`, so it won't import. The file stays in the repo as source
  material, along with Zander's pre-episode synopsis.
- **Folded into ep 1's opening `🐐`:** the mothership chunk, Seth's broken
  leg (he takes a pill for it, per Zander, so his walking and limping in
  ep 1 still hold), Garrick's dented eyeball (heals in a day) and the
  patch of fur the Llamanians took from Emmett's neck. Emmett's scratch
  was already there at his wake-up.
- **Left out:** Seth's magic satchel, Emmett being high and shirtless, and
  the roster talk. The roster talk says Iris left, but she's aboard in
  ep 1.

### Ep 7: judgment calls for Trey to review

- **Your answers (2026-09-29):**
  - The leash stays unrevealed. Your out-of-character "It was jess" was
    cut, and Emmett's guess ("Either that, or Jess.") is the only hint.
  - The episode closes on `🐐 | To be continued...` in place of Zander's
    "extended episode, continues Monday".
- **New NPC tags:**
  - `` `Ameno` ``: the Goddess of Death and Seth's wife, who runs the Elf
    Heaven front desk. Sean voices her in quotes. Seth calls her
    "Shyanalcaop", and his dialogue keeps it. The wiki's Ameno page lists
    Shyanalcaop as an alias, and its "3020 GUY… died from suicide"
    appearance is this scene. I first tagged her `Shyanalcaop`, but Trey
    flagged it.
  - `` `Skeleton` ``: Seth's companion on the Soul Train bench.
- **Seth's death and revival.** A `🐐` line at "Seth awakens in Elf Heaven"
  cites the curse from the wiki page (he comes back after consensual sex
  within two weeks of dying, and gets crazier each time). To match it,
  Ameno's "three-week span" was changed to "two-week".
- **Vargas's head is his 8-ball.** "Vargas shakes his 8ball / asks his
  8ball" became him shaking his own head. The "2/3" rerolls became a
  best-two-of-three, and the answers are narrated ("Yes, bitch.",
  "Just do it. Yes.").
- **Invented connective tissue:**
  - **The Seth Blowup Doll.** Garrick tosses it onto the den floor.
    - Later, Vargas nukes "Seth's body" at the same time as Garrick moves
      the real one, and "Does Vargas destroy every piece of matter that is
      Seth?" comes up N0.
    - The narration calls Vargas's target "the body" until a `🐐` reveals
      it was the doll.
    - Garrick's "Spanish no" on the bed roll leaves Seth on the floor of
      his room, so "Seth awakens in his bed" became "on the floor of his
      room".
  - **Vargas's airlock trips.**
    - Trip 1: he jumps out himself after Seth's "Neigh" roll, then finds
      his way back in.
    - Trip 2: Seth airlocks him, which is the caveat on your "everyone
      follows Emmett" roll. The "Majority rules!" vote has no votes, so he
      stays stuck outside.
    - Emmett's "Fine. I'll get out." gained a beat where he cycles the
      airlock. Vargas's thanks was moved after it.
    - Charles's "gets back in the way he did last time" became "tries to".
  - **Vargas's side job.**
    - Kept: "kills Darwin Caltin". Cut: "gone for a day" and "is starting
      his mission" (the ship arrives within about two in-game hours).
    - After the "Nope" roll and his "didn't kill my target", a beat says
      whoever he killed wasn't Darwin Caltin. Same wrong-man pattern as ep 6.
    - Zander's "spends all of his money on plostacian" became a `🐐`.
  - **American Dad Empire.**
    - Both Good Morning USA zaps are `🐐` lines, following the FF2 ep 13
      precedent (the ADE comms array catches its jingle).
    - The second zap sets up Seth's Rogu morph.
    - "Is Zarazoga in GU territory? No, but…" gets a `🐐`: Zarazoga-9 is
      ADE territory, and the border scan turns everyone into American Dad
      characters. Ep 8's "Please don't turn us into American Dad
      characters" supports this.
    - Zander's meta roll "Does what Sean say get revoked…" was cut.
  - **Seth's absurd diner order from ep 2** is what Garrick piles next to
    Seth's body. "The size of my dick" became "Seth's dick".
  - Theylin's 800-pound roll ("No, but…"): he has enough for 850, per
    Maxwell.
- **Nipples, not titties.** You said out of character that you and Zander
  meant nipples, so Emmett's "she doesn't even have titties" became
  "nipples". Your "Does Sanya have titties? Outlook good" roll is kept, and
  Brody confirmed she always has. Ep 8 then uses this: Seth's disguise has
  nipples, and the real Sanya doesn't.
- **AOOOOGA copypasta:**
  - Emmett's gets ep 6's normalized wording.
  - Seth's and Vargas's repeats were condensed to one-line beats.
  - Charles's pasted Good Morning USA lyrics were cut.
- **Folded:** the liquid-marble roll became "Person who's before you decides!
  Maxwell says no." The "does Vargas see through Seth's disguise?" roll
  became "Michael says no." Michael's "Vargas passes out" was cut, because
  Vargas keeps talking straight after.
- **Cut:**
  - Unicode spam (◘ ° ▒ Æ Çest "Ÿøû`rē Wêłčõmę", B🇷🇷🇷).
  - Zander's bare `t!choose` / `t!help choose`, and Charles's duplicate
    "does the ship head towards Zarazoga-9?" roll.
  - Michael's and Charles's out-of-character lines ("brb", "@Zander",
    "calling one of my online teachers").
  - Your "You got a potential kid." and Preston's "Да".
  - Michael's "yo mamma jeans" roll.
  - The out-of-character nipples clarification (Brody's "(She always has)",
    your "We meant nipples"), and the stray FFBot replies after the session.
- **Reworded:**
  - Zander's opening "Is the ship setting course to Zarazoga-9? Spanish no"
    became "already at", since they are en route.
  - "by that picture" became "by that sight".
- **Density:** 0.65 (237 actions to 365 quotes). Most of the added beats
  are Tier 1: comms and location cues across the five interleaved threads.

### Ep 8: judgment calls for Trey to review

- **It continues ep 7's session a week later.** The cold-open `🐐` carries
  over the state: Seth is still in Sanya's form, the real Sanya is
  unaccounted for, and Emmett is still leashed. Her reappearance is kept
  neutral ("back from wherever she's been").
- **New tag:** `` `Zarazoga Security` ``, for the docking-control voice
  Zander quoted.
- **Seth-as-Sanya is voiced by Brody** (Sean was absent). Those quoted
  lines are tagged `` `Seth` ``, which resolves to Seth Im'Kin'ki.
- **"You decide. You earned it!"** (Brody's "Does Seth flash Sanya?")
  gets a `🐐` outcome. The disguise's one wrong detail is that it has
  nipples, which sets up Zander's "nippled Sanya".
- **Zander narrating Garrick:** "pulls something out of his pockets" and
  "turns into a naked molerat for three seconds" became `🐐` lines. The
  Rubber Chicken's "HONK" is folded into Garrick's action.
- **Garrick's "toes"** are glossed once as the wispy tendrils at the base
  of his body, using your own "wispy base" line.
- **Your answer:** the Chomsky/Mary "brother and sister" exchange was cut
  with the rest of the post-session chatter.
- **Also cut:**
  - "Is Garrick secretly an eldritch god? YAAAAAS", which you retconned.
  - "Is Sanya top tier in Final Fighter?"
  - Cooldude's "SANYA PARENTHESIS S PARENTHESIS", "Trey screams in final
    frontier" and "Sanya's boobies look like this".
  - The "is chomsky black" roll and its pings, and 8poop.
- **Left as typed:** Emmett's "potentially Mary's" pastel clothes, and
  Sanya's "Those are... Iris's." Garrick's small-caps scream is kept, with
  a framing beat.
- **Ending:** it ends on Emmett putting on his trunks, and nothing was
  added (per your choice). There's no Space Rule in the raw.
- **Density:** 0.70 (53 actions to 76 quotes).

## Unrelated but open

The `CLAUDE.md` "Ravens bug" note turned out to be stale and was removed (2026-09-29); see `HANDOFF-ff4-editorial.md`.
