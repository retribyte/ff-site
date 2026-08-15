# Persona feature — decision record

## Status / handoff — 2026-08-14, end of session

**Done, verified, uncommitted.** Everything below is implemented and tested,
but `git status` is still dirty — no commit was made this session. Nothing
was pushed to the live dev DB either: all `discord-json-to-api.py` runs this
session wrote to the gitignored `api/` scratch dir and were deleted after
inspection, never POSTed to `/import`. The dev DB's existing FF4 data (used
read-only, via the running `ff-server` API on :3000, to find real anchor
text) predates this session's `personaTimeline` additions.

Changed/new files (all uncommitted):
- `src/lib/personaIdentity.ts` + `.test.ts` (new), `vitest.config.mts` (new),
  `package.json`/`package-lock.json` (added `vitest`) — frontend module.
- `src/components/transcript/StoryBlock.tsx`,
  `src/app/characters/[id]/page.tsx` — refactored onto the new module.
- `archive-to-markdown/persona_timeline.py` (new, shared by both scripts),
  `discord-json-to-api.py`, `md-to-api.py` — pipeline mechanism.
- `archive-to-markdown/meta/ff4.json` — real `personaTimeline` data (Fungus,
  Fursean, Argonian; Marv/Sascha are code-driven, no config).
- `archive-to-markdown/test_cast_character.py` + `test_persona_timeline.py`
  (new), `requirements-dev.txt` (new), `.gitignore` (added
  `.pytest_cache/`) — pytest coverage, 17 tests, run via `.venv`.
- `archive-to-markdown/README.md` — documents `personaTimeline`.
- This file — full decision record, including course corrections made
  *during* implementation (read those before trusting any single claim in
  isolation — several early guesses here were wrong and later fixed).

**To verify from scratch**: `npm test` (JS, 8 tests) and, in
`archive-to-markdown/`, `python3 -m venv .venv && .venv/bin/pip install -r
requirements-dev.txt && .venv/bin/pytest` (Python, 17 tests). Both passed as
of this handoff.

**Not done, not asked for today, real work if picked up:**
- **Not committed.** First thing to decide next session — one commit or
  split frontend/pipeline, and whether to squash the mid-session corrections
  or keep them as separate commits for the trail.
- **Never imported into the dev DB.** The `personaTimeline` config exists
  and is verified against the raw export, but no `/import` run has actually
  applied it to a live episode yet — do that before trusting the rendered
  transcript, not just the converter's JSON output.
- **"Fungo"** (the Moldak-guard persona right after Fursean, ep5) — real,
  found by accident, not encoded. Not asked for.
- **Sanya Dreadflower's own look changes** (FF2 ×2, FF3, FF4) — confirmed
  real intent (grilling session A1), zero source doc like `vec-hosts.wiki`
  exists for her yet. Whoever picks this up needs the same
  verify-against-source-and-author discipline this file documents getting
  wrong twice for Argonian before getting right.
- **Four hand-copied `Persona` shapes** (Prisma model, `PERSONA_SELECT`,
  `ff-site` `types.ts`, `ff-server` `openapi.ts`) — surfaced in the original
  architecture review, not touched this session.
