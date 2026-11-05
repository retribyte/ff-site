# FF4 all episodes: merge-candidate triage (30 s sweep)

Source: `editorial/ff4_merge_candidates.py` (default 30 s / 4 blocks) over `md/ff4/0..23`, 212 hits, each read with 2 blocks of context. Nothing was edited. IDs are the last 6 digits (look up full IDs for `ff4_move_blocks.py`; some suffixes repeat within an episode). `N#k` = episode N, k-th hit in that episode's output. "X > after Y" = move X directly after Y.

Rule used: a hit is a **merge** when the gap block is independent of the author's thought (another scene, a GM aside, an 8ball/`/dmg` for someone else, a different player's unrelated action) and the author's two messages are one continuous thing (a speech, a dictation, an action plus its follow-up line, one character's beat). It is a **leave** when the gap block is the cause of, or a reaction to, the author's first or second message, or when the two messages are different characters voiced by the same player.

## Tier 1: merge (strong)

| Hit | Author's thought | Move (interrupter) |
|---|---|---|
| 3#2 | Zion "Hm." / "Well, stay here…" | 203904 + 683840 (Seth's communicator ringing) > after 150184 |
| 3#3 | Vec as Suchan x2 vs Seth staring at hostages x2 | 919933 > after 455052 |
| 4#4 | Bellow "Truce…" / "I can heal you…" | 158440 + 661649 > after 180190 |
| 6#1 | Bellow "Zach, Terry. Terry, Zach." / "We met at a shop…" | 738789 (Seth grabs child) > after 559225 |
| 6#7 | Bellow reaches for pistol / "As he said, we have business" | 459507 + 903121 > after 221993 |
| 9#1 | Olag "Just know I'm not heading with you" / points into catacombs | 397760 (Seth fedora) > after 712407 |
| 9#2 | Marv looks at Seth / "What's up with you anyhow, Seth?" | 904036 + id-less Dutch line > after 802345 |
| 9#5 | Seth shakes Dutch / "shot for luck?" | 043826 > after 199412 |
| 9#9 | "Get back in there, little buddy" / puts Miny up nose | 102426 > after 038362 |
| 9#11 | Owner "IT'S NEVERENDING SUFFERING!" / tosses vials | 490694 > after 768719 |
| 9#12+13 | Owner monologue (118741 > 583527 > 813312 > 411816) | 525108, 792096 > after 813312 |
| 10#1 | Bellow "Perfect." / "Let's get you back to your head." | 857593 > after 262255 |
| 10#2 | Zion "take off your Republic pin" / "I don't even know where you got that" | 385371 > after 855381 |
| 10#7 | Zion "Mmmfmffmf." / "still pulling" (Dutch rips the helmet *before* "still pulling": out of order) | 012348 > after 864852 (so "Or, that." 915252 follows it) |
| 11#1 | Bellow "No, it's not fine…" / "You see, Zion?…" | 859665 > after 480273 |
| 11#2 | Morra "Here. Let me try something." / pulls out book | 411920 + 128789 > after 539242 |
| 12#7 | Seth "He died valiantly" / whispers to Bee Emmett | 753715 + 167349 + 005632 > after 581874 |
| 12#12+13 | Seth knocks / "open up" / "It's me Seth" (643338 is a reply to 823829) | 825385 + 643338 > after 823829 |
| 12#14 | Seth "We got this." / "Alright Emmett?" | 073822 + 307644 > after 543322 |
| 12#15 | "We're Emmett and Seth…" / "Now let's get out of here." | 908134 > after 344968 |
| 14#2 | Zion "Don't count on it." / peers across the room | 157146 > after 026088 |
| 15#2 | Seth "Janitor…" / "Key Word: Waffle." | 304008 > after 878439 |
| 15#5 | Seth's captain's-log dictation (295248, 759574, 593236, 340419) | 053544 > after 340419 |
| 15#10 | Angela walks up, wags finger / "Coochie Coochie Choo." | 132065 > after 473512 |
| 15#11 | "Dildus is an independent station…" / "Especially with the GU…" / Angela nods | 563360, 585553, 086463, 855838 > after 082625 |
| 15#13 | Dutch outbursts 173268 / 339018 / 939292 | 659530 (`/dmg`) > before 173268 |
| 15#17 | "JANITOR!" / Seth gets on PA / "JANITOR I NEED YOU…" | 068825 > after 063900 |
| 16#4 | Morra "Breakthrough. I've made a bre-" / "Vec, please." | 792400 > after 892083 |
| 16#6 | Shadow "I am the Ultimate Knight!!" / poses | 601492 > after 856248 |
| 16#7 | Seth "Yeah." / "See." | 927508 > after 672286 |
| 16#11 | "I got you, Shadow." / "Crew! Stop!" | 011586 > after 144702 |
| 17#1 | Seth "AHHHH" / "MONSTER!!" | 632916 > after 297224 |
| 17#2 | "A message from Zach got through." / "Somehow." | 330890 > after 986314 |
| 17#4 | Vec "Morra." / "What's wrong with you?" | 030063 + 386179 > after 801227 |
| 17#8 | Vec "Thanks man…" / "This is better than any cig…" | 660394 > after 582096 |
| 18#2 | Seth turns off intercom / gets dressed | 599199 + 435088 + 486195 > after 345610 |
| 18#7 | "Alright, let's go muck up…" / Seth follows Zion | 662943 > after 917261 |
| 18#9 | Zach covers them, shard hits / "Ow!" | 520528 + 296700 + 737680 > after 379580 |
| 18#11 | Vec "ALL I THINK OF IS EAT." / "NOT YOU." | 437649 > after 246848 |
| 18#18+19 | Vec pops off Zach / Vec bubbling; Zion burn mark / "Seth, what the f—" | 058197 > after 479112 |
| 18#21 | "What is there to hear out?" / "It's a threat…" | 866026 > after 271484 |
| 18#22 | "I'm not calling you a liar." / "I'm calling the fungus a liar." | 541771 > after 458691 |
| 18#23+24 | "I won't let them know…" / runs back; opens airlock / "The fungus is gone." | 930908 > after 668863; 290268 + 816327 > after 233704 |
| 19#6 | "This is too strange." / looks through pinhole | 998731 + 619964 + 584640 > after 437673 |
| 20#3 | Silas "I'm so cool." / "And also my dick is cold." | 834917 > after 242699 |
| 20#8 | Seth picks up Morra / "we have quite the journey" | 102474 + 774642 + 626778 > after 649937 |
| 21#4 | Morra "Ow." / "Vec, I appreciate your help…" | 315881 + 516776 + 772096 > after 442644 |

