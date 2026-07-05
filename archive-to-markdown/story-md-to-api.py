#!/usr/bin/env python3
"""Convert a short-story markdown manuscript into ff-server story JSON.

Usage:
    python3 story-md-to-api.py md/stories/<slug>.md            # convert only
    python3 story-md-to-api.py md/stories/<slug>.md --upload   # convert + POST
        [--api http://localhost:3000/api]

Markdown format (see README, "Stories"):

    ---
    slug: the-last-squoatling          required, ^[a-z0-9-]+$
    title: The Last Squoatling         required
    blurb: One-line summary.           optional
    author: Trey                       optional username, resolved at upload
    published: 2026-07-04              optional ISO date
    themeColor: '#e8b23b'              optional (+ themeColor2)
    format: prose                      optional, 'script' (default) or 'prose'
    ---

    # Chapter 1: The Signal            "# Chapter N[: Title]" starts a chapter;
                                       no headings = single untitled chapter

    A plain paragraph is one NARRATION line.

    > Emmett: I told you this would happen.     DIALOGUE by Emmett
    > ?: Who's there?                           DIALOGUE, unknown speaker

    The lock clicked. ["Move,"]{Emmett} she hissed.   NARRATION with an inline
                                       dialogue span — [spoken]{Speaker}. The
                                       paragraph stays ONE line; the span is
                                       colored by speaker in the reader. The
                                       segment texts concatenate verbatim (minus
                                       the markers) back to the paragraph, so
                                       'format: prose' novel-style stories keep
                                       dialogue inside their narration.

    _take the left corridor_                    ACTION

    ```transcript                               one TRANSCRIPT line; interior
    VCOMM RECORDED ...                          blank lines become paragraph
    ```                                         breaks in the reader

    ***                                         BREAK (scene break)

Output lands in api/stories/<slug>.json (gitignored). Stdlib only.
"""

import argparse
import getpass
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "api" / "stories"

SLUG_RE = re.compile(r"^[a-z0-9-]+$")
CHAPTER_RE = re.compile(r"^#\s+Chapter\s+(\d+)(?:\s*:\s*(.+?))?\s*$", re.IGNORECASE)
DIALOGUE_RE = re.compile(r"^>\s*(.+?):\s+(.*)$")
BREAK_RE = re.compile(r"^(\*\s*\*\s*\*+|-{3,}|_{3,})\s*$")
# Novel-style inline dialogue: [spoken text]{Speaker} embedded in a narration paragraph
INLINE_DIALOGUE_RE = re.compile(r"\[([^\[\]]+)\]\{([^{}]+)\}")
VALID_FORMATS = {"script", "prose"}


# ---------- parsing ----------

def parse_frontmatter(lines):
    """Returns (meta dict, remaining lines)."""
    if not lines or lines[0].strip() != "---":
        sys.exit("error: manuscript must start with a --- frontmatter block")
    meta = {}
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return meta, lines[i + 1:]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, sep, value = line.partition(":")
        if not sep:
            sys.exit(f"error: bad frontmatter line: {line!r}")
        value = value.split("#", 1)[0].strip().strip("'\"")
        meta[key.strip()] = value
    sys.exit("error: unterminated frontmatter block")


def flush_paragraph(buffer, lines_out):
    """Turn one blank-line-delimited paragraph into story line(s)."""
    text = "\n".join(buffer).strip()
    if not text:
        return

    if BREAK_RE.match(text):
        lines_out.append({"type": "BREAK", "text": ""})
        return

    # A paragraph of "> Name: ..." quote lines — one DIALOGUE line each;
    # bare "> ..." continuations attach to the previous speaker's line.
    if text.startswith(">"):
        current = None
        for raw in buffer:
            stripped = raw.strip()
            if not stripped.startswith(">"):
                continue
            body = stripped[1:].strip()
            match = DIALOGUE_RE.match(stripped)
            if match:
                if current:
                    lines_out.append(current)
                current = {"type": "DIALOGUE", "speaker": match.group(1).strip(), "text": match.group(2)}
            elif current:
                current["text"] += " " + body
            else:
                sys.exit(f"error: dialogue line without a speaker: {stripped!r}")
        if current:
            lines_out.append(current)
        return

    # _action line_ — the whole paragraph wrapped in single underscores
    if text.startswith("_") and text.endswith("_") and len(text) > 2 and not text.startswith("__"):
        lines_out.append({"type": "ACTION", "text": " ".join(text[1:-1].split())})
        return

    # NARRATION — markdown soft-wraps join with a space
    joined = " ".join(text.split())
    segments = parse_inline_dialogue(joined)
    if segments:
        # text is the clean concatenation of segment texts (markers stripped)
        clean = "".join(seg["text"] for seg in segments)
        lines_out.append({"type": "NARRATION", "text": clean, "segments": segments})
    else:
        lines_out.append({"type": "NARRATION", "text": joined})


