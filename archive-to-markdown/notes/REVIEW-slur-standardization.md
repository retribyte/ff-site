# Slur standardization review

Status: **applied, uncommitted**. Every edit is recorded in `.editorial-analysis/slur_standardize.py` (local-only), which asserts each line's prior text. To revert a single line, restore the "Before" text below at that `file:line`.

## The standard

Sources: the wiki's [Interspecies relations § Derogatory Terms Across Species](https://wiki.vortox.space/wiki/Interspecies_relations#Derogatory_Terms_Across_Species) (gleemp, the `-loid` suffix), and the FF3 edits Trey had already made in `ff3/ff3.md`.

| Raw | Replacement | Notes |
|---|---|---|
| f-slur, full (`f*ggot`) | **binger** | FF3 precedent: "He's a binger, that's what he is." |
| f-slur, short (`f*g`) | **bing** | FF3: "Seth is a bing though." Also used as the adjective. |
| "gay" / "homo" used as an insult | *(no stock replacement)* | Left for a manual pass; see §3. |
| n-word, hard R | **gleemp** | Catalogue: an outsider, someone who doesn't belong. FF3: "No, Gleemp." |
| n-word, "-a" form | **glimp** | FF3: "I'm back glimps!" |
| robo- + n-word | **robogleemp** | FF3: "Now go away robogleemp." |
| "retard" (noun) | **stupidloid** | Catalogue `-loid` suffix. Noun only. |
| "retarded" (adjective) | **stupid** | `stupidloid` is not an adjective. |

## 1. Zander's unique substitutions: kept (reverted after review)

Trey reviewed these and preferred the originals, so all nine were restored: `robo-bastard` / `ROBO-BASTARD` (13), `bastard` and `robo-bro` (14), `Yee haw like a bee haw nee haw!` (18), `dick god` and `It's stupid.` (19), and `BASTARRRD!` and `DEECOLUN` (23). The standard applies only to raw slurs and to stock swaps like `sleazeball`, not to a hand-crafted substitute.

Known wrinkle left as-is: after Zander's episode 18 line, the next lines still ask "The hell is 'yigga'?"

## 2. Mechanical f-slur swaps (13)

Mostly Zander's `sleazeball`/`sleaze` → `binger`/`bing`, plus the f-slur the old censor pass missed (`10:801`). Episode 17's bit uses `bing` to preserve the "same fag" rhythm. Also fixed typos in the same line: `squat an` → `squat and`, `others'` → `other's`.

| Where | Raw original | Before | After |
|---|---|---|---|
| `ff2/9-pirates-vs-pummelers.md:1746` | Fuck you faggot. | Fuck you, sleazeball! | Fuck you, binger! |
| `ff2/9-pirates-vs-pummelers.md:1760` | Your emperor is also a faggot. | Your emperor is also a sleazeball. | Your emperor is also a binger. |
| `ff2/9-pirates-vs-pummelers.md:1850` | Nice fleshlight faggot. | Nice fleshlight, sleazeball. | Nice fleshlight, binger. |
| `ff2/10-toothache-troubles.md:621` | Chill faggot. | Chill, sleaze. | Chill, binger. |
| `ff2/10-toothache-troubles.md:695` | Big baby have tantrum like faggot | Big baby have tantrum, like sleazeball. | Big baby have tantrum, like binger. |
| `ff2/10-toothache-troubles.md:801` | — | WAAAAAAAAAAAAAAAAAAA MY NAME LODAS I BIG FAGGOT THAT CRY LIKE BABY AND JERK OFF TO CYBERDOG WHILE CRYING | WAAAAAAAAAAAAAAAAAAA MY NAME LODAS I BIG BINGER THAT CRY LIKE BABY AND JERK OFF TO CYBERDOG WHILE CRYING |
| `ff2/13-seeing-double.md:2156` | Get fucked faggot. | Get fucked, sleazeball! | Get fucked, binger! |
| `ff2/13-seeing-double.md:2358` | Emmett go kill the flame faggot. | Emmett, go kill the flame sleazeball! | Emmett, go kill the flame binger! |
| `ff2/13-seeing-double.md:2542` | You're little faggot behind you decided to interfere so we might as well. | Your little sleazeball behind you decided to interfere, so we might as well! | Your little binger behind you decided to interfere, so we might as well! |
| `ff2/13-seeing-double.md:4772` | Fuck you too faggot, I'll rip your fucking head off. | Fuck you too sleazeball, I'll rip your fucking head off! | Fuck you too, binger, I'll rip your fucking head off! |
| `ff2/17-take-two.md:2180` | t!8ball Does Seth and Seth point at each other and say same fag? | t!8ball Does Seth and Seth point at each other and say, "Same sleaze"? | t!8ball Does Seth and Seth point at each other and say, "Same bing"? |
| `ff2/17-take-two.md:2196` | (added action; follows the "same fag" roll) | _The two Seths squat an point to each other, exclaiming, "Same sleaze". They both are taken aback by the others' response._ | _The two Seths squat and point to each other, exclaiming, "Same bing." They both are taken aback by the other's response._ |
| `ff2/17-take-two.md:2198` | (Zander rewrite in the same bit) | No, you're the sleaze! | No, you're the bing! |

