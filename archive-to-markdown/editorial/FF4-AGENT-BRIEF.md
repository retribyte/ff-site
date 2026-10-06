# FF4 agent brief (new-episode edit)

Self-sufficient. Do NOT read HANDOFF-ff4-editorial.md, EDITORIAL-STYLE-GUIDE.md or the whole review queue. Consult the handoff only for a rare edge case, by section name: "FF4 conventions" (recaps, code-block narration, multi-voiced NPCs), "Reordering", "Known limits", "Cast and continuity", "Resume here". Run everything from `archive-to-markdown/`. No commits.

## Token rules
- Read parts only with `python3 editorial/ff4_view.py --short .editorial-analysis/ff4-epN/prep-K.md` (one line per block: `last6ID|Who|time| body`; 8ball/embeds/URLs/replies collapsed). Never Read prep-K/edit-K whole. For a collapsed embed or a full line use `sed -n 'A,Bp'` on a line range.
- Verify with `python3 editorial/ff4_verify.py N --brief`. Filter other output with grep/head.
- Don't re-read files you just wrote or read the raw file. Skim the next part before cutting anything that might matter.

## Format
Header: `**Player** _(dd-Mon-yy hh:mm AM)_ [FullDiscordID]`, then body lines.
- Dialogue `> text`. Action `_text._` on its own line. NPC/alt-form dialogue `` > `Name`: text ``; NPC action `` _`Name`: Name does X._ ``.
- Persona: `` > `Vec as Marv`: text `` (character Vec, persona Marv). Metadata lines `↪ Who: quote`, `⌘ X used /cmd`, `📎 file` are not imported; delete one only with its message.
- Embed: `<embed>` / `<title>..</title>` / `<description>..</description>` / `<footer>..</footer>` / `<color>#hex</color>` / `</embed>`. Recaps and Mission Control transmissions are `<code>ini</code>`-style embeds with `[BRACKETS]` verbatim.
- IDs: a block with an ID holds text derived from that message (keep the ID even if edited, converted or moved). Added text always goes in an ID-less block (`ins`/`insb`) under the right player's header, with the neighbouring timestamp. Never add lines inside an ID'd block.
- Vortox header = the GM bot. GM narration is a Vortox `_action_` (imports as untagged ACTION). Space Rules are plain text under Vortox (`Space Rule #553: ...`), not actions.
- Sticky tags: `md-to-api.py` applies a `` `Name`: `` tag to every later line in the same block. Keep NPC-tagged lines and the PC's own untagged lines in separate blocks (`ins ID Player` makes one). A tagged action under a Vortox header is ignored by the importer: GM beats there stay untagged.
- A lone `` `Name`: `` line above an `<embed>` assigns the embed's speaker.
- Use only tags already in the episode's raw/prep, the canonical short names (`Emmett`, `Seth`, `Chomsky`, `Sanya`, `Zach`, `Dutch`, `Bellow`, `Llafay`, `Llawdon`, `Zion`) or established NPCs. A typo'd tag creates a new DB character.
- One NPC voiced by several players: consecutive lines of that NPC go under one block/player (the voicer, usually the GM); keep message IDs.

