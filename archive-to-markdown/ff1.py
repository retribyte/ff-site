"""FF1 export (DiscordChatExporter, old HTML layout) -> md/ff1/ff1.md

Same layout as FF2's export (chatlog__message-group / chatlog__content), so
this is ff2.py with a few differences: inline code spans (`Name`: speaker
overrides) and <i>/<b> are preserved, bot embeds are normalized, and the
input/output paths are CLI args.

    python3 ff1.py [final-frontier-1.html] [md/ff1/ff1.md]
"""
import re
import sys
from datetime import datetime, timedelta

from bs4 import BeautifulSoup, NavigableString

TS_FMT = "%d-%b-%y %I:%M %p"


def parse_timestamp(s):
    return datetime.strptime(s.strip(), TS_FMT)


def inline(node):
    """Flatten a content element to markdown-ish text, keeping code/italic/bold."""
    out = []
    for child in node.children:
        if isinstance(child, NavigableString):
            out.append(str(child))
            continue
        cls = child.get("class", [])
        if child.name == "br":
            out.append("\n")
        elif "chatlog__edited-timestamp" in cls:
            continue
        elif "pre--multiline" in cls:
            out.append("\n" + child.get_text("\n").strip("\n") + "\n")
        elif "pre--inline" in cls:
            # In FF1 backticks mark in-character speech. Wrap the span in
            # sentinels; quote() turns an IC line into `> text` (QUOTE) and
            # leaves everything else a plain line (OTHER, no character).
            out.append(IC_OPEN + child.get_text() + IC_CLOSE)
        elif child.name == "i":
            out.append("_" + inline(child).strip() + "_")
        elif child.name == "b":
            out.append(inline(child))  # bold would collide with **Author** headers
        elif child.name == "img":
            out.append(child.get("alt", ""))
        else:
            out.append(inline(child))
    return "".join(out)


def clean(text):
    text = text.replace("’", "'").replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in text.split("\n")]
    return "\n".join(l for l in lines if l or False).strip()


EIGHTBALL_NEW = {"Magic 8 Bot"}  # embed = bare answer; addressee is the asker
EIGHTBALL_OLD = {"Magic8Ball"}  # "@Asker Answer."
PBOT = {"pbot"}  # ":question: Question: ... :8ball: Answer: X"
NOISE_BOTS = {"RPBot"}  # "Unknown command" / "Sent a DM" chatter


def bot_line(author, group, asker):
    """Normalize 8-ball bot output to FF2's `🎱 | Answer, Asker.` form."""
    if author in NOISE_BOTS:
        return []
    texts = [clean(inline(e)) for e in group.find_all(class_="chatlog__embed-description")]
    texts += [clean(inline(c)) for c in group.find_all(class_="chatlog__content")]
    t = " ".join(x for x in texts if x)
    if not t:
        return []
    if author in PBOT:
        m = re.search(r"Answer:\*\*\s*(.+)$", t, re.S)
        ans = m.group(1).strip() if m else t
        return [f"🎱 | {ans.rstrip('.,!?')}, {asker}."]
    if author in EIGHTBALL_OLD:
        node = group.find(class_="mention")
        if node and t.startswith(node.get_text()):
            who = node.get_text().lstrip("@")
            ans = t[len(node.get_text()):].strip()
            return [f"🎱 | {ans.rstrip('.,!?')}, {who}."]
        return [f"🎱 | {t}"]
    return [f"🎱 | {t.rstrip('.,!?')}, {asker}."]


def message_text(group):
    parts = []
    for c in group.find_all(class_="chatlog__content"):
        t = clean(inline(c))
        if t in ("Pinned a message.",):
            t = ""  # system line; kept out of the transcript
        if t:
            parts.append(t)
    for e in group.find_all(class_="chatlog__embed-description"):
        t = clean(inline(e))
        if t:
            parts.append(t)
    return parts


IC_OPEN, IC_CLOSE = "\x01", "\x02"


def quote(text, force=False):
    """Per line: in-character speech -> `> text`; OOC -> plain line.
    force=True quotes every line (bot output, as in FF2)."""
    out = []
    for l in text.split("\n"):
        if not l.strip():
            continue
        ic = IC_OPEN in l
        l = l.replace(IC_OPEN, "").replace(IC_CLOSE, "")
        out.append("> " + l if (ic or force) else l)
    return "\n".join(out)


def extract(html):
    soup = BeautifulSoup(html, "html.parser")
    msgs = []
    prev_author = prev_ts = None
    cur = None
    last_human = "Unknown"
    for g in soup.find_all(class_="chatlog__message-group"):
        a = g.find(class_="chatlog__author-name")
        author = a.get_text(strip=True) if a else "Unknown"
        ts = parse_timestamp(g.find(class_="chatlog__timestamp").get_text())
        if author in EIGHTBALL_NEW | EIGHTBALL_OLD | PBOT | NOISE_BOTS:
            parts = bot_line(author, g, last_human)
        else:
            parts = message_text(g)
            last_human = author
        if not parts:
            continue
        for p in parts:
            q = quote(p)  # bot lines stay plain, as in FF2
            if not q:
                continue
            if cur and author == prev_author and ts - prev_ts <= timedelta(minutes=5):
                cur["content"] += "\n" + q
            else:
                cur = {"author": author, "ts": ts, "content": q}
                msgs.append(cur)
            prev_author, prev_ts = author, ts
    return msgs


# Session boundaries. The export has no episode markers, so these are by play
# day (the 8ball-driven sessions), with out-of-session chatter folded into the
# nearest session. Episode numbers continue from the two already-edited ones
# this archive doesn't contain: the export starts at "Third Opening Status".
# (first day, episode) -- a block belongs to the last start <= its date.
EPISODE_STARTS = [
    ("2017-10-01", 3),
    ("2017-11-24", 4),   # pre-session pings/bot tests, then the Dec 17 session
    ("2017-12-28", 5),   # includes Emmett's backstory posts from Dec 30
    ("2018-01-01", 6),
    ("2018-01-08", 7),
    ("2018-01-19", 8),   # Mica's character intro, then the Jan 21 session
    ("2018-01-26", 9),
    ("2018-02-18", 10),
]


def episode_for(ts):
    day = ts.strftime("%Y-%m-%d")
    ep = None
    for start, n in EPISODE_STARTS:
        if day >= start:
            ep = n
    return ep


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "final-frontier-1.html"
    dst = sys.argv[2] if len(sys.argv) > 2 else "md/ff1/ff1.md"
    msgs = extract(open(src, encoding="utf-8").read())
    with open(dst, "w", encoding="utf-8") as f:
        for m in msgs:
            f.write(f"**{m['author']}** _({m['ts'].strftime(TS_FMT)})_\n{m['content']}\n\n")
    print(len(msgs), "messages ->", dst)
    import os
    out_dir = os.path.dirname(dst)
    by_ep = {}
    for m in msgs:
        by_ep.setdefault(episode_for(m["ts"]), []).append(m)
    for ep, ms in sorted(by_ep.items()):
        path = os.path.join(out_dir, f"{ep}.md")
        with open(path, "w", encoding="utf-8") as f:
            for m in ms:
                f.write(f"**{m['author']}** _({m['ts'].strftime(TS_FMT)})_\n{m['content']}\n\n")
        print(f"  ep {ep}: {len(ms)} messages, {ms[0]['ts']:%Y-%m-%d} .. {ms[-1]['ts']:%Y-%m-%d} -> {path}")
