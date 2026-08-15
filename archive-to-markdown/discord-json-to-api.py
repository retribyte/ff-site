"""Convert a DiscordChatExporter JSON export directly into API-ready episode
JSON — skips the markdown editing stage entirely.

Sibling to md-to-api.py: same meta/<season>.json metadata format and the same
output shape (ready for the /import page or POST /episodes + POST
/episodes/:title/messages), but the source is a raw Discord export .json
file rather than a hand-edited markdown transcript. Classification is a
best-effort automatic pass based on how players format their own messages in
Discord (backtick-wrapped dialogue, *italicized* actions) — it will not be as
clean as a hand-edited transcript. Re-run md-to-api.py's manual pipeline
instead if an episode needs precise QUOTE/ACTION attribution.

Usage:
    python discord-json-to-api.py <season> [path ...]
        batch — converts every export whose channel name matches an episode
        already titled in meta/<season>.json. Each path may be a .json file
        or a directory (its *.json files are included, non-recursive). With
        no paths given, scans the current directory for *.json.

Reads  ./meta/<season>.json              (season metadata: cast, username map, episodes)
       *.json files/directories given on the command line (default: cwd)
Writes ./api/<season>/<episode_number>-<file_name>.json

Classification (applied per line of each Discord message's `content`):
    plain line                          -> OTHER
    @Magic8Ball … / t!… / 8ball …       -> COMMAND
    > spoken line                       -> QUOTE (current character)
    `spoken line` (1-3 backticks)       -> QUOTE (current character)
    *action line* / _action line_       -> ACTION
    `Name`: line                        -> speaker override, sticks for the message
    Name: line                          -> speaker override when Name is in the
                                           cast, or when the rest of the line is
                                           entirely markdown-wrapped (NPC dialogue)
A line can mix spans — `spoken` *acted* `spoken` — and becomes one message per
span, adjacent same-type spans merged. Nested wrappers unwrap (*`text`* and
`*text*` are both QUOTE), **bold**/~~strikethrough~~ are decoration and
stripped, a full "…" wrap around a quote is dropped (the archive stores
dialogue as bare prose), and ```fenced blocks``` become plain OTHER lines.
Messages from a bot author (author.isBot) are always BOT_RESPONSE, split one
per non-empty content line. Embeds (embeds[]) become EMBED messages, one per
embed, shaped {title?, description[], footer?} per the site's embed reader.
RecipientAdd/RecipientRemove system messages are dropped.
"""

import glob
import json
import os
import re
import sys
from datetime import datetime

from persona_timeline import PersonaTimeline

BACKTICK_SPEAKER = re.compile(r"^`([^`]+)`: (.*)$")
SPEAKER_PREFIX = re.compile(r"^([A-Za-z0-9][A-Za-z0-9 .,'\-]{0,29}):\s?(.*)$")
FULL_WRAP = re.compile(r"^(`{1,3}|[*_])(.+)\1$", re.S)
UNDERSCORE_LINE = re.compile(r"^_([^_].*[^_])_$")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
STRIKE = re.compile(r"~~(.+?)~~")
ITALIC_PAIR = re.compile(r"(?<![*\w])\*([^*\s][^*]*?)\*(?![*\w])")
CODE_PAIR = re.compile(r"`{1,3}([^`]+)`{1,3}")
FENCE = re.compile(r"```(?:([A-Za-z0-9]+)\n)?(.*?)```", re.S)
TICK_RUN = re.compile(r"`{1,2}")
QUOTE_WRAPS = (('"', '"'), ("“", "”"))

DEFAULT_INPUT_DIR = os.getcwd()


def load_meta(season):
    path = os.path.join(os.path.dirname(__file__), "meta", f"{season}.json")
    if not os.path.exists(path):
        sys.exit(f"No metadata file at {path} — create it first (see meta/ff2.json).")
    with open(path, encoding="utf-8") as f:
        meta = json.load(f)
    for key in ("seasonTitle", "episodes"):
        if key not in meta:
            sys.exit(f"{path} is missing required key '{key}'.")
    return meta


def cast_character(meta, player, episode_number):
    """The character a player was playing as of a given episode number."""
    spans = meta.get("cast", {}).get(player)
    if not spans:
        return None
    best = None
    for from_ep, name in sorted(spans.items(), key=lambda kv: int(kv[0])):
        if int(from_ep) <= int(episode_number):
            best = name
    return best or spans[min(spans, key=int)]


def parse_timestamp(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw).isoformat()
    except ValueError:
        return None


# One raw line's strikethrough is diegetic -- an in-fiction note reading
# "...IN YOUR EYES, ~~SON.~~ ZION." where a character physically scratched
# out a word, confirmed by the DM's own following action line ("Son is
# scratched out and replaced with 'Zion'."). Every other ~~strike~~ in the
# FF4 archive is a genuine Discord self-edit (joke aside or word swap) and
# should be discarded outright; this one line is exempted pending a manual
# pass to render it as an actual strikethrough instead of deleting it.
DIEGETIC_STRIKE_EXEMPT = "I SAW GLEAM"

