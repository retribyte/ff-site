#!/usr/bin/env python3
"""Convert a Google Docs .docx export into a story markdown manuscript.

First leg of the short-story pipeline (see README, "Stories"):

    Google Doc  ──File ▸ Download ▸ Microsoft Word──▶  <manuscript>.docx
    python3 story-docx-to-md.py <manuscript>.docx  ──▶  md/stories/<slug>.md
    python3 story-md-to-api.py md/stories/<slug>.md --upload  ──▶  database

FF stories color-code dialogue, and the text color is often the only clue to
who is speaking — .docx is the one Google export that both preserves colors
and parses with the stdlib. This script maps colors to character names:

    python3 story-docx-to-md.py <manuscript>.docx           wizard: prompts for
                                                            story metadata and any
                                                            unmapped colors, saves
                                                            answers to meta/stories/
    python3 story-docx-to-md.py <manuscript>.docx --batch   non-interactive: exits
                                                            with a report if meta
                                                            is missing/incomplete

Reads  <manuscript>.docx
       ./meta/stories/<slug>.json    metadata + color→character map
Writes ./md/stories/<slug>.md        the editing format — review it before upload

The `format` meta field (asked by the wizard, required in --batch) picks how
colored spans inside a paragraph are handled:
    script (default)  a whole paragraph is either narration or one voice; a
                      colored span mid-paragraph still splits into separate
                      lines (fine when authors write dialogue on its own line).
    prose             novel-style: a mixed paragraph becomes ONE narration line
                      with inline [spoken]{Speaker} spans, so dialogue stays
                      embedded in the prose (no comma-fragment splitting).

How the document is read:
    Title / Subtitle styles          story title / blurb (frontmatter defaults)
    Heading 1                        chapter break ("Chapter N: ..." numbering is
                                     honored when increasing, else sequential)
    Heading 2                        prose: "## Title" in-chapter heading;
                                     script: another chapter break
    paragraph in a mapped color      DIALOGUE by that character
    colored span inside a paragraph  script: splits into narration + dialogue
                                     lines; prose: inline [span]{Speaker} kept in
                                     one paragraph, seam whitespace preserved
    italic / bold run                prose: *italic* / **bold** emphasis, kept
                                     inline (nests inside dialogue spans);
                                     script: flattened to plain text
    wholly italic paragraph          prose: italic narration; script: ACTION line
    monospace paragraphs (Courier,   one TRANSCRIPT block per run of consecutive
      Consolas, Roboto Mono...)      monospace paragraphs
    horizontal rule or *** / - - -   BREAK (scene break)

Colors mapped to an empty name count as narration (ink color, not a voice).
Underline and other inline formatting is flattened to plain text.
"""

import argparse
import json
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    import readline  # noqa: F401 — line editing/history in the interactive prompts
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
META_DIR = ROOT / "meta" / "stories"
MD_DIR = ROOT / "md" / "stories"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

MONO_FONTS = {"courier new", "courier", "consolas", "roboto mono", "source code pro", "jetbrains mono"}
CHAPTER_HEADING = re.compile(r"^chapter\s+(\d+)\s*[:.–—-]?\s*(.*)$", re.IGNORECASE)
BREAK_TEXT = re.compile(r"^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$")
SLUG_OK = re.compile(r"^[a-z0-9-]+$")


# ---------- docx reading ----------

def load_document(path):
    try:
        with zipfile.ZipFile(path) as zf:
            xml = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError):
        sys.exit(f"error: {path} is not a .docx (export the Doc via File ▸ Download ▸ Microsoft Word)")
    return ET.fromstring(xml)


def normalize_color(value):
    """w:color values -> '#rrggbb', or None for default/automatic ink."""
    if not value or value.lower() == "auto":
        return None
    value = value.lower().lstrip("#")
    if len(value) != 6:
        return None
    return f"#{value}"


def run_properties(run):
    """(text, color, italic, mono, bold) for one <w:r>."""
    parts = []
    for node in run.iter():
        if node.tag == f"{W}t":
            parts.append(node.text or "")
        elif node.tag == f"{W}tab":
            parts.append("\t")
        elif node.tag == f"{W}br":
            parts.append("\n")
    text = "".join(parts)

    rpr = run.find(f"{W}rPr")
    color, italic, mono, bold = None, False, False, False
    if rpr is not None:
        color_el = rpr.find(f"{W}color")
        if color_el is not None:
            color = normalize_color(color_el.get(f"{W}val"))
        italic_el = rpr.find(f"{W}i")
        italic = italic_el is not None and italic_el.get(f"{W}val") not in ("0", "false")
        bold_el = rpr.find(f"{W}b")
        bold = bold_el is not None and bold_el.get(f"{W}val") not in ("0", "false")
        fonts = rpr.find(f"{W}rFonts")
        if fonts is not None:
            face = (fonts.get(f"{W}ascii") or fonts.get(f"{W}hAnsi") or "").lower()
            mono = face in MONO_FONTS
    return text, color, italic, mono, bold


