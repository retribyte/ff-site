#!/usr/bin/env python3
"""ff4_view.py [--short] prep-K.md   (run from archive-to-markdown/)

Compact one-line-per-block view of a prep part: `last6-of-ID|Who|time| body`.
Use it to read a part quickly and copy the 6-digit IDs into ops-K.txt for
ff4_patch.py (blank lines dropped, body lines joined with ' ⏎ ').

--short: also collapses 8ball embeds to `[8ball Asker: "Q" → A]`, other embeds
to `[embed: first ~120 chars]`, bare URLs to `[link]`, and `↪` reply quotes to
~40 chars. IDs and the `ID|Who|time|` prefix are unchanged.
"""
import re, sys

args = [a for a in sys.argv[1:] if a != '--short']
SHORT = '--short' in sys.argv[1:]

H = re.compile(r'^\*\*(.+?)\*\* _\((.+?)\)_(?: \[(\d+)\])?\s*$')
URL = re.compile(r'https?://\S+')


def tag(s, name):
    m = re.search(rf'<{name}>(.*?)</{name}>', s, re.S)
    return m.group(1).strip() if m else ''


def shorten_embed(chunk):
    """chunk: lines from <embed> to </embed> (a leading '✂ ' kept)."""
    cut = '✂ ' if chunk[0].startswith('✂') else ''
    flat = '\n'.join(chunk)
    title, desc, foot = tag(flat, 'title'), tag(flat, 'description'), tag(flat, 'footer')
    if title.lower().startswith('8ball'):
        m = re.match(r'^(.*?) asked: "(.*)"$', foot, re.S)
        who, q = (m.group(1), m.group(2)) if m else ('?', foot)
        return f'{cut}[8ball {who}: "{q}" → {desc}]'
    text = ' '.join(x for x in (title, desc or tag(flat, 'code') or foot) if x)
    text = re.sub(r'\s+', ' ', text)
    return f'{cut}[embed: {text[:120]}]'


def shorten(body):
    out, i = [], 0
    while i < len(body):
        l = body[i]
        if l.lstrip('✂ ') == '<embed>':
            j = i
            while j < len(body) and body[j].lstrip('✂ ') != '</embed>':
                j += 1
            e = shorten_embed(body[i:j + 1])
            if e.lstrip('✂ ').startswith('[8ball') and out and out[-1].startswith('⌘ '):
                out.pop()  # the ⌘ line only repeats the asker
            out.append(e)
            i = j + 1
            continue
        if l.startswith('↪'):
            l = l[:40].rstrip() + ('…' if len(l) > 40 else '')
        out.append(URL.sub('[link]', l))
        i += 1
    return out


cur = None
out = []
for l in open(args[0], encoding='utf-8').read().split('\n'):
    m = H.match(l)
    if m:
        cur = [m.group(3)[-6:] if m.group(3) else '------', m.group(1)[:3], m.group(2)[-8:], []]
        out.append(cur)
    elif l.strip() and cur:
        cur[3].append(l)
for i, w, ts, b in out:
    if SHORT:
        b = shorten(b)
    print(f"{i}|{w}|{ts}| " + " ⏎ ".join(b))
