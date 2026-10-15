#!/usr/bin/env python3
"""Move FF4 blocks by Discord message ID. Nothing else is touched.

    python3 editorial/ff4_move_blocks.py md/ff4/1-episode-1.md MOVE_ID:AFTER_ID [MOVE_ID:AFTER_ID ...]

Each MOVE_ID:AFTER_ID puts the block whose header carries MOVE_ID directly
after the block carrying AFTER_ID. Headers, IDs and timestamps stay as they
are (a moved block keeps its original timestamp). ID-less blocks that
directly follow the moved block (added outcome beats, say) travel with it,
and the move lands after any ID-less blocks that trail the anchor. Carried
blocks are printed so you can check them. Specs apply in order.
"""
import re, sys

HDR = re.compile(r'^\*\*.+?\*\* _\([^)]*\)_(?: \[(\d+)\])?\s*$')


def load(path):
    blocks, cur = [], None
    for line in open(path, encoding='utf-8').read().split('\n'):
        m = HDR.match(line)
        if m:
            cur = {'id': m.group(1), 'lines': [line]}
            blocks.append(cur)
        elif cur is None:
            raise SystemExit('text before first header')
        else:
            cur['lines'].append(line)
    return blocks


def save(path, blocks):
    open(path, 'w', encoding='utf-8').write('\n'.join(l for b in blocks for l in b['lines']))


def move(blocks, mid, after):
    ids = [b['id'] for b in blocks if b['id']]
    assert len(ids) == len(set(ids)), 'duplicate ids'
    i = next(k for k, b in enumerate(blocks) if b['id'] == mid)
    j = next(k for k, b in enumerate(blocks) if b['id'] == after)
    assert i != j
    # carry the ID-less blocks that directly follow the moved one
    n = 1
    while i + n < len(blocks) and blocks[i + n]['id'] is None:
        n += 1
    chunk = blocks[i:i + n]
    if n > 1:
        print(f'  {mid} carries {n - 1} id-less block(s):', [c['lines'][0][:40] for c in chunk[1:]])
    rest = blocks[:i] + blocks[i + n:]
    j = next(k for k, b in enumerate(rest) if b['id'] == after)
    # keep the anchor's own trailing id-less blocks (its added beats) before the insertion
    k = j + 1
    while k < len(rest) and rest[k]['id'] is None:
        k += 1
    rest[k:k] = chunk
    return rest


if __name__ == '__main__':
    path = sys.argv[1]
    blocks = load(path)
    for spec in sys.argv[2:]:
        mid, after = spec.split(':')
        blocks = move(blocks, mid, after)
    save(path, blocks)
