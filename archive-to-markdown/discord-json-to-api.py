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
    python discord-json-to-api.py <season> [file.json ...]
        batch — converts every export whose channel name matches an episode
        already titled in meta/<season>.json. With no files given, scans
        DEFAULT_INPUT_DIR for *.json.

Reads  ./meta/<season>.json              (season metadata: cast, username map, episodes)
       DEFAULT_INPUT_DIR/*.json          (or files passed on the command line)
Writes ./api/<season>/<episode_number>-<file_name>.json

Classification (applied per line of each Discord message's `content`):
    plain line                          -> OTHER
    @Magic8Ball … / t!… / 8ball …       -> COMMAND
    > spoken line                       -> QUOTE (current character)
    `spoken line`                       -> QUOTE (current character; whole-line backtick wrap)
    > `Name`: line  /  `Name`: line     -> QUOTE attributed to Name
    > Name: line  (Name in the cast)    -> QUOTE attributed to Name
    *action line* / _action line_       -> ACTION (same `Name`: override)
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

BACKTICK_SPEAKER = re.compile(r"^`(.+?)`: (.*)$")
PLAIN_SPEAKER = re.compile(r"^([A-Z][A-Za-z0-9 .'\-]{0,29}): (.*)$")
FULL_BACKTICK = re.compile(r"^`(.+)`$")
ACTION_LINE = re.compile(r"^[_*](.+)[_*]$")

DEFAULT_INPUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "discord-exports", "episodes")
)


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


def classify_line(line, character, cast_names):
    """One line of Discord message content -> (type, text, character). A
    speaker override (`Name`: or a bare Name: for a known cast character)
    reattributes the line and sticks for the rest of the message. A line
    fully wrapped in backticks or in *…*/_…_ is treated the same way a
    player wrapping their own message in Discord markdown would expect:
    backticks read as spoken dialogue, asterisks/underscores as action."""
    quote = line.startswith("> ")
    if quote:
        line = line[2:]

    match = BACKTICK_SPEAKER.match(line)
    if not match:
        match = PLAIN_SPEAKER.match(line)
        if match and match.group(1) not in cast_names:
            match = None
    if match:
        character = match.group(1)
        line = match.group(2)
        quote = True

    full_backtick = FULL_BACKTICK.match(line)
    if full_backtick:
        line = full_backtick.group(1)
        quote = True

    if quote:
        return "QUOTE", line, character

    action = ACTION_LINE.match(line)
    if action:
        inner = BACKTICK_SPEAKER.match(action.group(1))
        if inner:
            character = inner.group(1)
            return "ACTION", inner.group(2), character
        return "ACTION", action.group(1), character

    if "@Magic" in line or "t!" in line or line.lower().startswith("8ball"):
        return "COMMAND", line, character

    return "OTHER", line, character


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
    several — a multi-line message or one with both text and an embed can
    expand to more than one)."""
    if msg.get("type") in ("RecipientAdd", "RecipientRemove"):
        return []

    author = msg.get("author") or {}
    display = author.get("nickname") or author.get("name") or "Unknown"
    player = usernames.get(display, display)
    timestamp = parse_timestamp(msg.get("timestamp"))
    is_bot = bool(author.get("isBot")) or player in bots

    out = []
    character = cast_character(meta, player, episode_number)
    content = (msg.get("content") or "").strip()
    if content:
        for line in content.split("\n"):
            line = line.strip()
            if not line:
                continue
            if is_bot:
                msg_type, text = "BOT_RESPONSE", line
            else:
                msg_type, text, character = classify_line(line, character, cast_names)
                # FR-MSG-4: a quote needs a speaker
                if msg_type == "QUOTE" and not character:
                    msg_type = "OTHER"
            out.append({
                "player": player,
                "character": character,
                "timestamp": timestamp,
                "type": msg_type,
                "text": text,
            })

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


def batch(season, files):
    meta = load_meta(season)

    json_files = files or sorted(glob.glob(f"{DEFAULT_INPUT_DIR}/*.json"))
    if not json_files:
        sys.exit(f"No JSON files found in {DEFAULT_INPUT_DIR}.")

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