def parse_inline_dialogue(text):
    """Split narration into [{text}, {text, speaker}, ...] at [dialogue]{Speaker}
    spans, preserving surrounding whitespace so segments concatenate back to the
    prose. Returns None when the paragraph has no spans (plain narration)."""
    segments = []
    pos = 0
    for match in INLINE_DIALOGUE_RE.finditer(text):
        if match.start() > pos:
            segments.append({"text": text[pos:match.start()]})
        segments.append({"text": match.group(1), "speaker": match.group(2).strip()})
        pos = match.end()
    if not segments:
        return None
    if pos < len(text):
        segments.append({"text": text[pos:]})
    return segments


def parse_body(lines):
    """Returns [{chapter_no, title, lines: [...]}]."""
    chapters = []
    current = None
    buffer = []
    in_fence = False
    fence_lines = []

    def chapter():
        nonlocal current
        if current is None:
            current = {"chapter_no": 1, "title": None, "lines": []}
            chapters.append(current)
        return current

    for line in lines:
        if in_fence:
            if line.strip() == "```":
                in_fence = False
                chapter()["lines"].append({"type": "TRANSCRIPT", "text": "\n".join(fence_lines).strip()})
            else:
                fence_lines.append(line.rstrip())
            continue

        if line.strip().startswith("```"):
            if buffer:
                flush_paragraph(buffer, chapter()["lines"])
                buffer = []
            fence_kind = line.strip()[3:].strip()
            if fence_kind != "transcript":
                sys.exit(f"error: unknown fenced block {fence_kind!r} (only ```transcript is supported)")
            in_fence = True
            fence_lines = []
            continue

        heading = CHAPTER_RE.match(line)
        if heading:
            if current:
                flush_paragraph(buffer, current["lines"])
                buffer = []
            current = {"chapter_no": int(heading.group(1)), "title": heading.group(2) or None, "lines": []}
            chapters.append(current)
            continue

        if not line.strip():
            if buffer:
                flush_paragraph(buffer, chapter()["lines"])
                buffer = []
        else:
            buffer.append(line)

    if in_fence:
        sys.exit("error: unterminated ```transcript block")
    if buffer:
        flush_paragraph(buffer, chapter()["lines"])

    seen = set()
    for ch in chapters:
        if ch["chapter_no"] in seen:
            sys.exit(f"error: duplicate chapter number {ch['chapter_no']}")
        seen.add(ch["chapter_no"])
        if not ch["lines"]:
            sys.exit(f"error: chapter {ch['chapter_no']} has no lines")
    return sorted(chapters, key=lambda c: c["chapter_no"])


def convert(md_path):
    lines = md_path.read_text(encoding="utf-8").splitlines()
    meta, body = parse_frontmatter(lines)

    for key in ("slug", "title"):
        if not meta.get(key):
            sys.exit(f"error: frontmatter is missing {key!r}")
    if not SLUG_RE.match(meta["slug"]):
        sys.exit(f"error: slug {meta['slug']!r} must match ^[a-z0-9-]+$")

    story = {"slug": meta["slug"], "title": meta["title"]}
    if meta.get("blurb"):
        story["blurb"] = meta["blurb"]
    if meta.get("published"):
        story["publishedDate"] = meta["published"]
    for key in ("themeColor", "themeColor2"):
        if meta.get(key):
            story[key] = meta[key]
    fmt = (meta.get("format") or "script").strip().lower()
    if fmt not in VALID_FORMATS:
        sys.exit(f"error: format must be one of {sorted(VALID_FORMATS)}, got {meta.get('format')!r}")
    if fmt == "prose":
        story["format"] = "PROSE"

    return {"story": story, "author": meta.get("author"), "chapters": parse_body(body)}