- **Message identity** (`(episodeTitle, messageNo)` isn't a stable id) —
  deliberately scoped OUT of this whole session, explicit agreement to
  start a fresh session for it. Not blocked by anything above.
- `DEFERRED-character-delete-dangling-persona.md` (`ff-server`) — already
  tracked separately by the team, untouched here.

---

2026-08-14. Grilling session that started as an architecture review of the
persona/attribution feature (candidate 1 from that review — centralizing
persona display-name resolution) and expanded into the actual center of
gravity for the feature: how `personaId` gets onto a message in the first
place. No `ff-server` schema changes came out of this — `Persona`,
`Message.personaId`, and the bulk stamp API all stay as-is. Everything below
is `ff-site`-side: import pipeline (`archive-to-markdown/`) and one frontend
module.

## What a persona is (confirmed intent, not just what's built)

An in-story transformation of an existing character — new name, new look, or
both — for some stretch of the archive. Not a concealment/mystery mechanism:
if a reader clicks through a persona to the real character page, that's on
them, not a bug to fix. Not tied to search visibility either. The founding
case is Vec (a parasite that changes hosts/bodies constantly, `FF4`); Sanya
Dreadflower's repeated look changes across `FF2`/`FF3`/`FF4` are the same
mechanism, different character.

## Frontend: `resolvePersonaIdentity`

The render-time fallback (`persona?.field ?? character?.field ?? player?.field`,
independently per name/color/avatar) is currently re-derived inline at four
call sites with near-duplicate comments re-explaining the same rule:
`StoryBlock.tsx`, `characters/[id]/page.tsx` (×2 — the "also known as" chip
and the quote teaser suffix). Centralize into one function:

```ts
resolvePersonaIdentity(persona, character, player) => { speaker, color, avatarSrc }
```

- Lives in `src/lib/`.
- `Persona.name`/`label` stay nullable as typed today — this function becomes
  the one defensive site instead of four, rather than tightening the type.
- Kept separate from `EpisodeImporter.tsx`'s import-time name matching — that
  resolves a raw string to an id (opposite direction), a genuinely different
  interface.
- First real tests in this repo: Vitest (none exists today — no test
  framework anywhere in `ff-site`).

## Pipeline: why per-message stamping alone doesn't work

Original ask was range-level ("apply for this whole season"), abandoned
early for pure per-message tagging because a prior pass judged "how do you
revert one message back to canonical mid-range" too complex to justify a
schema addition. In practice this produces exactly the pain that tradeoff
predicted: potentially thousands of hand-stamped rows for a multi-episode
run, nothing carries forward when a new episode is imported into an ongoing
persona's range, and manual per-message stamping was never actually going to
happen by hand — the real plan is automation (LLM- or rule-assisted) that
reads transcript/campaign context and writes the assignment once,
pre-import, as reproducible config. Not a live-DB corrective pass: FF4 will
be imported and re-imported into a fresh DB multiple times before
production, and this needs to survive that and be usable by another team
member, not live only in one LLM session's memory.

### `cast` already solves half of this — reuse it, don't duplicate it

`discord-json-to-api.py::cast_character()` (and a second, independent copy in
`md-to-api.py`) is already an "as of episode N" range resolver for **which
character** a player is voicing. `NAME_ALIASES` currently double-duties as
persona resolution by accident — `"Fungus": "Vec"` folds two *cast* entries
(`"2": "Fungus"`, `"11": "Vec"`) into one canonical character, silently
discarding the fact that "Fungus" was ever a distinct look. This is the only
entry in `NAME_ALIASES` that's actually a persona transition wearing a
name-typo-cleanup hat; the rest (`"Emmett": "Emmett Tawfeek"` etc.) are
genuine shorthand with no story meaning and stay as-is.

**Decision: split persona resolution into its own top-level structure,
`personaTimeline`, keyed by character (not player), separate from `cast`.**
Not nested under `cast` — deliberately, per direct confirmation — so that
`md-to-api.py` and any season without personas (currently `FF2`/`FF3`, 2 of
3 campaigns) need zero script changes until they need one.

`cast` keeps doing what it's actually good at: every confirmed PC swap so
far (including Sanya Dreadflower → Morra, `Brody`'s `cast` entry — confirmed
via `REVIEW-character-attribution-cleanup.md` as genuinely separate, unrelated
characters, not a persona) lands cleanly on an episode boundary.

### Granularity: episode-only isn't enough — most of Vec's transitions are mid-episode

`vec-hosts.wiki` (already in the working tree, full episode-by-episode host
list for Vec) shows most host changes happening *within* an episode, not at
its start — e.g. a body taken at the end of one episode and animated at the
start of the next, or (per direct confirmation) at least one case reverting
mid-episode with no clean boundary at all. An episode-indexed `cast`-style
span can't express this without turning into exactly the "messy hard-coded
exception" pattern this is trying to avoid.

**Decision: `personaTimeline` entries are content-anchored, not
position-anchored.** `Message.messageNo` is a plain, non-autoincremented
`Int` — confirmed neither `discord-json-to-api.py` nor `md-to-api.py` ever
computes a `"no"` field; it's assigned downstream of both scripts, purely
positional. Anchoring persona boundaries to it would be fragile against any
future pipeline change that shifts line counts (exactly the class of bug
`REVIEW-character-attribution-cleanup.md` already found and fixed once for
character resolution). Content-matching (`anchor_contains`, a text snippet
that must appear in the target message) is immune to that and is already a
proven pattern in this codebase (`FORCE_CHARACTER_CONTAINING`,
`TERRY_CHILZORS_LINES`, `DIEGETIC_STRIKE_EXEMPT`) — this generalizes that
existing ad hoc mechanism into structured config instead of scattered
one-off Python tuples.

Proposed shape (to be finalized during implementation):

```jsonc
"personaTimeline": {
    "Vec": [
        { "from_episode": 2, "persona": "Fungus" },
        { "from_episode": 7, "persona": "Marv", "anchor_contains": "<snippet>" },
        { "from_episode": 10, "persona": "Argonian" },
        { "from_episode": 10, "persona": null, "anchor_contains": "<snippet>" },
        { "from_episode": 23, "persona": null }
    ]
}
```

No `anchor_contains` = starts at the top of that episode. `persona: null` =
explicit revert to canonical from this point — an ordinary span entry, not a
sentinel value (the `personaId: -1` idea floated and rejected during
grilling as too obscure).

### What actually shipped (revised during implementation)

Two corrections surfaced once the mechanism was built and checked against
the real archive, not just the proposal above:

- `NAME_ALIASES["Fungus"] = "Vec"` (`discord-json-to-api.py`) was not
  retired, just re-scoped. The real source of the lost signal was
  `cast.Zander["2"]` itself saying `"Fungus"` — fixed directly by changing
  that entry to `"Vec"` (and dropping the now-redundant `"11": "Vec"`
  entry). `NAME_ALIASES["Fungus"]` stays, because the raw export
  independently contains one stray literal override unrelated to the cast
  default — `` Fungus: `I think I just him splat.` `` in Blackjack (ep4) —
  that still needs folding to `Vec` for character purposes. Persona comes
  from `personaTimeline` now, not from whatever `NAME_ALIASES` produces, so
  the two no longer need to tell the same story.
- **Checked `vec-hosts.wiki`'s host list against the actual Discord export
  text before encoding anything — first pass was too conservative.**
  Narration-only mentions (`*the argonian sits...*`) don't require an
  explicit `Name:` override to justify a persona; direct correction: yes,
  encode a host as a persona once the narrative establishes it, an inline
  override isn't the bar. Two real gotchas found doing this properly:
  1. **`anchor_contains` only ever matches lines already attributed to the
     target character.** `PersonaTimeline.resolve()` is called per line
     with *that line's own* resolved character — an anchor phrase sitting
     in a line spoken/narrated by someone else will never fire. Verified
     the author of every candidate anchor line is Zander (Vec's player)
     before using it, e.g. `` `"Oh hey, you're... Fursean, right?"` `` (ep5)
     is Trey's line, not Zander's, and would have silently never matched.
  2. **Following the trail past Fursean surfaced a third host name the wiki
     doesn't mention at all**: once Fursean's body "falls apart" (ep5,
     confirmed line `*Fursean falls apart by the second.*`), Vec takes a
     Moldak guard's corpse and the transcript calls it **"Fungo"** (`*Fungo
     hops into a guard Moldak's corpse...*`), not "Fungus" — a distinct
     nickname the wiki table never records. Not encoded — only "Argonian"
     and "Fursean" were asked for — but real, and worth a source pass of
     its own if the Moldak-guard stretch is wanted later.

  What's backed by verified attribution evidence and now in
  `meta/ff4.json`'s `personaTimeline["Vec"]`:
  - **"Fungus"** — `cast` default, ep2-10, plus one stray inline override.
  - **"Fursean"** — ep5 (`Diplomacy`) only: `{from_episode: 5, persona:
    "Fursean", anchor_contains: "Fursean scratches his head"}` (msg 447,
    Zander), reverting to `{from_episode: 5, persona: "Fungus",
    anchor_contains: "Fursean falls apart"}` (msg 764, Zander) later the
    same episode.
  - **"Argonian"** — `{from_episode: 17, persona: "Argonian",
    anchor_contains: "An Argonian in a parka appears"}` (msg 37 of
    `Don't Weld Yourself`, Zander), reverting with `{from_episode: 20,
    persona: null, anchor_contains: "fell back, slamming into the side of
    the sofa"}` (msg 411 of `Event Horizon`, Zander). Went through two
    wrong guesses before landing here, both corrected on user review, not
    self-caught:
    1. First pass: top-of-episode-20 approximation, flagged as a guess,
       because a keyword search of the raw export (`decompos`, `black
       hole`, `falls apart`, etc.) found nothing conclusive.
    2. Second pass: queried the live dev API instead (`ff-server` on
       :3000, already seeded with FF4 — `GET
       /api/episodes/Event%20Horizon/messages`) and found msg 67, the
       *first* Zander-authored line in the episode, already reading "A
       mercenary enters the common area, slumping back on the couch" —
       concluded the Argonian's death was off-screen, between episodes,
       and anchored the revert there. **Wrong**: msg 67 is *also* the
       Argonian, just increasingly described as "a mercenary" rather than
       by species as decomposition set in — same body throughout, not a
       swap. The real death is on-screen and explicit: an 8ball embed at
       msg 404 (`"Does Dutch accidentally fire Pauline, obliterating the
       drunken head of the mercenary?"` → "Certainly.") followed by msg
       411, Zander's own line, "The mercenary fell back, slamming into the
       side of the sofa." Live-verified: "Argonian" now correctly covers
       msg 67-410 (the "mercenary" stretch included) before reverting to
       null exactly at 411.
    A search finding nothing is evidence the anchor isn't in the text
    searched — not evidence the moment isn't narrated at all. Worth
    remembering before flagging the next one as unfindable.
  - **"Marv"/"Sascha"** — confirmed via the `RAVENS_PREFIXES`/
    `VEC_HOSTED_RAVENS_PREFIXES` fenced-dialogue mechanism (the prefix
    names the persona directly, more precisely than an episode/anchor
    guess), handled entirely in code — no `personaTimeline` entry at all.
  - Everything else in `vec-hosts.wiki` (Llorpus, the unnamed corpses,
    the Moldak guard/"Fungo") — not encoded, not asked for.

  Live-verified end to end against the real archive (not just unit tests):
  ep5 → `Fungus → Fursean → Fungus`, ep17 → `null → Argonian`, ep20 →
  `Argonian → null` (msg 411). If Sanya Dreadflower's own look changes
  (FF2 ×2, FF3, FF4 — still real, per the grilling session's A1) get
  encoded later, the same verify-against-source-and-author step should
  happen before writing any span — and per the Argonian correction above,
  "I searched and found nothing" isn't the same as "it isn't there."

### Testing

Both `cast_character()` implementations and the new `personaTimeline`
resolution logic are becoming real shared business logic across two
scripts, with zero test coverage today (no `pytest` or any test runner
found in `archive-to-markdown/`). Add coverage as part of this work rather
than deferring it.

## Explicitly out of scope, deferred to a fresh session

**Message identity.** `(episodeTitle, messageNo)` is positional, not a real
identity — surfaced while discussing anchor stability, but bigger than
personas. `Commentary` and `StoryBlock`'s permalink (`?line=`) both key off
the same composite FK and would go stale the same way if FF4 messages get
deleted/reordered before production (explicitly expected to happen —
"FF4 is in-progress"). Whether that needs a GUID, a content-derived id, or
something else entirely is an open question the user does not yet have an
answer to. Do not fold a fix in as a side effect of the persona work above —
`personaTimeline`'s content-anchoring was deliberately designed to not
depend on `messageNo` stability, so it isn't blocked by this. Needs its own
grilling pass: what should happen to a commentary/deep-link when its message
is deleted (orphan visibly? drop silently? re-anchor by content?), whether
this is FF4-only urgency or true of the whole archive.

## Also unrelated to this feature, already tracked elsewhere

- `DEFERRED-character-delete-dangling-persona.md` (`ff-server`) — deleting a
  `Character` leaves dangling `Message.personaId` refs. Separate, already
  scoped with three fix options by the team.
- Four independently hand-maintained shapes of "Persona" (Prisma model,
  `PERSONA_SELECT`, `ff-site`'s `types.ts`, `ff-server`'s `openapi.ts`) with
  no generated link between them — surfaced in the original architecture
  review, not addressed here.