# A handful of lines were *entirely* struck through except for a leading
# `Name:` speaker label (e.g. 'John Smith: ~~`"I love my son Hunter!"`~~') --
# once the struck quote is removed nothing meaningful is left, but the bare
# "Name:" survives as inert clutter since it isn't itself markdown. Drop
# these known instances outright rather than write a general "bare label"
# heuristic that would also catch legitimate short lines like "kills:".
DROP_LINES_CONTAINING = (
    "I love my son Hunter",
    "she usually responds to those",
    "penis explosion chamber",
    "Duplication is just a cheap tactic",
)

# A `Name:`/`` `Name`: `` override is trusted literally, so a player's own
# shorthand for their character (typed the same way every FF4 player
# eventually types their PC's surname out) fragments them across two DB
# Character rows: the short form, and the full cast-list name. Canonicalize
# to the full name post-classification so both spellings land on one record.
# "Dread" is handled separately below -- it doesn't collapse into Sanya
# Dreadflower until after they merge partway through the story.
NAME_ALIASES = {
    "Emmett": "Emmett Tawfeek",
    "Seth": "Seth Im'Kin'ki",
    "Chomsky": "Victor Chomsky",
    "Dutch": "Dutch Elkins",
    "Dutchina": "Dutch Elkins",
    "Bellow": "Bellow Brightlight",
    "Llafay": "Llafay Terrels",
    "Llawdon": "Llawdon Brandanowitz",
    "Zion": "Zion Daybreaker",
    "Sanya": "Sanya Dreadflower",
    # "Fungus" (ep2-10) is Vec's pre-self-naming identity, tracked as a
    # persona now (meta/ff4.json's personaTimeline), not a cast default --
    # cast.Zander already resolves straight to "Vec" from ep2 on. This entry
    # is still needed for the rare stray inline override (one line in
    # Blackjack: "Fungus: `I think I just him splat.`") that names it
    # literally rather than inheriting the ambient default.
    "Fungus": "Vec",
    # Sanya spends most of the Finale undercover, going by "Dread" or the
    # bare initial "S" until her reveal (`S: Call me Dreadflower...`).
    # Confirmed the initial "S" doesn't appear as a speaker override for any
    # other player anywhere in FF4 -- safe to alias globally rather than
    # scoping to the Finale.
    "S": "Sanya Dreadflower",
}

# Sanya and the entity Dread were separate characters through FF2/FF3 and
# merged into one between campaigns. Episode 0 (the "FF4 Test One-shot") is
# chronologically FF3-era, so a `Dread:` line there must NOT be folded into
# Sanya Dreadflower -- everywhere else in FF4 (post-merge) it should be.
DREAD_MERGE_EPISODE = 1

# A handful of Finale lines narrate Sanya/Dread's climactic scene with no
# `Name:` marker at all (Brody dropped the override partway through a run of
# otherwise-tagged lines), so they silently defaulted to his FF4 cast PC,
# Morra -- a different character. No text pattern distinguishes these from
# genuine Morra lines; matched by known content instead.
FORCE_CHARACTER_CONTAINING = (
    ("First, you may call me Dread", "Sanya Dreadflower"),
    ("a spear finds it's way into the raven Leader's back", "Sanya Dreadflower"),
    ("Call me Dreadflower. If you survive", "Sanya Dreadflower"),
    ("She takes her spear, and readies herself", "Sanya Dreadflower"),
    ("Sanya bends down and grabs the bloody stump", "Sanya Dreadflower"),
    ("places her spear at the middle of his upper arm", "Sanya Dreadflower"),
    ("and with that, Sanya disappears", "Sanya Dreadflower"),
    ("SANYA JOINS THE BATTLE", "Sanya Dreadflower"),
    ("Zach sees a squatting figure in his blurring vision", "Sanya Dreadflower"),
    ("The new wound holds not blood, or any signs of flesh", "Sanya Dreadflower"),
    ("A silversteel sword, sits where she stood", "Sanya Dreadflower"),
    # Pre-debut lines: Sanya/Dread is present and narrating well before her
    # formal introduction ("First, you may call me Dread" above), still with
    # no `Name:` marker, so these also silently defaulted to Morra. Confirmed
    # by context, not text pattern -- see
    # REVIEW-finale-sanya-morra-attribution.md Group A for the corroborating
    # surrounding lines (in particular Jonas's Chomsky answering "Ah, Sanya,
    # you've arrived" two lines after "Who said I wasn't helping?").
    ("A light, distant sense of fear begins to seep into the minds of Zion and Zach", "Sanya Dreadflower"),
    ("Im here... to watch that.", "Sanya Dreadflower"),
    ("Thanks for the front row seat Angel. I hope you enjoy the show", "Sanya Dreadflower"),
    ("So, arsonist, what's your plan?", "Sanya Dreadflower"),
    ("A voice comes from his ear, not his mind", "Sanya Dreadflower"),
    ("Who said I wasn't helping?", "Sanya Dreadflower"),
    # Jonas plays both Bellow Brightlight (his FF4 PC) and Victor Chomsky (a
    # returning FF2 cameo, same pattern as Brody/Sanya) in the Finale. He
    # tags some Chomsky lines explicitly (`Chomsky: ...`, already handled by
    # NAME_ALIASES) but narrates others in third person with no marker at
    # all, so they silently defaulted to his FF4 PC. Matched wherever
    # "Chomsky" is the line's own grammatical subject -- a reliable signal
    # this is his scene, not Bellow's.
    ("Chomsky leans into his comms and attempts to contact Llashii", "Victor Chomsky"),
    ("Come in, Chomsky's air fleet to LR. Do you copy?", "Victor Chomsky"),
    ("Chomsky hangs up and walks down towards the weapons area", "Victor Chomsky"),
    ("Chomsky is on his way!", "Victor Chomsky"),
    ("Chomsky strides into the room from the inside door", "Victor Chomsky"),
    ("Relax everybody, I'm here.", "Victor Chomsky"),
    ("Chomsky stands confidently", "Victor Chomsky"),
    ("Chomsky stumbles, but stands firm in an instant", "Victor Chomsky"),
    ("Chomsky looks over at Zion", "Victor Chomsky"),
    ("Can you believe this guy?", "Victor Chomsky"),
    ("Chomsky smirks, appreciating the gall.", "Victor Chomsky"),
    ("Too bad I can't immolate your face directly", "Victor Chomsky"),
    ("Chomsky smirks confidently again", "Victor Chomsky"),
    ("Chomsky is starting to bleed, but that won't stop him.", "Victor Chomsky"),
    ("Chomsky lets out a last chuckle, and falls over.", "Victor Chomsky"),
    ("Chomsky is still chuckling to himself, bleary and delirious.", "Victor Chomsky"),
    ("Chomsky stumbles and sways, and eventually, covered in blood, stands. back. up.", "Victor Chomsky"),
    ("It doesn't matter....How mercilessly you beat me...I will still...Fight you...TO THE END!", "Victor Chomsky"),
)

