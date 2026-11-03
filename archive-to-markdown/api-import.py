#!/usr/bin/env python3
"""api-import.py -- load md-to-api.py episode JSON into the API from the CLI.

The scriptable sibling of the admin /import page, for re-importing on any dev
machine. Unlike the page it (a) stamps personas from each message's `persona`
field and (b) can create missing users, NPC voices and personas, so the
markdown + meta/<season>.json stay the only source of truth -- nothing has to
be patched into the database by hand afterwards.

    python3 api-import.py [options] api/ff2/*.json api/ff4/[0-6]-*.json

      --replace         delete an existing episode (same title) first; without
                        it, an existing episode is an error. Check for
                        commentaries first -- deleting an episode removes them.
      --create-missing  create users / NPC voices / personas that don't exist
                        (see below); without it, unmatched speakers import as
                        OTHER lines and unmatched personas are left unstamped
      --dry-run         resolve everything, print what would happen, change nothing
      --api URL         default http://localhost:3000/api (or $FF_API)
      --user NAME       login (default $FF_USER, else prompted)
                        the password comes from $FF_PASSWORD or a prompt

A speaker resolves, in order, to a character (exact name, else a unique
case-insensitive match), an NPC persona (case-insensitive), or a character
persona's name. A speaker that matches none of those is a one-off NPC: with
--create-missing it becomes an NPC persona (POST /personas, find-or-create
by name), its lines keep their type with characterId null. Characters are
never created here; if an NPC turns out to matter, promote it on the site
(admin, POST /admin/speakers/promote). A missing user is registered with
password `<lowercased name, no spaces>123` (dev-only, same as the seed); a
missing persona hangs off its character. Needs an ADMIN login.
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
    npcs = {}  # casefolded name -> NPC persona id (NPC personas are unique by case-insensitive name)
    for p in api.call("GET", "/personas"):
        if not p["name"]:
            continue
        if p["characterId"] is None:
            npcs[p["name"].casefold()] = p["id"]
        else:
            personas[(p["characterId"], p["name"])] = p["id"]
            persona_by_name[p["name"]] = (p["characterId"], p["id"])

    # ---- plan: what's missing ------------------------------------------------
    need_users = sorted({m["player"] for p in payloads for m in p["messages"]} - users.keys())
    # unmatched speakers, one per case-insensitive name ("Guard" and "guard" are one NPC)
    need_npcs = {}
    for p in payloads:
        for m in p["messages"]:
            c = m.get("character")
            if c and c not in chars and c not in persona_by_name and c.casefold() not in npcs:
                need_npcs.setdefault(c.casefold(), c)
    need_npcs = sorted(need_npcs.values(), key=str.casefold)
    need_personas = sorted({
        (m["character"], m["persona"])
        for p in payloads for m in p["messages"]
        if m.get("character") in chars and m.get("persona")
        and (chars[m["character"]], m["persona"]) not in personas
    })
    print(f"users to create:      {need_users or '-'}")
    print(f"NPC voices to create: {need_npcs or '-'}")
    print(f"personas to create:   {[f'{c} as {n}' for c, n in need_personas] or '-'}")
    if not args.create_missing and (need_users or need_npcs or need_personas):
        print("(without --create-missing: missing players abort, unmatched speakers become OTHER lines,"
              " missing personas stay unstamped)")
        if need_users:
            sys.exit("error: unresolved players")

    # ---- create missing ------------------------------------------------------
    if args.create_missing and not args.dry_run:
        for name in need_users:
            users[name] = api.call("POST", "/register", {
                "username": name, "email": f"{shorthand(name)}@ff.invalid", "password": f"{shorthand(name)}123"})["id"]
        for name in need_npcs:
            npcs[name.casefold()] = api.call("POST", "/personas", {"name": name})["id"]
        for char, name in need_personas:
            personas[(chars[char], name)] = api.call(
                "POST", f"/characters/{chars[char]}/personas", {"name": name})["id"]

    def resolve(char, persona):
        """-> (characterId, personaId). NPC lines are (None, npc persona); a speaker
        string that only matches a character persona's name still resolves to it."""
        if not char:
            return None, None
        if char in chars:
            return chars[char], personas.get((chars[char], persona)) if persona else None
        if char.casefold() in npcs:
            return None, npcs[char.casefold()]
        if char in persona_by_name:
            return persona_by_name[char]
        return None, None

    # ---- import ----------------------------------------------------------------
    new_npcs = {n.casefold() for n in need_npcs}  # dry-run tally only
    for p in payloads:
        title, season, no = p["episode"]["title"], p["seasonTitle"], p["episode"]["episode_no"]
        enc = urllib.parse.quote(title, safe="")
        tally = collections.Counter()
        rows = []
        for m in p["messages"]:
            cid, pid = resolve(m.get("character"), m.get("persona"))
            if cid is None and (pid or (args.dry_run and (m.get("character") or "").casefold() in new_npcs)):
                tally["NPC"] += 1
            elif pid or (args.dry_run and cid and m.get("persona")):
                tally[m["persona"]] += 1
            rows.append({
                "playerId": users.get(m["player"]), "characterId": cid, "personaId": pid,
                "timestamp": m.get("timestamp"),
                # a QUOTE needs a voice (FR-MSG-4): a character or an NPC persona
                "type": "OTHER" if m["type"] == "QUOTE" and cid is None and pid is None else m["type"], "text": m["text"],
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
