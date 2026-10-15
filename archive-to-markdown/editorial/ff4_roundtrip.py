#!/usr/bin/env python3
"""Round-trip gate for ff4-to-md.py: md-to-api.py(raw md) must reproduce
discord-json-to-api.py(export JSON, blacklist off) line for line on
(player, type, text) and, for QUOTE/ACTION, (character, persona).
Usage (from archive-to-markdown/): python3 editorial/ff4_roundtrip.py <export.json> [raw.md]"""
import importlib.util, json, os, sys
sys.path.insert(0, os.getcwd())
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
d2a = load('d2a', 'discord-json-to-api.py'); m2a = load('m2a', 'md-to-api.py'); f2m = load('f2m', 'ff4-to-md.py')
export, meta, episode = f2m.load_export(sys.argv[1])
raw = sys.argv[2] if len(sys.argv) > 2 else os.path.join('md', 'ff4', 'raw', f2m.md_name(episode))
ep = dict(episode, messageBlacklist=[])
want = d2a.convert_file(sys.argv[1], meta, ep)['messages']
got = m2a.convert_file(raw, m2a.load_meta('ff4'), ep)['messages']
def key(x):
    k = (x['player'], x['type'], x['text'] if x['type'] != 'EMBED' else json.loads(x['text']))
    if x['type'] in ('QUOTE', 'ACTION'):
        k += (x['character'], x['persona'])
    return k
bad = 0
for i in range(max(len(want), len(got))):
    a = key(want[i]) if i < len(want) else None
    b = key(got[i]) if i < len(got) else None
    if a != b:
        bad += 1
        if bad <= 25: print(f'#{i+1}\n  json: {a}\n  md:   {b}')
print(f'{len(want)} json / {len(got)} md messages, {bad} mismatches')
sys.exit(1 if bad else 0)
