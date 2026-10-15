#!/usr/bin/env python3
"""ff4_punct.py md/ff4/N-slug.md   (run from archive-to-markdown/)

Punctuation/capitalization scan for the installed episode: lists dialogue and
action lines that start lowercase or end without terminal punctuation
(. ! ? ... ~ " ) or a trailing dash). Read-only; fix by hand. Guide §2.4.
Tagged actions (_`Name`: …_), embeds and metadata lines are skipped.
"""
import re, sys

for n, l in enumerate(open(sys.argv[1], encoding='utf-8').read().split('\n'), 1):
    s = l.strip()
    if not s or s.startswith(('**', '<', '⌘', '↪', '📎', '_`')):
        continue
    x = re.match(r'^(> )?(`[^`]+`: )?(.*)$', s).group(3).strip('_')
    if not x:
        continue
    bad = []
    if x[0].isalpha() and x[0].islower():
        bad.append('lowercase start')
    if not re.search(r'[.!?…~")\-]$|\*$', x):
        bad.append('no terminal punctuation')
    if bad:
        print(f'{n}: {", ".join(bad)}: {s[:110]}')
