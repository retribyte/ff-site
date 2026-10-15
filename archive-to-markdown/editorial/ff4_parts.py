#!/usr/bin/env python3
"""Split an FF4 prep file into editable parts, or join edited parts back.
Usage (from archive-to-markdown/):
    python3 editorial/ff4_parts.py split <prep.md> <dir> [lines_per_part=600]
        -> <dir>/prep-1.md, prep-2.md, ... cut only at block headers
    python3 editorial/ff4_parts.py join <out.md> <edit-1.md> [<edit-2.md> ...]
        -> concatenated, blank-line runs collapsed
Parts are cut at block boundaries, so each edit-K.md starts with a header."""
import os, re, sys

HEADER = re.compile(r'^\*\*[^*]+\*\* _\(')

def split(src, out_dir, size):
    lines = open(src, encoding='utf-8').read().split('\n')
    os.makedirs(out_dir, exist_ok=True)
    parts, cur = [], []
    for line in lines:
        if HEADER.match(line) and len(cur) >= size:
            parts.append(cur); cur = []
        cur.append(line)
    if cur:
        parts.append(cur)
    for k, part in enumerate(parts, 1):
        path = os.path.join(out_dir, f'prep-{k}.md')
        open(path, 'w', encoding='utf-8').write('\n'.join(part).strip('\n') + '\n')
        print(path, len(part), 'lines')

def join(out, parts):
    text = '\n\n'.join(open(p, encoding='utf-8').read().strip('\n') for p in parts)
    open(out, 'w', encoding='utf-8').write(re.sub(r'\n{3,}', '\n\n', text) + '\n')
    print(out)

if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'split':
        split(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 600)
    elif len(sys.argv) >= 4 and sys.argv[1] == 'join':
        join(sys.argv[2], sys.argv[3:])
    else:
        sys.exit(__doc__)