## 3. "gay"/"homo" as an insult: pending manual pass

These were briefly auto-mapped to `bing`, then reverted: "gay" doesn't map to the f-slur's replacement. They're back to their pre-pass text, for a line-by-line manual pass:

| Where | Current text |
|---|---|
| `ff2/9-pirates-vs-pummelers.md:1641` | Blah, blah, blah, I'm gay. That is all I heard from you, gay boy. |
| `ff2/9-pirates-vs-pummelers.md:1706` | Your emperor is gay and you should suck your own ass. |
| `ff2/9-pirates-vs-pummelers.md:1799` | Dude, you look gay. |
| `ff2/12-party-planet.md:1927` | Elves are dumb. *(Zander's softening of raw "Elves are gay." The catalogue's elf slur is Egokk.)* |
| `ff2/13-seeing-double.md:981` | Gaysier. *(pun on Asier)* |
| `ff2/13-seeing-double.md:2049` | That's gay. |
| `ff2/14-crash-and-burn.md:2853` | U gay! |
| `ff2/14-crash-and-burn.md:3666` | Garrick, your nose is gay! |
| `ff2/4-dreamin-scary.md:776` / `:842` | @Magic8Ball Are you gay? / Is Bruno mars gay? *(8ball jabs)* |
| `ff3/ff3.md:4627` (→ `ff3/2.md`) | `Seth`: The gay slime. |
| `ff3/ff3.md:5976` (→ `ff3/2.md`) | *Emmett peers at the homo.* (narration, about Olag) |
| `ff3/ff3.md:18051` (→ `ff3/6.md`) | `Theylin`: Vargas is GAYYYYYYYY?????????? *(reveal reaction)* |

The FF3 lines live in both `ff3.md` and the re-split episode file. Edit `ff3.md`, then re-run `.editorial-analysis/ff3_resplit.py --apply` (or edit both copies).

## 4. Newly censored: "retard" (19)

`stupidloid` for the noun, `stupid` for the adjective. **Check `2:1104`:** it's Zander's GM line ("mental retardation"), now "an even worse case of stupidloidism", the only coined form. `18:540` also fixes "a way" → "away".

