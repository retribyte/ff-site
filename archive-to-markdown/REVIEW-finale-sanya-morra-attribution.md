# Finale: Brody's Sanya/Dread lines wrongly attributed to Morra — review

**Status: implemented and reseeded.** Groups A–C were approved as proposed;
Group D was resolved by direct confirmation (1242, 1219, 1347, 1401 all
Sanya). See "Resolution" at the bottom for what actually changed. This is a
follow-up to
`REVIEW-character-attribution-cleanup.md` §3, which fixed 7 lines of Sanya's
climax scene. Re-reading all 155 of Brody's Finale messages against the raw
Discord export surfaced a bigger, mechanically-explainable pattern behind it,
plus some lines that need a real judgment call rather than a rule.

Brody plays two characters in the Finale: **Morra** (his FF4 PC) and
**Sanya Dreadflower**, who spends most of the episode undercover, referred to
only as **"Dread"** or the bare initial **"S"** until she formally reveals
herself (raw msg 1171 / converted #1237, `S: `Call me Dreadflower. If you
survive, I'll tell you the rest.``). Every group below traces back to that
undercover convention.

Current tally across Brody's 155 Finale messages:

| Attribution | Count | Status |
|---|---|---|
| Morra (correct) | 85 | no ambiguity — normal Morra dialogue/action throughout the episode |
| Morra (should be Sanya/Dread) | 6 | **Group A** below |
| Morra (should be Sanya/Dread) | 10 | **Group B** below — parser bug |
| `S` (fragmented character, = Sanya) | 20 | **Group C** below — needs alias, not a Morra mistake |
| `null`/OTHER, part of the same parser bug | 10 | **Group B** below |
| `null`/OTHER, genuinely non-dialogue | 11 | correct as-is (`:art:`, `understood!`, `ooo\`, the "Space rule #82419" sign-off, etc.) |
| Sanya Dreadflower (already correct) | 9 | includes the 7 already fixed in the prior pass |
| Morra, genuinely ambiguous | 4 | **Group D** below — needs your call |

---

## Group A — Pre-debut lines, no name marker at all, high confidence Sanya/Dread

These have zero markdown-based signal (no `Name:` prefix at all — same reason
they defaulted to Morra, the author's own PC), but the surrounding scene makes
the real speaker clear.

**1. #649 (raw 636) — ACTION — "A light, distant sense of fear begins to seep into the minds of Zion and Zach..."**
Currently: Morra. Confidence Sanya/Dread: **~75%**.
Twelve raw messages before her formal "First, you may call me Dread"
introduction (raw 648). Thematically it's her signature power — she later
explicitly says "I manifested a deep fear" (raw 1294) and "Wrong, I'm fear"
(raw 1205/converted #1275). No hard confirmation the way items 4–6 have, so
this is the shakiest of the six.
```
625 Hunt520  `"Jack said something about a Chomsky..."`
626 Brody    ~~Sanya: `My balls are rumbling in pain.`~~   [joke, correctly dropped already]
630 Jonas    ~~Chomsky: `My balls...`~~                    [joke, correctly dropped already]
636 Brody    *A light, distant sense of fear begins to seep into the minds of Zion and Zach...*
637 Hunt520  *Zach's phone started ringing, it was Jack!* `"Excuse me..."`
644 Silas    ``What do we do?``
648 Brody    *`First, you may call me Dread. Second, just consider me an onlooker...`*   [already correctly Sanya]
```

**2. #679 (raw 658) — QUOTE — "Im here... to watch that."**
Currently: Morra. Confidence Sanya/Dread: **~90%**.
Sandwiched directly between two other unmarked Brody lines in the same
"onlooker" voice, with no other Brody dialogue between them.
```
648 Brody  *`First, you may call me Dread. Second, just consider me an onlooker...`*   [already Sanya]
653 Zander  Llashii: `"Indeed."`
656 Silas   ``HOLY FUCK LOOK OUTSIDE``
658 Brody   *`Im here... to watch that.`*
659 Trey    *Zion looks up.* `HOLY FLAMES OF ELVEN HELL`
663 Brody   *`Thanks for the front row seat Angel. I hope you enjoy the show...`*
```

**3. #685 (raw 663) — QUOTE — "Thanks for the front row seat Angel. I hope you enjoy the show..."**
Currently: Morra. Confidence Sanya/Dread: **~90%**.
Same block as #2 (see context above). "Angel" is otherwise used only in
confirmed Dread/Sanya lines (raw 1168 `Didn't recognize the voice, Angel?`,
raw 1218 `Very nice, Angel!`) — Morra never uses it.

**4. #750 (raw 721) — QUOTE — "...So, arsonist, what's your plan?"**
Currently: Morra. Confidence Sanya/Dread: **~90%**.
"Arsonist" is Sanya's own nickname for Chomsky elsewhere (raw 943 `Nothing to
worry about it, arsonist...`, raw 1124 `What did you expect, Arsonist?...`).
Morra never uses it.
```
718 Zander  *It's likely that Chomsky contacted Seth, Emmett, and Garrick for the tattoos. Sanya likely noticed on her own accord...*
719 Jonas   *Bellow prepares his guns for now, ready with his sword if close combat is required.*
721 Brody   *`...So, arsonist, what's your plan?`*
726 Brody   *Morra steels themself, readying for battle*   [this one IS Morra — different scene beat]
```

**5–6. #770–771 (raw 742, one multi-line raw message) — ACTION + QUOTE — "A voice comes from his ear, not his mind" / "Who said I wasn't helping?"**
Currently: Morra (both lines). Confidence Sanya/Dread: **~95%**, the
strongest evidence in the set.
```
739 Zander  60% of them, over the course of the battle.
742 Brody   *A voice comes from his ear, not his mind*
            `Who said I wasn't helping?`
744 Jonas   Chomsky: `Ah. Sanya, you've arrived. You're much less insufferable than that forsaken flower on your head...`
```
Jonas's Chomsky answers the "voice" two lines later by naming Sanya directly
as having just arrived — about as close to confirmation as raw text gets.
Note both lines come from **one raw Discord message** (an action + quote on
two lines) — whichever way this is resolved, both lines need to move
together or they'll split again the way #17 below already did.

---

## Group B — Parser bug: `S:` with no space after the colon

Root cause found in `discord-json-to-api.py`: `SPEAKER_PREFIX` requires a
literal space after the colon (`": "`) to recognize a `Name:` override. Every
time Brody typed `S:` with **no space** before a backtick/asterisk, the
override silently fails to fire — the line splits into an orphan `OTHER`
fragment (just the text `"S:"`) plus a separate `QUOTE` that inherits
whatever the ambient default character is (Morra, since Brody's own PC).
When he typed `S: ` **with a space**, it works correctly (→ Group C).

All 10 instances, in order — `(orphan fragment #, quote #)` → text:

| # | Converted # | Text | Currently |
|---|---|---|---|
| 7 | 985 / 986 | "I'll also Try not to be hurt by that remark." | `S:` / Morra |
| 8 | 989 / 990 | "Nothing to worry about it, arsonist. You're crew will be here." | `S:` / Morra |
| 9 | 992 / 993 | "Mostly." | `S:` / Morra |
| 10 | 995 / 996 | "Speaking of which..." | `S:` / Morra |
| 11 | 999 / 1000 | "Even the strongest beasts fall to those who tirelessly hunt. Strike true, hunter of ravens." | `S:` / Morra |
| 12 | 1044 / 1045 | "Dumbass." | `S:` / Morra |
| 13 | 1062 / 1063 | "Howdy, Emmett. Figured I'd pop in and check on you." | `S:` / Morra |
| 14 | 1169 / 1170 | "He's not the only one." | `S:` / Morra |
| 15 | 1189 / 1190 | "What did you expect, Arsonist? I had a god strapped to my soul for the better part of our time as crewmates." | `S:` / Morra |
| 16 | 1200 / 1201 | "Oh shit." | `S:` / Morra |

Confidence these are all Sanya/Dread: **~99%** — mechanical, not textual
judgment. Each one sits in the middle of an unbroken run of correctly-parsed
`S: ` lines (Group C) with no other Brody dialogue in between, using the
same "arsonist" nickname and the same voice.

**Proposed fix (not applied):** relax `SPEAKER_PREFIX` to make the space
after the colon optional (`":\s?"` instead of `": "`). This is a **corpus-wide
regex change**, not scoped to the Finale — flagging that explicitly since
it's your call, not mine. It should be low-risk: the override only actually
*fires* when the name is a known cast member or the remainder is fully
markdown-wrapped (see `classify_line`'s `all_wrapped`/`unclosed_quote` guard),
so a stray colon elsewhere in the corpus (times, ratios, etc.) won't
suddenly start reattributing lines — but the right verification step is a
full-corpus dry-run diff before it's called done, same as every other fix
this session.

---

## Group C — Character "S" is a fragmented duplicate of Sanya Dreadflower

The 20 lines where `S: ` (with the space) parsed correctly are landing on a
**separate, disconnected `Character` row literally named "S"** — the same
identity-fragmentation bug from the original review (§2), just not caught
because a single letter didn't look like a name variant at a glance.
Confirmed safe to merge:
- `S` appears **only** in this one episode's data (`api/ff4/23_finale.json`)
  — no cross-episode collision risk.
- Checked the full FF4 raw export corpus for any other player ever starting
  a line with `S:` — **zero matches**, so this isn't colliding with anyone
  else's dialogue convention.
- The one other real occurrence of `S:` from Brody anywhere in FF4 (Episode
  17, raw: `S: Ow my dreadballs`) is a bare-text throwaway joke with no
  markdown at all — it already correctly resolves to `OTHER`/`null`, so
  aliasing "S" won't touch it.
- One of the 20 lines is the formal reveal itself (`Call me Dreadflower...`,
  converted #1237) — already correctly resolved to Sanya Dreadflower via the
  existing `FORCE_CHARACTER_CONTAINING` entry, confirming the identity.

Confidence: **~99%**. **Proposed fix (not applied):** add `"S": "Sanya
Dreadflower"` to `NAME_ALIASES` in `discord-json-to-api.py`, same mechanism
already used for Emmett/Seth/Chomsky/etc.

---

## Group D — Genuinely ambiguous, needs your call

These are narration lines inside Sanya's confirmed scene where either
character is plausible — action description *of* Sanya, written by Morra's
player, could belong to either the "narrator" voice (Sanya/Dread, who's
clearly narrating some of her own entrances/exits elsewhere) or to Morra
reacting/observing. Unlike Groups A–C, I don't think text alone settles
these.

**17. #1242 (raw 1175, second line of a two-line raw message) — ACTION — "SANYA JOINS THE BATTLE!"**
Currently: Morra. The **first line of this same raw message** (`She takes
her spear, and readies herself!`) is already correctly Sanya via the
existing hardcoded rule — so this is the same "multi-line raw message splits
attribution" bug as Group A #5–6, just for an already-half-fixed line. A
dramatic all-caps banner like this reads more like a narrator's title card
than either character's own voice, but if it stays tied to character
attribution at all, it should probably follow line 1 rather than default to
Morra.
```
1166 Brody  *and with two quick pierces, a spear finds it's way into the raven Leader's back!*   [already Sanya]
1167 Trey   `Who is THAT?`
1171 Brody  S: `Call me Dreadflower. If you survive, I'll tell you the rest.`   [already Sanya, via S]
1175 Brody  *She takes her spear, and readies herself!*                        [already Sanya]
            ***SANYA JOINS THE BATTLE!***                                     [currently Morra]
1177 Trey   *The Ravens leader takes a swing at Sanya, and she dodges!*
```

**18. #1219 (raw 1151) — ACTION — "Zach sees a squatting figure in his blurring vision..."**
Currently: Morra. This is the line immediately before Sanya's disguised
rescue of Zach begins (`S: `Please, you're fine.`` follows one message
later). Could be Morra narrating what Zach perceives, or could be Sanya's
own entrance narration (per the pattern in #17).
```
1145 Hunt520  *Zach doesn't feel anything... he's still in shock... he just falls over...*
1146 Brody    `ZACH!`                                              [Morra — confirmed correct, her crewmate just lost an arm]
1151 Brody    *Zach sees a squatting figure in his blurring vision...*
1152 Brody    S: `Please, you're fine.`                             [already Sanya, via S]
```

**19. #1347 (raw 1278) — ACTION — "The new wound holds not blood, or any signs of flesh. Just... clean. unnatural."**
Currently: Morra. Sits between Sanya's cauterizing cut (already Sanya) and
Morra's reaction to it (#1356, `Morra is staring DIRECTLY at the new wound`
— unambiguously Morra, contrast case). Could be the tail of Sanya's action
or the start of Morra's observation.
```
1273 Brody  *Sanya places her spear at the middle of his upper arm... And cuts, cleanly.*   [already Sanya]
1278 Brody  *The new wound holds not blood, or any signs of flesh. Just... clean. unnatural.*
1287 Brody  *Morra is staring DIRECTLY at the new wound.*          [Morra — confirmed correct]
```

**20. #1401 (raw 1329) — ACTION — "A silversteel sword, sits where she stood."**
Currently: Morra. Immediately follows Sanya's exit (already Sanya:
`and with that, Sanya disappears, but not before leaving a gift...`) as a
separate raw message — could be her narration finishing the exit, or
neutral DM-style scene description of what's left behind (arguably nobody's
"line" at all, similar to how the "S" banner in #17 sits oddly under any
single speaker).
```
1326 Brody  *and with that, Sanya disappears, but not before leaving a gift...*   [already Sanya]
1329 Brody  *A silversteel sword, sits where she stood.*
1330 Jonas  `Oh thank Dread and God and Death and whoever else! You're alive!`
```

---

## Resolution

All four groups implemented in `discord-json-to-api.py`:

- **Group A** (6 lines) + **Group D** (4 lines, all confirmed Sanya) added
  to `FORCE_CHARACTER_CONTAINING` by exact content match.
- **Group B**: `SPEAKER_PREFIX` changed from `": "` to `":\s?"` (space
  optional). Corpus-wide change, as flagged — full-corpus content-aware
  diff before reseeding showed it also fixed 5 previously-misattributed NPC
  voice-overs elsewhere (Mother/Angela/Chilzor/Dwarf/Miny Seth, in `Pilot`,
  `Sir, This Is A Chilzor's`, `Rumble Baby`, `Don't Be A Shitty Dad` —
  same bug class, all merged into pre-existing NPC characters, no new junk
  rows created). No other unintended changes anywhere in the 24-episode FF4
  corpus.
- **Group C**: `"S": "Sanya Dreadflower"` added to `NAME_ALIASES`.

Reseeded (`npm run seed`). Live-verified via the API: Brody's Finale
messages now split 85 Morra / 49 Sanya Dreadflower / 11 correctly-null
OTHER (previously 105 Morra / 20 fragmented-`S` / 21 null / 9 Sanya).
Character count 293 → 292 (the fragmented `S` row is gone). Spot-checked
`SANYA JOINS THE BATTLE!`, `A silversteel sword, sits where she stood.`,
and the `arsonist` line directly against the live API — all correctly
Sanya Dreadflower.

`REVIEW-character-attribution-cleanup.md` §3 and its "Still open" section
updated to reflect this and correct the old "`S` is junk" note.
