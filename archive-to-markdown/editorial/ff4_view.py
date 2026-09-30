#!/usr/bin/env python3
"""ff4_view.py prep-K.md   (run from archive-to-markdown/)

Compact one-line-per-block view of a prep part: `last6-of-ID|Who|time| body`.
Use it to read a part quickly and copy the 6-digit IDs into ops-K.txt for
ff4_patch.py (blank lines dropped, body lines joined with ' ⏎ ').
"""
import re, sys

H = re.compile(r'^\*\*(.+?)\*\* _\((.+?)\)_(?: \[(\d+)\])?\s*$')
cur = None
out = []
for l in open(sys.argv[1], encoding='utf-8').read().split('\n'):
    m = H.match(l)
    if m:
        cur = [m.group(3)[-6:] if m.group(3) else '------', m.group(1)[:3], m.group(2)[-8:], []]
        out.append(cur)
    elif l.strip() and cur:
        cur[3].append(l)
for i, w, ts, b in out:
    print(f"{i}|{w}|{ts}| " + " ⏎ ".join(b))
