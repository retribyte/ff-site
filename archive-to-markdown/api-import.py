#!/usr/bin/env python3
"""api-import.py -- load md-to-api.py episode JSON into the API from the CLI.

The scriptable sibling of the admin /import page, for re-importing on any dev
machine. Unlike the page it (a) stamps personas from each message's `persona`
field and (b) can create missing users, characters and personas, so the
markdown + meta/<season>.json stay the only source of truth -- nothing has to
be patched into the database by hand afterwards.

    python3 api-import.py [options] api/ff2/*.json api/ff4/[0-6]-*.json

      --replace         delete an existing episode (same title) first; without
                        it, an existing episode is an error. Check for
                        commentaries first -- deleting an episode removes them.
      --create-missing  create users / characters / personas that don't exist
                        (see below); without it, unmatched speakers import as
                        OTHER lines and unmatched personas are left unstamped
      --dry-run         resolve everything, print what would happen, change nothing
      --api URL         default http://localhost:3000/api (or $FF_API)
      --user NAME       login (default $FF_USER, else prompted)
                        the password comes from $FF_PASSWORD or a prompt

Creation conventions match ff-server/prisma/seed-legacy.ts: a missing user is
registered with password `<lowercased name, no spaces>123` (dev-only, same as
the seed); a missing character gets the "Unclassified" species, no color, and
is created on behalf of the player who voiced it most; a missing persona hangs
off its character. Needs an ADMIN login (character creatorId).
"""
import argparse
import collections
import getpass
import glob
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

CHUNK = 500


