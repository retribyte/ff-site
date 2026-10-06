"""Delete and recreate one episode in the dev DB through the ff-server API (:3000).

Usage (from archive-to-markdown/, after md-to-api.py has written the JSON):
    python3 editorial/ff4_import.py api/ff4/7-episode-7.json
Logs in as Trey, deletes the episode by title (cascades commentaries: check there are 0 first),
recreates it and posts the messages. Then run editorial/ff4_set_personas.py <n>.
Character names that print UNMATCHED need an entry in ALIAS below.
"""
import json,sys,urllib.request,urllib.parse
B='http://localhost:3000/api'
def call(path,method='GET',body=None,tok=None):
    r=urllib.request.Request(B+path,method=method,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+tok} if tok else {})})
    try:
        b=urllib.request.urlopen(r).read(); return json.loads(b) if b else {"status":"empty-ok"}
    except urllib.error.HTTPError as e:
        return {'status':'http'+str(e.code),'message':e.read().decode()[:300]}
d=json.load(open(sys.argv[1]))
lg=call('/login','POST',{'username':'Trey','password':'trey123'})
tok=lg['data']['token'] if 'data' in lg and isinstance(lg['data'],dict) and 'token' in lg['data'] else lg.get('token')
assert tok,lg
title=d['episode']['title']
print('delete',call('/episodes/'+urllib.parse.quote(title),'DELETE',tok=tok))
users={u['username']:u['id'] for u in call('/users',tok=tok)['data']}
chars={c['name']:c['id'] for c in call('/characters?limit=5000',tok=tok)['data']} if True else {}
print(len(chars))
ALIAS = {'Squi': 'Squina', 'Edmin Kalvanzas': 'Edmin'}
alias=ALIAS
print('ep',call('/episodes','POST',{'title':title,'seasonTitle':d['seasonTitle'],'episode_no':d['episode']['episode_no'],'playedDate':d['episode']['playedDate']},tok))
rows=[]
for m in d['messages']:
    cn=alias.get(m['character'],m['character']) if m['character'] else None
    cid=chars.get(cn) if cn else None
    if m['character'] and cid is None: print('UNMATCHED',m['character'])
    rows.append({'playerId':users[m['player']],'characterId':cid,'personaId':None,'timestamp':m['timestamp'],'type':'OTHER' if m['type']=='QUOTE' and cid is None else m['type'],'text':m['text']})
for o in range(0,len(rows),500):
    r=call('/episodes/'+urllib.parse.quote(title)+'/messages','POST',{'messages':rows[o:o+500]},tok)
    print(o,str(r)[:120])
