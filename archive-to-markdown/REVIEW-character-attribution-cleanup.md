# FF2/FF4 character attribution cleanup — 2026-08-12

## Why this happened

FF4 was imported straight from the Discord export JSON via `discord-json-to-api.py`,
which does best-effort classification (no hand-edited markdown pass, unlike
FF2/FF3). The task started as "find evidence that FF4's transcripts are
incoherent" and escalated once the patterns turned out to be real, common,
and fixable at the pipeline level rather than one-off typos. This file is
the record of what changed, why, and what's still open.

**Everything below is a pipeline/data fix, not a one-time patch.** The
canonical sources stay: FF2/FF3 markdown (`md/ff2/`, `md/ff3/`, untouched),
the raw Discord export JSON for FF4 (`../discord-exports/episodes/`,
untouched), and their `meta/<season>.json` configs. Re-running the
converters against those sources reproduces everything here. The DB is
disposable and gets there via `npm run seed` (FF2/FF4; FF3 still blocked,
see below).

## What was broken

1. **Parser edge cases** in `discord-json-to-api.py`:
   - A straight `"` sitting outside backticks (`Name: "` `` `quote` `` `"`)
     defeated the "is this fully wrapped" check that lets a `Name:` override
     fire, so the line silently inherited the author's own PC. Fixed with
     `strip_adjacent_quote()`.
   - `OTHER`/`COMMAND` messages (table talk, OOC asides, links — no markdown
     at all) were still tagging the ambient default character even though
     nothing marked them as that character's speech. Now forced to
     `character: null`.
   - `~~strikethrough~~` used to strip the markers but keep the struck text,
     producing garbled merged lines ("penetrate Dutch's **ass** spacesuit").
     Now the struck content is dropped entirely — a whole-line strike
     collapses to nothing (existing empty-line handling drops it), a partial
     strike removes just the struck span. One line is deliberately exempted
     (`DIEGETIC_STRIKE_EXEMPT`) — a scratched-out word that's part of the
     in-fiction text itself, not a Discord edit.
   - A handful of lines were *entirely* struck through except for a bare
     `Name:` label left over (e.g. `John Smith: ~~`"..."`~~`) — hardcoded
     drops (`DROP_LINES_CONTAINING`) rather than a general "bare label"
     heuristic that would also catch legitimate short lines like `kills:`.

2. **Character identity fragmentation.** A `` `Name`: `` override is always
   trusted literally, so any shorthand a player used for their own PC (or an
   old pre-FF4 name for a returning character) created a second, disconnected
   `Character` row instead of matching the real one — invisible until you
   look at a character's total line count and notice it's split across two
   pages. Confirmed and fixed via a `NAME_ALIASES` table (in both
   `discord-json-to-api.py` and `md-to-api.py`), plus `meta/ff2.json` /
   `meta/ff3.json` cast-dict edits to use full names going forward:

   | Fragment | Canonical | Scope |
   |---|---|---|
   | Emmett | Emmett Tawfeek | FF2 + FF4 (same character, pre-existing FF2 avatar/color) |
   | Seth | Seth Im'Kin'ki | FF2 + FF4 |
   | Chomsky | Victor Chomsky | FF2 + FF4 |
   | Sanya | Sanya Dreadflower | FF2 + FF4 (**not** Morra — confirmed unrelated, see below) |
   | Fungus | Vec | FF4 only — same parasite, same player, pre/post self-naming, not a separate being |
   | Dutch, Dutchina | Dutch Elkins | FF4 only |
   | Bellow | Bellow Brightlight | FF4 only |
   | Llafay | Llafay Terrels | FF4 only |
   | Llawdon | Llawdon Brandanowitz | FF4 only |
   | Zion | Zion Daybreaker | FF4 only |

   **Dread is the one exception that does NOT get flattened.** Dread and
   Sanya were confirmed *separate* characters through FF2/FF3 (Dread has 73
   FF2 messages, an independent antagonist arc, no relation to Brody's PC
   lineage) that narratively merge into one being partway into FF4. The
   alias is episode-gated (`DREAD_MERGE_EPISODE = 1`) so FF4 episode 0 (the
   "Test One-shot," chronologically FF3-era) keeps them separate; everywhere
   else in FF4, `Dread` folds into `Sanya Dreadflower`.

