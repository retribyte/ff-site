#!/usr/bin/env python3
"""Verify an edited FF4 episode. Usage (from archive-to-markdown/):
    python3 editorial/ff4_verify.py <episode_number> [path/to/edited.md]
Defaults to md/ff4/<N>-<slug>.md, audited against md/ff4/raw/<same name>.

Prints message-type counts, then problems (each should be empty or
deliberate): leftover "✂ " pre-flagged cuts, unresolved speakers, the
character set (cast names or intended NPC tags only -- a typo'd tag becomes a
new DB Character), surviving OTHER lines (each a deliberate keep), the action/quote ratio, the persona split
(timeline anchors match on text, so rewording an anchor line silently moves
a persona switch), lint, slur flags, IDs that no longer exist in the raw
export (a mangled header), and raw lines with no fuzzy match in the edit
(each must be a deliberate cut or rewrite)."""
import collections, difflib, glob, importlib.util, json, os, re, sys
sys.path.insert(0, os.getcwd())

spec = importlib.util.spec_from_file_location('m2a', 'md-to-api.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
meta = m.load_meta('ff4')
number = int(sys.argv[1])
ep = next(e for e in meta['episodes'] if e['episode_number'] == number)
name = f"{number}-{re.sub(r'[^a-z0-9]+', '-', ep['file_name'].lower()).strip('-')}.md"
path = sys.argv[2] if len(sys.argv) > 2 else f'md/ff4/{name}'
raw_path = f'md/ff4/raw/{name}'
msgs = m.convert_file(path, meta, ep)['messages']
raw_msgs = m.convert_file(raw_path, meta, ep)['messages']

print('types', dict(collections.Counter(x['type'] for x in msgs)))
print('CUT MARKS LEFT', [x['text'][:60] for x in msgs if x['text'].startswith('✂')])
bots = set(meta.get('bots', []))
print('unresolved', [x['text'][:60] for x in msgs if x['type'] in ('ACTION', 'QUOTE') and not x.get('character') and x['player'] not in bots])
print('GM narration (bot actions)', sum(x['type'] == 'ACTION' and x['player'] in bots for x in msgs))
print('characters', dict(collections.Counter(x['character'] for x in msgs if x['type'] in ('ACTION', 'QUOTE'))))
# Player (not character) messages that survived: fine when kept on purpose
# (a GM clarification, a ruling); each should be a deliberate keep.
print('OTHER (review: kept on purpose?)', [(x['player'], x['text'][:60]) for x in msgs if x['type'] == 'OTHER'])
q = sum(x['type'] == 'QUOTE' for x in msgs); a = sum(x['type'] == 'ACTION' for x in msgs)
rq = sum(x['type'] == 'QUOTE' for x in raw_msgs); ra = sum(x['type'] == 'ACTION' for x in raw_msgs)
print(f'actions {a} quotes {q} ratio {a / max(q, 1):.2f}  (raw: {ra}/{rq} = {ra / max(rq, 1):.2f})')
personas = lambda ms: dict(collections.Counter((x['character'], x['persona']) for x in ms if x.get('persona')))
print('personas', personas(msgs), ' raw:', personas(raw_msgs))

text = open(path, encoding='utf-8').read().split('\n')
raw_text = open(raw_path, encoding='utf-8').read().split('\n')
raw_ids = {i for l in raw_text for i in re.findall(r'_ \[(\d{17,20})\]$', l)}
raw_author = {m.group(2): m.group(1) for m in (re.match(r'^\*\*([^*]+)\*\* _\([^)]*\)_ \[(\d+)\]$', l) for l in raw_text) if m}
for i, l in enumerate(text, 1):
    if l.startswith('**'):
        if not re.match(r'^\*\*[^*]+\*\* _\(\d\d-[A-Z][a-z]{2}-\d\d \d\d:\d\d [AP]M\)_( \[\d{17,20}\])?$', l):
            print('BAD HEADER', i, l[:80])
        found = re.search(r'\[(\d+)\]$', l)
        if found and found.group(1) not in raw_ids:
            print('UNKNOWN ID', i, l[:80])
        elif found and not l.startswith(f"**{raw_author[found.group(1)]}**"):
            print('  moved from', raw_author[found.group(1)], '(check intended):', l[:70])
        continue
    if re.search(r'^> _|^> `[^`]*`$|\\\*|  $', l) or (l.startswith('_') and not l.endswith('_')) \
            or (l.startswith(('> ', '_')) and re.search(r'(?<!\*)\*(?!\*)', l)):
        print('LINT', i, l[:80])
    if re.search(r'\b(fag|nigg|retard|nig nog)|\bgay\b|\bhomo', l, re.I):
        print('SLUR/FLAG', i, l[:80])

def norm(l):
    l = re.sub(r'^> ', '', l); l = re.sub(r'^_|_$', '', l); l = re.sub(r'`[^`]+`: ', '', l)
    return re.sub(r'[^a-z0-9 ]', '', l.lower()).strip()
raw = [l for l in raw_text if l.startswith('> ') or (l.startswith('_') and not l.startswith('_('))]
ed = [norm(l) for l in text if l.strip() and not l.startswith('**')]
joined = ' || '.join(ed)
for l in raw:
    nl = norm(l)
    if nl and nl not in joined and not difflib.get_close_matches(nl, ed, n=1, cutoff=0.75):
        print('  UNMATCHED RAW', l[:100])

# Embed audit: Vortox output stays verbatim (Trey, 2026-09-29) -- title,
# description and color byte-identical; the footer may change only inside
# the quoted question, with a player name as the asker. Every raw embed
# (besides what --prep drops anyway) missing from the edit is listed.
f2m_spec = importlib.util.spec_from_file_location('f2m', 'ff4-to-md.py')
f2m = importlib.util.module_from_spec(f2m_spec); f2m_spec.loader.exec_module(f2m)
HEAD = re.compile(r'^\*\*([^*]+)\*\* _\([^)]*\)_(?: \[(\d+)\])?$')

def embeds(lines):
    """-> {id: [(author, has_command_marker, {section: text})]}"""
    out, block, author, cmd, cur, sec = {}, None, None, False, None, None
    for l in lines:
        h = HEAD.match(l)
        if h:
            author, block, cmd = h.group(1), h.group(2), False; continue
        if l.startswith('⌘ '): cmd = True
        if l.lstrip('✂ ') == '<embed>': cur = {}; continue
        if l == '</embed>' and cur is not None:
            out.setdefault(block, []).append((author, cmd, cur)); cur = None; continue
        if cur is not None:
            m1 = re.match(r'^<([a-z]+)>(.*)</\1>$', l)
            if m1: cur[m1.group(1)] = m1.group(2); continue
            m2 = re.match(r'^<([a-z]+)>$', l)
            if m2: sec = m2.group(1); cur[sec] = ''; continue
            if re.match(r'^</[a-z]+>$', l): sec = None; continue
            if sec: cur[sec] += ('\n' if cur[sec] else '') + l
    return out

players = set(meta.get('usernames', {}).values())
raw_e, ed_e = embeds(raw_text), embeds(text)
for mid, items in raw_e.items():
    for idx, (author, cmd, e) in enumerate(items):
        if author != 'Vortox':
            continue
        desc = e.get('description', '')
        if f2m.ADMIN_EMBED.match(e.get('title', '')) or f2m.FAILED_COMMAND.search(desc):
            continue
        got = ed_e.get(mid, [])
        if idx >= len(got):
            print('  CUT EMBED', mid, e.get('title', ''), '|', desc[:50].replace('\n', ' '))
            continue
        _, gcmd, g = got[idx]
        for key in ('title', 'description', 'color'):
            if e.get(key) != g.get(key):
                print('EMBED CHANGED', mid, key, repr(e.get(key))[:50], '->', repr(g.get(key))[:50])
        if 'footer' in e:
            asker = re.match(r'^(.*?) asked: "', g.get('footer', ''))
            if not asker or asker.group(1) not in players:
                print('EMBED FOOTER', mid, repr(g.get('footer'))[:70])
        if cmd != gcmd:
            print('COMMAND MARKER', mid, 'lost' if cmd else 'added')
for mid, items in ed_e.items():
    if mid and mid not in raw_e:
        print('  converted to embed (check intended)', mid)
