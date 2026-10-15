# FF4 eps 20-23: read-through and reorder candidates

Source: `md/ff4/20..23-*.md` as of commit 5b20718, read via `ff4_view.py --short`, plus `ff4_merge_candidates.py --window 45`. Nothing was edited. IDs are the last 6 digits (the move script needs full IDs; look them up first, and note that some suffixes repeat within an episode). "X > after Y" means move X directly after Y.

**Overall:** the four episodes read like a real-time chat. The recurring problem is that `↪` replies aren't imported, so a reply that lands several blocks after its question loses its antecedent. Bot blocks (8ball, `/dmg`, GM outcomes) also tend to land after the reaction they caused. The flagger (30s/45s) caught only ~25% of these; the rest are reply/outcome pairs that sit outside its window. Ep 23 needs the most work.

Do not move: ep 21 `890906` (Seth's "chin has become more gigachad", the Sethkinki persona anchor). In ep 20, `469726` / `418270` (Vec leaving the body) are persona-anchor lines.

## Ep 20 Event Horizon (verdict: good, ~16 moves)
Outcome or reply placed after the reaction:
- 717882 (Zach's phone vibrates) > after 040473, so it precedes Dutch's "photo pop up" 311711
- 234631 (Zach flips him off) > after 970099
- 982610 (Zion "if you're sure you wanna do that") > after 821810 (Seth grabs the snotball)
- 393152 (Bellow "Yes, I said that a while ago") > after 125193
- 649375 (Bellow "Yes, Captain...") > after 088321 (Zion assigns the tractor beam)
- 682447 (mercenary falls back, Pauline outcome) > after 674129 (8ball)
- 772244 (Bellow's determination outcome) > after 946186 (8ball)
- 034438 (Vortox note on the bottle) + 872808 ("Sorry! -Seth.") > after 779274 (Dutch "Is there a note?")
- 924393 (8ball roll/yaw/pitch) > after 563004
- 679168 (Seth hangs up) > after 887563
- 388073 (Vortox "duo might start seeing things") > after 752296
- 000170 (Morra "appreciated your prayer") > after 914271
- 312828 ("Passing by Zion") > after 887740 (Bellow in the common room)
- Emmett call: 797254 (`Emmett`: Yeah...) > after 652102; 493979 (Bellow and Zach go to another room) > after 023846; then Morra's "Pardon?"/"What was that voice?" (813184, 283487) > after 797254
- Optional: 256667 (8ball pod lands) > after 834552; 880414 (another mercenary enters) > after 784858 (8ball)

Scene interleaving (not fixed): 372-575 weaves the Emmett/Seth call with the Morra/Zion/Zach goodbyes. It is readable but dense; a regroup would help if you want one.

Flags: 077383 (Morra "I'll try to hide my wounds, Captain." is an orphan), 751552 (typo "calculations,."), 047741 ("USB slot", anachronism).

## Ep 21 Welcome to Elf Heaven (verdict: good, ~9 moves)
- 600100 (Seth "That's her...") > after 509030 (Morra asks if it's the Deity of the Dead)
- Wormhole beat: 201701 (retrieval succeeds) + 891520 (Ow.) + 984670 (body disappears) > after 798279 (Morra attempts to wormhole)
- 918578 (Vec slices connectors) > after 257868 (Morra "Fuck.")
- 062108 (goblin has elf ears) > after 468978 (goblin shouts)
- 503410 (Vortox "ex-wife laying atop a couch") > after 557329 (Seth opens the door)
- 677673 (Vec grabs the hot dog) > after 229845 ("Is that a hot dog?")
- 712414 (Vec drops the plywood) > after 820058 (Seth's mask)
- 347541 + 907072 (second head on Seth's back, "Oh, delightful") > after 297877 (the /choose)
- Optional: 192256 (slum description) > after 402523 (8ball)

Flags:
- 870002: the 8ball footer asker is `?` ("Brody asked: ...").
- 923925 and 714462 are near-duplicates ("Now, let's see what that item is." / "Now, let's see what...").
- No outcome beat after 8ball 828946 (the elevator tipping) or 312686 (the goblin headshot, though the Goddess's "VILE!" implies it).
- No outcome beat after 883522 (Vec gives the artifact).
- 008465: the dagger has no stated source.
- 464 "Stopping episode!" is episode framing; keep or cut?

## Ep 22 Usurper (verdict: good, ~11 moves)
- 319169 (Zion throws holodeck) > after 006976, so Squorchy 452282 and Emmett 403066 are adjacent
- 480848 (Zach pat-down) > after 212133 (Zach "Fine.")
- 486384 (Zion can't reach Dutch's hands) > after 904006 (8ball), then 829039 (Dutch "I am on the phone") after it
- 947467 (Zach blinks) > after 168597 ("Poof!")
- 736331 (Zion "backroad") > after 393665
- 108160 (Bellow "That might work") > after 687046 (Dutch's Moldarr idea), so Zion's 937244/361991 stay together
- 328272 (customs replaced the ears) > after 004486 (16 hours pass), before 013432 (the ears jingle)
- 545118 (Giant's reply) > after 873257 (Zach greets the Giant)
- 429299 (Messenger rushes out) > after 975700 (Dutch "PUT ME DOWN")
- 441158 (Messenger 1 crawling) > after 704692
- 994002 (Dutch relays Zion's threat) > after 073416
- Optional: 379787 (8ball runes) > after 428742

Flag: 486814 has an empty `↪ Jonas:` quote.

## Ep 23 Finale (verdict: needs the most work, ~45 moves)
Hangar and artifact reveal:
- 542190 (Morra opens the pod) > after 739866; 858000 ("I believe so!") > after 957437; 497681 (Zach "Good to see you again too!") > after 518727
- 314076 (Morra returns the hugs) > after 205800
- Call ending: 825760 (Llashii "You're cleared") > after 863050; Dutch's pilot bit 728016, 578812, 225091, 143484 > after 169705 (Zion hangs up)

Mothership:
- 532274 (Zion "Spent a couple GUYs here") > after 909855
- 473534 (Zion "Of course you can come") > after 172318
- Zach/Morra "should I stay" thread, in order: 288370 > after 769930; 402035 > after 288370; 141203 > after 402035; 622517 > after 141203; 922440 > after 622517
- 793194 (Dutch "Howdy.") > after 810186 (the man enters)
- 055111 (kids revealed at the right floor) > after 447458, before Zion ejects Dutch
- 231196 (Dutch "Howdy, Commander!") > after 781150
- 194300 (Llashii "welcome you back") > after 753054
- 583933 + 907359 (Llashii "ship just docked") > after 042816
- Llashii reply pairs: 876437 > after 587004; 110400 > after 153769; 925781 > after 727582

Battle:
- Zach's arm: 8ball 138823 ("lose a limb?") and /choose 356264 ("arm") and 064094 ("blade slice") sit hundreds of lines before the event. Move all three > after 446623, directly before the Ravens_blade `/dmg` 276802.
- 906152 (arm sliced off) > after 276802
- 465705 (Enemy A slices Morra) > after 769758
- 620746 (Zion fires the blaster) > after 833512
- 245569 (Zion slices Enemy C) > after 155921, then 208616 (Sanya "Very nice") after it
- 980051 (blast pushes the leader back) > after 091668
- 252393 (Chomsky's grenade quip) > after 092106
- 858827 + 665886 (Bellow's quadpistols) > after 872042
- Emmett/Sanya: 784672 + 120011 > after 442975
- Sanya spear: 502440 + 345020 ("Behind you...", the spear) > after 316594, before the Dreadspear `/dmg` 636261
- 665994 (Dutch "I need to end YOU!") > after 846356
- Bellow's cauterize thread: 219230 > after 750992; 848308 > after 219230; 912617 > after 848308; 311061 and 906241 > after 912617
- 8ball 883082 (meat cube) > immediately before 197265 (Vec's meat cube)
- 081586 (Sanya's wound is clean) > after 516246
- 016765 (Chomsky "Please don't mention that day") > after 200051
- 747732 + 406986 (Zion's reply to Vec) > after 580412
- 788900 (Zion salutes Chomsky) > after 911134
- 213845 (tooth bounces off Bellow) > after 528465, before Dutch's second "Ow."

Flags:
- 346079 is an 8ball embed inside a Zander block, after Vec's action. The embed belongs under Vortox 406706 and should precede the action (the outcome is "the person after you decides").
- 405982 (Bellow "We don't have it, sorry.") is unclear in context.
- 217 8ball's "Chris Chan" is an anachronism.
- 8ball 895154 has a real-looking phone number (850 area code).

---
Applied 2026-10-07 (all non-optional moves above; optional ones skipped). Flags are still open.