| Where | Before | After |
|---|---|---|
| `ff2/2-tuck-and-run.md:1104` | Hey guys? I think Jacob is suffering even worse from mental retardation. | Hey guys? I think Jacob is suffering an even worse case of stupidloidism. |
| `ff2/4-dreamin-scary.md:926` | @Magic8Ball Is this game retarded? | @Magic8Ball Is this game stupid? |
| `ff2/6-killer-ship.md:524` | That's retarded. | That's stupid. |
| `ff2/6-killer-ship.md:988` | Whatever, your planet's laws are retarded. | Whatever, your planet's laws are stupid. |
| `ff2/11-ups-and-downs.md:476` | He's retarded. | He's a stupidloid. |
| `ff2/13-seeing-double.md:203` | With the retarded robot arm... | With the stupid robot arm... |
| `ff2/14-crash-and-burn.md:3193` | TAKE THE FUCKING CIGARETTE, RETARD! | TAKE THE FUCKING CIGARETTE, STUPIDLOID! |
| `ff2/18-cruisin-for-a-snoozin.md:540` | We are literally half a mile a way from my home town, retards. | We are literally half a mile away from my home town, stupidloids. |
| `ff2/18-cruisin-for-a-snoozin.md:566` | Well guess what, retard? I have a ship lot that we can go to and use one of the many ships I captured! | Well guess what, stupidloid? I have a ship lot that we can go to and use one of the many ships I captured! |
| `ff2/20-rough-resurrection.md:1199` | Look what you did, retard! | Look what you did, stupidloid! |
| `ff2/22-dam-hooligans.md:2547` | Don't worry my future in-laws I am planning on marrying your daughter! My twin just was being a retard. | Don't worry my future in-laws I am planning on marrying your daughter! My twin just was being a stupidloid. |
| `ff3/ff3.md:567` | `Seth`: Good morning retards | `Seth`: Good morning stupidloids |
| `ff3/ff3.md:1175` | `Seth`: No, none of them were retarded. | `Seth`: No, none of them were stupid. |
| `ff3/ff3.md:2958` | `Emmett`: He's our retarded captain. | `Emmett`: He's our stupid captain. |
| `ff3/ff3.md:7449` | `Emmett`: I swear, the people on this ship are retarded sometimes. | `Emmett`: I swear, the people on this ship are stupid sometimes. |
| `ff3/ff3.md:13098` | `Seth`: Its me retard. | `Seth`: Its me stupidloid. |
| `ff3/ff3.md:17239` | And I said 8ball not 8ball man, retard. | And I said 8ball not 8ball man, stupidloid. |
| `ff3/ff3.md:18409` | `Emmett`: "You think I'm retarded?" | `Emmett`: "You think I'm stupid?" |
| `ff3/ff3.md:18446` | `Sanya`: While my crew maybe be retarded, i assure you, i am a trained assassin. | `Sanya`: While my crew maybe be stupid, i assure you, i am a trained assassin. |

## 5. Deliberately left alone

- **"bastard"** in `9:1635`, `20:163`, `20:175`, `22:3522`: the raw said "bastard" too, so it's not a substitute.
- **Identity or plot uses in FF3:** "is emmett homosexual?" (8ball), "Emmett's homophobic", "Is this the thing they call 'homosexuality'?", "you're now a gay icon".
- **Out-of-character player lines in FF3's unedited table talk:** "not gay" (`ff3.md` ~3744) and "sanya's actually a guy and emmett's gay" (~8222). These would normally be deleted as OOC in an editing pass rather than censored.
- **Autism:** `2` "He has autism, please be patient." is a sincere line. Zander already turned `22`'s "I'm AUTISTIC!" into "FUCK!".
- **Episodes 24–25** are still raw. They'll get this standard during the editing pass.

## 6. FF3 re-split (related)

Trey's FF3 edits existed only in `ff3/ff3.md`. The split files the importer reads (`ff3/0-prep.md`, `1.md`–`8.md`) were the untouched raw export (with slurs, `(edited)` markers and table talk). They are now verbatim slices of `ff3.md`, cut at each episode's original first timestamp. `md-to-api.py` parses the new files cleanly, with message counts within about 5% of before; episode 1 lost about 70 OOC messages to Trey's cleanup.

This surfaced a pre-existing gap: `meta/ff3.json` had no cast entry for **Maxwell** (Mateo). The old raw files hid this because every line had a typed `Mateo:` prefix; the edited actions don't. `"Maxwell": {"1": "Mateo"}` was added, and all speakers now resolve. FF3 episodes still have no titles in the meta file, so none has ever been imported.
