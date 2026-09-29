"""Convert a DiscordChatExporter JSON export (FF4) into editable transcript
markdown -- the FF2/FF3 house syntax that md-to-api.py imports.

FF4's canonical, hand-edited source is md/ff4/<N>-<slug>.md; the Discord
JSON under discord-exports/ stays as reference material. This script makes
the starting point for an edit. Line classification (QUOTE/ACTION/OTHER,
speaker overrides, the Ravens code-fence voices, the Finale/Hunt520 content
tables, personas) is *not* reimplemented here -- every line goes through
discord-json-to-api.py's convert_message, so both pipelines attribute
identically. This script only lays the result out as markdown and adds the
information that pipeline drops on the floor.

Every Discord message gets its own block, and its header carries the
message's Discord ID -- `**Zander** _(10-May-22 07:46 PM)_ [973747759268134953]`
-- anchoring the text back to the export (md-to-api.py ignores it; the DB
never sees it). Blocks are deliberately not merged by author: the site's
reader regroups consecutive same-speaker messages itself, as Discord did.
A block an editor adds has no ID, which marks it as editorial. Inside a
message's block:

    ↪ Trey: That's very interesting. So your…   Discord reply: the next line
                                                 answers this message (author
                                                 and opening words of it)
    ⌘ Brody used /8ball                          the slash command behind the
                                                 bot message that follows
    📎 goat_butt.png                             an attachment (file name only;
                                                 the CDN links expire)

md-to-api.py skips all three marker lines -- the DB has no column for them
yet -- so they cost nothing at import and stay in the archive for editors
(a reply is often the only record of who a line was addressed to).

Usage (from archive-to-markdown/):
    python3 ff4-to-md.py <export.json> [<export.json> ...]
        raw baseline -> md/ff4/raw/<N>-<slug>.md  (everything, no blacklist)
    python3 ff4-to-md.py --prep <export.json> <out.md>
        editing working copy: drops Vortox's turn/admin embeds (Episode Turn,
        Skipping Turn, Turn List, Resetting, Stopping, Adding/Editing …),
        /list tables, and failed commands ("… not found!", "Invalid dice
        format!"), and
        normalizes 8ball footer askers to player names ("Maxwell asked: …"),
        moves GM recap embeds (the ones with <code>) under Vortox, and
        prefixes every line Trey's meta messageBlacklist flagged with "✂ ",
        a pre-flagged cut the editor confirms or keeps. ff4_verify.py fails
        while any "✂ " line remains.
"""

import importlib.util
import json
import os
import re
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("d2a", os.path.join(HERE, "discord-json-to-api.py"))
d2a = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(d2a)
from persona_timeline import PersonaTimeline  # noqa: E402

SEASON = "ff4"
SNIPPET = 60

# Canonical cast name -> the short form players type; tags use the short
# form (md-to-api.py's NAME_ALIASES maps it back).
SHORT_NAMES = {full: short for short, full in d2a.NAME_ALIASES.items()
               if short not in ("Dutchina", "Fungus", "S")}

# Vortox embeds that are turn management or bot bookkeeping, never story.
ADMIN_EMBED = re.compile(
    r"^(Episode Turn|Skipping Turn|Turn List|Combat Turn List|Joining Combat|Resetting"
    r"|Stopping( Current)? Episode|Starting Episode|(Adding|Editing|Deleting|Removing)\b.*(Succeeded|Failed)!?)$")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def md_name(episode):
    return f"{episode['episode_number']}-{slug(episode['file_name'])}.md"


def header_time(iso):
    return datetime.fromisoformat(iso).strftime("%d-%b-%y %I:%M %p")


def discord_name(author):
    """The name Discord showed. Block headers keep it as it appeared (e.g.
    "Vortox"); md-to-api.py maps it to a DB user through meta usernames."""
    return author.get("nickname") or author.get("name") or "Unknown"


def display_name(author, usernames):
    display = author.get("nickname") or author.get("name") or "Unknown"
    return usernames.get(display, display)


def first_text(msg):
    """Opening words of a message, for a reply marker."""
    text = (msg.get("content") or "").strip()
    if not text:
        for embed in msg.get("embeds") or []:
            text = (embed.get("description") or embed.get("title") or "").strip()
            if text:
                break
    if not text and msg.get("attachments"):
        text = msg["attachments"][0].get("fileName", "")
    text = re.sub(r"[`*_~>]|\|\|", "", text.split("\n")[0]).strip()
    return text if len(text) <= SNIPPET else text[:SNIPPET].rstrip() + "…"


