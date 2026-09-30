#!/usr/bin/env python3
"""ff4_set_personas.py N   (run from archive-to-markdown/, after importing ep N)

The /import page ignores the payload `persona` field. This zips Vec's messages
in api/ff4/N-*.json against the DB rows (ordered by messageNo) and sets
personaId. Persona ids: Fungo 8, Fursean 9, Drowned Llamanian 13 (check
`select id,name from personas`). Vec's character id is 1961.
"""
import glob, json, subprocess, sys

n = sys.argv[1]
path = glob.glob(f'api/ff4/{n}-*.json')[0]
d = json.load(open(path))
title = d['episode']['title']
per = [m.get('persona') for m in d['messages'] if m.get('character') == 'Vec']
psql = ['docker', 'exec', '-i', 'ff-server-db-1', 'psql', '-U', 'vortox', '-d', 'final-frontier', '-At']
q = f'select "messageNo" from messages where "episodeTitle"=\'{title}\' and "characterId"=1961 order by "messageNo"'
rows = subprocess.run(psql + ['-c', q], capture_output=True, text=True).stdout.split()
assert len(rows) == len(per), (len(rows), len(per))
pid = {'Drowned Llamanian': 13, 'Fursean': 9, 'Fungus': 8, 'Fungo': 8}
by = {}
for r, p in zip(rows, per):
    if p:
        by.setdefault(pid[p], []).append(r)
sql = ';'.join(f'update messages set "personaId"={k} where "episodeTitle"=\'{title}\' and "messageNo" in ({",".join(v)})' for k, v in by.items())
if sql:
    subprocess.run(psql + ['-c', sql], input='', text=True)
print({k: len(v) for k, v in by.items()})