def read_paragraphs(body):
    """Flatten the document into dicts: {style, hr, runs: [(text, color, italic, mono, bold)]}."""
    paragraphs = []
    for p in body.iter(f"{W}p"):
        ppr = p.find(f"{W}pPr")
        style, hr = None, False
        if ppr is not None:
            style_el = ppr.find(f"{W}pStyle")
            if style_el is not None:
                style = style_el.get(f"{W}val")
            # Google exports a horizontal rule as an empty paragraph with a border
            hr = ppr.find(f"{W}pBdr") is not None
        runs = [run_properties(r) for r in p.findall(f"{W}r")]
        runs = [r for r in runs if r[0]]
        paragraphs.append({"style": style, "hr": hr, "runs": runs})
    return paragraphs


def paragraph_text(paragraph):
    return "".join(text for text, *_ in paragraph["runs"]).strip()


# ---------- meta / wizard ----------

def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text or "untitled"


def collect_colors(paragraphs):
    """{color: {'count': n, 'samples': [...]}} for every non-default ink."""
    seen = {}
    for paragraph in paragraphs:
        if paragraph["style"] in ("Title", "Subtitle"):
            continue
        for text, color, _italic, _mono, _bold in paragraph["runs"]:
            if color is None or not text.strip():
                continue
            entry = seen.setdefault(color, {"count": 0, "samples": []})
            entry["count"] += 1
            sample = text.strip()
            if len(entry["samples"]) < 3 and sample not in entry["samples"]:
                entry["samples"].append(sample[:70])
    return seen


def prompt(question, default=None):
    suffix = f" [{default}]" if default else ""
    answer = input(f"{question}{suffix}: ").strip()
    return answer or default or None


def run_wizard(meta, colors, doc_title, doc_blurb, source_name):
    print("\n-- story metadata (enter accepts the default) --")
    meta["title"] = prompt("title", meta.get("title") or doc_title or source_name)
    default_slug = meta.get("slug") or slugify(meta["title"])
    while True:
        slug = prompt("slug", default_slug)
        if SLUG_OK.match(slug):
            meta["slug"] = slug
            break
        print("  slug must be lowercase letters/digits/hyphens")
    meta["blurb"] = prompt("blurb", meta.get("blurb") or doc_blurb or None)
    meta["author"] = prompt("author (site username)", meta.get("author") or None)
    meta["published"] = prompt("published (YYYY-MM-DD)", meta.get("published") or None)
    while True:
        # prose = dialogue is embedded inside narration paragraphs (novel-style);
        # script = narration and dialogue alternate as whole paragraphs (VM-style)
        fmt = (prompt("format (script/prose)", meta.get("format") or "script") or "script").lower()
        if fmt in ("script", "prose"):
            meta["format"] = fmt
            break
        print("  format must be 'script' or 'prose'")

    unmapped = [c for c in colors if c not in meta["colors"]]
    if unmapped:
        print("\n-- color → character map (empty answer = narration ink, not a voice) --")
        for color in sorted(unmapped, key=lambda c: -colors[c]["count"]):
            info = colors[color]
            print(f"\n  {color} — {info['count']} run(s):")
            for sample in info["samples"]:
                print(f"    | {sample}")
            name = input("  character: ").strip()
            meta["colors"][color] = name or None
    return meta


# ---------- conversion ----------

def speaker_for(color, color_map):
    """Character name for a run color, or None when it reads as narration."""
    if color is None:
        return None
    return color_map.get(color)


def segment_paragraph(paragraph, color_map):
    """Split a paragraph's runs into (speaker|None, text) segments in order."""
    segments = []
    for text, color, _italic, _mono, _bold in paragraph["runs"]:
        speaker = speaker_for(color, color_map)
        if segments and segments[-1][0] == speaker:
            segments[-1] = (speaker, segments[-1][1] + text)
        else:
            segments.append((speaker, text))
    return [(speaker, " ".join(text.split())) for speaker, text in segments if text.strip()]


