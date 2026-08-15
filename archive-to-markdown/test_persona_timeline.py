from persona_timeline import PersonaTimeline


def test_character_with_no_timeline_resolves_to_none():
    timeline = PersonaTimeline({}, episode_number=5)
    assert timeline.resolve("Vec", "anything") is None


def test_none_character_resolves_to_none():
    meta = {"personaTimeline": {"Vec": [{"from_episode": 1, "persona": "Fungus"}]}}
    timeline = PersonaTimeline(meta, episode_number=5)
    assert timeline.resolve(None, "anything") is None


def test_span_from_an_earlier_episode_applies_from_the_top_of_this_one():
    meta = {"personaTimeline": {"Vec": [{"from_episode": 2, "persona": "Fungus"}]}}
    timeline = PersonaTimeline(meta, episode_number=7)
    # No anchor needed -- episode 7 is entirely past episode 2's boundary.
    assert timeline.resolve("Vec", "the very first line of the episode") == "Fungus"


def test_span_starting_in_a_later_episode_does_not_apply_yet():
    meta = {"personaTimeline": {"Vec": [{"from_episode": 11, "persona": None}]}}
    timeline = PersonaTimeline(meta, episode_number=7)
    assert timeline.resolve("Vec", "anything") is None


def test_anchor_gated_span_does_not_apply_before_its_anchor_is_seen():
    meta = {
        "personaTimeline": {
            "Vec": [{"from_episode": 7, "persona": "Marv", "anchor_contains": "the trigger line"}]
        }
    }
    timeline = PersonaTimeline(meta, episode_number=7)
    assert timeline.resolve("Vec", "an earlier, unrelated line") is None


def test_anchor_gated_span_applies_from_the_matching_line_onward():
    meta = {
        "personaTimeline": {
            "Vec": [{"from_episode": 7, "persona": "Marv", "anchor_contains": "the trigger line"}]
        }
    }
    timeline = PersonaTimeline(meta, episode_number=7)
    assert timeline.resolve("Vec", "an earlier, unrelated line") is None
    assert timeline.resolve("Vec", "here comes the trigger line at last") == "Marv"
    assert timeline.resolve("Vec", "and a later line") == "Marv"


def test_state_advances_in_chronological_order_and_does_not_rewind():
    """Two spans in the same episode: resolve() must be called in the same
    order the episode's own messages are processed in -- an anchor already
    matched can't be un-matched by a later call that doesn't contain it."""
    meta = {
        "personaTimeline": {
            "Vec": [
                {"from_episode": 10, "persona": "Argonian"},
                {"from_episode": 10, "persona": None, "anchor_contains": "reverts here"},
            ]
        }
    }
    timeline = PersonaTimeline(meta, episode_number=10)
    assert timeline.resolve("Vec", "top of the episode") == "Argonian"
    assert timeline.resolve("Vec", "still Argonian") == "Argonian"
    assert timeline.resolve("Vec", "it reverts here mid-episode") is None
    assert timeline.resolve("Vec", "stays reverted afterward") is None


def test_null_persona_is_an_explicit_revert_not_absence():
    meta = {
        "personaTimeline": {
            "Vec": [
                {"from_episode": 2, "persona": "Fungus"},
                {"from_episode": 11, "persona": None},
            ]
        }
    }
    assert PersonaTimeline(meta, episode_number=5).resolve("Vec", "x") == "Fungus"
    assert PersonaTimeline(meta, episode_number=11).resolve("Vec", "x") is None
    assert PersonaTimeline(meta, episode_number=20).resolve("Vec", "x") is None


def test_only_the_matching_character_advances():
    meta = {
        "personaTimeline": {
            "Vec": [{"from_episode": 1, "persona": "Fungus"}],
        }
    }
    timeline = PersonaTimeline(meta, episode_number=5)
    assert timeline.resolve("Sanya Dreadflower", "some line") is None
    assert timeline.resolve("Vec", "some other line") == "Fungus"
