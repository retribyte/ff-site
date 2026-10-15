"""Verify an edited FF1 episode.   python3 editorial/ff1-verify.py <N> [file.md]

Runs md-to-api.py's convert_file on md/ff1/N.md and reports the gates the
FF2/FF3 passes used: type counts, unresolved speakers, OTHER lines from
non-bots, orphan bot replies, lint hits, slurs, and action density.
Exit status 1 if any gate fails.
"""
import collections
import os
import importlib.util
import re
import sys

n = sys.argv[1]
path = sys.argv[2] if len(sys.argv) > 2 else f"md/ff1/{n}.md"
sys.path.insert(0, os.getcwd())
spec = importlib.util.spec_from_file_location("m2a", "md-to-api.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
meta = m.load_meta("ff1")
ep = next(e for e in meta["episodes"] if str(e["episode_number"]) == n)
res = m.convert_file(path, meta, ep)
msgs = res["messages"] if isinstance(res, dict) else res
bad = 0

print("types:", dict(collections.Counter(x["type"] for x in msgs)))
unres = [x["text"][:70] for x in msgs if x["type"] in ("ACTION", "QUOTE") and not x.get("character")]
print("unresolved speakers:", len(unres))
for t in unres[:15]:
    print("   ", t)
bad += bool(unres)

bots = set(meta.get("bots", []))
other = [x["text"][:70] for x in msgs if x["type"] == "OTHER" and x["player"] not in bots]
print("OTHER lines (should be 0):", len(other))
for t in other[:15]:
    print("   ", t)
bad += bool(other)

orph = []
for i, x in enumerate(msgs):
    if x["type"] == "BOT_RESPONSE" and not x["text"].startswith("🐐"):
        prev = next((y for y in reversed(msgs[:i]) if y["type"] != "BOT_RESPONSE"), None)
        if not prev or prev["type"] != "COMMAND":
            orph.append(x["text"][:70])
print("bot replies not following a command (🐐 excepted):", len(orph))
for t in orph[:15]:
    print("   ", t)
bad += bool(orph)

chars = collections.Counter(x["character"] for x in msgs if x.get("character"))
print("characters:", dict(chars))

lines = open(path, encoding="utf-8").read().split("\n")
lint = [(i + 1, l[:80]) for i, l in enumerate(lines)
        if re.search(r"^> _|^> `[^`]*`$|\\\*|[^ ]  $|^\*[^*_]", l)]
print("lint hits:", len(lint))
for i, l in lint[:15]:
    print("   ", i, l)
bad += bool(lint)

slurs = [(i + 1, l[:80]) for i, l in enumerate(lines)
         if re.search(r"\b(fag|nigg|retard|tranny|dyke)", l, re.I)]
print("slur hits (should be 0):", len(slurs))
for i, l in slurs[:10]:
    print("   ", i, l)
bad += bool(slurs)

act = sum(1 for l in lines if re.match(r"^_.*_$", l))
dia = sum(1 for l in lines if l.startswith("> "))
print(f"density: {act} action lines, {dia} dialogue lines, {act / max(1, act + dia):.0%} action")
sys.exit(1 if bad else 0)