# Continuing the Finale Bellow/Chomsky banter above: once the two are
# fighting side by side there's a stretch of unmarked back-and-forth with no
# textual signal at all to disambiguate by (unlike the "Chomsky is the
# grammatical subject" lines above) -- confirmed line by line. Several are
# too short/generic ("Oh.", "Yes!", "Try it.") to safely match as a global
# substring like FORCE_CHARACTER_CONTAINING, so this is scoped to the
# Finale + Jonas specifically rather than checked everywhere.
FINALE_EPISODE_NUMBER = 23
FINALE_BANTER_CHOMSKY_LINES = (
    "the ravens my old ENEMIES",
    "No more games, no more chasing",
    "I'll be the one doing the slaughtering",
    "Oh.",
    "no biggie. I got other tricks",
    "Shut up, fear flower.",
    "Too bad I can't fight you after you die today",
    "Woah!",
    "Nice shot, little man!",
    "Try it.",
    "That all you got?",
    "How have these guys not beaten you yet?",
    "Cheap tricks? Your armour is thicker than mine",
    "ayo",
    "Showoff.",
    "I've still got tricks too",
    "the 4 quick shots land perfectly",
    "why was it so easy to take down",
    "You...you little....idiot, hahaHAHAHA!",
    "Yes!",
    "Nice one...Seth...! Heh, always a...surprise.",
    "wait what",
    "You...Oh, god, you didn't...",
    "I hate gods...",
    "You disgust me.",
    "Slightly joking, but, not really all that much lol",
    "Your crew are cowards. Down goes the leader",
    "HEh...heEHheHh...",
    "Don't...urg, care...",
    "Fight on, verinian!",
    "A warrior who dies in battle dies a hero!",
)

# Hunt520 has three characters, only one of which (Zacharias Smith, "Zach")
# is registered in meta/ff4.json's cast list as his ambient default. Terry
# is also registered there (his episode-3 debut, before Zach's cast entry
# starts at episode 4 -- confirmed: the anonymous elf pharmacist NPC who
# gives Bellow his number in "Ambush" is Terry). The third, Jack, never gets
# a `Name:` marker of his own (narrated in third person, same shape as the
# Sanya/Chomsky pattern above), so he needs scoped, content-matched
# treatment instead.

