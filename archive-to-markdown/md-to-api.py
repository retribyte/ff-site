"""Convert transcript markdown into API-ready episode JSON.

Successor to md-to-json.py: instead of the legacy ff-site asset format, this
emits payloads shaped for the ff-server API, ready for the /import page (or
any client of POST /episodes and POST /episodes/:title/messages).

Usage:
    python md-to-api.py                        interactive — prompts for season,
                                               file, episode number, title, etc.
    python md-to-api.py <season> [file.md ...] batch — convert every episode
                                               already titled in the meta file

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

try:
    import readline  # noqa: F401 — line editing/history in the interactive prompts
except ImportError:
    pass

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


def find_episode(meta, md_file):
    """The meta episode entry for a markdown file (file_name matches the
    basename with or without its NN- prefix), or None."""
    base_name = os.path.splitext(os.path.basename(md_file))[0]
    candidates = {base_name, re.sub(r"^\d+-", "", base_name)}
    return next((ep for ep in meta["episodes"] if ep["file_name"] in candidates), None)


def emit(md_file, meta, season, episode):
    """Convert one markdown file and write its api/<season>/ JSON."""
    base = os.path.dirname(__file__) or "."
    out_dir = f"{base}/api/{season}"
    os.makedirs(out_dir, exist_ok=True)

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
    return out_file


def batch(season, files):
    meta = load_meta(season)
    base = os.path.dirname(__file__) or "."

    md_files = files or sorted(
        glob.glob(f"{base}/md/{season}/*.md"),
        key=lambda s: [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)],
    )
    if not md_files:
        sys.exit(f"No markdown files found in {base}/md/{season}/.")

    for md_file in md_files:
        base_name = os.path.splitext(os.path.basename(md_file))[0]
        episode = find_episode(meta, md_file)
        if episode is None:
            print(f"skip {md_file}: no episode with file_name '{base_name}' in meta/{season}.json")
            continue
        if not episode.get("title"):
            print(f"skip {md_file}: episode '{base_name}' has no title yet — fill it in meta/{season}.json")
            continue
        emit(md_file, meta, season, episode)


# ---------------------------------------------------------------------------
# Interactive mode: no arguments — a wizard prompts for everything and saves
# the answers back into meta/<season>.json, so batch runs keep working too.
# ---------------------------------------------------------------------------

USE_COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def tint(text, code):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else str(text)


def ask(label, default=None, required=False):
    hint = f" [{default}]" if default not in (None, "") else ""
    while True:
        raw = input(f"  {tint('?', '36')} {label}{tint(hint, '90')}: ").strip()
        if not raw and default not in (None, ""):
            return default
        if raw or not required:
            return raw
        print(tint("    this one is required", "31"))


def ask_int(label, default=None):
    while True:
        raw = ask(label, default=None if default is None else str(default), required=True)
        try:
            return int(raw)
        except ValueError:
            print(tint("    numbers only", "31"))


def ask_yes(label, default=False):
    raw = ask(label, default="y" if default else "n")
    return raw.lower().startswith("y")


def save_meta(season, meta):
    path = os.path.join(os.path.dirname(__file__), "meta", f"{season}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=4, ensure_ascii=False)
        f.write("\n")
    return path


def pick_season():
    """Choose an existing meta/<season>.json or scaffold a new one."""
    base = os.path.dirname(__file__) or "."
    known = sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(f"{base}/meta/*.json"))

    print(f"\n{tint('season', '1')}")
    for i, name in enumerate(known, 1):
        with open(f"{base}/meta/{name}.json", encoding="utf-8") as f:
            meta = json.load(f)
        titled = sum(1 for ep in meta["episodes"] if ep.get("title"))
        print(f"  {tint(i, '36')}) {name} — {meta['seasonTitle']} ({titled}/{len(meta['episodes'])} episodes titled)")
    print(f"  {tint('n', '36')}) new season")

    while True:
        raw = ask("season", default=known[0] if known else None, required=True)
        if raw.isdigit() and 1 <= int(raw) <= len(known):
            return known[int(raw) - 1], load_meta(known[int(raw) - 1])
        if raw in known:
            return raw, load_meta(raw)

        season = ask("meta file name (e.g. ff4)", required=True) if raw.lower() == "n" else raw
        if season in known:
            return season, load_meta(season)
        if not ask_yes(f"no meta/{season}.json yet — create it?", default=raw.lower() == "n"):
            continue
        title = ask("season title as it should appear in the DB", default=season.upper())
        meta = {"seasonTitle": title, "usernames": {}, "bots": [], "cast": {}, "episodes": []}
        path = save_meta(season, meta)
        print(tint(f"  created {path} — fill in usernames/bots/cast before converting", "33"))
        print(tint("  (without a cast, no line gets a character; see meta/ff2.json)", "33"))
        return season, meta


def pick_md_file(season):
    """Choose a markdown file from md/<season>/ or type any path."""
    base = os.path.dirname(__file__) or "."
    files = sorted(
        glob.glob(f"{base}/md/{season}/*.md"),
        key=lambda s: [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)],
    )

    print(f"\n{tint('markdown file', '1')}")
    for i, path in enumerate(files, 1):
        print(f"  {tint(i, '36')}) {os.path.relpath(path, base)}")
    if files:
        print("  …or type a path")

    while True:
        raw = ask("file", required=True)
        if raw.isdigit() and files and 1 <= int(raw) <= len(files):
            return files[int(raw) - 1]
        path = os.path.expanduser(raw)
        if os.path.isfile(path):
            return path
        print(tint(f"    no such file: {path}", "31"))


def edit_episode(meta, md_file):
    """Prompt for the episode fields, defaulting to the existing meta entry."""
    base_name = os.path.splitext(os.path.basename(md_file))[0]
    existing = find_episode(meta, md_file)

    prefix = re.match(r"^(\d+)", base_name)
    default_no = existing["episode_number"] if existing else (
        int(prefix.group(1)) if prefix
        else max((int(ep["episode_number"]) for ep in meta["episodes"]), default=0) + 1
    )

    print(f"\n{tint('episode', '1')}" + (" (editing existing entry)" if existing else ""))
    number = ask_int("episode number", default=default_no)
    taken = next(
        (ep for ep in meta["episodes"]
         if int(ep["episode_number"]) == number and ep is not existing),
        None,
    )
    if taken and not ask_yes(f"episode {number} is already \"{taken['title'] or taken['file_name']}\" — continue?"):
        return None
    title = ask("title", default=existing.get("title") if existing else None, required=True)
    short_desc = ask("short description", default=existing.get("short_desc") if existing else None)

    if existing is None:
        existing = {"title": "", "file_name": base_name, "episode_number": number, "short_desc": ""}
        meta["episodes"].append(existing)
        meta["episodes"].sort(key=lambda ep: int(ep["episode_number"]))
    existing.update(title=title, episode_number=number, short_desc=short_desc)
    return existing


def interactive():
    print(tint("\n┌──────────────────────────────────────────┐", "35"))
    print(tint("│  FF ARCHIVE CONVERTER · markdown → api   │", "35"))
    print(tint("└──────────────────────────────────────────┘", "35"))

    season, meta = pick_season()
    while True:
        md_file = pick_md_file(season)
        episode = edit_episode(meta, md_file)
        if episode is not None:
            path = save_meta(season, meta)
            print(f"\n  saved {os.path.relpath(path, os.path.dirname(__file__) or '.')}")
            out_file = emit(md_file, meta, season, episode)
            print(tint(f"  next: upload {os.path.basename(out_file)} at /import (admin)", "32"))
        if not ask_yes("\nconvert another episode?"):
            break


def main():
    if sys.argv[1:] and sys.argv[1] in ("-h", "--help"):
        sys.exit(__doc__.strip())
    if not sys.argv[1:]:
        try:
            interactive()
        except (KeyboardInterrupt, EOFError):
            sys.exit("\naborted — nothing else was written")
        return
    batch(sys.argv[1], sys.argv[2:])


if __name__ == "__main__":
    main()