def segment_paragraph_prose(paragraph, color_map):
    """Merge runs into styled atoms so an inline-dialogue paragraph can be rebuilt
    without eating seam whitespace or losing emphasis.

    Returns atoms (speaker|None, italic, bold, core, had_leading_ws,
    had_trailing_ws): `core` has internal whitespace collapsed; the boundary
    flags remember whether the source run touched whitespace on either side.
    Runs merge while (speaker, italic, bold) are identical."""
    merged = []  # (speaker, italic, bold, raw)
    for text, color, italic, _mono, bold in paragraph["runs"]:
        speaker = speaker_for(color, color_map)
        key = (speaker, italic, bold)
        if merged and merged[-1][:3] == key:
            merged[-1] = (*key, merged[-1][3] + text)
        else:
            merged.append((*key, text))
    atoms = []
    for speaker, italic, bold, raw in merged:
        core = " ".join(raw.split())
        if not core:
            # whitespace-only run — mark a seam on the previous atom
            if atoms:
                a = atoms[-1]
                atoms[-1] = (*a[:5], True)
            continue
        atoms.append((speaker, italic, bold, core, raw != raw.lstrip(), raw != raw.rstrip()))
    return atoms


def emphasize(core, italic, bold):
    """Wrap text in the markdown emphasis markers for its style."""
    if italic and bold:
        return f"***{core}***"
    if bold:
        return f"**{core}**"
    if italic:
        return f"*{core}*"
    return core


def render_prose_paragraph(atoms):
    """One markdown NARRATION paragraph: consecutive same-speaker atoms group into
    a single [spoken]{Speaker} span, emphasis markers wrap styled atoms inside,
    and a single space is kept at each seam the source had whitespace on."""
    def seam(prev, nxt):
        return " " if prev[5] or nxt[4] else ""

    parts = []
    i, n = 0, len(atoms)
    while i < n:
        speaker = atoms[i][0]
        group, j = [], i
        while j < n and atoms[j][0] == speaker:
            group.append(atoms[j])
            j += 1
        if i > 0:
            parts.append(seam(atoms[i - 1], atoms[i]))
        inner = "".join(
            (seam(group[k - 1], atom) if k > 0 else "") + emphasize(atom[3], atom[1], atom[2])
            for k, atom in enumerate(group)
        )
        parts.append(f"[{inner}]{{{speaker}}}" if speaker is not None else inner)
        i = j
    return "".join(parts)


def strip_speaker_prefix(text, speaker):
    """Drop a redundant 'Name:' the author typed inside the colored line."""
    match = re.match(r"^([^:]{1,40}):\s*(.+)$", text)
    if match and match.group(1).strip().lower() == speaker.lower():
        return match.group(2)
    return text


def convert(paragraphs, meta):
    """Paragraph dicts -> markdown body lines (without frontmatter)."""
    color_map = meta["colors"]
    is_prose = (meta.get("format") or "script").strip().lower() == "prose"
    out = []
    chapter_count = 0
    last_number = 0
    transcript = []  # consecutive monospace paragraphs, flushed as one block
    warnings = []

    def flush_transcript():
        nonlocal transcript
        if transcript:
            out.append("```transcript")
            out.append("\n\n".join(transcript))
            out.append("```")
            out.append("")
            transcript = []

    for paragraph in paragraphs:
        style = paragraph["style"] or ""
        text = paragraph_text(paragraph)

        if style in ("Title", "Subtitle"):
            continue  # consumed as frontmatter defaults

        if style.startswith("Heading") and style[7:] in ("1", "2") and text:
            # Prose: Heading 1 = chapter, Heading 2 = in-chapter section heading.
            # Script: both levels are chapters (legacy behavior).
            if is_prose and style[7:] == "2":
                flush_transcript()
                out.append(f"## {text}")
                out.append("")
                continue
            flush_transcript()
            chapter_count += 1
            match = CHAPTER_HEADING.match(text)
            if match and int(match.group(1)) > last_number:
                number, title = int(match.group(1)), match.group(2).strip()
            else:
                number, title = last_number + 1, text
                if match:
                    warnings.append(f"heading {text!r} does not increase — renumbered to {number}")
            last_number = number
            out.append(f"# Chapter {number}{f': {title}' if title else ''}")
            out.append("")
            continue

        if paragraph["hr"] and not text:
            flush_transcript()
            out.append("***")
            out.append("")
            continue

        if not text:
            continue

        if BREAK_TEXT.match(text):
            flush_transcript()
            out.append("***")
            out.append("")
            continue

        if paragraph["runs"] and all(mono for _t, _c, _i, mono, _b in paragraph["runs"]):
            transcript.append(text)
            continue
        flush_transcript()

        wholly_italic = all(italic for _t, _c, italic, _m, _b in paragraph["runs"])

        if is_prose:
            # Every prose paragraph is one NARRATION line: inline [spoken]{Speaker}
            # dialogue spans and *emphasis* are carried as segments (a wholly-
            # italic paragraph becomes italic narration, not ACTION). Dialogue,
            # emphasis, and their nesting are all handled by render_prose_paragraph.
            if any(ch in text for ch in "[]{}*"):
                warnings.append(f"prose paragraph contains literal []{{}}* that may collide with span/emphasis syntax: {text[:40]!r}")
            atoms = segment_paragraph_prose(paragraph, color_map)
            paragraph_md = render_prose_paragraph(atoms)
            if paragraph_md[:1] in "#>`":
                warnings.append(f"paragraph starts with a markdown marker: {paragraph_md[:40]!r}")
            out.append(paragraph_md)
            out.append("")
            continue

        segments = segment_paragraph(paragraph, color_map)
        narration_only = all(speaker is None for speaker, _ in segments)

        if narration_only and wholly_italic:
            out.append(f"_{' '.join(text.split())}_")
            out.append("")
            continue

        for speaker, segment_text in segments:
            if speaker is None:
                if segment_text[0] in "#>_`*":
                    warnings.append(f"narration starts with a markdown marker: {segment_text[:40]!r}")
                out.append(segment_text)
            else:
                out.append(f"> {speaker}: {strip_speaker_prefix(segment_text, speaker)}")
            out.append("")

    flush_transcript()
    if chapter_count == 0:
        # no headings — story-md-to-api treats a headingless body as one chapter
        pass
    return out, warnings