# "Sir, This Is A Chilzor's": Zach explicitly leaves the scene ("Zach walks
# back to the ship"), and a second character, Terry, sits down with Bellow
# in his place for an extended conversation -- confirmed by Jonas naming her
# directly ("You might want to leave now, Terry.") and Trey's narration
# ("Terry kisses Bellow on the mouth..."). Most of her lines carry no
# `Name:` marker and several ("Hey there stranger.", "May I sit?", "Sorry
# can't help myself!") are too generic to match anywhere but this one scene.
CHILZORS_EPISODE_NUMBER = 15
TERRY_CHILZORS_LINES = (
    "Hey there stranger.",
    "Terry is standing there",
    "I'm a traveling doctor that's why.",
    "May I sit?",
    "Terry sits",
    "Oh? Isn't that the crew that you're apart of for that 'secret mission?",
    "Terry looks over",
    "Looks... interesting, wait isn't someone missing? Where's... Zach? That's his name right?",
    "Terry chuckles",
    "I'm sure you have your work cut out for you then.",
    "Terry starts doing origami with a napkin",
    "I think I'll leave, don't really like conflict, see you later!",
    "Terry walks away, not before blowing kiss goodbye",
    "Sorry can't help myself!",
)

# Jack Madison, Zach's fiance -- introduced as a texting-only presence
# before appearing in person from "Don't Weld Yourself" onward, same
# secondary-PC pattern as Sanya/Chomsky above. Two mechanisms: "Text
# (Message) from Jack" narration headers (and the quote immediately
# following, in the same raw message) are Jack's own words arriving by
# phone; lines where "Jack" is the line's own grammatical subject work the
# same way the Chomsky rule above does. Confirmed: the three "Message from
# Jack"-headed texts in "Don't Weld Yourself" are actually Zach's own
# words, relayed via Jack's phone while Zach is separated from the party
# and his own phone is in Bellow's possession -- left on the ambient
# default rather than matched to Jack at all. The "Text (Message) from
# Jack" header text is otherwise identical between the confirmed-good
# "Crashlanded" texts and those three, so the headers are scoped to
# "Crashlanded" specifically rather than matched by text alone.
CRASHLANDED_EPISODE_NUMBER = 16
JACK_TEXT_HEADER_LINES = (
    "Text Message from Jack",
    "Text from Jack",
)

# The rest of "Don't Weld Yourself"'s Jack lines, confirmed line by line
# (REVIEW-hunt520-terry-zach-jack.md) rather than guessed -- several are too
# short/generic ("Oh?", "Well then...") to safely match anywhere else in
# the corpus, so scoped to this episode+player like the Finale banter table.
DONT_WELD_YOURSELF_EPISODE_NUMBER = 17
DONT_WELD_YOURSELF_JACK_LINES = (
    "Oh?",
    "Should I be here?",
    "I'm comfortable though",
    "So... mission?",
    "Well then...",
    "I can do that!",
)

JACK_LINES = (
    "Hey! How's that mission going?.... I miss you",
    "You must be busy... but don't worry, I'm always thinking about you!",
    "Sent a picture",
    "Crewmates am I right?",
    "hahah, really cool!",
    "I miss you... call me soon?",
    "Jack gets a phonecall",
    "Depends... who's asking?",
    "What happened?",
    "Jack's eyes widen",
    "Jack's too busy crying",
    "Jack said something that made him blush",
    "Jack chuckles",
    "If that's what I'm known as then yes... it's nice to finally meet you though, Jack Madison by the way.",
    "Jack stands in front of Zach, with Zach hugging him from behind",
    "Jack is also confused, but he knows that Zach is leaving soon",
    "Zach talked a lot about you guys.",
    "Yeah... well Zach is also just shy like that...",
    "Jack is ready... he knows this will be tough",
    "Jack is having a hard time aiming",
    "Jack is struggling a bit",
    "Jack manages to get on board the mother ship",
    "Jack rushes in",
    "WHERE THE FUCK IS MY FUTURE HUSBAND",
    "Jack notices the arm gone",
    "Jack stumbles but still smiles with tears",
    "Jack is following the commander",
)

# Joke lines riffing on "what if Morra showed up in FF2" -- not real
# dialogue, so they shouldn't be credited as anyone's canonical quote.
# Matched on text OR the (equally joking) speaker label itself, since
# "Morra in FF2: `Help`" carries the joke in the name, not the one-word text.
DROP_CHARACTER_CONTAINING = (
    "Emmett, what is that.",
)
DROP_CHARACTER_NAMES = (
    "Morra in FF2",
)

# Trey and Zander voice the Ravens (an antagonist faction) entirely through
# colored code-fence formatting -- never `Name`: or `"quoted"` text -- since
# that's the only way Discord lets you color a line. Each fence's leading
# character is the faction member speaking, consistently for the whole
# fenced block (verified: zero mixed-prefix blocks in the source).
# Trey always voices the "real" member. Zander's blocks in the same style
# are Vec speaking through a body it currently possesses (see the FF4
# Vec-hosts chronology) -- but only for Marv and Sascha, the two members
# Vec is ever confirmed to host; Odran and the Ravens Leader are never Vec.
RAVENS_PREFIXES = {"+": "Marv", "[": "Sascha", "-": "Odran", ">": "Ravens Leader"}
VEC_HOSTED_RAVENS_PREFIXES = {"+", "["}


