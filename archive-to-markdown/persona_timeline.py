"""Shared by discord-json-to-api.py and md-to-api.py: resolves which persona
(if any) is active for a character at a given point in an episode, per
meta["personaTimeline"] -- see PLAN-persona-timeline.md and README.md.

personaTimeline is keyed by character (not player), separate from `cast`:
`cast` tracks which character a player voices, at episode granularity (every
confirmed swap lands on an episode boundary); personaTimeline tracks which
*persona* of that character is active, which often changes mid-episode.

    "personaTimeline": {
        "Vec": [
            { "from_episode": 2, "persona": "Fungus" },
            { "from_episode": 7, "persona": "Marv", "anchor_contains": "<snippet>" },
            { "from_episode": 10, "persona": null, "anchor_contains": "<snippet>" }
        ]
    }

A span with no anchor_contains starts at the top of from_episode. A span
with one starts at whichever message contains that text -- content-matched
rather than position-matched, since message numbers aren't a stable
identifier (assigned positionally downstream of both conversion scripts, so
any future pipeline change that shifts line counts would silently misalign
a position-anchored boundary). persona: null is an explicit revert to the
character's canonical presentation, not the absence of an entry.
"""


class PersonaTimeline:
    """One instance per episode conversion. Call resolve(character, text)
    once per line, in the same chronological order the episode's messages
    are processed in -- state only advances forward, so a later call can't
    "un-see" an anchor an earlier call already matched."""

    def __init__(self, meta, episode_number):
        self._timeline = meta.get("personaTimeline", {})
        self._episode_number = episode_number
        self._current = {}
        self._pending = {}

    def _init_character(self, character):
        spans = self._timeline.get(character, [])
        established = None
        for span in spans:
            if span["from_episode"] < self._episode_number:
                established = span.get("persona")
        self._current[character] = established
        self._pending[character] = [
            span for span in spans if span["from_episode"] == self._episode_number
        ]

    def resolve(self, character, text):
        """The persona active for `character` as of this line's text, or
        None if the character has no timeline (or is None itself)."""
        if character is None:
            return None
        if character not in self._current:
            self._init_character(character)
        pending = self._pending[character]
        while pending:
            span = pending[0]
            anchor = span.get("anchor_contains")
            if anchor is None or anchor in text:
                self._current[character] = span.get("persona")
                pending.pop(0)
                continue
            break
        return self._current[character]