## Tier 2: merge, with a judgment call

The gap block is independent but the two author messages are different characters, or the interrupter is loosely related.

0#2 (Seth/Emmett split by Chomsky yogurt + 8ball: 798244 + id-less > after 547358), 0#3 (Chomsky mustache 716042 > after 370139), 0#8, 2#1 (8ball 269780 > after 340116), 4#2, 4#11, 6#4 (Fungo reaction 857276 belongs before 766348), 6#6, 7#3, 7#5, 7#6, 8#7, 8#9, 9#3, 10#3, 10#4, 12#2, 12#9, 13#1, 14#8, 15#9, 15#16, 16#3, 16#14 (move Zach's two Oblivion actions before Zion's speech; Vec's interruption stays), 18#1, 18#6, 18#15, 18#17, 18#20, 18#25, 19#2, 21#1.

## Leave as is

- **The gap is the cause or reaction** (majority): e.g. 0#5/#7, 4#3/#5/#6/#8/#9/#10, 5#1/#2/#4, 7#1/#2/#4, 8#5, 9#6/#7, 13: none, 15#1/#4, 16#13, 17#3/#5/#6/#7/#9, 18#3/#12/#13/#14, 19#1/#4/#7/#8/#9, 20#4/#5, 21#2/#5/#6, 23#1-4/#8/#9/#11/#14.
- **Same player, different characters** (merging would not form one thought): 8#1-#4/#6, 12#11, 16#5/#8/#9/#12, 23#7/#10/#12/#13.

## Flags

- **Negative offsets** (the later block has the earlier timestamp, so the file was already hand-reordered; stale hits): 8#5, 20#6, 23#2, #4, #6, #7, #10. 21#4 (-30 s) is the same, but still worth the move above.
- **23#5 looks like an import glitch, not a merge:** block 406706 is an empty `Brody used /8ball` header, and its embed text (`<embed> <title>8ball Response…`) is glued onto Zander's block 346079 ("Vec starts to fill the room with a thick, purple mist.").
- **22 Usurper has no hits.** 45 s extras (about 112 more) were not read.