def tag_name(character):
    return SHORT_NAMES.get(character, character)


def load_export(path):
    with open(path, encoding="utf-8") as f:
        export = json.load(f)
    meta = d2a.load_meta(SEASON)
    episode = d2a.find_episode(meta, export.get("channel", {}).get("name", ""))
    if episode is None:
        sys.exit(f"{path}: channel has no episode entry in meta/{SEASON}.json")
    return export, meta, episode


def entries(export, meta, episode):
    """Walk the export, yielding one dict per emitted line plus its marker
    lines. messageNo counts exactly as discord-json-to-api.py does, so the
    meta messageBlacklist lines up."""
    usernames = meta.get("usernames", {})
    bots = set(meta.get("bots", []))
    cast_names = {n for spans in meta.get("cast", {}).values() for n in spans.values()}
    number = episode["episode_number"]
    timeline = PersonaTimeline(meta, number)
    by_id = {m["id"]: m for m in export.get("messages", [])}
    message_no = 0
    for msg in export.get("messages", []):
        out = d2a.convert_message(msg, meta, number, usernames, bots, cast_names, timeline)
        markers = []
        ref = (msg.get("reference") or {}).get("messageId")
        if msg.get("type") == "Reply" and ref:
            target = by_id.get(ref)
            if target:
                who = discord_name(target.get("author") or {})
                markers.append(f"↪ {who}: {first_text(target)}")
            else:
                markers.append("↪ (message outside this export)")
        interaction = msg.get("interaction")
        if interaction:
            who = display_name(interaction.get("user") or {}, usernames)
            markers.append(f"⌘ {who} used /{interaction.get('name')}")
        attachments = [f"📎 {a.get('fileName')}" for a in msg.get("attachments") or []]
        if not out and not attachments:
            continue
        author = discord_name(msg.get("author") or {})
        lines = []
        for item in out:
            message_no += 1
            lines.append(dict(item, messageNo=message_no))
        yield {"author": author, "id": msg["id"], "timestamp": msg["timestamp"], "markers": markers,
               "lines": lines, "attachments": attachments}


FOOTER_ASKER = re.compile(r'^.*? (asked: ".*)$', re.S)


def embed_lines(text, invoker=None):
    embed = json.loads(text)
    if invoker and "footer" in embed:
        # "Horny Sexwell MAX asked: ..." -> "Maxwell asked: ...": server
        # nicknames normalized to player names, as FF2/FF3 did for authors
        embed["footer"] = FOOTER_ASKER.sub(lambda m: f"{invoker} {m.group(1)}", embed["footer"])
    body = ["<embed>"]
    if "title" in embed:
        body.append(f"<title>{embed['title']}</title>")
    if embed.get("description") and len(embed["description"]) == 1 and "\n" not in embed["description"][0]:
        body.append(f"<description>{embed['description'][0]}</description>")
    elif embed.get("description"):
        body.append("<description>")
        body.extend(embed["description"])
        body.append("</description>")
    if "footer" in embed:
        body.append(f"<footer>{embed['footer']}</footer>")
    if "color" in embed:
        body.append(f"<color>{embed['color']}</color>")
    if "code" in embed:
        # fence language of a GM recap: its [BRACKETS] are highlight markup
        body.append(f"<code>{embed['code']}</code>")
    body.append("</embed>")
    return body


FAILED_COMMAND = re.compile(r"not found!|Invalid dice format!|Invalid formatting")


def is_admin_embed(line):
    """Turn/bookkeeping embeds and failed bot commands (junk retries)."""
    if line["type"] != "EMBED":
        return False
    embed = json.loads(line["text"])
    return bool(ADMIN_EMBED.match(embed.get("title") or "")
                or any(FAILED_COMMAND.search(d) for d in embed.get("description") or []))


