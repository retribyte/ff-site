# Drive stories import — attribution review

Status: **imported to the dev DB (2026-10-02), uncommitted.**

- **Sources:** the FF shared Google Drive export (`drive-download-20261002T203458Z-1-001.zip`) and `wiki/sources/stories/Nehe's Origin.md`.
- **Output:** 29 manuscripts in `md/stories/`, all prose format, author Archivist.
- **Dialogue:** every quote is attributed. Quotes left unattributed on purpose are labels, scare quotes, sound effects and crowd chants (listed below).
- **Not done yet:** a copyedit pass of the kind done for FF2 (`REVIEW-ff2-stories-copyedit.md`).

## Skipped (not stories)

- **Lore / reference:** A Brief History of Moonshine Forest, Hexgots, Novakids, FF Ideas, The End (outline), Every Single Vortox Pummeler.
- **Data:** 8ball Responses, Color Codes, the spreadsheets.
- **Other:** CYOA (needs its own pass), Sean's screenplay PDF, Final Slurtier, the Stasis fragment, Trouble with Florans (Wish Hunt).

## Color keys

The FF3 **Color Codes** doc gives most colors for FF3 and FF4. Gray (`#666666`) means "NPC", and those lines were read and attributed one by one.

Where a story uses a color for someone other than its usual owner, the story wins:

| Story | Color → speaker |
|---|---|
| A Fateful Date | Burgundy italics → **Dread** (the flower). Red → **Sanya**, both aloud and as her conscience. Blue `4a86e8` → **Mary** |
| A Quick Break | Iris's blue → **Mary**, who is in the temple. Sanya italics after her flower opens → **Dread** |
| One Whole Week | `cf0000` early → **Dread**, then **Sanya**. Burgundy while possessed ("*our* fear gas") → **Dread**. Blue → **Mary** |
| Knocked and Rocked Asleep | Burgundy → **Dread** (the God of Dread). Navy `073763` → **Zach** |
| Deafening Silence | White was the whole text and was dropped. Red Part 3 is Zion's monologue → **Zion**, not Seth |
| Everything Was Okay | Emmett's green → **Wade** (factory worker) in the opening, **Marv** among the Ravens |
| Any Means Necessary / Give No Quarter / Everything Was Okay | Blue → **Sascha**, red → **Odran**, uncolored bold → **Ravens Leader** |
| Obama Story | Red "sus"/"suspicious" is an Among Us joke → unspanned |
| Ballistic Bonanza / Hesitation | Green/red/cyan `[PLAYBACK]` system lines → unspanned UI text |

## Identity calls

- **Valentina / Volentina** is one bear. She links to **Volentina Constantini**, and the empty `Valentina` row was deleted.
- **FF3's Jess** is the Ottori **Jessica** (FF2/FF3 row). The separate `Jess` row belongs to Vortox Machina and stays.
- **Squosafina / "Squem's" bride** in Do Emmetts Dream → **Josephine**.
- **The talking bud** ("I'm you, Emmett") → display name **Emmett's Bud**. The flirting bee → **Garrick**.
- **Fungus/Fungo → Vec.** Story lines can't carry personas yet.
- **Zach's father** → **John** (the FF4 row by Hunt520). The Elf who trained Zach → **Pirate Captain**.
- **Bellow's shopkeeper "Terry Keep"** → FF4 **Terry** row (the "Ambush" shopkeeper).
- **Bloopers narrator** ("Me, Emmett Flower, the narrator") → **Emmett Flower**, including the two orphan lines. Zander's cameo → **Zander**.
- **Wes Romaw's sniper narrator:** left unattributed, per Trey.

## Text fixes made while attributing

- **Final Pummel:** prologue → `Chapter 0: Preface`. The dead "bloopers" link line → "collected in Obama Story". A lone colored period was unspanned.
- **Cultural Spotlight:** `''` used as closing quotes → `”` (2×). A quote split by a line break was rejoined ("Domoleáin, in the binary…").
- **Deafening Silence:** `—”people”—` → `—‘people’—`.
- **Omg Zach's Gay, Shocker:** `Mr. “You are so mysterious.”` → `Mr. ‘You are so mysterious.’`. One misplaced italic marker.
- **Zach's Journey:** two misplaced italic markers. Added the missing `”` after the Captain's "*understand*?". The italic aside paragraph lost its outer italics so the spans inside it render.
- **Bellow and Zach Train:** one misplaced italic marker.
- **Everything Was Okay:** "he pleaded" moved out of Vince's span.
- **Obama Story:** the "Obama Story / Final Pummel Bloopers" heading was dropped. The credit line was set in italics.
- **Bellow's Journal:** each "(After Episode N)" became a chapter. The episode-14 audio log is colored as Bellow speaking.
- **Everywhere:** bold/italic markers wrapped around a quote were moved inside the span (91×), otherwise they render as literal asterisks.

## Deliberately unattributed quotes

- **Labels:** "AUTO PILOT", "Call Me", "Vioxx's Truth", "CPTN of the INTERSTELLAR DREAM", "IT'S ALIVE".
- **Sound:** "BLAM" ×5, "chunk".
- **Crowd / crew:** "PELO!" ×4, "For the VP!", "For Emmett!".
- **Scare quotes:** e.g. "pocket dimension", "married", "base", "growing pains", "practice".
- **Other:** Wes's two thoughts; Deafening Silence's "…" silences; the Hesitation robot's "instincts say 'fire'".
