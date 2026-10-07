#!/usr/bin/env python3
"""Find FF4 conversation threads (Discord replies) that are scattered in the markdown.

    python3 editorial/ff4_reply_threads.py md/ff4/20-event-horizon.md
    python3 editorial/ff4_reply_threads.py md/ff4/20-event-horizon.md --min-gap 3 --long-min 10

The md keeps only a truncated `↪ Who: quote` marker, so the real reply links
come from the Discord export that contains the episode's message IDs. Authors
(ff4_merge_candidates.py) find one thought split up; replies find a
conversation split up. Nothing is edited; this prints where to look.

A thread is a root message plus everything that replies to it, directly or via
a reply. For each reply whose block sits more than --min-gap blocks from the
previous member of its thread (or sits BEFORE it), it prints both ends and a
proposed `MOVE:AFTER` spec for ff4_move_blocks.py, chained so a thread gathers
behind its root. Gaps over --long-min minutes are marked LONG and not proposed
(the delay may be real; judge by hand). Replies whose target was cut from the
md, or isn't in this export, are skipped and counted.
"""
import argparse, glob, json, os, re, sys

HEADER = re.compile(r'^\*\*(?P<author>.+?)\*\* _\((?P<when>[^)]*)\)_(?: \[(?P<id>\d+)\])?\s*$')
EPOCH = 1420070400000


def secs(i):
    return ((int(i) >> 22) + EPOCH) / 1000.0


def parse(path):
    blocks = []
    for line in open(path, encoding='utf-8').read().split('\n'):
        m = HEADER.match(line)
        if m:
            blocks.append({'author': m['author'], 'id': m['id'], 'body': []})
        elif blocks and line.strip():
            blocks[-1]['body'].append(line.strip())
    return blocks


def preview(b, n=70):
    for l in b['body']:
        if not l.startswith(('↪', '⌘', '📎')):
            return re.sub(r'\s+', ' ', l)[:n]
    return (b['body'][0] if b['body'] else '')[:n]


def find_reply_map(ids):
    ids = set(ids)
    here = os.path.dirname(os.path.abspath(__file__))
    for f in glob.glob(os.path.join(here, '../../../discord-exports/episodes/*.json')):
        raw = open(f, encoding='utf-8').read()
        probe = next(iter(ids))
        if probe not in raw:
            continue
        msgs = json.loads(raw)['messages']
        have = {m['id'] for m in msgs}
        if len(ids & have) < len(ids) * 0.5:
            continue
        return {m['id']: m['reference']['messageId'] for m in msgs
                if (m.get('reference') or {}).get('messageId')}
    sys.exit('no matching discord export found')


ap = argparse.ArgumentParser()
ap.add_argument('md')
ap.add_argument('--min-gap', type=int, default=3, help='blocks between a reply and its thread predecessor')
ap.add_argument('--long-min', type=float, default=10, help='minutes; beyond this, flag LONG instead of proposing')
a = ap.parse_args()

blocks = parse(a.md)
pos = {b['id']: i for i, b in enumerate(blocks) if b['id']}
replies = find_reply_map(pos)
parent = {c: p for c, p in replies.items() if c in pos and p in pos}
skipped = sum(1 for c in replies if c in pos and replies[c] not in pos)

def root(i):
    while i in parent:
        i = parent[i]
    return i

threads = {}
for c in parent:
    threads.setdefault(root(c), set()).update({c, root(c)})

out, specs, nlong = [], [], 0
for r, members in sorted(threads.items(), key=lambda kv: min(pos[m] for m in kv[1])):
    order = sorted(members, key=lambda m: pos[m])
    lines = []
    for prev, cur in zip(order, order[1:]):
        gap = pos[cur] - pos[prev] - 1
        mins = abs(secs(cur) - secs(prev)) / 60
        reversed_ = pos[cur] < pos[parent[cur]]
        if gap <= a.min_gap and not reversed_:
            continue
        tag = 'LONG ' if mins > a.long_min else ''
        if tag:
            nlong += 1
        else:
            specs.append(f'{cur}:{prev}')
        lines.append(f'  {tag}gap {gap:>2} blocks, {mins:4.1f} min   {blocks[pos[prev]]["author"][:8]:8} "{preview(blocks[pos[prev]], 48)}"'
                     f'\n    -> {blocks[pos[cur]]["author"][:8]:8} "{preview(blocks[pos[cur]], 60)}"   [{cur[-6:]} after {prev[-6:]}]')
    if lines:
        out.append(f'thread root {r[-6:]} ({len(order)} msgs)')
        out.extend(lines)

print('\n'.join(out) if out else 'no scattered reply threads')
print(f'\n{len(threads)} threads, {len(parent)} replies in md, {skipped} skipped (target cut), {nlong} LONG')
if specs:
    print('\nproposed (full IDs, in order):\n' + ' '.join(specs))
