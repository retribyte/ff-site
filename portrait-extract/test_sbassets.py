"""python3 -m unittest discover portrait-extract"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sbassets  # noqa: E402
from sbassets import AssetStore, apply_patch, parse_frames, parse_json  # noqa: E402


class LenientJson(unittest.TestCase):
    def test_comments_are_stripped_but_strings_kept(self):
        doc = parse_json(b'{ // note\n "link": "steam://url/x", /* block */ "n": 1, "s": "a /* b */ c" }')
        self.assertEqual(doc, {"link": "steam://url/x", "n": 1, "s": "a /* b */ c"})

    def test_trailing_commas_and_bom(self):
        self.assertEqual(parse_json(b'\xef\xbb\xbf{"a": [1, 2,], }'), {"a": [1, 2]})


class Patches(unittest.TestCase):
    def test_add_append_replace_remove(self):
        doc = {"hair": ["1"], "x": 1}
        out = apply_patch(doc, [
            {"op": "add", "path": "/hair/-", "value": "2"},
            {"op": "replace", "path": "/x", "value": 2},
            {"op": "add", "path": "/new", "value": True},
            {"op": "remove", "path": "/hair/0"},
        ])
        self.assertEqual(out, {"hair": ["2"], "x": 2, "new": True})
        self.assertEqual(doc, {"hair": ["1"], "x": 1})

    def test_failed_test_skips_only_its_batch(self):
        out = apply_patch({"a": 1}, [
            [{"op": "test", "path": "/missing"}, {"op": "add", "path": "/b", "value": 1}],
            [{"op": "test", "path": "/missing", "inverse": True}, {"op": "add", "path": "/c", "value": 1}],
            [{"op": "test", "path": "/a", "value": 1}, {"op": "add", "path": "/d", "value": 1}],
        ])
        self.assertEqual(out, {"a": 1, "c": 1, "d": 1})

    def test_flat_patch_that_fails_raises(self):
        with self.assertRaises(sbassets.PatchError):
            apply_patch({"a": 1}, [{"op": "replace", "path": "/nope", "value": 2}])


class Frames(unittest.TestCase):
    def test_grid_list_and_aliases(self):
        frames = parse_frames({
            "frameGrid": {"size": [43, 43], "dimensions": [3, 2], "names": [[None, "idle.1", "idle.2"], [None, "walk.1"]]},
            "frameList": {"normal": [43, 0, 86, 43]},
            "aliases": {"lay.1": "sit.1", "sit.1": "idle.2", "ghost": "nothing"},
        })
        self.assertEqual(frames["idle.2"], [86, 0, 43, 43])
        self.assertEqual(frames["walk.1"], [43, 43, 43, 43])
        self.assertEqual(frames["normal"], [43, 0, 43, 43])
        self.assertEqual(frames["lay.1"], [86, 0, 43, 43])
        self.assertNotIn("ghost", frames)

    def test_unnamed_grid_is_numbered(self):
        frames = parse_frames({"frameGrid": {"size": [8, 8], "dimensions": [2, 2]}})
        self.assertEqual(frames["3"], [8, 8, 8, 8])


class Store(unittest.TestCase):
    def mod(self, root: Path, name: str, files: dict, **meta) -> Path:
        d = root / name
        for rel, content in files.items():
            f = d / rel.lstrip("/")
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(content if isinstance(content, bytes) else json.dumps(content).encode())
        (d / "_metadata").write_text(json.dumps({"name": name, **meta}))
        return d

    def test_load_order_patches_and_frames_lookup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = self.mod(root, "base", {
                "/species/cat.species": {"kind": "cat", "hair": ["1"]},
                "/humanoid/default.frames": {"frameList": {"normal": [0, 0, 1, 1]}},
                "/humanoid/cat/Hair/1.png": b"vanilla",
            })
            cute = self.mod(root, "cute", {"/humanoid/cat/hair/1.png": b"cute"}, priority=1)
            extra = self.mod(root, "extra", {
                "/species/cat.species.patch": [{"op": "add", "path": "/hair/-", "value": "2"}],
                "/humanoid/cat/hair/1.png": b"extra",
                "/humanoid/cat/hair/default.frames": {"frameList": {"normal": [2, 0, 3, 1]}},
            })
            store = AssetStore()
            store.load(base, [(cute, None), (extra, None)])
            # Higher priority loads later and wins; every provider is still listed.
            self.assertEqual([s.id for s in store.providers["/humanoid/cat/hair/1.png"]], ["vanilla", "extra", "cute"])
            self.assertEqual(store.read("/humanoid/cat/hair/1.png"), b"cute")
            self.assertEqual(store.json("/species/cat.species")["hair"], ["1", "2"])
            self.assertEqual(store.frames_file("/humanoid/cat/hair/1.png"), "/humanoid/cat/hair/default.frames")
            self.assertEqual(store.frames_file("/humanoid/cat/malebody.png"), "/humanoid/default.frames")

    def test_a_mod_given_twice_is_replaced_by_the_later_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = self.mod(root, "base", {"/a.txt": b"x"})
            old = self.mod(root / "workshop", "squoat", {"/humanoid/s/body.png": b"old"})
            new = self.mod(root / "repo", "squoat", {"/humanoid/s/body.png": b"new"})
            store = AssetStore()
            store.load(base, [(old, "2715594280"), (new, None)])
            self.assertEqual(store.read("/humanoid/s/body.png"), b"new")
            self.assertEqual(len(store.providers["/humanoid/s/body.png"]), 1)


if __name__ == "__main__":
    unittest.main()
