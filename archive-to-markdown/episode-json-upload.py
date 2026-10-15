"""Upload md-to-api.py episode JSON to a running ff-server (scripted
equivalent of the /import page, plus it creates what's missing).

    python3 episode-json-upload.py api/ff1/*.json [--dry-run]

Env: FF_API (default http://localhost:3000/api), FF_USER / FF_PASS (an ADMIN;
dev default Trey/trey123). Creates, if absent: the season, user accounts for
unknown players (placeholder email, random password), characters (species
"Unclassified"), and personas named in the messages' `persona` field.
Refuses to touch an episode title that already exists.
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("FF_API", "http://localhost:3000/api")
CHUNK = 500


def call(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        sys.exit(f"error: {method} {path} -> {e.code}: {e.read().decode(errors='replace')[:400]}")


def main():
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    payloads = [json.load(open(f)) for f in files]
    tok = call("POST", "/login", {"username": os.environ.get("FF_USER", "Trey"),
                                  "password": os.environ.get("FF_PASS", "trey123")})["data"]["token"]

    users = {u["username"]: u["id"] for u in call("GET", "/users", tok=tok)["data"]}
    chars = {c["name"]: c["id"] for c in call("GET", "/characters?limit=100000", tok=tok)["data"]}
    species = call("GET", "/species")["data"]
    unclassified = next(s["id"] for s in species if s["name"] == "Unclassified")
    seasons = {s["title"] for s in call("GET", "/seasons", tok=tok)["data"]}
    existing_eps = {e["title"] for s in call("GET", "/seasons", tok=tok)["data"] for e in s["episodes"]}

    players = {m["player"] for p in payloads for m in p["messages"]}
    names = {m["character"] for p in payloads for m in p["messages"] if m["character"]}
    persona_pairs = {(m["character"], m["persona"]) for p in payloads for m in p["messages"]
                     if m["character"] and m["persona"]}
    for p in payloads:
        if p["episode"]["title"] in existing_eps:
            sys.exit(f"error: episode {p['episode']['title']!r} already exists; roll it back first")

    print("new users:", sorted(players - users.keys()))
    print("new characters:", sorted(names - chars.keys()))
    print("personas:", sorted(persona_pairs))
    if dry:
        return

    for name in sorted(players - users.keys()):
        slug = "".join(ch for ch in name.lower() if ch.isalnum())
        r = call("POST", "/register", {"username": name, "email": f"{slug}@ff.invalid",
                                       "password": secrets.token_urlsafe(16)})
        users[name] = r["data"]["id"]
    for name in sorted(names - chars.keys()):
        r = call("POST", "/characters", {"name": name, "speciesId": unclassified}, tok)
        chars[name] = r["data"]["id"]

    persona_ids = {}
    for char, pname in sorted(persona_pairs):
        have = [p for p in call("GET", f"/characters/{chars[char]}/personas", tok=tok)["data"]
                if p["name"] == pname]
        if have:
            persona_ids[(char, pname)] = have[0]["id"]
        else:
            persona_ids[(char, pname)] = call("POST", f"/characters/{chars[char]}/personas",
                                              {"name": pname}, tok)["data"]["id"]

    for p in payloads:
        title, season = p["episode"]["title"], p["seasonTitle"]
        if season not in seasons:
            call("POST", "/seasons", {"title": season}, tok)
            seasons.add(season)
        ep = p["episode"]
        call("POST", "/episodes", {"title": title, "seasonTitle": season, "episode_no": ep["episode_no"],
                                   "summary": ep.get("summary") or None, "playedDate": ep.get("playedDate")}, tok)
        rows = []
        for m in p["messages"]:
            cid = chars[m["character"]] if m["character"] else None
            pid = persona_ids.get((m["character"], m["persona"])) if m["persona"] else None
            row = {"playerId": users[m["player"]], "timestamp": m["timestamp"],
                   "type": "OTHER" if m["type"] == "QUOTE" and cid is None else m["type"], "text": m["text"]}
            if cid is not None:
                row["characterId"] = cid
            if pid is not None:
                row["personaId"] = pid
            rows.append(row)
        for i in range(0, len(rows), CHUNK):
            call("POST", f"/episodes/{urllib.parse.quote(title)}/messages", {"messages": rows[i:i + CHUNK]}, tok)
        print(f"uploaded {title}: {len(rows)} messages")


main()