3. **A DM-narrated climax scene reading as the wrong PC.** Six lines in the
   Finale narrate Sanya Dreadflower's rescue sequence in third person with no
   `Name:` marker, so they defaulted to Brody's actual FF4 PC, Morra — a
   different character. No text pattern distinguishes these; matched by
   known content (`FORCE_CHARACTER_CONTAINING`). Also fixed: two
   non-canonical joke lines ("Sanya: `Emmett, what is that.`" / "Morra in
   FF2: `Help`") that were riffing on FF2 continuity as a bit, not real
   dialogue — excluded from attribution rather than credited to anyone.

   **A follow-up pass found the same scene had three more layers of the
   same bug**, all detailed in
   `REVIEW-finale-sanya-morra-attribution.md`:
   - **6 more pre-debut lines** (Sanya/Dread present and narrating well
     before her formal introduction, still no `Name:` marker) — same
     `FORCE_CHARACTER_CONTAINING` mechanism. Strongest evidence: Brody
     writes `A voice comes from his ear, not his mind` / `Who said I wasn't
     helping?` with no marker at all, and two lines later Jonas's Chomsky
     answers "Ah, Sanya, you've arrived" — a near-confirmation.
   - **A real parser bug**, not a one-off: `SPEAKER_PREFIX` required a
     literal space after the colon (`"Name: "`) to recognize an override.
     Brody consistently wrote Sanya's pre-reveal codename as `S:` with no
     space, which silently failed the match and split each line into an
     orphan `S:` fragment plus a separate quote defaulting to Morra — 10
     instances. Fixed by making the space optional (`":\s?"`). This is a
     **corpus-wide regex change**, not scoped to the Finale — verified via
     full-corpus diff before reseeding; it turned out to also fix 5 more
     misattributions elsewhere (Mother/Angela/Chilzor/Dwarf/Miny Seth NPC
     voice-overs in `Pilot`, `Sir, This Is A Chilzor's`, `Rumble Baby`, and
     `Don't Be A Shitty Dad` previously defaulting to the voicing player's
     own PC — same bug class, same fix).
   - **Character fragmentation**: the correctly-parsed `S: ` (with space)
     lines — 20 of them — were landing on a disconnected `Character` row
     literally named "S" rather than Sanya Dreadflower, same identity-split
     bug as the table above, just a single letter instead of a short name.
     Fixed via `NAME_ALIASES`. Confirmed safe: "S" appears nowhere else in
     the FF4 corpus as any other player's speaker prefix.
   - **4 genuinely ambiguous narration lines** inside the same scene (e.g.
     `SANYA JOINS THE BATTLE!`, `The new wound holds not blood...`) with no
     textual signal either way — rendered with surrounding context for
     direct confirmation rather than guessed; all four came back Sanya
     Dreadflower.

   Net effect on Brody's 155 Finale messages: 85 Morra lines were already
   correct and untouched; 40 moved from Morra/fragmented-`S`/orphan to
   Sanya Dreadflower.

   **Same pattern found a second time, same episode:** Jonas plays both
   Bellow Brightlight (his FF4 PC) and Victor Chomsky (his own FF2-cameo
   return, same shape as Brody/Sanya) through most of the Finale. He tags
   some Chomsky lines explicitly (already correct via `NAME_ALIASES`) but
   narrates others in third person with no marker — `*Chomsky strides into
   the room...*` — which silently defaulted to Bellow. Fixed 18 lines where
   "Chomsky" is unambiguously the line's own grammatical subject (`Chomsky
   leans into his comms...`, `Chomsky stumbles...`, `Chomsky lets out a last
   chuckle, and falls over...`, etc.), same `FORCE_CHARACTER_CONTAINING`
   mechanism.

   The remaining ~40 lines of back-and-forth banter between Bellow and
   Chomsky once they're fighting side by side (`Finale` raw indices
   976–1208) had no mechanical signal at all — rendered in chat, numbered,
   for direct confirmation rather than guessed. 30 came back Chomsky, 12
   Bellow (already the correct default, no change needed). Resolved via a
   new scoped table, `FINALE_BANTER_CHOMSKY_LINES` — checked only for
   Jonas + the Finale, since several of the confirmed lines ("Oh.", "Yes!",
   "Try it.") are too short/generic to safely match as a global substring
   the way `FORCE_CHARACTER_CONTAINING` does elsewhere.

4. **The Ravens faction was never recognized as dialogue at all.** Trey and
   Zander voice Marv, Sascha, Odran, and the Ravens Leader exclusively
   through colored Discord code fences (`` ```diff ``` ``/`` ```ini``` ``/`` ```md``` ``)
   — never `` `text` `` or `Name: `"text"`` — because that's the only way to
   get color into a Discord message. The converter treated *any* fenced
   block as generic non-dialogue text, so ~250 blocks of major antagonist
   dialogue (and Vec's own interiority, voiced through two of that faction's
   members) were silently unattributed.

   The fix turned out to be fully mechanical once the convention was known:
   the fence's leading character identifies the speaker consistently for the
   whole block (verified: zero blocks mix prefixes), and author decides real
   vs. Vec-possessed:

   | Prefix | Member | Trey (author) | Zander (author) |
   |---|---|---|---|
   | `+` | Marv | real Marv | Vec (hosting Marv) |
   | `[` | Sascha | real Sascha | Vec (hosting Sascha) |
   | `-` | Odran | real Odran | never — not a Vec host |
   | `>` (`md` fences only) | Ravens Leader | real Ravens Leader | never — not a Vec host |

   `is_recap_fence()` excludes the "Last episode..." / "In the ending of the
   last story..." narration blocks, which reuse the same fence styling for a
   different purpose. `npc-fenced-dialogue-review.md` is the manual-review
   inventory built *before* this rule was found — now superseded/historical,
   kept for reference. One anomaly deliberately left unattributed: a single
   `md`/`>` block from Zander ("Get wrecked, kid.") that formatting-wise
   matches the Ravens Leader convention but can't be, per the host rule above
   — flagged rather than guessed.

   New `Character` rows: Marv, Sascha, Odran, Ravens Leader (all real,
   Trey-voiced). Two new `Persona` rows under Vec ("Marv," "Sascha"),
   bulk-applied per episode where Vec is confirmed hosting that member
   (Marv Attacks!/Don't Be A Shitty Dad/Are You Not Entertained?! for Marv;
   High Roll On D100/Wrong Answer for Sascha). Note: Sascha's persona was
   *not* applied to Goblinators even though the wiki's host table's episode
   range includes it — there's no actual Vec-voiced Sascha dialogue there
   (the fenced lines stop after Wrong Answer, and Goblinators is also where
   she fights off Vec's control), so applying it would have mislabeled her
   own dialogue as Vec's. Caught and corrected before this was reported done.

5. **Hunt520's entire cast list was silently inert.** `meta/ff4.json`'s
   `cast` dict was keyed `"Hunt"`, but the player name his messages actually
   resolve to is `"Hunt520"` — so `cast_character()` looked up a key that
   never existed and returned `None` for all 972 of his messages, always.
   Every unmarked line — which for a player's own PC is virtually all of
   them, per the pattern above — had no character at all instead of
   defaulting to his PC. Fixed by renaming the key; full-corpus diff before
   reseeding confirmed exactly 1003 changed lines, all Hunt520's, nothing on
   any other player. ~1200 lines moved from `null` to his real PC,
   Zacharias Smith.

   Hunt520 turned out to have three characters, not one — same
   secondary-PC pattern as Sanya/Chomsky and Bellow/Chomsky above. Full
   detail, including the numbered confirmation for the last few ambiguous
   lines, in `REVIEW-hunt520-terry-zach-jack.md`:
   - **Terry**, a recurring minor NPC across three scenes (her debut in
     "Ambush" giving Bellow his number, a brief explicitly-tagged
     appearance in "Obligatory Shopping Episode," and a full scene in "Sir,
     This Is A Chilzor's" where Zach explicitly leaves and she sits down
     with Bellow in his place) — 36 lines total, added to the cast dict and
     `FORCE_CHARACTER_CONTAINING`-style scoped matching for the untagged
     lines.
   - **Jack Madison**, Zach's fiance — introduced texting-only, later
     appearing in person. Resolved via "Text (Message) from Jack" narration
     headers (the words that follow are his) and the same
     "grammatical-subject" rule already proven on Chomsky (`Jack chuckles`,
     `Jack rushes in`, etc.) — 37 lines across 5 episodes. Three
     "Message from Jack"-headed texts turned out to actually be **Zach's**
     own words, relayed via Jack's phone while separated from the party and
     his own phone is in Bellow's possession — confirmed and left on Zach
     rather than matched to Jack.
   - A second, unrelated **parser bug** surfaced while resolving the last
     few Jack lines: two adjacent single-line backtick quotes split across
     a raw Discord newline (`` `a`\n`b` ``) were misread by
     `split_multiline_spans()` as one deliberate multi-line span whose
     "content" was just the newline itself, consuming both real
     closing/opening backticks and silently downgrading both lines to
     unattributed. Fixed by leaving a match untouched when its captured
     content is empty — full-corpus diff found 35 more lines it fixed for
     *other* players (Trey/Dr. Jorpa, Jonas/Bellow Brightlight, Brody/Morra),
     every one the same `OTHER`/no-character → `QUOTE`/correct-character
     pattern, no regressions.

6. **`seed-legacy.ts` regression, found via the reseed itself.** It resolves
   character colors/avatars by looking up the literal name in
   `ff-site-old`'s `characterColors.json` / avatar files — so renaming
   Emmett → Emmett Tawfeek (etc.) silently dropped their color and avatar,
   *and* recreated the old short name as an empty zero-message orphan
   character (color-table keys feed the character-name set regardless of
   whether any message uses them). Same problem independently in the CYOA
   (Vortox Machina) speaker resolution. Fixed with a small alias table
   (`LEGACY_NAME_ALIASES`) inside `seed-legacy.ts` itself — `ff-site-old` is
   read-only reference and was not touched.

## Verification

- Every fix was diffed against the full FF4 season (24 episodes) with
  content-aware alignment (not just counts) before being called done.
- FF2's live DB data was confirmed to genuinely trace back to this pipeline
  (`seed-legacy.ts` reads `archive-to-markdown/api/<season>/*.json` directly)
  — no divergent source, so meta-file fixes are the correct and complete fix
  path for FF2 too.
- Ran `npm run seed` (full wipe + reseed) several times across the whole
  effort — once surfaced the color/avatar regression above, the rest clean.
  Confirmed live via the API: correct character colors/avatars, zero orphan
  short-name stubs, correct Persona stamps, correct slugs (e.g. `Jack
  Madison` → `jack_madison`, auto-derived, no manual fix needed),
  spot-checked several of the specific fixed lines end to end.

## Still open / explicitly deferred

- **Ventriloquism / throwaway character voicing** ("Category C" from the
  first pass): any player can put words in another PC's mouth via a trusted
  `Name:` override, and some of that is legitimate stand-in play (a player
  covering an absent friend's character) while some is a joke that
  shouldn't read as canon. Confirmed real (Morra voiced by non-Brody players
  5+ times, including an 8-character joke chain in Blackjack). Needs a
  policy discussion before any fix — explicitly not touched this session.
- **FF3 import is blocked**, unrelated to any of the above:
  `meta/ff3.json`'s episode titles are all empty, meaning FF3 was never
  actually converted from markdown. `meta/ff3.json`'s cast dict *is* already
  updated to full names (ready for whenever titles get filled in), but
  there's nothing to seed yet.
- **~100+ one-off "junk" characters** from single-letter/garbage
  `SPEAKER_PREFIX` matches (`D`, `X`, `B`, `C`, `A`, etc.) — noted as a
  side effect of the same trusted-override mechanism, not cleaned up.
  (`S` was in this list originally but turned out not to be junk — it was
  Sanya Dreadflower's deliberate pre-reveal codename in the Finale, used
  ~30 times; see §3.)
- **Zennigan Smith / Ziga** — one NPC (a blacksmith in "Obligatory Shopping
  Episode") voiced under two different names in the same scene, neither
  matched to a Character. Low volume, not addressed.
- The single Zander "Get wrecked, kid." anomaly (see §4) is left
  unattributed by design, not by omission.

## Files touched

- `ff-site/archive-to-markdown/discord-json-to-api.py` — parser fixes, name
  aliases, Ravens-fence classification, Hunt520's secondary characters.
- `ff-site/archive-to-markdown/md-to-api.py` — name aliases (FF2/FF3).
- `ff-site/archive-to-markdown/meta/ff2.json`, `meta/ff3.json`,
  `meta/ff4.json` — cast dicts updated to full names / fixed keys.
- `ff-server/prisma/seed-legacy.ts` — legacy color/avatar/CYOA alias
  fallback.
- `ff-site/archive-to-markdown/npc-fenced-dialogue-review.md` — historical;
  the manual inventory that led to discovering the mechanical Ravens rule.
- `ff-site/archive-to-markdown/REVIEW-finale-sanya-morra-attribution.md` —
  the follow-up pass on Sanya/Dread's Finale scene (§3 above); full
  per-line evidence and confidence ratings.
- `ff-site/archive-to-markdown/REVIEW-hunt520-terry-zach-jack.md` — the
  Hunt520/Terry/Zacharias Smith/Jack Madison pass (§5 above); full per-line
  evidence and confidence ratings.
- No changes to `discord-exports/episodes/` (raw FF4 source), `md/ff2/`,
  `md/ff3/` (raw FF2/FF3 source), or anything under `ff-site-old/`.