# ---------- upload ----------

class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = None

    def call(self, method, path, body=None, ok404=False):
        req = urllib.request.Request(f"{self.base}{path}", method=method)
        req.add_header("Accept", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        data = None
        if body is not None:
            req.add_header("Content-Type", "application/json")
            data = json.dumps(body).encode()
        try:
            with urllib.request.urlopen(req, data) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            if err.code == 404 and ok404:
                return None
            detail = err.read().decode(errors="replace")
            sys.exit(f"error: {method} {path} -> HTTP {err.code}: {detail}")

    def login(self):
        username = input("username: ")
        password = getpass.getpass("password: ")
        res = self.call("POST", "/login", {"username": username, "password": password})
        self.token = res["data"]["token"]
        return username


def upload(payload, api_base):
    api = Api(api_base)
    slug = payload["story"]["slug"]

    if api.call("GET", f"/stories/{slug}", ok404=True) is not None:
        sys.exit(f"error: story '{slug}' already exists — delete it via the API to re-upload")

    username = api.login()

    # Resolve the author (frontmatter username, falling back to the uploader)
    me = api.call("GET", "/user")["data"]
    author = payload.get("author")
    story = dict(payload["story"])
    if not author or author == username:
        story["authorId"] = me["id"]
    else:
        users = api.call("GET", "/users", ok404=True)  # admin-only
        match = next((u for u in (users or {}).get("data", []) if u["username"] == author), None)
        if match:
            story["authorId"] = match["id"]
        else:
            print(f"warning: could not resolve author {author!r}; leaving unset")

    # Character name -> id (exact name, then aliases) for dialogue attribution
    characters = api.call("GET", "/characters")["data"]
    by_name = {}
    for character in characters:
        by_name.setdefault(character["name"], character["id"])
        for alias in character.get("aliases", []):
            by_name.setdefault(alias["name"], character["id"])

    api.call("POST", "/stories", story)
    print(f"created story '{slug}'")

    unresolved = set()
    for chapter in payload["chapters"]:
        api.call("POST", f"/stories/{slug}/chapters", {
            "chapter_no": chapter["chapter_no"],
            **({"title": chapter["title"]} if chapter["title"] else {}),
        })
        def resolve_speaker(entry, speaker):
            """Attach characterId (or a display-name speaker) for a speaker string."""
            if speaker in by_name:
                entry["characterId"] = by_name[speaker]
            else:
                entry["speaker"] = speaker
                unresolved.add(speaker)

        lines = []
        for line in chapter["lines"]:
            out = {"type": line["type"], "text": line["text"]}
            speaker = line.get("speaker")
            if speaker:
                resolve_speaker(out, speaker)
            segments = line.get("segments")
            if segments:
                out["segments"] = []
                for seg in segments:
                    resolved = {"text": seg["text"]}
                    if seg.get("speaker"):
                        resolve_speaker(resolved, seg["speaker"])
                    out["segments"].append(resolved)
            lines.append(out)
        CHUNK = 500
        for i in range(0, len(lines), CHUNK):
            api.call("POST", f"/stories/{slug}/chapters/{chapter['chapter_no']}/lines",
                     {"lines": lines[i:i + CHUNK]})
        print(f"  chapter {chapter['chapter_no']}: {len(lines)} lines")

    if unresolved:
        print(f"warning: no Character row for {sorted(unresolved)} — kept as display names")
    print(f"done — reads at /stories/{slug}")


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser(description="Convert story markdown to ff-server JSON.")
    parser.add_argument("manuscript", type=Path, help="markdown file (md/stories/<slug>.md)")
    parser.add_argument("--upload", action="store_true", help="POST the result to the API")
    parser.add_argument("--api", default="http://localhost:3000/api", help="API base URL")
    args = parser.parse_args()

    payload = convert(args.manuscript)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{payload['story']['slug']}.json"
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(len(c["lines"]) for c in payload["chapters"])
    print(f"{out_path.relative_to(ROOT)}: {len(payload['chapters'])} chapter(s), {total} lines")

    if args.upload:
        upload(payload, args.api)


if __name__ == "__main__":
    main()