def is_recap_fence(body):
    """The "Last episode..." / "In the ending of the last story..." recap
    blocks reuse the same ini/diff/md coloring for narration, not dialogue --
    exclude them from Ravens-member classification."""
    stripped = body.strip()
    return (
        stripped.startswith("Last episode")
        or stripped.startswith("In the ending of the last story")
        or "HORIZONERS" in stripped[:40]
    )


def strip_decoration(text):
    """**bold** is decoration at any nesting level -- drop the markers, keep
    the text. ~~strikethrough~~ marks a self-edit (a discarded joke aside or
    a word the player swapped out) -- drop the markers AND the struck text;
    a line that's nothing but a strike collapses to empty and is dropped by
    the empty-line check like any other blank line."""
    if DIEGETIC_STRIKE_EXEMPT not in text:
        text = STRIKE.sub("", text)
    text = BOLD.sub(r"\1", text)
    return text


def clean_inline(text):
    """Residual markers inside an already-classified span: *emphasis* pairs
    and `code` quoting mid-text, doubled spaces left by span removal."""
    text = ITALIC_PAIR.sub(r"\1", text)
    text = CODE_PAIR.sub(r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def unwrap_quotes(text):
    """A quote fully wrapped in "…" (straight or curly) sheds the marks —
    the hand-edited archive stores dialogue as bare prose."""
    for open_q, close_q in QUOTE_WRAPS:
        if (len(text) > 1 and text[0] == open_q and text[-1] == close_q
                and open_q not in text[1:-1] and close_q not in text[1:-1]):
            return text[1:-1].strip()
    return text


def tokenize_spans(line):
    """Split a line into (delim, text) segments: delim '`' or '*' for a
    wrapped span (runs of 1-3 delimiter chars, longest match first), '' for
    plain text between spans."""
    segments = []
    plain_start = 0
    i = 0
    n = len(line)
    while i < n:
        ch = line[i]
        if ch in "`*":
            run = 1
            while run < 3 and i + run < n and line[i + run] == ch:
                run += 1
            for r in range(run, 0, -1):
                close = line.find(ch * r, i + r)
                if close != -1 and line[i + r:close].strip():
                    if line[plain_start:i].strip():
                        segments.append(("", line[plain_start:i].strip()))
                    segments.append((ch, line[i + r:close].strip()))
                    plain_start = i = close + r
                    break
            else:
                i += 1
            continue
        i += 1
    if line[plain_start:].strip():
        segments.append(("", line[plain_start:].strip()))
    return segments


def classify_span(delim, text):
    """A wrapped span -> (type, text). Nested full wraps peel off, and any
    backtick layer makes the span dialogue: *`I see.`* and `*text*` are both
    QUOTE, a plain *…* is ACTION."""
    is_quote = delim == "`"
    while True:
        match = FULL_WRAP.match(text)
        if not match:
            break
        if "`" in match.group(1):
            is_quote = True
        text = match.group(2).strip()
    if is_quote:
        return "QUOTE", unwrap_quotes(clean_inline(text))
    return "ACTION", clean_inline(text)


def is_command(line):
    return "@Magic" in line or line.startswith("t!") or line.lower().startswith("8ball")


def strip_adjacent_quote(text):
    """A straight/curly double-quote sitting directly against a markdown
    delimiter -- `Name: "`quote`"` style -- isn't wrapped content, it's a
    stray quote mark the player added outside the backticks. Strip one from
    each end (independently) so it doesn't defeat the "is the rest of this
    line fully markdown-wrapped" check that lets a `Name:` override fire."""
    quotes = ('"', "“", "”")
    if len(text) > 1 and text[0] in quotes and text[1] in "`*":
        text = text[1:]
    if len(text) > 1 and text[-1] in quotes and text[-2] in "`*":
        text = text[:-1]
    return text


def classify_line(line, character, cast_names, quote_ctx=False):
    """One line of Discord message content -> (messages, character), where
    messages is a list of (type, text, character). A speaker override
    (`Name`:, a bare Name: for a known cast character, or any Name: whose
    remainder is entirely markdown-wrapped) reattributes the line and sticks
    for the rest of the message. Mixed lines split one message per span."""
    if any(s in line for s in DROP_LINES_CONTAINING):
        return [], character

    line = strip_decoration(line).strip()
    if not line:
        return [], character

    if line.startswith("> "):
        quote_ctx = True
        line = line[2:].strip()

    match = BACKTICK_SPEAKER.match(line)
    if match:
        character = match.group(1).split(",")[0].strip()
        line = match.group(2).strip()
        quote_ctx = True
    else:
        match = SPEAKER_PREFIX.match(line)
        if match:
            rest = match.group(2).strip()
            if match.group(1) in cast_names:
                character = match.group(1)
                line = rest
                quote_ctx = True
            else:
                stripped_rest = strip_adjacent_quote(rest)
                rest_spans = tokenize_spans(stripped_rest)
                all_wrapped = bool(rest_spans) and all(delim for delim, _ in rest_spans)
                unclosed_quote = (stripped_rest.startswith("`")
                                  and not any(delim for delim, _ in rest_spans))
                if all_wrapped or unclosed_quote:
                    character = match.group(1).split(",")[0].strip()
                    line = stripped_rest
                    quote_ctx = True

    underscore = UNDERSCORE_LINE.match(line)
    if underscore:
        line = f"*{underscore.group(1)}*"

    segments = tokenize_spans(line)
    if not any(delim for delim, _ in segments):
        # no closed markdown spans anywhere in the line
        if line.startswith("`"):
            # unclosed opening backtick — the player forgot to end their dialogue
            # (rstrip * catches the odd `quote* typo that closes with the wrong char)
            text = unwrap_quotes(clean_inline(line.strip("`").rstrip("*")))
            return ([("QUOTE", text, character)] if text else []), character
        text = clean_inline(line.rstrip("`"))
        if not text:
            return [], character
        if quote_ctx:
            return [("QUOTE", unwrap_quotes(text), character)], character
        if is_command(text):
            return [("COMMAND", text, character)], character
        return [("OTHER", text, character)], character

    out = []
    for idx, (delim, text) in enumerate(segments):
        if not delim:
            # A `Name:` override embedded mid-line (e.g. after a leading
            # *action* clause typed in the same message) never reaches the
            # whole-line SPEAKER_PREFIX check above, since that's anchored
            # to the start of the line. tokenize_spans already isolated it
            # as its own bare segment sitting right before a wrapped span
            # -- the same "remainder is markdown-wrapped" signal the
            # line-start check uses, just split across segments instead of
            # captured in one regex group. Retarget `character` for the
            # rest of the line and drop the tag itself, same as the
            # line-start override does with its own prefix.
            prefix_match = SPEAKER_PREFIX.match(text)
            next_is_wrapped = idx + 1 < len(segments) and segments[idx + 1][0]
            if prefix_match and not prefix_match.group(2).strip() and next_is_wrapped:
                character = prefix_match.group(1).split(",")[0].strip()
                quote_ctx = True
                continue
        if delim:
            msg_type, text = classify_span(delim, text)
        else:
            text = clean_inline(text.strip("`"))
            msg_type = "QUOTE" if quote_ctx else "OTHER"
            if msg_type == "QUOTE":
                text = unwrap_quotes(text)
        if not text:
            continue
        if out and out[-1][0] == msg_type:
            out[-1] = (msg_type, f"{out[-1][1]} {text}", character)
        else:
            out.append((msg_type, text, character))
    return out, character


def content_chunks(content):
    """Split message content into ('text', str) and ('fence', lang, str)
    chunks — ```fenced blocks``` are lifted out before line classification."""
    chunks = []
    pos = 0
    for match in FENCE.finditer(content):
        before = content[pos:match.start()]
        if before.strip():
            chunks.append(("text", before))
        chunks.append(("fence", match.group(1) or "", match.group(2)))
        pos = match.end()
    rest = content[pos:]
    if rest.strip():
        chunks.append(("text", rest))
    return chunks


def split_multiline_spans(text):
    """An inline `code span` that crosses newlines becomes one wrapped span
    per line, so the per-line classifier sees each line as dialogue.

    Ticks are paired strictly left-to-right (1st opens/2nd closes, 3rd
    opens/4th closes, ...) so a closing tick that already completed one
    line's self-contained span is never re-examined as the opener of a new
    span reaching into an unrelated line further down. A regex `.sub()`
    can't guarantee that -- `re.sub` restarts its search from the *end* of
    the previous match, but nothing stops the pattern from matching
    *starting at* a tick that a previous match already consumed as its
    close, which is exactly what let `Squina: `"..."`\\nEmmett: `"..."``
    (two complete, independent single-line spans) get mispaired as one
    fake span reaching from the first line's closing tick to the second
    line's opening tick, stranding the second line's own quote unwrapped
    and unattributed."""
    ticks = list(TICK_RUN.finditer(text))
    out = []
    pos = 0
    i = 0
    while i < len(ticks):
        open_m = ticks[i]
        close_j = next((j for j in range(i + 1, len(ticks)) if ticks[j].group() == open_m.group()), None)
        if close_j is None:
            i += 1
            continue
        close_m = ticks[close_j]
        span_text = text[open_m.end():close_m.start()]
        if "\n" in span_text:
            out.append(text[pos:open_m.start()])
            tick = open_m.group()
            parts = (p.strip() for p in span_text.split("\n"))
            out.append("\n".join(f"{tick}{p}{tick}" if p else "" for p in parts))
            pos = close_m.end()
        # Advance past this pair either way -- close_m must never be
        # reconsidered as a fresh opener, which is the mispairing bug above.
        i = close_j + 1
    out.append(text[pos:])
    return "".join(out)


def embed_to_json(embed):
    """A Discord embed -> {title?, description[], footer?}, the shape the
    site's transcript reader expects for EMBED message text."""
    out = {}
    if embed.get("title"):
        out["title"] = embed["title"]

    lines = [line for line in (embed.get("description") or "").split("\n") if line.strip()]
    for field in embed.get("fields") or []:
        name = (field.get("name") or "").strip()
        value = (field.get("value") or "").strip()
        if value:
            lines.append(f"{name}: {value}" if name else value)
    if lines:
        out["description"] = lines

    footer = embed.get("footer") or {}
    if footer.get("text"):
        out["footer"] = footer["text"]
    return out


def convert_message(msg, meta, episode_number, usernames, bots, cast_names, persona_timeline):
    """One Discord export message -> a list of API messages (zero, one, or
    several — a multi-line message, a mixed dialogue/action line, or one with
    both text and an embed can expand to more than one)."""
    if msg.get("type") in ("RecipientAdd", "RecipientRemove"):
        return []

    author = msg.get("author") or {}
    display = author.get("nickname") or author.get("name") or "Unknown"
    player = usernames.get(display, display)
    timestamp = parse_timestamp(msg.get("timestamp"))
    is_bot = bool(author.get("isBot")) or player in bots

    out = []
    character = cast_character(meta, player, episode_number)

    def emit_line(msg_type, text, line_character, persona_override=None):
        if any(s in text for s in DROP_CHARACTER_CONTAINING) or line_character in DROP_CHARACTER_NAMES:
            line_character = None
        for needle, forced in FORCE_CHARACTER_CONTAINING:
            if needle in text:
                line_character = forced
                break
        if (player == "Jonas" and episode_number == FINALE_EPISODE_NUMBER
                and any(s in text for s in FINALE_BANTER_CHOMSKY_LINES)):
            line_character = "Victor Chomsky"
        if player == "Hunt520":
            if (episode_number == CHILZORS_EPISODE_NUMBER
                    and any(s in text for s in TERRY_CHILZORS_LINES)):
                line_character = "Terry"
            elif (episode_number == CRASHLANDED_EPISODE_NUMBER
                    and any(s in text for s in JACK_TEXT_HEADER_LINES)):
                line_character = "Jack Madison"
            elif (episode_number == DONT_WELD_YOURSELF_EPISODE_NUMBER
                    and any(s in text for s in DONT_WELD_YOURSELF_JACK_LINES)):
                line_character = "Jack Madison"
            elif any(s in text for s in JACK_LINES):
                line_character = "Jack Madison"
        if line_character == "Dread" and episode_number >= DREAD_MERGE_EPISODE:
            line_character = "Sanya Dreadflower"
        line_character = NAME_ALIASES.get(line_character, line_character)
        # persona_override (e.g. the Ravens-fence prefix, which names the
        # persona directly) always wins over the timeline lookup; otherwise
        # ask the timeline what's active for this character right now. Must
        # run before the OTHER/COMMAND blanking below, since resolve()
        # advances timeline state chronologically and needs to see every
        # line addressed to this character, not just the ones that end up
        # carrying an attribution.
        line_persona = (
            persona_override if persona_override is not None
            else persona_timeline.resolve(line_character, text)
        )
        # FR-MSG-4: a quote needs a speaker
        if msg_type == "QUOTE" and not line_character:
            msg_type = "OTHER"
        # OTHER/COMMAND come from lines with no markdown at all -- table talk,
        # OOC asides, bot commands. They aren't performed as a character, so
        # don't let them carry the ambient default PC as a tagged speaker.
        if msg_type in ("OTHER", "COMMAND"):
            line_character = None
            line_persona = None
        out.append({
            "player": player,
            "character": line_character,
            "persona": line_persona,
            "timestamp": timestamp,
            "type": msg_type,
            "text": text,
        })

    content = (msg.get("content") or "").strip()
    for chunk in content_chunks(content) if content else []:
        if chunk[0] == "fence":
            _, lang, body = chunk
            if not is_bot and lang in ("diff", "ini", "md") and not is_recap_fence(body):
                for line in body.split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    prefix = line[0] if line[0] in RAVENS_PREFIXES else None
                    # ">" is only a Ravens Leader color-marker in `md` fences
                    # (Discord blockquote); in other langs it isn't part of
                    # this convention at all.
                    if prefix == ">" and lang != "md":
                        prefix = None
                    if prefix:
                        text = line[1:].strip()
                        # ~1 in 4 lines close with the same marker char too
                        # (diff/ini coloring is line-based, so it's purely
                        # decorative symmetry, not content) -- drop it.
                        if len(text) > 1 and text[-1] == prefix:
                            text = text[:-1].strip()
                        line_persona_override = None
                        if player == "Trey":
                            line_character = RAVENS_PREFIXES[prefix]
                        elif player == "Zander" and prefix in VEC_HOSTED_RAVENS_PREFIXES:
                            # The prefix names the persona directly (Vec
                            # speaking through Marv's or Sascha's body) --
                            # stronger and more precise than a personaTimeline
                            # episode/anchor lookup, so it wins outright.
                            line_character = "Vec"
                            line_persona_override = RAVENS_PREFIXES[prefix]
                        else:
                            # Anomaly: this player/prefix combination isn't in
                            # the confirmed Vec-hosts chronology -- don't guess.
                            line_character = None
                        emit_line("QUOTE", text, line_character, persona_override=line_persona_override)
                    else:
                        emit_line("OTHER", line, character)
                continue
            if lang == "ini":
                # ini highlighting is a Discord color hack — brackets are markup
                body = body.replace("[", "").replace("]", "")
            for line in body.split("\n"):
                line = line.strip()
                if line:
                    emit_line("BOT_RESPONSE" if is_bot else "OTHER", line, character)
            continue
        for line in split_multiline_spans(chunk[1]).split("\n"):
            line = line.strip()
            if not line:
                continue
            if is_bot:
                emit_line("BOT_RESPONSE", clean_inline(strip_decoration(line)), character)
                continue
            classified, character = classify_line(line, character, cast_names)
            for msg_type, text, line_character in classified:
                emit_line(msg_type, text, line_character)

    for embed in msg.get("embeds") or []:
        embed_json = embed_to_json(embed)
        if not embed_json:
            continue
        out.append({
            "player": player,
            "character": None,
            "persona": None,
            "timestamp": timestamp,
            "type": "EMBED",
            "text": json.dumps(embed_json, ensure_ascii=False),
        })

    return out


def convert_file(json_file, meta, episode):
    with open(json_file, encoding="utf-8") as f:
        export = json.load(f)

    usernames = meta.get("usernames", {})
    bots = set(meta.get("bots", []))
    cast_names = {name for spans in meta.get("cast", {}).values() for name in spans.values()}
    episode_number = episode["episode_number"]
    persona_timeline = PersonaTimeline(meta, episode_number)

    messages = []
    played_date = None
    for msg in export.get("messages", []):
        for out_msg in convert_message(msg, meta, episode_number, usernames, bots, cast_names, persona_timeline):
            played_date = played_date or out_msg["timestamp"]
            messages.append(out_msg)

    return {
        "seasonTitle": meta["seasonTitle"],
        "episode": {
            "title": episode["title"],
            "episode_no": int(episode_number),
            "summary": episode.get("short_desc") or None,
            "playedDate": played_date,
        },
        "messages": messages,
    }


def channel_file_name(channel_name):
    """"Final Frontier 4 Episode 10" -> "Episode 10" — strips the season/
    campaign prefix so meta file_name entries stay short and typeable."""
    return re.sub(r"^Final Frontier \d+\s+", "", channel_name).strip()


def find_episode(meta, channel_name):
    base = channel_file_name(channel_name)
    return next((ep for ep in meta["episodes"] if ep["file_name"] == base), None)


def emit(json_file, meta, season, episode):
    base = os.path.dirname(__file__) or "."
    out_dir = f"{base}/api/{season}"
    os.makedirs(out_dir, exist_ok=True)

    payload = convert_file(json_file, meta, episode)
    slug = re.sub(r"[!?&'@#$%^*\(\)]", "", episode["title"].lower())
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("-")
    out_file = f"{out_dir}/{episode['episode_number']}_{slug}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=4, ensure_ascii=False)

    types = {}
    for msg in payload["messages"]:
        types[msg["type"]] = types.get(msg["type"], 0) + 1
    summary = ", ".join(f"{count} {name}" for name, count in sorted(types.items()))
    print(f"{json_file} -> {out_file} ({len(payload['messages'])} messages: {summary})")
    return out_file


def collect_json_files(paths):
    """Expand command-line arguments (files and/or directories) into a sorted
    list of concrete .json file paths. Directories contribute their *.json
    files (non-recursive); bare files are taken as-is."""
    if not paths:
        return sorted(glob.glob(os.path.join(DEFAULT_INPUT_DIR, "*.json")))
    collected = []
    for path in paths:
        if os.path.isdir(path):
            collected.extend(sorted(glob.glob(os.path.join(path, "*.json"))))
        else:
            collected.append(path)
    return collected


def batch(season, files):
    meta = load_meta(season)

    json_files = collect_json_files(files)
    if not json_files:
        where = ", ".join(files) if files else DEFAULT_INPUT_DIR
        sys.exit(f"No JSON files found in {where}.")

    for json_file in json_files:
        with open(json_file, encoding="utf-8") as f:
            channel_name = json.load(f).get("channel", {}).get("name", "")
        episode = find_episode(meta, channel_name)
        if episode is None:
            print(f"skip {json_file}: no episode with file_name '{channel_file_name(channel_name)}' in meta/{season}.json")
            continue
        if not episode.get("title"):
            print(f"skip {json_file}: episode '{channel_file_name(channel_name)}' has no title yet — fill it in meta/{season}.json")
            continue
        emit(json_file, meta, season, episode)


def main():
    if sys.argv[1:] and sys.argv[1] in ("-h", "--help"):
        sys.exit(__doc__.strip())
    if not sys.argv[2:] and not sys.argv[1:]:
        sys.exit(__doc__.strip())
    batch(sys.argv[1], sys.argv[2:])


if __name__ == "__main__":
    main()
