"""discord-json-to-api.py and md-to-api.py each have their own independent
cast_character() implementation (not shared code) -- both are tested here so
a future change to one doesn't silently diverge from the other."""

import importlib.util
import os

import pytest

HERE = os.path.dirname(__file__)


def _load(module_name, file_name):
    spec = importlib.util.spec_from_file_location(module_name, os.path.join(HERE, file_name))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


djta = _load("discord_json_to_api", "discord-json-to-api.py")
mta = _load("md_to_api", "md-to-api.py")

IMPLEMENTATIONS = [djta.cast_character, mta.cast_character]


@pytest.mark.parametrize("cast_character", IMPLEMENTATIONS)
def test_player_with_no_cast_entry_resolves_to_none(cast_character):
    assert cast_character({"cast": {}}, "Nobody", 5) is None


@pytest.mark.parametrize("cast_character", IMPLEMENTATIONS)
def test_resolves_the_span_active_as_of_the_given_episode(cast_character):
    meta = {"cast": {"Zander": {"0": "Emmett Tawfeek", "1": "Llafay Terrels", "2": "Vec"}}}
    assert cast_character(meta, "Zander", 0) == "Emmett Tawfeek"
    assert cast_character(meta, "Zander", 1) == "Llafay Terrels"
    assert cast_character(meta, "Zander", 2) == "Vec"
    assert cast_character(meta, "Zander", 9) == "Vec"  # carries forward past the last span


@pytest.mark.parametrize("cast_character", IMPLEMENTATIONS)
def test_before_the_players_first_span_falls_back_to_their_earliest_character(cast_character):
    meta = {"cast": {"Brody": {"1": "Serpile", "5": "Bail"}}}
    assert cast_character(meta, "Brody", 0) == "Serpile"


@pytest.mark.parametrize("cast_character", IMPLEMENTATIONS)
def test_span_keys_are_compared_numerically_not_lexically(cast_character):
    # "10" must sort after "2", not before it as a string comparison would.
    meta = {"cast": {"Zander": {"2": "Fungus", "10": "Argonian"}}}
    assert cast_character(meta, "Zander", 9) == "Fungus"
    assert cast_character(meta, "Zander", 10) == "Argonian"