def render(export, meta, episode, prep=False):
    number = episode["episode_number"]
    blacklist = set(episode.get("messageBlacklist") or []) if prep else set()
    blocks = []  # [author, header_ts, last_dt, default_char, paragraphs, tagged]

    def new_block(author, ts, msg_id):
        default = d2a.cast_character(meta, meta.get("usernames", {}).get(author, author), number)
        blocks.append({"author": author, "ts": ts, "id": msg_id, "default": default,
                       "paras": [], "current": default, "persona": None})
        return blocks[-1]

    for entry in entries(export, meta, episode):
        if prep and any(m.startswith("⌘ ") and m.endswith(" used /list") for m in entry["markers"]):
            continue  # Vortox's weapon/character tables: bot bookkeeping
        lines = [l for l in entry["lines"] if not (prep and is_admin_embed(l))]
        if not lines and not entry["attachments"]:
            continue
        # a slash-command marker with nothing left to precede is noise
        markers = entry["markers"] if lines else [m for m in entry["markers"] if not m.startswith("⌘")]
        invoker = next((m[2:].split(" used /")[0] for m in entry["markers"] if m.startswith("⌘ ")), None)
        ts = entry["timestamp"]
        block = new_block(entry["author"], ts, entry["id"])
        paras = block["paras"]
        paras.append(list(markers)) if markers else None
        for line in lines:
            kind, text, char = line["type"], line["text"], line["character"]
            cut = "✂ " if line["messageNo"] in blacklist else ""
            if kind == "EMBED":
                body = embed_lines(text, invoker if prep else None)
                if prep and "code" in json.loads(text) and entry["author"] not in meta.get("bots", []):
                    # a GM's recap/transmission is GM narration: it moves under
                    # the bot, keeping the message ID (in a player's block it
                    # would import as that player's character talking)
                    bot = meta["bots"][0]
                    bot_header = next((k for k, v in meta.get("usernames", {}).items() if v == bot), bot)
                    gm = new_block(bot_header, ts, entry["id"])
                    gm["paras"].append([cut + body[0]] + body[1:])
                    block = new_block(entry["author"], ts, entry["id"])
                    paras = block["paras"]
                    continue
                paras.append([cut + body[0]] + body[1:])
                continue
            if kind in ("QUOTE", "ACTION"):
                persona = line.get("persona")
                override = persona if (char == "Vec" and persona in d2a.RAVENS_PREFIXES.values()) else None
                speaker = (char, override)
                tag = ""
                if speaker != (block["current"], block["persona"]):
                    if char == block["default"] and override is None:
                        # back to the block owner: md-to-api.py's tags are
                        # sticky, so reopen the block under the same header
                        block = new_block(entry["author"], ts, entry["id"])
                        paras = block["paras"]
                    else:
                        tag = f"`{tag_name(char)} as {override}`: " if override else f"`{tag_name(char)}`: "
                    block["current"], block["persona"] = char, override
                if kind == "QUOTE":
                    rendered = f"> {tag}{text}"
                else:
                    rendered = f"_{tag}{text}_"
            else:
                rendered = text
            rendered = cut + rendered
            if kind == "QUOTE" and paras and paras[-1] and paras[-1][-1].lstrip("✂ ").startswith("> "):
                paras[-1].append(rendered)
            else:
                paras.append([rendered])
        if entry["attachments"]:
            paras.append(entry["attachments"])

    out = []
    for block in blocks:
        paras = [p for p in block["paras"] if p]
        if not paras:
            continue
        out.append(f"**{block['author']}** _({header_time(block['ts'])})_ [{block['id']}]\n")
        for p in paras:
            out.append("\n".join(p) + "\n")
    return "\n".join(out)


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit(__doc__.strip())
    if args[0] == "--prep":
        if len(args) != 3:
            sys.exit("usage: ff4-to-md.py --prep <export.json> <out.md>")
        export, meta, episode = load_export(args[1])
        os.makedirs(os.path.dirname(os.path.abspath(args[2])), exist_ok=True)
        with open(args[2], "w", encoding="utf-8") as f:
            f.write(render(export, meta, episode, prep=True))
        print(f"{args[1]} -> {args[2]} (prep)")
        return
    out_dir = os.path.join(HERE, "md", SEASON, "raw")
    os.makedirs(out_dir, exist_ok=True)
    for path in args:
        export, meta, episode = load_export(path)
        out = os.path.join(out_dir, md_name(episode))
        with open(out, "w", encoding="utf-8") as f:
            f.write(render(export, meta, episode))
        print(f"{path} -> {out}")


if __name__ == "__main__":
    main()