## Cast
Zander: Vec (Llafay in eps 1-2, always `Vec as Llafay Terrels`); clone PC `Buzzcut` from ep 12 (never `Bee Emmett`; no persona after ep 12's reveal). Trey: Zion. Maxwell: Edmin. Silas: Dutch. Jonas: Bellow. Michael: Llawdon. Sean: Seth. Brody: Morra (they/them). Hunt520: Zach (Terry in ep 3).
- Vec in a host's body: every Vec line AND action after the takeover is `Vec as <Host>` (`Vec as Marv`, `Vec as Sascha`, `Vec as John Smith IV`), actions included. Narration about the host by Vortox stays untagged Vortox. A new host persona needs a `personas` row (Vec = character 1961) plus a `pid` entry in `ff4_set_personas.py`; tell the caller.
- Timeline personas (Fungus, Fursean, Argonian, Drowned Llamanian) apply by anchor text: never reword "Fungo takes some time to get adjusted", "Fursean scratches his head", "Fursean falls apart", "An Argonian in a parka appears", "fell back, slamming into the side of the sofa".
- Emmett Tawfeek is NOT Vec's father; Emmett Tawfeek and Buzzcut are separate. Buzzcut's untagged third-person actions (Zander block) get `` `Buzzcut`: `` (eps 12-17); Buzzcut as an object ("A box is flipped over Buzzcut") is Vortox.
- GM attribution: untagged Zander lines default to Vec, Trey's to Zion. Untagged GM line narrating one PC's/NPC's own action or outcome: tag it to that character under the typist's header (`` _`Name`: ..._ ``). Vortox only when scope goes beyond one character (hazard, ambient event, scene change, ruling, outcome affecting others). NPC-subject actions get that NPC's tag. List every attribution (ID, whom) in the review notes.
- Morra is they/them: fix he/him/his on Morra in text and 8ball footers; grep near "Morra" after editing.

## Cut vs keep
- Unwrapped player text is OOC (table talk): CUT, with its `↪`/`📎`. In-character speech was wrapped (backticks/quotes -> `>` lines). Exception: bare text that is a GM ruling/clarification the next lines depend on -> convert to a Vortox action (keep ID); unsure -> keep and flag.
- Cut: turn calls, pings, typed name/typo corrections, "(switching from X to Y)", memes, gifs/links, "Changed the channel name", keyboard smash, lol/ok, episode framing, mechanics debate, attachments you can't see (list each: ID, who, filename, time).
- `✂ ` marks are Trey's pre-flagged cuts: cut by default; `keep` one only if later lines depend on it or the fiction reacts to it; list every kept `✂` ID. Verify fails while any `✂` remains.
- GM/player banter and fake flavor cut: gag actions piling on a joke (twerking, mouth-to-mouth, eating things, bodily-function chains, spam, repeated bits) cut even when someone plays along; never convert a gag to Vortox. Keep only if the fiction reacts in character (list those under "Kept gags"). In-character lines that sound meta stay. Trim repetition (spam -> 2-3).
- Crude/absurd content is source material; keep it.
- "Black" is a canon eldritch species (and colour): keep every reference ("a Black", "BLACK IS REAL!", /choose options), never cut/reword it. Bare OOC "BLACK!" typed outside play is still cut as unwrapped.
- Slurs: binger/bing (f-slur), gleemp/glimp (n-word; robo- + n-word = robogleemp), stupidloid (retard noun), stupid (adj). "gay"/"homo" as an insult: leave, list for Trey. Identity uses fine. Keep case/stretching. A better in-voice swap is allowed.
- Anachronisms (Earth brands, Christ/Jesus, Discord, memes, Earth IP): leave as typed; list each with a suggested swap.
- Vortox embeds stay embeds. 8ball `<description>` verbatim (joke answers too: "N Word. (No).", "Yabumba. (Yes)"). `<title>`, `<description>`, `<color>` byte-identical for every Vortox embed; only the footer's quoted question may change; asker = player name (prep does it). /choose footer ("The choices were: ...") stays verbatim. "No, but something that the person before/after you decides upon happens." stays verbatim; the neighbour's following action is the outcome.
- 8ball question: clean per below, third person ("Am I..." -> "Is Kumdome..."), caps, punctuation, typos. May be reworded to match what is played (e.g. subject changed to whoever acts next); list each reworded ID. Cut 8balls with no outcome or only a gag.
- Combat embeds: successful `/dmg` hits/misses and HP lines verbatim (keep green/red `<color>`). Cut failed commands, retries, joke targets, `/info`, `/list`, `/combat`, `/reset` joke uses, "does not exist", "Unable to Roll", wrong-target hits. Plain `/roll` stays only if something follows.

## Style
- Dialogue: no whole-line quotes/backtick fencing; terminal punctuation everywhere (`NO` -> `NO!`); sentence case; proper nouns capital (Zion, Moldarr, Llamanian); fix `Its`/`Thats`/`Im`; typos.
- Ellipses: `...` never `…`; `...and` -> `... And`; `I'm just...a` -> `I'm just... a`.
- Actions in `_..._`, never in a blockquote, never inline in dialogue (split: action line, then `> dialogue`). Parenthetical shorthand -> action.
- Density: add few actions. Tier 1 (required): entrance before first line; unclear addressee (`↪` replies are evidence); delivery/medium (comms, impression); referent recall; outcome beat right after a roll when nothing shows it (ID-less block); bridge when an outcome contradicts what follows; cold-open establishing beats. Tier 2 light: reaction only where a line reads flat. Actions/quote ratio 0.45-0.6 is plausible (sanity check only).
- Continuity: fix dice-vs-outcome by rewording the question; fix wrong actor/location.
- Reorder split thoughts (see Pipeline step 6).

## Pipeline
`EXPORT` = the episode's `../../discord-exports/episodes/*Episode <export#>*.json` (export number differs from FF4 episode N; `ls ../../discord-exports/episodes | grep`). Name = `<N>-<slug>.md` from meta title, apostrophes dropped (`md/ff4/raw/` has it).
```
D=.editorial-analysis/ff4-epN; mkdir -p $D
python3 ff4-to-md.py --prep "$EXPORT" $D/prep.md
python3 editorial/ff4_parts.py split $D/prep.md $D            # prep-1..K.md, ~600 lines
python3 editorial/ff4_view.py --short $D/prep-K.md            # read; write $D/ops-K.txt
python3 editorial/ff4_patch.py $D/prep-K.md $D/ops-K.txt $D/edit-K.md
python3 editorial/ff4_parts.py join md/ff4/N-slug.md $D/edit-{1..K}.md
python3 editorial/ff4_verify.py N --brief
python3 editorial/ff4_punct.py md/ff4/N-slug.md               # fix every line listed
python3 editorial/ff4_merge_candidates.py md/ff4/N-slug.md    # then again with --window 45
python3 editorial/ff4_move_blocks.py md/ff4/N-slug.md MOVEID:AFTERID ...   # FULL 17-20 digit IDs
python3 editorial/ff4_verify.py N --brief                     # re-verify after moves/fixes
python3 md-to-api.py ff4 md/ff4/N-slug.md                     # writes api/ff4/N-<file_name>.json
python3 editorial/ff4_import.py api/ff4/N-<file>.json         # needs ff-server up; check 0 commentaries first
python3 editorial/ff4_set_personas.py N
```
After install, `md/ff4/N-slug.md` is the source of truth: fix it in place (sed/python edits), never re-join over it. Never touch `md/ff4/raw/`.

Reorder (step 6): flagger lists same-author pairs split by other blocks. Default to moving: every `[bot]` hit (move the 8ball//dmg/GM block after the second half); every `[action]` hit where the gap is a reaction/prop/roll outcome/side action (move it after). Leave a hit only when the gap is spoken dialogue answering the first message or a short reply interjection. Answer follows question: 8ball sits after the line that asks/narrates it. Moves carry directly-following ID-less blocks. Log every left hit with a one-line reason. Duplicate block IDs make move_blocks assert: rename one temporarily.

## ff4_patch.py ops file (IDs = last 6+ digits, unique in the part; wrong suffix aborts)
```
cut ID ID ...             remove blocks
keep ID ID ...            drop leading "✂ " in those blocks
sub ID :: old => new      substring replace in one block (must match exactly once)
sub* ID :: old => new     replace all occurrences in the block
set ID                    replace block body with following lines up to a line "."
who ID Name               change header author (e.g. Vortox)
ins ID Name               new ID-less block AFTER block ID; body follows up to "."
insb ID Name              new ID-less block BEFORE block ID
```
Body lines verbatim; blank lines kept. Example:
```
ins 123456 Vortox
_The ship shudders.._
.
```
The new block copies the anchor block's timestamp.

## Verify gates (checklist; all must hold)
- [ ] No `CUT MARKS LEFT`; `unresolved` empty (every ACTION/QUOTE has a character)
- [ ] No `BAD HEADER`, `UNKNOWN ID`, `LINT`
- [ ] `OTHER` empty or each entry a deliberate keep (listed in review notes)
- [ ] `characters` are cast names or intended NPC tags only (no typos); `personas` match raw (plus intended `Vec as <Host>`)
- [ ] No `EMBED CHANGED`, no `COMMAND MARKER`; `EMBED FOOTER` only for combat embeds ("Player (Char) damaged/rolled/missed/wanted a choice") and nothing else
- [ ] Each `CUT EMBED` deliberate (8ball with no outcome, joke, retry); each "moved from" deliberate (GM narration -> Vortox, NPC consolidation, recap -> Vortox)
- [ ] Every `UNMATCHED RAW` is a deliberate cut or rewrite (brief shows 3 examples; run full verify and grep only if the count looks wrong)
- [ ] ff4_punct.py clean; Morra no he/him; no `…`; merge flagger swept at 30s and 45s with moves applied
- [ ] Import prints no UNMATCHED characters

## Review notes (mandatory; append, do not read the files)
1. Append `## Ep N: judgment calls for Trey to review` to HANDOFF-ff4-editorial.md with `cat >> file <<'X'`: export file, message counts, one-sentence summary, then bullets: Buzzcut/Vec-as-host tags (IDs), GM attributions (ID, whom), Vortox beats (IDs), reworded/cut 8balls, fake flavor cut, kept gags, cut attachments, unclear rewrites, new NPC tags, kept `✂` IDs, anachronism/slur flags, merge moves and leftover hits with reasons, Morra scan. Also edit the ep's row in its "Status" table (`sed -i`) and the "Resume here" "Next:" pointer.
2. Append `## Ep N (Title)` to REVIEW-ff4-trey-queue.md with `cat >>`: one `- [ ] ...` line per question for Trey, each ending in a short question ("Right?", "Keep?"), with block IDs (last 6) and quoted text; one item per category above. Rulings already settled above are not questions.
3. Final report to caller: under 150 words (counts, new characters/personas, anything blocking). Nothing committed.