def frontmatter(meta):
    lines = ["---"]
    for key in ("slug", "title", "blurb", "author", "published", "themeColor", "themeColor2", "format"):
        value = meta.get(key)
        if value:
            lines.append(f"{key}: {value}")
    lines.append("---")
    lines.append("")
    return lines


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser(description="Convert a Google Docs .docx into story markdown.")
    parser.add_argument("manuscript", type=Path, help="the .docx exported from Google Docs")
    parser.add_argument("--batch", action="store_true",
                        help="no prompts — fail with a report if metadata or colors are missing")
    parser.add_argument("--slug", help="story slug (locates meta/stories/<slug>.json; required with --batch)")
    args = parser.parse_args()

    body = load_document(args.manuscript).find(f"{W}body")
    paragraphs = read_paragraphs(body)
    colors = collect_colors(paragraphs)

    doc_title = next((paragraph_text(p) for p in paragraphs if p["style"] == "Title"), None)
    doc_blurb = next((paragraph_text(p) for p in paragraphs if p["style"] == "Subtitle"), None)

    slug = args.slug or (slugify(doc_title) if doc_title else slugify(args.manuscript.stem))
    meta_path = META_DIR / f"{slug}.json"
    meta = {"slug": slug, "title": None, "blurb": None, "author": None,
            "published": None, "themeColor": None, "themeColor2": None, "format": None, "colors": {}}
    if meta_path.exists():
        meta.update(json.loads(meta_path.read_text(encoding="utf-8")))

    if args.batch:
        missing = [c for c in colors if c not in meta["colors"]]
        if not meta.get("title") or not meta.get("format") or missing:
            print(f"{meta_path.relative_to(ROOT)} is incomplete:", file=sys.stderr)
            if not meta.get("title"):
                print("  title: <missing>", file=sys.stderr)
            if not meta.get("format"):
                print("  format: <missing> (set to 'script' or 'prose')", file=sys.stderr)
            for color in missing:
                samples = "; ".join(colors[color]["samples"])
                print(f'  colors["{color}"]: <unmapped> — {colors[color]["count"]} run(s): {samples}', file=sys.stderr)
            sys.exit(1)
    else:
        meta = run_wizard(meta, colors, doc_title, doc_blurb, args.manuscript.stem)
        if meta["slug"] != slug:  # wizard changed the slug — save under the new name
            meta_path = META_DIR / f"{meta['slug']}.json"

    META_DIR.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(meta, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")

    body_lines, warnings = convert(paragraphs, meta)
    MD_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MD_DIR / f"{meta['slug']}.md"
    out_path.write_text("\n".join(frontmatter(meta) + body_lines).rstrip() + "\n", encoding="utf-8")

    dialogue = sum(1 for line in body_lines if line.startswith("> "))
    print(f"\n{out_path.relative_to(ROOT)}: {dialogue} dialogue line(s), "
          f"{len([c for c, n in meta['colors'].items() if n])} voice color(s)")
    for warning in warnings:
        print(f"warning: {warning}")
    print(f"next: review the markdown, then  python3 story-md-to-api.py {out_path.relative_to(ROOT)} --upload")


if __name__ == "__main__":
    main()
