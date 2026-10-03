# Handoff: FF1 editorial pass (started 2026-10-02)

FF1 (episodes 3–10; 1–2 aren't in the archive we have) is the oldest and
chattiest campaign: late 2017 – Feb 2018, ~2,000 messages, mostly Discord
8-ball play-by-post with a middle-school sense of humor. This file is the
brief for the editing pass. **Read `md/ff2/EDITORIAL-STYLE-GUIDE.md` first**
(the house rules: line types, §3 deletions, §4 slurs, §5 contextual actions),
then this file. It only records what is *different* about FF1.

## Where things are

- `md/ff1/raw/N.md` — frozen converter output ("before"). **Never edit.**
  `md/ff1/raw/ff1.md` is the whole archive in one file.
- `md/ff1/N.md` — the working/edited episode. Edit this file.
- Wiki context (public API; see HANDOFF-ff2 "Look up lore"): wiki pages
  `Final Frontier 1`, `Timeline` (§2765 GUY, §2965 GUY), `Seth`, `Matthias`,
  `Serpile`, `Grass Stalker`, `Grasshoppers`, `Apis`, `Mouse Breaker`. Look up
  names before tagging NPCs.
- `python3 editorial/ff1-verify.py N` (run from `archive-to-markdown/`) is
  the gate script: 0 unresolved speakers, 0 OTHER lines from non-bots, 0
  orphan bot replies, 0 lint hits, 0 slurs.
- Each editor appends an `## Ep N: judgment calls for Trey` section to the
  bottom of THIS file (what was cut/converted/guessed, open questions).

## There was no GM

FF1 had **no game master**. It was a leaderless, collaborative play-by-post:
every player voiced their own character, and anyone could introduce or voice
NPCs, the setting and events, with the 8-ball bot as the shared randomizer
that decided what happened (hence the "[Yes]"/"[No]" players answering the
bot). Don't attribute world-building, NPCs or rulings to a GM — assign them
to whichever player typed them (Zander did a lot of scene-setting, but as a
player). Narration the editor adds is the archive's voice, not a character's.
Sentences in these notes or the style guide that say "the GM" refer to the
FF2–4 convention and only matter here as the `🐐 |` line format.

## The source format (differs from FF2's raw)

The FF1 converter (`ff1.py`) already separated in-character from
out-of-character, because FF1 players typed IC speech in `backticks`:

- `> text` = the player typed it in backticks = **in-character speech**.
- a plain line = anything else: 8-ball commands (`@Magic8Ball …`, `8ball …`,
  `!8ball …`), OOC chatter, narration/actions typed without markup,
  pings (`@Zander`), `[Yes]`/`[No]` answers to the bot.
- `🎱 | Answer, Asker.` lines under a bot header (Magic 8 Bot / Magic8Ball /
  pbot) are bot replies, already collapsed. `_italic_` = a typed action.
- Block headers name Discord accounts. `meta/ff1.json` maps account → player
  → character. **Plain lines OTHER-import with no character**, so every plain
  line that survives must be a bot command (stays plain), a bot reply, or be
  converted to `> speech` / `_action_` / `🐐 | narration`.
- Quote lines are attributed to the block owner's character. A quote that is
  an NPC needs a `` > `Name`: `` tag, and the owner's next untagged line needs
  to start a new block under the same header (md-to-api carries a tag over
  the rest of the block).

## Cast (meta/ff1.json)

| Account → player | Character | Notes |
|---|---|---|
| Zander | **Grass Stalker**, persona **Emmett** | A player like the others. Narrate him as "Emmett". A vespoid (wasp-person) from Apis. |
| Bagelwrecker → Sean | Seth Im'Kin'ki | Bounty hunter; captain of the crew; crude; lost his translator. |
| Enchantingtable2013 → Maxwell | Matthias | Avian. Players type "Mattias", "Math", "Meth" as jokes. |
| Master JRM → Josh | Jacob | |
| Brakia → Brody | Serpile, persona **Kabajhu** | Only appears in ep 9 (wiki spells it "Kabaju"). |
| Mica | Venus | Half human/half robot; joins ep 8. |
| Zvirym Vallaheim | Meth | Ep 6 only; a chaos player ("Bezaziel, Shadow of God"). |
| Junnn | Heck | Ep 10; "zombie". |
| ProfessorTree→Silas, WatchfulDrake→Bill, Platinum_Pathos→Rashidi | (none) | Cameo accounts. If they voice something in-world, tag it. |
| Magic8Ball / Magic 8 Bot / pbot (→ "FF 8 Ball") | the 8-ball bot (the table's randomizer) | Not a person. The archive's narrator voice (`🐐 \|` lines, see below) is filed under a `**Magic8Ball**` block purely by house convention. |

Characters not on that list (Dominic, Venus' guards, the warden, the queen,
Mouse Breaker, the Goddess of Death, the Grasshoppers, Belly Button Dog…) are
NPCs/offscreen: tag their speech, and look them up first.

## Plot spine (wiki Timeline, "2765 GUY") — use it to resolve confusion

Grass Stalker is the first vespoid in space; Seth dubs him "Emmett". Emmett
joins Seth's crew (he's the pilot because Seth can't fly a GU ship); Matthias
is the crew's taskman (rivalry with Seth); Emmett's mammalian-reproduction
attempts with his girlfriend Mouse Breaker get published to the Holonet; the
crew assists two rebellions on Apis (the second one kills the queen and founds
"Russia"; Mouse is accidentally killed by Emmett); Seth marries the Goddess of
Death on Lama'entria (honeymoon ~2 weeks; his translator breaks, so he talks
by sticking his head up his wife's ass); then, in deep space, the crew is
ambushed by the **Grasshoppers** (a violent gang from Apis). **Seth and
Matthias are cryogenically frozen; Emmett reluctantly leaves them for his own
safety.** Then a **200-GUY timeskip** (2965 GUY: Seth and Matthias reawaken).
That freeze/skip is in **ep 10** (it's the biggest plot beat, along with ep
9–10's new-galaxy details like facial-ID everything). The opening status post
in ep 3 ("Seth: on his homeplanet; honeymoon…") fits this: ep 3 starts at the
honeymoon. Sessions are not labeled; use the wiki + the chat to place scenes.
In-universe, 1 GUY = 1 year; 1 equinox = 1 day.

## What's different about editing FF1

1. **Expect chaos.** Many 8-ball exchanges are players fighting the bot; many
   plain lines are table talk. Follow guide §3 (delete OOC) and §2.3 (rewrite
   commands in third person, fold "decides for you", delete retries and junk).
   The FF1 bot's non-answers: "The person who played before you can answer
   that for you", "The next person to play can answer that for you", "Why,
   don't you know the answer already" (the asker decides). A following
   `[Yes]`/`[No]`/`{Yes}` plain line from a player is the answer — fold it
   into the bot line (`🎱 | Sean says yes, Zander.`), then delete it.
2. **Plot-relevant OOC → in-world.** When a plain OOC line carries story (a
   player describing what their character does, an NPC description, a table-agreed ruling on a scene), convert it to a character action `_Seth does X._` in
   that player's own block (free and encouraged) or, **sparingly**, narrator
   narration `🐐 | …` under a Magic8Ball block. Character sheet / backstory
   dumps (e.g. Venus' bio, Emmett's backstory posts) → at most one short
   action or a 🐐 summary; don't paste lore walls.
3. **Tiers 1–2 actions** (guide §5) apply: give the transcript scene
   continuity, who is where, what the 8-ball roll resulted in. The episodes
   are thin on dialogue and heavy on commands, so most added actions will be
   roll outcomes (§5.1 item 6) and entrances/location beats.
4. **Continuity first.** Read the end of the previous episode's judgment
   section in this file before starting; write down in yours where everyone
   is at the end (location, status, items).
5. **Crude content is source material — keep it, elaborate lightly** (guide
   §4) with these FF1-specific limits, because this archive is going into the
   shared git history and the public-ish site:
   - slurs → the §4 table; flag "gay/homo" insults in your section.
   - **real-world targeted harassment of real people** 
     (the players' own Discord friends by real name, real
     schools/addresses/personal info, "real name" asides): cut or rewrite;
     list what you cut (without quoting it) in your section.
   - Out-of-character real-name drama between players is deleted.
6. Don't name Discord handles in dialogue (they appear as `@Name` pings):
   delete pings; if one is a real address to a character, rewrite it
   (`@Bagelwrecker` → Seth).
7. Ep numbering/titles: episode titles in `meta/ff1.json` are placeholders —
   propose a real title in your section.

## Workflow per episode

1. Read `md/ff1/raw/N.md` in full (in ~400-line chunks). Skim the previous
   episode's judgment section and the first screen of the next episode's raw
   (for setups: guide §9.3 — don't cut something a later episode needs).
2. Write the edited episode to `md/ff1/N.md` (build it in parts in a durable
   scratch folder, e.g. `.editorial-analysis/ff1-epN/`, then concatenate into
   `md/ff1/N.md`; do not use `/tmp`).
3. `python3 editorial/ff1-verify.py N` until clean. The density check is a
   calibration (guide §0), not a quota — FF1 will run lower on dialogue.
4. Append your `## Ep N: judgment calls for Trey` section here.
5. Don't `git commit`; don't touch `md/ff1/raw/`; don't upload anything.

## Ep 3: judgment calls for Trey

**How much is recovered vs invented.** Ep 3 raw is ~250 messages, essentially 100% 8-ball (Oct 1 2017 14:13-15:15, plus one stray Oct 13 roll and one Oct 14 chat line; the Nov/Dec material at the end of the raw file is OOC noise). The only in-character speech was one Emmett line and one Seth shout. Every roll outcome is recovered from the bot; the connective tissue (the action lines, ~37) is mine, but each follows from a typed question plus its answer. Stretches where the bot's replies contradicted each other (marble size, arm length) were resolved to the kept rolls, and the rest cut.

**Recap.**
- Opening status: Seth honeymooning on his homeplanet, Mattias still covered in poop, Jacob and Dominic on the ship.
- Seth bags his wife, hickeys her into submission, and becomes a marble (50 ft tall, 2 mm wide); the wife eats the marble and delivers his elf form.
- Seth grows legs, his arms punch him, thrusters sprout and he rockets skyward ("FREEDOM!"), declining to aim at "Mother" (his actual mother) or pee on the people below (he is out of urine).
- The ship snatches Seth from the sky and flings him through its hull; the crash wakes Emmett, who wet the bed, swaps Seth's drink for piss, and the wife drinks it.
- Aboard, it is revealed the ship's AI is the former vespoid queen.

**Where everyone ends (for ep 4).**
- Seth: aboard the ship, with his wife (consistent with ep 4, where she is still with him); translator still broken, spare translator still in her rear (he decided to "give it time", so ep 4's retrieval attempts stand); has "seven universal grabs" left.
- Emmett: awake, aboard, embarrassed about the wet bed.
- Mattias: buried six feet underground, still covered in poop (not dug up).
- Jacob: aboard, in the lounge. Dominic: aboard (never appears on the page).
- Ship AI is the former vespoid queen, not fighting for dominance. Seth's mother's house is rubble.

**Cut for filtering rules (described, not quoted).** A racial-slur outburst by Seth's player (1 line); an "aside" insult line; two rolls about urinating in the wife's mouth / drinking out of her throat with the head inserted (sexual-bodily, ambiguous consent, bot said no or "trust me, you don't want to know"); a real first name used for Mattias's player in one roll (rewritten to Mattias); a real-world link dump (two URLs, one about a real athlete) and a Wikipedia link. No "gay/homo" insults in the kept lines (the Nov 24 "gay" rolls belong to ep 4's raw).

**Converted from OOC to story.**
- The opening status post became a single GM line.
- Bagelwrecker's "FREEDOM" shout became Seth dialogue.
- A "Man sassy 8ball" reaction from Master JRM was dropped, and in its place I wrote one Jacob action in the lounge (invented, to place Jacob on the ship per the opening status).
- Questions asked in first person were rewritten to third person ("Does Seth..."). "Mother" and "Michael" are treated as in-fiction names; "Ask Michael" replies were cut as non-answers.
- Moved blocks (keeping original timestamps): the Emmett wakes / drink-swap scene (original 02:47-03:05) now follows the ship landing (original 03:08-03:09), and the Mattias-buried roll (03:08) sits earlier. Without the move, Seth and Emmett swap drinks while Seth is flying.

**Also cut.** All tug-of-war repeats and retries ("Reply hazy", "Cannot predict", "Ask again later"), junk rolls, the Oct 13 portal-gun roll (bot told him to decide for himself and nobody answered), "universal grab" ping-pong, Emmett-head-shape / cow-arm / farm-animal / planets-aligned / buffet / ignition / "without sex two weeks" / marble-shrinks-to-1mm / Math-dating-the-AI rolls (non-answers or contradictory), ship thruster fuel, the Nov/Dec pings, "where is our 8ball", and the Dec 15 pbot test.

**Questions for Trey.**
1. "Universal grab" is clearly a Seth ability and I kept one line about it; do you want it explained anywhere?
2. The bot said Seth is blasting off "toward the capital" but wants to land at "the ship". I kept both and had the ship snatch him. Is the ship parked at the capital? Is "Mother" a place or a person?
3. Are you OK with the Jacob invention and with the ship-AI-is-the-queen reveal being taken literally from a single "Isn't it obvious" roll?
4. Is the "wife" the Goddess of Death? I never named her, per the wiki spine.
5. Is the poop/Mattias burial a bit you want kept in the canon?
6. I kept the 8-ball joke answers (e.g. "y35") as typed; fine?

**Proposed title.** "Honeymoon Over". One sentence: Seth stuffs his bride in a bag, turns into a marble, rockets off his homeplanet, and gets flung back onto the ship, where a wet bed, a drink swap and a very familiar AI await.

## Ep 4: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 4 (1,293 lines) is ~95% one session, Dec 17 2017 8:04-10:08 PM, plus ~40 lines of pre-session pings, a Nov 24 chat about the 8-ball and a Dec 15 bot test. Every in-character quote is the player's own. The ~65 action lines are mine; nearly all are roll outcomes, entrances and "who is where" beats, each following from a typed question plus the bot's answer (or a player's decision after a "don't you know the answer already" reply). Where the bot said "next person decides" and nobody answered, I either cut the roll or kept the player's narrated result as an action. The kept bot lines of that kind are left as the bot typed them, with the decision in the next action.

**Recap.**
- Opening status (one 🐐 line): Seth, Emmett, Mattias aboard; translator broken; Mattias in a two-month coma.
- Mattias wakes (not drowsy), drinks space-cow milk, loses his muscles, switches on the autopilot. Seth sells his protein powder and gym gear for 120,000 credits (ordinary payday) and orders an FTL engine off the holonet. A trip to fix the translator is ruled "very doubtful".
- Seth retrieves his spare translator from his wife and pulls out her pancreas by accident. Emmett, piloting, spots a gigantic hole-ridden space yacht beside an asteroid strewn with dead naked women, including his dead girlfriend Mouse.
- Seth spacewalks to the bodies and finds roughly two-inch bite marks; Emmett thinks Grasshoppers, explains them (once a second sentient species on Apis, a truce after killing a great leader, which is why they didn't bite Mouse) and expects them back soon. Emmett and then Mattias suit up and follow.
- Seth and Mattias enter the yacht's control station: a dead elven pilot, Seth's comrade Mac' Feralin (Seth knew his father, a blacksmith); Seth keeps the service revolver and a last will and testament, finds no map. Mattias finds a weapons locker and a two-round-burst laser rifle.

**Where everyone ends (for ep 5).**
- Seth: inside the yacht's control station with Mattias; has the dead pilot's service revolver and the will; halberd out; spare translator retrieved (never stated whether it is installed or working; raw does not say).
- Mattias: inside the yacht with Seth; just found a two-round-burst laser rifle in the weapons locker (he overruled Seth's poop joke). Still has his regular gun. Not buried or covered in poop any more (see questions).
- Emmett: outside on the asteroid in his holosuit, taking blood/organic samples, wooden shiv and the two Grasshopper mandibles he extracted; expects Grasshoppers to return.
- Seth's wife: last seen aboard the ship (her pancreas is out, she groans; the 8-ball never answered whether she grows a new one).
- Ship: autopilot on, parked or drifting near the asteroid and yacht. Jacob and Dominic never appear.

**Cut for filtering rules (described, not quoted).**
- Real-world: a Nov 24 roll using an anti-gay slur about a pop-culture name, a Dec 8 pair of garbled slur-like insults between players, and the "is Math gay" roll that came with them (not an in-story insult; pure table banter, so cut rather than flagged); a YouTube link answer; the bot's m8-help spam including an invite link and a real username.
- A sexual-content exchange among Seth, Emmett and Mattias (about 10 lines, 9:22-9:25 PM) in which Seth is accused of rape of someone he believed to be 18 but who was a minor-aged alien, plus Seth's drow-elf aside, the "public radio channel" roll and the puberty joke that followed. Cut entirely: it involves sexual assault and a minor.
- One roll about pouring hot coffee down the wife's throat and drinking it from her rear (same sexual-bodily ambiguous-consent category as ep 3's cuts), and Seth's "Perfect" reply.
- One crude line from Mattias ("Delicious") about the dead women; the "harassing them / they're dead" exchange is kept, trimmed.
- All pre-session pings and "join vc" chatter, the Dec 15 pbot test, "where is our 8ball", 🅱 spam, "Send nudes" / "boob?" / "poop poop ok" bot tests, "(Text)", and the "bye now" / "k fine I decide" player asides.
- Retries and non-answers with no outcome: manufacturer's-planet coordinates, Emmett's "intensely focused" / "interesting in my concentration" rolls, belly-button-dog on the yacht, Seth's willy in space, "does she grow a new one", ship comes to a halt, a ship/Grasshoppers on the horizon, "is it a mirage", wife-off-head, repeated syringe rolls, fish/brain-fuel roll, Seth blood-draw and flesh-cutting rolls, Mattias "breaks down", "inflation", "almond milk", "bribe", etc.

**OOC converted into story.**
- Coma and holosuit rolls became Mattias actions.
- Zander's parenthetical "(Wet dream, he means)" became an Emmett murmur to Seth.
- Seth's plain-line narration "He finds a piece of poop" became a Seth action, and Mattias's OOC "k fine I decide / 2 round burst lazer rifle" became his reply action (the poop-or-rifle bit is Mattias vs Seth).
- Emmett's "Hey! I can still hear you, asshole!" is made explicit as a reaction to the pilot dig over comms; "Not the fridge" gets a setup action (Mattias talking to the fridge); comms actions added wherever remote lines needed a medium.
- Wife's "Mmmm" line is tagged `Seth's Wife` (NPC voiced by Zander).
- The yacht/asteroid geography is mine: raw says both "asteroid" and "yacht" for where the bodies are. I put the bodies on the asteroid beside the yacht and changed Seth's "on that yacht" to "out here".

**Moved/reordered blocks (original timestamps kept).**
- Seth's 8:04 PM "trip to fix translator" roll now follows Emmett and Seth's 8:12 PM "should we get your problem fixed?" exchange, so the "very doubtful" ruling answers the proposal.
- Seth's 8:09 spare-translator roll sits right after the coma wake-up; Mattias's 8:22-8:23 muscles, Emmett's 8:23 autopilot roll, and a few other bot timestamps are slightly out of order from this.
- The Dec 17 8:04 PM opening 🐐 block borrows the first block's timestamp.

**Questions for Trey.**
1. Continuity break: ep 3 ends with Mattias buried six feet down, covered in poop. Ep 4 starts him waking from a two-month coma aboard. I did not bridge it (no one was dug up on the page). Do you want a line, or is the poop-burial just ep 3's bit?
2. Does the retrieved translator work now? Raw is silent; I left it ambiguous.
3. Ep 5 raw opens with Zander asking "poop or 2-round burst laser rifle?" (yes for poop) and mentions beating a lean steak, murdered women and "Remarkable". Is that a new scene or a different weapons locker? I kept the rifle as the ep 4 ending since Mattias decided it.
4. The "Elf Lil' Pump tattoo on his anus" joke: kept as one Emmett-knowledge action. Fine?
5. "Intergalactic Act 90,198 of 4195" kept as typed. Is 4195 a real in-universe year (GUY)? Probably a retcon candidate.
6. Is the dead elf Mac' Feralin tied to Seth's past in the wiki? I couldn't confirm; treated as an NPC name in Seth's dialogue only.
7. The wife/pancreas bit is kept at one action. OK, or should it be softer?
8. The dead-women asteroid scene (necrophilia-adjacent jokes, "slightly arousing") is kept at the level of Emmett's one line and Mattias's "harassment" gag; no "gay/homo" insults survived in this episode.

**Proposed title.** "Nudist Massacre". One sentence: Mattias wakes from a two-month coma, Seth fishes a translator out of his wife, and the crew drifts up to a hole-ridden space yacht beside an asteroid of bitten, dead women, where Emmett recognizes the Grasshoppers' handiwork and Mattias finds a laser rifle.

## Ep 5: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 5 (1,626 lines) is one session, 28 Dec 2017 11:10 AM to 1:58 PM, plus Zander's Emmett backstory posts on 30 Dec. Every in-character quote is the players' own (typed in backticks). The ~77 action lines are mine: roll outcomes, entrances and "who is where" beats, comms framing and a few reactions; each follows from a typed question plus its answer or a player's ruling. The raw opens mid-scene with no framing, so a short 🐐 line opens the episode. Result: 1,575 lines, 21% action.

**Recap.**
- A Grasshopper patrol arrives at the asteroid. Emmett, outside with comms open, chats with one (who calls him "Remarkable"). Seth and Mattias, inside the yacht, taunt the Grasshoppers over the comms despite Emmett's pleas.
- A Grasshopper rams Emmett (a gut wound), kicks the crash shutters in and chases Seth and Mattias to the cryo pods. Mattias's laser shotgun is lost outside. Seth is probed, then slams a pod door on the Grasshopper's head and knocks him out. That sets off a distress beacon, which Emmett explains triggers a sector takeover.
- Emmett crawls back to his ship. Seth and Mattias say a long goodbye over the comms and freeze themselves. Seth's wife stays on Emmett's ship and wants a divorce. Emmett starts his ship.
- Time skip (🐐 line). Seth and Mattias wake in a storage container on an unknown planet. Mattias breaks the door, they loot crates (silenced pistols, poison, black clothes), take down two assault droids that turn into sticks and eggs, enter the city, buy the cheapest ship, and fly to a space station. The year on the wall reads 3205. Seth finds a card from "Jeremy", shoots him, and Jeremy explodes into sticks and eggs. Seth poops on Mattias and makes him eat it.
- Emmett's backstory (30 Dec) became one 🐐 summary line at the end.

**Where everyone ends (for ep 6).**
- Seth and Mattias: on a space station in the far future (wall says 3205), in debt from the cheapest-ship purchase, wearing black clothes with suppressed pistols and poison vials. Mattias is covered in Seth's poop (ate it). The "eternal bond item" between them is described as regained.
- Seth's translator: not mentioned this episode; he talks normally.
- Emmett: left in his ship, wounded in the stomach, alone with Seth's wife (who wants a divorce). Per his backstory he becomes leader of the Vespoids, ages, dies at 142, and is rebuilt as a golden wasp. He is not on the page in ep 6.
- Jacob and Dominic: never appear. The wife: last seen pacing on Emmett's ship.
- Ep 6 raw opens Jan 1 with Seth and Mattias (the "Birdbutt" and "Walnut Brain") finding a drow elf on the space station, so the "space station" ending lines up.

**Cut for filtering rules (described, not quoted).**
- One anti-gay slur shouted by Seth was swapped to "binger". One "retard" outburst from Emmett became "Stupidloids". A stray "kkk" reply was turned into "Okay".
- Seth's roll about sex with his wife while running to the pod ("on my cock"), and the "does the ship have a cock" roll (sexual-bodily, non-answers).
- A roll about a very ugly woman molesting Mattias and the follow-up marriage rolls (sexual assault joke, no outcome).
- A roll about a finger in Mattias's cloaca (answered no).
- All meta chatter about Silas (the cameo account) joining the game, and a roll naming him; a "Credits" cast list; a link to a race-reference page; Zander's "stick eggs" and "crap" asides; non-answers and retries.
- Rolls with no outcome: Emmett reasoning with the Grasshoppers as a roll (kept as an action), "do the Grasshoppers notice" retry, and others. The poop-vs-rifle roll at the start was dropped as already in ep 4.

**OOC converted into story.**
- The "[Yes]/[No]" player answers were folded into the bot lines ("Sean says yes, Zander."). Where a player answered themselves ("Why, don't you know"), it reads "Zander says yes, Zander."
- Parenthetical OOC "(Guys, they're onto you.)", "(currently bleeding from my stomach)" and "(Well, I'll be damned...)" became Emmett and Mattias lines with an action. Emmett's "[A beeping sound comes from him...]" is a narrator action.
- Zander's Grasshopper speech (typed in quotes) is tagged `Grasshopper`.
- Zander's quoted "stick and egg" bit is kept as a running gag (droids and Jeremy turn into sticks and eggs).
- Emmett's wound and crawl back to the ship follow the rolls and Seth's/Mattias's goodbye.
- The Dec 30 backstory is one 🐐 summary; none of the lore wall is pasted.

**Moved blocks / out-of-order timestamps.**
- The time-skip 🐐 line borrows the 12:34 PM neighbor timestamp. The Emmett backstory 🐐 keeps its 30-Dec 01:15 AM timestamp (after the 28-Dec blocks, in order). A couple of Mattias/Zander blocks near 12:04 and 11:42 were reordered so each roll's bot reply follows its command.

**Questions for Trey.**
1. The wall reads "3205", but the wiki spine says the reawakening is 2965 GUY (a 200-GUY skip). Keep 3205 as typed, or retcon to 2965? Seth says "a couple of years" while Mattias slept.
2. Seth's "probing" by the Grasshopper is kept at a light level (Mattias's line plus one action). OK, or cut?
3. "Jeremy" (the card writer) is a player-invented NPC; I treated him as fiction. Is it a real person's name? If so, rename.
4. Emmett's backstory is one 🐐 summary. Do you want it as an EMBED note or in a separate lore page instead?
5. The "hooker" roll is kept as a single action. Fine?
6. Do the Grasshopper "takeover detector" rule and the "ego rupture" explanation need to be in canon, or are they Zander's table lore?

**Proposed title.** "Freeze Day". One sentence: Seth's taunting brings a Grasshopper down on the crew, forcing Emmett to leave Seth and Mattias in cryo while a long time skip drops them in a crate on a far-future planet, where they loot, steal a ship, and reach a space station.

> **PM note (ep 5):** the freeze and the 200-GUY skip are in **ep 5**, not ep 10
> (ep 10 only refers back to it: "frozen for 200 years"). The wall year "3205"
> was retconned to **2965** to match the wiki Timeline (2765 + 200).

## Ep 6: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 6 (784 lines) is one Jan 1 2018 session (4:47-6:10 PM) plus one Zander roll on Jan 2. About half the raw is a new player account (Zvirym Vallaheim, character Meth/"Bezaziel, Shadow of God") and Bagelwrecker trading chaotic backticked insults, so the edit is mostly a heavy cut: 784 lines became about 500, and the result is about 19% action (25 action lines, all mine: roll outcomes, entrances, one 🐐 opener and one 🐐 on Emmett). Every kept quote is the player's own.

**Recap.**
- Opening 🐐: Seth and Mattias, still on the 2965 space station, in black clothes and debt.
- They find a loud drow elf, Meth ("Bezaziel, Shadow of God"). Mattias talks with him, Seth shouts, and Seth and Mattias kidnap him and fly to the bee planet. Emmett is not there.
- Mattias flies their ship into a hive ("fuel was leaking"), it blows up, and all three are arrested. They see the mourning natives on the way to transparent-walled cells.
- Mattias chokes Meth unconscious; Meth sleep-talks. Meth befriends the warden and falls madly in love. Seth and Mattias are unbonded. Meth sweet-talks the warden into freeing the prisoners "from their bondage". Next day (Jan 2) a golden wasp trailed by two servants arrives at the prison (Emmett, rebuilt as a golden wasp per ep 5's backstory).

**Where everyone ends (for ep 7).**
- Seth and Mattias: in a transparent-walled prison cell on the bee planet (Apis) with Meth, no longer eternally bonded; the ship they bought is destroyed. Ep 7 raw confirms they are still in a "prison cell".
- Meth: in the same cell, awake, besotted with the warden.
- Emmett: arriving at the prison as a golden wasp with two servants (this is the Jan 2 roll; the bot said "Maybe" and Zander typed no follow-up, so I wrote the arrival as one action).
- Jacob: bot-answered "on this planet" (yes); ep 7 raw has him returning from his "long journey" and Belly Button Dog following. The wife and Dominic never appear.

**Cut for filtering (described, not quoted).**
- The first half hour of pings, "thing"/keyboard noise, and a run of non-answered rolls (krokodil, backflip, fist-bump, God as a masturbator, "does everyone die", Sean performing sodomy on himself).
- A roll and cheers about raping the native beekeepers, "gangrape him" shouting, and several rolls about sex with the warden or a micropenis (sexual-assault and sexual-bodily jokes with no outcome).
- Self-harm lines ("kill yourself", "right back atcha", "do I stab myself"), a misogyny bit ("I don't like women" and the roll before it), ableist jokes ("autistic screeching", the running "schizo" nickname for Meth, replaced with "Meth"), a racial insult plus an ethnic mock about eyes and skin, a homophobic variant slur, and an "infamous sodomite" riff about someone's mother (all cut, none replaced with a table slur).
- The "Duncan es Seth" / "Sean es Seth" and "Thinh" lines: they use real names of players, and I rewrote or cut them (one roll naming "Thinh's character" was cut).
- OOC: ping spam at the cameo account, "Should we restart?", "(Yes)/{yes}" answers (folded into bot lines), most Meth/Seth keyboard-smash lines, repeated "Shut up"/"No u" ping-pong beyond what I kept.

**OOC converted into story.** Meth's entrance, the kidnapping, the hive crash, arrest, mourning natives, choking, sleep-talk, falling in love, unbonding, "freed from bondage" and the golden wasp's arrival are actions I wrote from rolls and player answers. Zander's "(Emmettalia is not on the bee planet)" became a 🐐 line. Meth eating a stick and egg is from Zander's bracketed answer to a schizophrenia roll.

**Moved blocks.** The "Is Jacob on this planet?" roll (5:41 PM) was moved to just after Seth's "Stop." (5:40 PM); a couple of 5:35-5:36 hive-flying blocks use their original 5:35/5:36 timestamps and sit just before. Otherwise order follows raw. New blocks borrow neighbor timestamps.

**Questions for Trey.**
1. "Free us from bondage": I wrote it literally (the warden frees the prisoners), but the prison continues in ep 7, and it may mean the Seth/Mattias bond only. Reword?
2. Who is Meth? He is a drow elf and apparently a player-run chaos character; I called him the "drow" and "Meth" and kept "Bezaziel, Shadow of God" once.
3. "Mattias" vs "Matthias": narration follows ep 4-5's "Mattias"; the one line where he says "Mine is Matthias" is kept as a spelling gag.
4. Is the golden wasp definitely Emmett? I did not name it in the action; the 🐐 summary in ep 5 supports it.
5. Seth's "aircraft carrier ... full of semen" crude line about the queen is kept. OK?
6. Jacob is "on this planet" (yes) but nobody reacts; kept as a bare roll.
7. No "gay/homo" insults survived. I cut a few; none needed flagging.

**Proposed title.** "Bezaziel, Shadow of God". One sentence: Seth and Mattias kidnap a drow elf named Meth on the space station, crash their ship into a hive on the bee planet, and wind up in a transparent-walled prison where Meth falls in love with the warden and a golden wasp arrives.

## Ep 7: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 7 (182 lines) is two short sessions, 8 Jan 2018 3:14-3:43 PM and 9 Jan 6:14-6:16 PM, almost all rolls and player "[Yes]/[No]" answers; the only in-character speech is Jacob's and Seth's few typed lines. Result: 7.md has 9 actions (all mine or converted from plain lines), 5 dialogue lines, 64% action. It is thin on purpose.

**Recap.** Seth and Mattias are still in the transparent prison cell (opening 🐐). The audience learns Seth's weakness (everyone already knew it). Jacob returns from his long journey (the neglected god of self-pleasure, a trial, two wishes: Belly Button Dog back, immortality) and is back on Emmett's abandoned ship; he decides to wait, unaware Emmett is still gone. Seth spends his last universal grab to yank Jacob into the cell; Jacob is horrified. Next day, Belly Button Dog is ruled to teleport to Jacob forever.

**Where everyone ends (for ep 8).**
- Seth, Mattias, Jacob: in the prison cell on the bee planet, with Belly Button Dog beside Jacob (teleported in). Seth has 0 universal grabs.
- Emmett: still gone (a 🐐 line from Zander's "Emmett is still gone"). Meth (ep 6) is not mentioned and is probably still in the cell or around the warden.
- The golden wasp from the end of ep 6 is not addressed; Zander says Emmett is "still gone" on 8 Jan, so the wasp may not be Emmett yet.

**Cut for filtering (described, not quoted).** Rolls and requests about Seth sticking a missile up his rear and about Emmett sucking someone's mouth (sexual-bodily, no outcome or a self-answered joke); "Hot"/typos/"Rip"/phone-keyboard complaints; the Jacob-looks-for-Seth chatter beyond what I kept; a maybe-answered "is a guard in the room" roll and Jacob's "walking home" aside; "this was dumb" and pings. The spiders-weakness question went unanswered, so it is cut.

**OOC converted into story.** Jacob's journey post became one Jacob action (I softened the wording slightly). "[Yes]/{yes}" answers are folded into the bot lines (Zander says yes, Master JRM; Sean says yes, Bagelwrecker; etc.). Zander's "Universal Grabs: 0 (1-1=0)" became an aside in Seth's action. "By the way, Emmett is still gone" is a 🐐 line. Jacob's "I'll just wait" has a Jacob action saying he is unaware.

**Moved blocks.** The Jacob-journey block (03:25) now follows the 03:27 "Zander says yes" reply to keep command and reply adjacent. The dog-teleport reply (03:43) is under Zander (he asked it).

**Questions for Trey.**
1. Is "Emmett is still gone" on 8 Jan consistent with the golden wasp arriving on 2 Jan in ep 6? I left both; ep 10 may need to resolve it.
2. Jacob's journey involves the god of self-pleasure; kept lightly. OK?
3. The cow tongue-bathing Seth is kept as one action.
4. Meth is absent from the cell now; do you want a line?

**Proposed title.** "Belly Button Dog". One sentence: Jacob returns from a long journey with immortality and a returned dog, and Seth uses his last universal grab to pull him into the prison cell.

## Ep 8: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 8 (399 lines) is one session, 19-21 Jan 2018 (mostly 12:32-1:10 AM on the 21st), and unlike ep 7 it is mostly real dialogue: Seth, Venus and Zander's guards. Every quote is the player's own; the guard lines were typed by Zander in quotes and are tagged `Guard` / `Second Guard` (nothing on the wiki; names are mine, to separate "Guard" from "Other Guard" in raw). The 20 action lines are mine or converted (roll outcomes, entrances, reactions). Result: 323 lines, 21% action.

**Recap.** Opening 🐐: two centuries after cryo, Seth and Mattias are in the vespoid prison (Jacob in with Seth). Mattias does not fall for the warden. Venus (Mica's new character) lies asleep in a nearby cell; guards bring food; she wakes. Seth asks the guards about Emmett: "Grand Emmett" has been dead about sixty years (his reforms opened the hives to tourists), and a ruler of a smaller vespoid colony with a near-identical name now uses Emmett's old ship. A guard tells Seth the prison is kept the same on purpose; Seth bends the bars and walks out with the guards' blessing. Venus is released (time served for vandalism). Seth and Venus agree to fetch their ships separately and meet again; Venus finds hers.

**Where everyone ends (for ep 9).**
- Seth: out of his cell, in the prison or just outside, hungry for a drink, with no ship (the original Emmett's ship is held by a vespoid ruler named something like "Emmett") and his stuff aboard it.
- Venus: free, walking off to find her own ship (the bot, via Zander, said yes).
- Jacob and Mattias: asleep in the cells (Mattias farther from Seth). Meth is not mentioned.
- Emmett: dead ("Grand Emmett", ~60 years), but a "similar name" ruler exists and Zander's bot roll says "maybe" he is on his homeplanet. I left it.

**Cut for filtering (described, not quoted).** Venus's character sheet (stats, personality, appearance) became one short action; the sheet's backstory about the character being taken by traffickers was dropped, as was her line about sexual acts. Pings, "PER FECT", "one last question", and stray backtick lines from Zander's phone. Non-answered rolls (Seth looks around, harmonica, Matthias wakes up noticing Seth is gone, "does Seth walk to a bar", "will Venus retrieve her ship" with a maybe, and Bagelwrecker's duplicate of the Emmett-homeplanet roll). Seth's "Thanks alot" (sarcasm at a maybe). No slurs or real-world material.

**OOC converted into story.** Self-answers "[yes]/{Yes}/[Yes]" are folded into the bot lines. The "[Yes; Math specifically is farther away...]" became an action. Guard and Second Guard lines gained `> ` and tags. I split "Seth Looter" lines to read as one introduction.

**Moved blocks.** None substantially; the 20 Jan Venus intro is placed at its original time, so Venus is "in a nearby cell" before the Jan 21 wake-up roll. I put the Second Guard unlocking action under Zander's header.

**Questions for Trey.**
1. "Seth Looter" is kept as typed; is it an old alias?
2. "Grand Emmett dead sixty years" plus "a smaller colony's ruler with a similar name uses his ship" conflicts with ep 6's golden wasp (and ep 7's "Emmett is still gone"). Ep 10 should settle that; I left it open.
3. Mattias "is asleep" in a farther cell; Meth is unaccounted for.
4. The 200-year reference ("It's been 200 years") is kept as typed.

**Proposed title.** "Prison Break, Sort Of". One sentence: Venus wakes up in the prison, the guards confirm that Grand Emmett has been dead for sixty years, and Seth simply bends the bars and walks out as they wave goodbye.

## Ep 9: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 9 (229 lines) is one 27 Jan 2018 session (3:39-4:44 PM) plus one 3 Feb roll, about two-thirds rolls and player answers. Every quote is the player's own. Brakia's character appears here: Serpile, persona Kabajhu ("Kaba"), running the tourist help station. I called him Kabajhu/Kaba in narration (the wiki spells it "Kabaju"; the meta persona is "Kabajhu", which I followed); no NPC voice tags were needed because Brakia's header resolves to him. The wiki describes him as a purple Argonian with a robotic right arm, so I used that in one action. 153 lines, 34% action (11 action lines, mine).

**Recap.** Mattias wakes in his cell and screeches for help; Jacob wakes (Seth already gone). Seth goes to the tourist help station (Argonian attendant, Kaba) and asks about Emmett's ship; Kaba demands "identification", Seth guesses "number 1", and it works. The ship belongs to Emmett, is in Park Q two Earth miles away, and is damaged. Kaba goes to fetch tools; Emmett is "near his ship" but not found yet. On 3 Feb, Kaba and the gang board a fueled, fixed ship with the course plotted to Emmett's ship.

**Where everyone ends (for ep 10).**
- Seth, Kaba and "the gang": on a repaired ship en route to Emmett's ship (ep 10's 18 Feb raw has Seth and Mattias both aboard and a roll saying Venus is aboard too; "the ship is not almost there").
- Mattias and Jacob: last seen awake in the prison cell, so the leap to "on the ship" in ep 10 is unbridged; "the gang" in my last action covers it.
- Venus: not on the page this episode (ep 10 puts her aboard).
- Emmett: dead / similar-name ruler, near his ship; not found yet. The "number 1" ID gag is Seth's and works because the facial-ID rule from ep 10's OOC apparently doesn't apply yet.

**Cut for filtering (described, not quoted).** Zander's starmap/cartographer OOC; the "it's three o'clock", car-stuck and "game stinks" table talk; a jab at Maxwell's effort and its roll; a vespoid-guard-ignoring-the-bars roll (maybe), the "look for information" roll (maybe), a floran-attendant roll (maybe); the "Zander 👍", the Gmod-map ping, and "that wasn't a question". No slurs.

**OOC converted into story.** Answers in brackets were folded into the bot lines ("Zander says yes, Master JRM", "Zander says not yet, Brakia"). Mattias's "do I survey my room" roll gets an action. Kaba's descriptions, the terminal accepting "1", and the ending boarding action are mine.

**Moved blocks.** None.

**Questions for Trey.**
1. "Two Earth light-miles" (Seth's joke) kept as light-miles.
2. Who is "the gang" boarding: Seth, Mattias, Jacob, Venus? I left it vague.
3. Kaba's "sleepy purple Argonian" detail comes from the wiki; fine?

**Proposed title.** "Park Q". One sentence: Mattias wakes up in a cell while Seth tracks down Emmett's old ship through an Argonian clerk named Kaba, who looks it up by the ID number 1.

## Ep 10: judgment calls for Trey

**How much is recovered vs invented.** Raw ep 10 (629 lines) is a short 18 Feb 2018 session (12:19 AM to 12:58 AM OOC planning, then 9:13-10:44 PM play) plus two stragglers on 17 Mar. The play is mostly Seth vs. Emmett's reunion. Every in-character quote is the players' own. The 30 action lines and two opening 🐐 lines are mine (roll outcomes, entrances, delivery beats); no dialogue was invented. Result: 466 lines (the old md/ff1/10.md was a byte copy of raw at 629), 26% action.

**Recap.**
- Opening 🐐: it is 2965 GUY, 200 years after the freeze; the new galactic law makes a person's face their ID for everything and bounty hunting illegal.
- Second 🐐: Emmett is a golden wasp ruling the small colony of Emmettalia under that cover name.
- Seth, Matthias and Venus are aboard the repaired ship. Seth and Matthias talk (the teenager planet, "200 years"). They reach Emmett's ship (the city of Georgia visible on his planet).
- Emmett's crew (Heck, Gaston, an unnamed crewman) spot the ship. Seth fires wildly until out of ammo; Emmett steps out, Seth steps out, Emmett shows his face. Seth refuses the handshake. Emmett returns Seth's bag (his ex Ahlyssa is in it).
- Seth doesn't believe him. Emmett: he died and was transferred into a new body made to look like his symbol. Seth demands he punch Math; Emmett refuses and finds Matthias missing from the ship. Seth says he has been frozen 200 years and Emmett might be an impostor. Emmett tells him he's crimeless and forgotten. Seth plans crimes; people begin disassembling Seth's ship.

**Where everyone ends (end of FF1).**
- Seth: standing outside beside Emmett's ship, on Emmett's planet (city of Georgia visible), with Seth's bag now in Emmett's hands (it holds Ahlyssa); gun empty; skeptical that this is Emmett. His ship is being taken apart.
- Emmett: golden wasp (consciousness transferred after his death, per ep 5), standing outside his ship; ruler of Emmettalia. His crew (Heck the zombie, Gaston, a crewman) are around.
- Matthias: missing from the arrival ship as of the last roll. Venus and Jacob: not on the page after the opener rolls (Venus aboard; Jacob never mentioned). Kaba (ep 9) isn't mentioned either.
- Heck: zombie crewman of Emmett's ship; Junnn's character.

**Squaring with earlier episodes.**
- 200 years / 2965 GUY: kept as typed; matches ep 5's retcon and ep 8's "two centuries".
- Emmett's status: the raw's "I did die... transferred my consciousness" matches ep 5's backstory (dies at 142, rebuilt as a golden wasp). Ep 8's "Grand Emmett dead sixty years" is the original death; ep 8's "ruler of a smaller colony with a near-identical name uses his ship" I resolved as Emmett ruling Emmettalia under that cover name (from Zander's OOC "that's his cover name"). The 🐐 line is my inference; flag if wrong. Ep 7's "Emmett is still gone" stands (he wasn't there for Jacob), and the ep 6 golden wasp is now clearly Emmett.
- The ep 9 "number 1" ID gag vs the new facial-ID rule: unchanged; it is just a clerk's terminal (see the cross-episode note).

**Cut for filtering (described, not quoted).**
- The 12:19-12:58 AM design chat (all of it): Seth/Emmett as radicals or double agents, politics and cover-name debate, whether Max keeps playing, character-replacement talk, spelling apologies. The facial-ID rule and bounty-hunting ban survive as one 🐐; Seth's reaction is one action.
- Zander's elvish-year/GUY/Earth-year lore math plus the two number lines (guide §3), and Matthias's depressed line was kept as the reaction to "200 years."
- Rolls with no outcome: feeling something in eyes/stomach, ponder-the-ship (retry), "does Heck..." crude roll, retries on screaming louder/handshake/high-five, "Emmett reveals himself" (maybe), "am I a zombie" and Junnn's pings (including a deleted-role ping).
- One self-harm quip appended to Seth's "time to commit some crimes" (the crimes line is kept, the rest cut).
- Junnn's noise (repeated "im a zombie", stray quote marks): kept only the zombie lines Heck plausibly says; ping spam and a stray backtick from Zander removed.
- ProfessorTree "are you broken?" and Zander's 17 Mar pings.
- A cameo-account name (Silas) typed inside one roll was dropped with the roll.

**OOC converted into story.** The facial-ID rules became the opening 🐐. Emmett's "Hey, Heck..." and the replies from Heck, "Hey, a ship pulled up", and "Fuck!" were typed by Zander in quotes: tagged `Heck` / `Emmett's Crewman`. "FUCKING NORMAL FAGS" became "BINGERS".

**Moved blocks.** None. Four commands sit after the line that prompted them (Zander's 10:12 handshake roll, etc.) only inside their own blocks.

**Questions for Trey.**
1. Seth says "now you are not Emmett because I know Emmett wouldn't punch Math in the face". As typed it contradicts Seth's own test (Emmett refused to punch). I changed "wouldn't" to "would" so the impostor logic works. Revert if the original was a joke.
2. Heck is Junnn's character but Zander voiced "No, sir. Gaston may know..." first. I tagged that line `Heck`. Is Gaston a real in-universe NPC?
3. "My real name isn't Heck. It's BootyDooty." kept as a joke line; cut if you'd rather drop it.
4. Ahlyssa: kept as typed (Seth's ex "who wanted to fuck and kill you"). Okay?
5. Matthias vanishing: the raw never says where he went. I left it as a mystery with no tag.
6. Is the "Emmettalia = the similar-name ruler of ep 8" resolution what you intended?
7. No "gay/homo" insults survived.

**Proposed title.** "Stranger Danger". One sentence: Two hundred years after the freeze, Seth reaches Emmett's ship, empties his gun at a stranger, and refuses to believe the golden wasp in front of him is really his dead friend.

## Cross-episode notes (PM audit)

- **Fixed directly:** "Mattias" to "Matthias" in all narration, commands and 🐐 lines of eps 3-9 (about 170 spots). Quoted dialogue was already clean; no `> ` line had "Mattias". "Math" and the like stay as typed jokes. `md/ff1/ff1.md` (the combined file, not an episode) still has "Mattias" in 4 places; I did not touch it.
- **Kabajhu / Kaba:** used only in ep 9; introduced as Kabajhu then "Kaba". Left as is.
- **Years:** ep 5 retconned to 2965; ep 6 🐐, ep 8 "two centuries" and ep 10 agree. No other four-digit year appears. (Ep 4's "Intergalactic Act 90,198 of 4195" is an in-fiction date only.)
- **Unresolved, bigger than a trivial fix:**
  1. Matthias's ep 3 burial in poop vs ep 4 coma wake-up (flagged in ep 4's section).
  2. Emmett: ep 6 golden wasp arrives, ep 7 "still gone", ep 8 "dead sixty years / similar-name ruler" are only reconciled by the ep 10 🐐 and Emmett's dialogue; ep 7/8 remain as written.
  3. Jacob drops out after ep 8-9 ("the gang"); Meth disappears after ep 6; Kaba never appears in ep 10; Venus appears only via rolls.
  4. Ep 9's ending says Kaba and the gang board a ship to Emmett's ship; ep 10 has only Seth, Matthias and Venus aboard, and Emmett already out of his ship in Park Q (location never restated).
  5. Ep 4 yacht/asteroid geography and the ep 5 "Seth's wife stays on Emmett's ship" never get resolved (she is not in ep 10); Seth's translator is never fixed or broken on the page.
