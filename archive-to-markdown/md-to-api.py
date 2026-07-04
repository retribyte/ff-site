"""Convert transcript markdown into API-ready episode JSON.

Successor to md-to-json.py: instead of the legacy ff-site asset format, this
emits payloads shaped for the ff-server API, ready for the /import page (or
any client of POST /episodes and POST /episodes/:title/messages).

Usage:
    python md-to-api.py <season> [file.md ...]

Reads  ./meta/<season>.json   (season metadata: cast, username map, episodes)
       ./md/<season>/*.md     (or just the files passed on the command line)
Writes ./api/<season>/<episode_number>-<file_name>.json

Markdown format (produced by ff2.py / ff3.py from Discord exports):
    **Author** _(24-Jun-18 05:13 PM)_
    plain line                  -> OTHER
    @Magic8Ball ... / t!... / 8ball ...  -> COMMAND
    > spoken line               -> QUOTE (attributed to the player's character)
    > `Name`: line  /  > Name: line      -> QUOTE attributed to Name
    _action line_               -> ACTION (same `Name`: override)
    <embed><description>...</description></embed> -> EMBED (sections as JSON)
Lines from a bot author are always BOT_RESPONSE. A bare "(edited)" is a
Discord artifact and is dropped.
"""

import glob
import json
import os
import re
import sys
from datetime import datetime

BLOCK_HEADER = re.compile(r"\*\*(.*?)\*\*\s+[_*]\((.*?)\)[_*]")
EMBED_OPEN = re.compile(r"^<([a-z]+)>$")
EMBED_CLOSE = re.compile(r"^</([a-z]+)>$")
BACKTICK_SPEAKER = re.compile(r"^`(.+?)`: (.*)$")
PLAIN_SPEAKER = re.compile(r"^([A-Z][A-Za-z0-9 .'\-]{0,29}): (.*)$")
ACTION_LINE = re.compile(r"^[_*](.+)[_*]$")


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
    # before their first appearance, fall back to their earliest character
    return best or spans[min(spans, key=int)]


def parse_timestamp(raw):
    try:
        return datetime.strptime(raw, "%d-%b-%y %I:%M %p").isoformat()
    except ValueError:
        return None


def split_blocks(lines):
    """Group markdown lines into (author, timestamp, content-lines) blocks."""
    blocks = []
    current = None
    for line in lines:
        line = line.strip()
        header = BLOCK_HEADER.match(line)
        if header:
            if current:
                blocks.append(current)
            current = {"author": header.group(1), "date": header.group(2), "lines": []}
        elif line and line != "(edited)":
            if current is None:
                sys.exit(f"Content before the first block header: {line!r}")
            current["lines"].append(line)
    if current:
        blocks.append(current)
    return blocks


def classify_line(line, character, cast_names):
    """One markdown line -> (type, text, character). Speaker overrides
    reattribute the line (and the rest of the block): `Name`: is always
    trusted; a bare Name: prefix only when it's a known cast character
    (dialogue like "Here's an idea: ..." must not become a speaker)."""
    quote = line.startswith("> ")
    if quote:
        line = line[2:]

    match = BACKTICK_SPEAKER.match(line)
    if not match and quote:
        match = PLAIN_SPEAKER.match(line)
        if match and match.group(1) not in cast_names:
            match = None
    if match:
        character = match.group(1)
        line = match.group(2)

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


def convert_file(md_file, meta, episode):
    with open(md_file, encoding="utf-8") as f:
        blocks = split_blocks(f.readlines())

    usernames = meta.get("usernames", {})
    bots = set(meta.get("bots", []))
    cast_names = {name for spans in meta.get("cast", {}).values() for name in spans.values()}
    messages = []
    played_date = None

    for block in blocks:
        player = usernames.get(block["author"], block["author"])
        character = cast_character(meta, player, episode["episode_number"])
        timestamp = parse_timestamp(block["date"])
        played_date = played_date or timestamp

        embed = None       # sections dict while inside <embed>…</embed>
        section = None     # current section name inside an embed
        for line in block["lines"]:
            closing = EMBED_CLOSE.match(line)
            if closing:
                if closing.group(1) == "embed" and embed is not None:
                    messages.append({
                        "player": player,
                        "character": character,
                        "timestamp": timestamp,
                        "type": "EMBED",
                        "text": json.dumps(embed, ensure_ascii=False),
                    })
                    embed = None
                section = None
                continue
            opening = EMBED_OPEN.match(line)
            if opening:
                if opening.group(1) == "embed":
                    embed = {}
                elif embed is not None:
                    section = opening.group(1)
                    embed[section] = []
                continue
            if embed is not None:
                if section:
                    embed[section].append(line)
                continue

            if player in bots:
                msg_type, text = "BOT_RESPONSE", line
            else:
                msg_type, text, character = classify_line(line, character, cast_names)
            # FR-MSG-4: a quote needs a speaker
            if msg_type == "QUOTE" and not character:
                msg_type = "OTHER"
            # the whole block carries the current character (the reader
            # regroups consecutive messages by player+character)
            messages.append({
                "player": player,
                "character": character,
                "timestamp": timestamp,
                "type": msg_type,
                "text": text,
            })

    return {
        "seasonTitle": meta["seasonTitle"],
        "episode": {
            "title": episode["title"],
            "episode_no": int(episode["episode_number"]),
            "summary": episode.get("short_desc") or None,
            "playedDate": played_date,
        },
        "messages": messages,
    }


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__.strip().split("\n\n")[1])

    season = sys.argv[1]
    meta = load_meta(season)
    base = os.path.dirname(__file__) or "."

    md_files = sys.argv[2:] or sorted(
        glob.glob(f"{base}/md/{season}/*.md"),
        key=lambda s: [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)],
    )
    if not md_files:
        sys.exit(f"No markdown files found in {base}/md/{season}/.")

    out_dir = f"{base}/api/{season}"
    os.makedirs(out_dir, exist_ok=True)

    for md_file in md_files:
        base_name = os.path.splitext(os.path.basename(md_file))[0]
        candidates = {base_name, re.sub(r"^\d+-", "", base_name)}
        episode = next((ep for ep in meta["episodes"] if ep["file_name"] in candidates), None)
        if episode is None:
            print(f"skip {md_file}: no episode with file_name '{base_name}' in meta/{season}.json")
            continue
        if not episode.get("title"):
            print(f"skip {md_file}: episode '{base_name}' has no title yet — fill it in meta/{season}.json")
            continue

        payload = convert_file(md_file, meta, episode)
        slug = re.sub(r"^\d+-?", "", episode["file_name"]) or episode["file_name"]
        out_file = f"{out_dir}/{episode['episode_number']}-{slug}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4, ensure_ascii=False)
        types = {}
        for msg in payload["messages"]:
            types[msg["type"]] = types.get(msg["type"], 0) + 1
        summary = ", ".join(f"{count} {name}" for name, count in sorted(types.items()))
        print(f"{md_file} -> {out_file} ({len(payload['messages'])} messages: {summary})")


if __name__ == "__main__":
    main()