class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = None

    def call(self, method, path, body=None, ok404=False):
        req = urllib.request.Request(self.base + path, method=method)
        req.add_header("Accept", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        data = None
        if body is not None:
            req.add_header("Content-Type", "application/json")
            data = json.dumps(body).encode()
        try:
            with urllib.request.urlopen(req, data) as res:
                raw = res.read()
        except urllib.error.HTTPError as err:
            if err.code == 404 and ok404:
                return None
            sys.exit(f"error: {method} {path} -> HTTP {err.code}: {err.read().decode(errors='replace')}")
        envelope = json.loads(raw) if raw.strip() else {}
        return envelope.get("data")

    def login(self, username, password):
        self.token = self.call("POST", "/login", {"username": username, "password": password})["token"]


def shorthand(name):
    return "".join(name.lower().split())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--api", default=os.environ.get("FF_API", "http://localhost:3000/api"))
    ap.add_argument("--user", default=os.environ.get("FF_USER"))
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--create-missing", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    payloads = []
    for path in args.files:
        payloads.append(json.load(open(path)))
    api = Api(args.api)
    username = args.user or input("username: ")
    api.login(username, os.environ.get("FF_PASSWORD") or getpass.getpass("password: "))
    if api.call("GET", "/user")["role"] != "ADMIN":
        sys.exit("error: an ADMIN login is required")

    users = {u["username"]: u["id"] for u in api.call("GET", "/users")}
    chars = {c["name"]: c["id"] for c in api.call("GET", "/characters")}
    # a speaker differing from an existing character only by case is that character
    chars_ci = {}
    for name, cid in chars.items():
        chars_ci.setdefault(name.casefold(), []).append((name, cid))
    folded = {}
    for p in payloads:
        for m in p["messages"]:
            c = m.get("character")
            if c and c not in chars and len(chars_ci.get(c.casefold(), [])) == 1:
                folded[c] = chars_ci[c.casefold()][0]
    for c, (existing, cid) in sorted(folded.items()):
        print(f"note: {c!r} matched existing character {existing!r} (case-insensitive)")
        chars[c] = cid
    personas = {}  # (characterId, name) -> id
    persona_by_name = {}  # name -> (characterId, id): legacy "speaker string is a persona name"
    for p in api.call("GET", "/personas"):
        if p["name"]:
            personas[(p["characterId"], p["name"])] = p["id"]
            persona_by_name[p["name"]] = (p["characterId"], p["id"])
    species = next((s["id"] for s in api.call("GET", "/species") if s["name"] == "Unclassified"), None)

    # who voiced each character most, across everything being imported
    voiced = collections.defaultdict(collections.Counter)
    for p in payloads:
        for m in p["messages"]:
            if m.get("character"):
                voiced[m["character"]][m["player"]] += 1

    # ---- plan: what's missing ------------------------------------------------
    need_users = sorted({m["player"] for p in payloads for m in p["messages"]} - users.keys())
    need_chars = sorted(
        {m["character"] for p in payloads for m in p["messages"] if m.get("character")}
        - chars.keys() - persona_by_name.keys()
    )
    need_personas = sorted({
        (m["character"], m["persona"])
        for p in payloads for m in p["messages"]
        if m.get("character") and m.get("persona")
        and (chars.get(m["character"]) is None or (chars[m["character"]], m["persona"]) not in personas)
    })
    print(f"users to create:      {need_users or '-'}")
    print(f"characters to create: {need_chars or '-'}")
    print(f"personas to create:   {[f'{c} as {n}' for c, n in need_personas] or '-'}")
    if not args.create_missing and (need_users or need_chars or need_personas):
        print("(without --create-missing: missing players abort, missing characters become OTHER lines,"
              " missing personas stay unstamped)")
        if need_users:
            sys.exit("error: unresolved players")

    # ---- create missing ------------------------------------------------------
    if args.create_missing and not args.dry_run:
        for name in need_users:
            users[name] = api.call("POST", "/register", {
                "username": name, "email": f"{shorthand(name)}@ff.invalid", "password": f"{shorthand(name)}123"})["id"]
        for name in need_chars:
            owner = voiced[name].most_common(1)[0][0]
            chars[name] = api.call("POST", "/characters", {
                "name": name, "speciesId": species, "creatorId": users[owner]})["id"]
        for char, name in need_personas:
            personas[(chars[char], name)] = api.call(
                "POST", f"/characters/{chars[char]}/personas", {"name": name})["id"]

    def resolve(char, persona):
        """-> (characterId, personaId); a speaker string that only matches a persona name still resolves."""
        if not char:
            return None, None
        if char in chars:
            return chars[char], personas.get((chars[char], persona)) if persona else None
        if char in persona_by_name:
            return persona_by_name[char]
        return None, None

    # ---- import ----------------------------------------------------------------
    for p in payloads:
        title, season, no = p["episode"]["title"], p["seasonTitle"], p["episode"]["episode_no"]
        enc = urllib.parse.quote(title, safe="")
        tally = collections.Counter()
        rows = []
        for m in p["messages"]:
            cid, pid = resolve(m.get("character"), m.get("persona"))
            if pid or (args.dry_run and cid and m.get("persona")):
                tally[m["persona"]] += 1
            rows.append({
                "playerId": users.get(m["player"]), "characterId": cid, "personaId": pid,
                "timestamp": m.get("timestamp"),
                "type": "OTHER" if m["type"] == "QUOTE" and cid is None else m["type"], "text": m["text"],
            })
        label = f"{season} #{no} {title!r}: {len(rows)} msgs, personas {dict(tally) or '-'}"
        if args.dry_run:
            print("would import", label)
            continue
        if api.call("GET", f"/episodes/{enc}", ok404=True) is not None:
            if not args.replace:
                sys.exit(f"error: {title!r} already exists (use --replace)")
            api.call("DELETE", f"/episodes/{enc}")
        if season not in {s["title"] for s in api.call("GET", "/seasons")}:
            api.call("POST", "/seasons", {"title": season})
        body = {"title": title, "seasonTitle": season, "episode_no": no}
        for key in ("summary", "playedDate"):
            if p["episode"].get(key):
                body[key] = p["episode"][key]
        api.call("POST", "/episodes", body)
        for i in range(0, len(rows), CHUNK):
            api.call("POST", f"/episodes/{enc}/messages", {"messages": rows[i:i + CHUNK]})
        print("imported", label)


if __name__ == "__main__":
    main()
