#!/usr/bin/env python3
"""ff4_set_personas.py N   (run from archive-to-markdown/, after importing ep N)

The /import page ignores the payload `persona` field. This zips Vec's messages
in api/ff4/N-*.json against the DB rows (ordered by messageNo) and sets
personaId. Persona ids: Fungo 8, Fursean 9, Drowned Llamanian 13, Suchan 14 (check
`select id,name from personas`). Vec's character id is 1961.
Also handles Zander's clone PC Buzzcut (character 1709): `Buzzcut as Bee Emmett`
-> persona 12 (ep 12 pre-reveal lines only; Buzzcut has no persona otherwise).
"""
import glob, json, subprocess, sys

n = sys.argv[1]
path = glob.glob(f'api/ff4/{n}-*.json')[0]
d = json.load(open(path))
title = d['episode']['title'].replace("'", "''")
psql = ['docker', 'exec', '-i', 'ff-server-db-1', 'psql', '-U', 'vortox', '-d', 'final-frontier', '-At']
CHARS = {'Vec': 1961, 'Buzzcut': 1709, "Seth Im'Kin'ki": 1920}
pid = {('Vec', 'Suchan'): 14, ('Vec', 'Llafay Terrels'): 7, ('Vec', 'Drowned Llamanian'): 13, ('Vec', 'Fursean'): 9, ('Vec', 'Fungus'): 8,
       ('Vec', 'Fungo'): 8, ('Vec', 'Marv'): 10, ('Vec', 'Sascha'): 11, ('Vec', 'John Smith IV'): 25, ('Vec', 'Argonian'): 26, ('Buzzcut', 'Bee Emmett'): 12,
       ("Seth Im'Kin'ki", 'Sethkinki'): 27}
by = {}
for ch, cid in CHARS.items():
    per = [m.get('persona') for m in d['messages'] if m.get('character') == ch]
    q = f'select "messageNo" from messages where "episodeTitle"=\'{title}\' and "characterId"={cid} order by "messageNo"'
    rows = subprocess.run(psql + ['-c', q], capture_output=True, text=True).stdout.split()
    assert len(rows) == len(per), (ch, len(rows), len(per))
    for r, p in zip(rows, per):
        if p:
            by.setdefault(pid[(ch, p)], []).append(r)
sql = ';'.join(f'update messages set "personaId"={k} where "episodeTitle"=\'{title}\' and "messageNo" in ({",".join(v)})' for k, v in by.items())
if sql:
    subprocess.run(psql + ['-c', sql], input='', text=True)
print({k: len(v) for k, v in by.items()})
