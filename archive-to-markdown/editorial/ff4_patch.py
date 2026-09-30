#!/usr/bin/env python3
"""ff4_patch.py prep-K.md ops-K.txt edit-K.md   (run from archive-to-markdown/)

Patches a prep part instead of retyping it. Read prep-K.md, write ops-K.txt,
run this, get edit-K.md. Every sub must match exactly once (else it aborts and
shows the block), so typos surface immediately.

Ops (one per line unless noted; IDs are Discord message IDs from headers;
an ID may be abbreviated to its last 6+ digits if unique in the part; copy them
  carefully from the header, a wrong suffix aborts with 'ID x: 0 matches'):
  cut ID ID ...                remove whole blocks
  keep ID ID ...               drop the leading '✂ ' marks in those blocks
  sub ID :: old => new         substring replace inside one block (must match once)
  sub* ID :: old => new        replace all occurrences in the block
  set ID                       replace block body with following lines up to a line '.'
  who ID Name                  change header author
  ins ID Name                  insert a new block AFTER block ID; body follows up to '.'
  insb ID Name                 insert a new block BEFORE block ID
  after-embed: n/a
Body lines are written verbatim. Blank lines inside a body are kept.
"""
import re, sys

HDR = re.compile(r'^\*\*(.+?)\*\* _\((.+?)\)_(?: \[(\d+)\])?\s*$')


def parse(text):
    blocks, cur = [], None
    for line in text.split('\n'):
        m = HDR.match(line)
        if m:
            cur = {'who': m.group(1), 'ts': m.group(2), 'id': m.group(3), 'body': []}
            blocks.append(cur)
        elif cur is not None:
            cur['body'].append(line)
    for b in blocks:
        while b['body'] and b['body'][0] == '': b['body'].pop(0)
        while b['body'] and b['body'][-1] == '': b['body'].pop()
    return blocks


def find(blocks, key):
    hits = [i for i, b in enumerate(blocks) if b['id'] and b['id'].endswith(key)]
    if len(hits) != 1:
        sys.exit(f'ID {key}: {len(hits)} matches')
    return hits[0]


def main(prep, ops, out):
    blocks = parse(open(prep, encoding='utf-8').read())
    lines = open(ops, encoding='utf-8').read().split('\n')
    i = 0
    inserts_after, inserts_before = {}, {}
    cut, keep = set(), set()
    subs, sets, whos = [], {}, {}
    def body(i):
        b = []
        while i < len(lines) and lines[i] != '.':
            b.append(lines[i]); i += 1
        return b, i + 1
    while i < len(lines):
        ln = lines[i]; i += 1
        if not ln.strip() or ln.startswith('#'): continue
        cmd, _, rest = ln.partition(' ')
        if cmd == 'cut':
            for k in rest.split(): cut.add(find(blocks, k))
        elif cmd == 'keep':
            for k in rest.split(): keep.add(find(blocks, k))
        elif cmd in ('sub', 'sub*'):
            k, _, spec = rest.partition(' :: ')
            old, _, new = spec.partition(' => ')
            subs.append((find(blocks, k), old, new, cmd == 'sub*'))
        elif cmd == 'set':
            b, i = body(i); sets[find(blocks, rest.strip())] = b
        elif cmd == 'who':
            k, _, n = rest.partition(' '); whos[find(blocks, k)] = n.strip()
        elif cmd in ('ins', 'insb'):
            k, _, n = rest.partition(' ')
            b, i = body(i)
            (inserts_after if cmd == 'ins' else inserts_before).setdefault(find(blocks, k), []).append((n.strip(), b))
        else:
            sys.exit(f'bad op: {ln}')
    for idx in keep:
        blocks[idx]['body'] = [l[2:] if l.startswith('✂ ') else l for l in blocks[idx]['body']]
    for idx, old, new, allocc in subs:
        t = '\n'.join(blocks[idx]['body'])
        n = t.count(old)
        if n == 0 or (n > 1 and not allocc):
            sys.exit(f'sub in {blocks[idx]["id"]}: {n} matches for {old!r}\n{t}')
        blocks[idx]['body'] = t.replace(old, new).split('\n')
    for idx, b in sets.items(): blocks[idx]['body'] = b
    for idx, n in whos.items(): blocks[idx]['who'] = n
    res = []
    def emit(b):
        h = f"**{b['who']}** _({b['ts']})_" + (f" [{b['id']}]" if b['id'] else '')
        res.append(h + '\n\n' + '\n'.join(b['body']) + '\n')
    for idx, b in enumerate(blocks):
        for n, bd in inserts_before.get(idx, []):
            emit({'who': n, 'ts': b['ts'], 'id': None, 'body': bd})
        if idx not in cut: emit(b)
        for n, bd in inserts_after.get(idx, []):
            emit({'who': n, 'ts': b['ts'], 'id': None, 'body': bd})
    open(out, 'w', encoding='utf-8').write('\n'.join(res))
    left = sum(l.startswith('✂') for r in res for l in r.split('\n'))
    print(f'{out}: {len(blocks)} -> {len(res)} blocks; cut {len(cut)}; ✂ left {left}')


main(*sys.argv[1:4])
