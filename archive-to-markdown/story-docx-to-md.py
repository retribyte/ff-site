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
    first line repeating the title   dropped (any style; bold / trailing "." ok)
    Heading 1                        chapter break ("Chapter N: ..." numbering is
                                     honored when increasing, else sequential;
                                     text before an explicit "Chapter 1" → Chapter 0)
    Heading 2                        prose: "## Title" in-chapter heading, or a
                                     chapter break when there's no Heading 1
                                     besides the title; script: chapter break
    soft line break (Shift+Enter)    starts a new paragraph
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
    horizontal line or *** / - - -   BREAK (scene break) — Google exports
                                     Insert ▸ Horizontal line as a VML rect
    quote marks at a styled/colored  moved outside: “[*…*]{Name},” (comma
      run's edge                     before the closing quote too)
    Heading 3+                       prose: "## Title" in-chapter section
    page break, or a run of empty    BREAK — "spacing around it" is the most
      paragraphs longer than the     common gap (0 or 1) among the 3 gaps on
      spacing around it              either side and across the doc; never
                                     next to a heading or at the end
    mostly-monospace document        monospace is the body font, not TRANSCRIPT
    punctuation-only styled run      plain (an italic "(" carries no emphasis)

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
V = "{urn:schemas-microsoft-com:vml}"
O = "{urn:schemas-microsoft-com:office:office}"

PAGE_BREAK = "\x0c"  # stand-in for <w:br w:type="page"/> inside run text
MONO_FONTS = {"courier new", "courier", "consolas", "roboto mono", "source code pro", "jetbrains mono"}
CHAPTER_HEADING = re.compile(r"^chapter\s+(\d+)\s*[:.–—-]?\s*(.*)$", re.IGNORECASE)
BREAK_TEXT = re.compile(r"^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$")
SLUG_OK = re.compile(r"^[a-z0-9]+(_[a-z0-9]+)*$")


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
            # Shift+Enter (textWrapping, or untyped) starts a new paragraph;
            # a page break is a section boundary (see read_paragraphs)
            parts.append(PAGE_BREAK if node.get(f"{W}type") == "page" else "\n")
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


# Inline containers that hold a paragraph's runs: Google wraps link text in
# <w:hyperlink>; Word adds tracked insertions, smart tags, content controls
# and simple fields. Runs inside them are part of the paragraph's text.
INLINE_WRAPPERS = {f"{W}hyperlink", f"{W}ins", f"{W}smartTag", f"{W}sdt", f"{W}sdtContent", f"{W}fldSimple", f"{W}customXml"}


def paragraph_runs(p):
    """A paragraph's runs in order as (run, in_link): direct children plus
    those inside inline wrappers (never runs of a nested paragraph, e.g. in
    a text box)."""
    runs = []
    def walk(el, in_link):
        for child in el:
            if child.tag == f"{W}r":
                runs.append((child, in_link))
            elif child.tag in INLINE_WRAPPERS:
                walk(child, in_link or child.tag == f"{W}hyperlink")
    walk(p, False)
    return runs


def read_paragraphs(body):
    """Flatten the document into dicts: {style, hr, page_break, runs: [(text, color, italic, mono, bold)]}.

    A soft line break (Shift+Enter) inside a paragraph splits it: several
    Drive stories write a whole scene as one paragraph of tab-indented lines
    joined by soft breaks, which would otherwise collapse into one run-on
    line. A page break also splits, and the piece after it is flagged
    `page_break` so convert() can read it as a section boundary."""
    paragraphs = []
    for p in body.iter(f"{W}p"):
        ppr = p.find(f"{W}pPr")
        style, hr = None, False
        if ppr is not None:
            style_el = ppr.find(f"{W}pStyle")
            if style_el is not None:
                style = style_el.get(f"{W}val")
            # one form of horizontal rule: an empty paragraph with a border
            hr = ppr.find(f"{W}pBdr") is not None
        # Google Docs' Insert ▸ Horizontal line exports as a VML rectangle
        # flagged o:hr="t" inside the paragraph
        hr = hr or any(rect.get(f"{O}hr") == "t" for rect in p.iter(f"{V}rect"))
        pieces = [{"style": style, "hr": hr, "page_break": False, "runs": []}]
        for run, in_link in paragraph_runs(p):
            text, *props = run_properties(run)
            if in_link:
                props[0] = None  # link blue is link styling, not a speaker's ink
            for k, chunk in enumerate(re.split(f"(\n|{PAGE_BREAK})", text)):
                if chunk == "\n" or chunk == PAGE_BREAK:
                    pieces.append({"style": style, "hr": False, "page_break": chunk == PAGE_BREAK, "runs": []})
                elif chunk:
                    pieces[-1]["runs"].append((chunk, *props))
        if len(pieces) > 1:
            # a border marks a rule only on a paragraph with no text at all
            for piece in pieces:
                piece["hr"] = False
        paragraphs.extend(pieces)
    return paragraphs


def paragraph_text(paragraph):
    return "".join(text for text, *_ in paragraph["runs"]).strip()


# ---------- meta / wizard ----------

def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower()
    text = re.sub(r"[\s-]+", "_", text)
    text = re.sub(r"[^a-z0-9_]+", "", text)
    text = re.sub(r"_+", "_", text).strip("_")
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
        print("  slug must be lowercase letters, digits, and underscores (^[a-z0-9]+(_[a-z0-9]+)*$)")
    meta["blurb"] = prompt("blurb", meta.get("blurb") or doc_blurb or None)
    meta["authors"] = prompt("authors (site usernames, comma-separated)", meta.get("authors") or meta.pop("author", None) or None)
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
    return color_map.get(color) or None  # "" (narration ink) is not a voice


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
        if merged and not text.strip():
            # whitespace carries no visible style or voice: fold it into the
            # previous run, so `**a** **b**` in one voice stays one atom
            merged[-1] = (*merged[-1][:3], merged[-1][3] + text)
            continue
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


OPEN_QUOTES = "“\"‘"
CLOSE_QUOTES = "”\"’"


def split_quotes(core):
    """(opening quotes, inner, closing) — closing carries a comma that sits
    right before the closing quote. Single quotes only peel as a pair, so a
    possessive ’ stays put."""
    start, end = 0, len(core)
    while start < end and core[start] in OPEN_QUOTES:
        start += 1
    while end > start and core[end - 1] in CLOSE_QUOTES:
        end -= 1
    opened, closed = core[:start], core[end:]
    if ("‘" in opened) != ("’" in closed):  # an unpaired single quote is an apostrophe
        if "‘" in opened:
            start = 0
        if "’" in closed:
            end = len(core)
        opened, closed = core[:start], core[end:]
    inner = core[start:end]
    if closed and inner.endswith(","):
        inner, closed = inner[:-1], "," + closed
    return opened, inner, closed


def emphasize(core, italic, bold):
    """Wrap text in the markdown emphasis markers for its style.

    House style keeps quote marks outside the styling — “*…*”, with a comma
    before the closing quote outside too — whatever the source run covered.
    A run that is nothing but punctuation gets no emphasis at all."""
    marker = "***" if italic and bold else "**" if bold else "*" if italic else ""
    if not marker or not any(ch.isalnum() for ch in core):
        return core
    opened, inner, closed = split_quotes(core)
    return f"{opened}{marker}{inner}{marker}{closed}"


def normalize_atoms(atoms):
    """House style for voiced spans: quote marks (and a comma before the
    closing quote) sit outside the span — “[…]{Name},” — and a voiced run
    with no letters or digits (a lone colored "…" or ".") is narration."""
    atoms = [(None if not any(ch.isalnum() for ch in a[3]) else a[0], *a[1:]) for a in atoms]
    out, i = [], 0
    while i < len(atoms):
        speaker = atoms[i][0]
        j = i
        while j < len(atoms) and atoms[j][0] == speaker:
            j += 1
        group = list(atoms[i:j])
        if speaker is not None:
            first, last = group[0], group[-1]
            opened, _inner, _closed = split_quotes(first[3])
            if opened:
                out.append((None, False, False, opened, first[4], False))
                group[0] = first = (*first[:3], first[3][len(opened):], False, first[5])
                if len(group) == 1:
                    last = first
            _o, _inner, closed = split_quotes(last[3])
            # a comma that ends the span right before a closing quote outside it
            nxt = atoms[j] if j < len(atoms) else None
            if not closed and last[3].endswith(",") and nxt and not last[5] and not nxt[4] and nxt[3][:1] in CLOSE_QUOTES:
                closed = ","
            tail = None
            if closed and len(closed) < len(last[3]):
                group[-1] = (*last[:3], last[3][: len(last[3]) - len(closed)], last[4], False)
                tail = (None, False, False, closed, False, last[5])
            out.extend(group)
            if tail:
                out.append(tail)
        else:
            out.extend(group)
        i = j
    return [a for a in out if a[3]]


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


def title_key(text):
    """Comparable form of a title line: case, emphasis and punctuation dropped."""
    return re.sub(r"[^0-9a-z]+", "", unicodedata.normalize("NFKD", text).casefold())


def scene_gaps(paragraphs):
    """Indices of paragraphs that open a new scene.

    Authors space paragraphs either with no blank paragraph between them or
    with exactly one, and some switch styles partway through a doc (a phone
    call typed one blank line apart inside an unspaced journal). So a run of
    empty paragraphs is a deliberate gap — a scene break or time skip — only
    when it is longer than the spacing around it: the most common gap among
    the three gaps on either side, and the doc's overall most common gap
    (0 or 1). A page break is always a gap."""
    gaps, run, last_text, page = [], 0, None, False
    for index, paragraph in enumerate(paragraphs):
        if paragraph["page_break"]:
            page = True
        if paragraph_text(paragraph) or (paragraph["hr"] and not paragraph["runs"]):
            if last_text is not None:
                gaps.append((index, run, page))
            last_text, run, page = index, 0, False
        else:
            run += 1

    def mode(runs):
        counts = {}
        for r in runs:
            counts[min(r, 1)] = counts.get(min(r, 1), 0) + 1
        return max(counts, key=lambda k: (counts[k], -k)) if counts else 0

    overall = mode(r for _i, r, _p in gaps)
    breaks = set()
    for k, (index, run, page) in enumerate(gaps):
        nearby = [r for _i, r, _p in gaps[max(k - 3, 0):k] + gaps[k + 1:k + 4]]
        if page or run > max(overall, mode(nearby)):
            breaks.add(index)
    return breaks


def convert(paragraphs, meta):
    """Paragraph dicts -> markdown body lines (without frontmatter)."""
    color_map = meta["colors"]
    is_prose = (meta.get("format") or "script").strip().lower() == "prose"
    out = []

    # A leading line that just repeats the story title (as a Heading 1, a
    # plain or bold paragraph, with or without a trailing period) is the
    # document's title, not story text.
    title = title_key(meta.get("title") or "")
    first = next((i for i, p in enumerate(paragraphs)
                  if paragraph_text(p) and p["style"] not in ("Title", "Subtitle")), None)
    skip = {first} if first is not None and title and title_key(paragraph_text(paragraphs[first])) == title else set()

    # With the title gone, a document whose only sections are Heading 2s
    # ("Part 1", "Part 2") is chaptered by them.
    def level(p):
        style = p["style"] or ""
        return style[7:] if style.startswith("Heading") and paragraph_text(p) else None
    # (Heading 3 and below are always in-chapter sections in prose)
    kept = [p for i, p in enumerate(paragraphs) if i not in skip]
    promote_h2 = not any(level(p) == "1" for p in kept) and any(level(p) == "2" for p in kept)

    breaks = scene_gaps(paragraphs)

    # Monospace marks a TRANSCRIPT block only against a proportional body
    # font; a story typed entirely in Courier is just set in Courier.
    body_chars = mono_chars = 0
    for p in paragraphs:
        if p["style"] in ("Title", "Subtitle"):
            continue
        for text, _c, _i, mono, _b in p["runs"]:
            body_chars += len(text.strip())
            mono_chars += len(text.strip()) if mono else 0
    mono_is_body = body_chars > 0 and mono_chars * 2 > body_chars
    chapter_count = 0
    last_number = 0
    transcript = []  # consecutive monospace paragraphs, flushed as one block
    warnings = []
    if mono_is_body:
        warnings.append("most of the text is monospace — treated as the body font, not TRANSCRIPT blocks")

    def flush_transcript():
        nonlocal transcript
        if transcript:
            out.append("```transcript")
            out.append("\n\n".join(transcript))
            out.append("```")
            out.append("")
            transcript = []

    def scene_break():
        # one BREAK per gap, never next to a heading or right after another
        flush_transcript()  # a pending transcript block ends here, before the check
        previous = next((line for line in reversed(out) if line), None)
        if previous is None or previous.startswith("#") or previous == "***":
            return
        out.append("***")
        out.append("")

    for index, paragraph in enumerate(paragraphs):
        style = paragraph["style"] or ""
        text = paragraph_text(paragraph)

        if style in ("Title", "Subtitle") or index in skip:
            continue  # consumed as frontmatter defaults / the title line

        is_heading = style.startswith("Heading") and style[7:].isdigit() and text
        is_mono = not mono_is_body and paragraph["runs"] and all(m for _t, _c, _i, m, _b in paragraph["runs"])
        # spacing inside a transcript block is its own layout, not a scene gap
        # (rules and page breaks still split it)
        if index in breaks and not is_heading and not (transcript and is_mono and not paragraph["page_break"]):
            scene_break()

        if is_heading:
            # Prose: Heading 1 = chapter, Heading 2 = in-chapter section heading
            # (or a chapter, when there are no Heading 1s). Script: both levels
            # are chapters (legacy behavior).
            if is_prose and (style[7:] != "1" and not (style[7:] == "2" and promote_h2)):
                flush_transcript()
                out.append(f"## {text}")
                out.append("")
                continue
            flush_transcript()
            chapter_count += 1
            match = CHAPTER_HEADING.match(text)
            if chapter_count == 1 and any(line and not line.startswith("#") for line in out):
                # Story text before the first chapter heading would become an
                # implicit chapter 1 and collide with an explicit "Chapter 1".
                # Number that preface 0 instead (or one below the first heading).
                first_no = int(match.group(1)) if match else 1
                out.insert(0, "")
                out.insert(0, f"# Chapter {max(first_no - 1, 0)}")
                last_number = max(first_no - 1, 0)
                warnings.append(f"text before the first chapter heading became Chapter {last_number} — give it a title")
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
            scene_break()
            continue

        if not text:
            continue

        if BREAK_TEXT.match(text):
            scene_break()
            continue

        if not mono_is_body and paragraph["runs"] and all(mono for _t, _c, _i, mono, _b in paragraph["runs"]):
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
            atoms = normalize_atoms(segment_paragraph_prose(paragraph, color_map))
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
    # no BREAK at the end of the story or right before a heading
    cleaned = []
    for k, line in enumerate(out):
        if line == "***":
            following = next((l for l in out[k + 1:] if l), None)
            if following is None or following.startswith("#"):
                continue
        cleaned.append(line)
    return cleaned, warnings


def frontmatter(meta):
    lines = ["---"]
    for key in ("slug", "title", "blurb", "authors", "published", "season", "themeColor", "themeColor2", "format"):
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
    meta = {"slug": slug, "title": None, "blurb": None, "authors": None,
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
