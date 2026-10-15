#!/usr/bin/env python3
"""Flag FF4 blocks that look like one thought split up by other people's messages.

    python3 editorial/ff4_merge_candidates.py md/ff4/1-episode-1.md
    python3 editorial/ff4_merge_candidates.py md/ff4/1-episode-1.md --window 45 --max-between 4

A candidate is two consecutive messages by the same author, within --window
seconds of each other, with other authors' blocks between them. Nothing is moved or rewritten: this only prints where to look.

Exact times come from the Discord message ID in the header (a snowflake),
because header times are minute-precision. Blocks with no ID (editor-added)
have no exact time, so they're ignored as anchors, but they still count as
"other" blocks when they sit between two of an author's messages.
Vortox is skipped as an author by default (--include-bot to keep it).

Defaults (30s, at most 4 blocks between) were picked by reading ep 0 and ep 1
output at 15-60s: nearly every hit at 30s was a real split thought. 45-60s
adds mostly 8ball-wait gaps (a roll landing between two lines that are still
one exchange); use --window 45 for a second, looser sweep. --all adds the
[talk] pairs, which are mostly true back-and-forth.

Each candidate is tagged by what interrupts it:
  [bot]     a Vortox block (8ball, roll, GM narration) lands mid-thought: strongest
  [action]  another player's _action_ line lands mid-thought: usually worth a look
  [talk]    only spoken dialogue interrupts: usually a real back-and-forth, so it's
            hidden unless you pass --all
"""
import argparse
import re
import sys

HEADER = re.compile(r'^\*\*(?P<author>.+?)\*\* _\((?P<when>[^)]*)\)_(?: \[(?P<id>\d+)\])?\s*$')
DISCORD_EPOCH_MS = 1420070400000


def snowflake_seconds(msg_id):
    return ((int(msg_id) >> 22) + DISCORD_EPOCH_MS) / 1000.0


def parse(path):
    blocks = []
    with open(path, encoding='utf-8') as f:
        for lineno, line in enumerate(f, 1):
            line = line.rstrip('\n')
            m = HEADER.match(line)
            if m:
                blocks.append({
                    'author': m['author'], 'when': m['when'], 'id': m['id'], 'line': lineno,
                    'secs': snowflake_seconds(m['id']) if m['id'] else None, 'body': [],
                })
            elif blocks and line.strip():
                blocks[-1]['body'].append(line.strip())
    return blocks


def kind(block):
    """bot: Vortox output/narration; action: only _action_ lines; talk: has spoken dialogue."""
    if block['author'] == 'Vortox':
        return 'bot'
    lines = [l for l in block['body'] if not l.startswith(('↪', '⌘', '📎'))]
    if lines and all(l.startswith('_') for l in lines):
        return 'action'
    return 'talk'


def preview(block, width=90):
    text = ' / '.join(block['body']) or '(empty)'
    return text if len(text) <= width else text[:width - 1] + '…'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('markdown')
    ap.add_argument('--window', type=float, default=30, help='max seconds between the two messages (default 30)')
    ap.add_argument('--max-between', type=int, default=4, help='ignore gaps with more than this many other blocks (default 4)')
    ap.add_argument('--all', action='store_true',
                    help='also show [talk] pairs: someone else spoke dialogue in the gap, so it is probably a real back-and-forth')
    ap.add_argument('--include-bot', action='store_true', help='also flag Vortox blocks')
    args = ap.parse_args()

    blocks = parse(args.markdown)
    skip = set() if args.include_bot else {'Vortox'}
    anchors = [i for i, b in enumerate(blocks) if b['secs'] is not None and b['author'] not in skip]
    found = 0

    # Look at each author's consecutive messages (skipping ID-less blocks). If other
    # people's blocks sit between them, that's a candidate.
    for n, i in enumerate(anchors):
        a = blocks[i]
        j = next((k for k in anchors[n + 1:] if blocks[k]['author'] == a['author']), None)
        if j is None:
            continue
        gap = [k for k in range(i + 1, j) if blocks[k]['author'] != a['author']]
        if not gap or len(gap) > args.max_between:
            continue
        # a stretch of the author's own editor-added blocks in between means it's already grouped
        b = blocks[j]
        if b['secs'] - a['secs'] > args.window:
            continue
        kinds = [kind(blocks[k]) for k in gap]
        strength = 'talk' if 'talk' in kinds else ('bot' if 'bot' in kinds else 'action')
        if strength == 'talk' and not args.all:
            continue
        found += 1
        print(f"#{found}  [{strength}] {a['author']}  {b['secs'] - a['secs']:.0f}s apart, {len(gap)} between  (line {a['line']})")
        for k in range(i, j + 1):
            x = blocks[k]
            mark = '  ►' if k in (i, j) else '   │'
            off = f"+{x['secs'] - a['secs']:.0f}s" if x['secs'] is not None else ''
            print(f"{mark} L{x['line']:<5} {x['author']:<9} {off:<6} {preview(x)}")
        print()

    print(f'{found} candidate(s) in {args.markdown}', file=sys.stderr)


if __name__ == '__main__':
    main()
