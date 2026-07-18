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

BACKTICK_SPEAKER = re.compile(r"^`([^`]+)`: (.*)$")
SPEAKER_PREFIX = re.compile(r"^([A-Za-z0-9][A-Za-z0-9 .,'\-]{0,29}): (.*)$")
FULL_WRAP = re.compile(r"^(`{1,3}|[*_])(.+)\1$", re.S)
UNDERSCORE_LINE = re.compile(r"^_([^_].*[^_])_$")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
STRIKE = re.compile(r"~~(.+?)~~")
ITALIC_PAIR = re.compile(r"(?<![*\w])\*([^*\s][^*]*?)\*(?![*\w])")
CODE_PAIR = re.compile(r"`{1,3}([^`]+)`{1,3}")
FENCE = re.compile(r"```(?:([A-Za-z0-9]+)\n)?(.*?)```", re.S)
MULTILINE_CODE = re.compile(r"(`{1,2})([^`]*\n[^`]*?)\1")
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


def strip_decoration(text):
    """**bold** and ~~strikethrough~~ are decoration at any nesting level —
    drop the markers, keep the text."""
    text = STRIKE.sub(r"\1", text)
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


def classify_line(line, character, cast_names, quote_ctx=False):
    """One line of Discord message content -> (messages, character), where
    messages is a list of (type, text, character). A speaker override
    (`Name`:, a bare Name: for a known cast character, or any Name: whose
    remainder is entirely markdown-wrapped) reattributes the line and sticks
    for the rest of the message. Mixed lines split one message per span."""
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
                rest_spans = tokenize_spans(rest)
                all_wrapped = bool(rest_spans) and all(delim for delim, _ in rest_spans)
                unclosed_quote = (rest.startswith("`")
                                  and not any(delim for delim, _ in rest_spans))
                if all_wrapped or unclosed_quote:
                    character = match.group(1).split(",")[0].strip()
                    line = rest
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
    for delim, text in segments:
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
    per line, so the per-line classifier sees each line as dialogue."""
    def per_line(match):
        tick = match.group(1)
        parts = (p.strip() for p in match.group(2).split("\n"))
        return "\n".join(f"{tick}{p}{tick}" if p else "" for p in parts)
    return MULTILINE_CODE.sub(per_line, text)


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


def convert_message(msg, meta, episode_number, usernames, bots, cast_names):
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

    def emit_line(msg_type, text, line_character):
        # FR-MSG-4: a quote needs a speaker
        if msg_type == "QUOTE" and not line_character:
            msg_type = "OTHER"
        out.append({
            "player": player,
            "character": line_character,
            "timestamp": timestamp,
            "type": msg_type,
            "text": text,
        })

    content = (msg.get("content") or "").strip()
    for chunk in content_chunks(content) if content else []:
        if chunk[0] == "fence":
            _, lang, body = chunk
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

    messages = []
    played_date = None
    for msg in export.get("messages", []):
        for out_msg in convert_message(msg, meta, episode_number, usernames, bots, cast_names):
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
