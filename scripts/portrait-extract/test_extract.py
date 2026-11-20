"""The per-mod bundle, on made-up mods (no game files): each folder holds only its own mod's
contribution, so deleting a folder equals never extracting that mod."""

import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract  # noqa: E402
from sbassets import AssetStore  # noqa: E402


def png(shade: int) -> bytes:
    """A 1x1 PNG; `shade` makes the bytes differ."""
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes([0, shade, shade, shade, 255]))) + chunk(b"IEND", b""))


def write_mod(root: Path, name: str, files: dict, **meta) -> Path:
    folder = root / name
    for rel, content in {"_metadata": {"name": name, **meta}, **files}.items():
        target = folder / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content if isinstance(content, bytes) else json.dumps(content).encode())
    return folder


SHIRT = {"itemName": "shirt", "shortdescription": "Shirt", "inventoryIcon": "icons.png:chest",
         "maleFrames": {"body": "chestm.png"}, "femaleFrames": {"body": "chestm.png"}, "colorOptions": [{"aa": "bb"}]}


class PerModBundle(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.base = write_mod(root, "base", {
            "species/elf.species": {"kind": "elf", "genders": [{"name": "male", "hair": ["1"]}]},
            "humanoid/elf/malebody.png": png(1), "humanoid/elf/malehead.png": png(2), "humanoid/elf/hair/1.png": png(3),
            "humanoid/default.frames": {"frameGrid": {"size": [1, 1], "dimensions": [1, 1], "names": [["normal"]]}},
            "items/armors/shirt/shirt.chest": SHIRT,
            "items/armors/shirt/chestm.png": png(4), "items/armors/shirt/icons.png": png(5),
        })
        self.cute = write_mod(root, "cute", {
            "species/elf.species.patch": [{"op": "add", "path": "/genders/0/hair/-", "value": "2"}],
            "humanoid/elf/malehead.png": png(9), "humanoid/elf/hair/2.png": png(8),
            "items/armors/shirt/shirt.chest.patch": [{"op": "replace", "path": "/femaleFrames/body", "value": "chestf.png"}],
            "items/armors/shirt/chestf.png": png(7),
        }, priority=5)
        self.quiet = write_mod(root, "quiet", {  # changes nothing the creator reads
            "items/armors/shirt/shirt.chest.patch": [{"op": "add", "path": "/learnBlueprintsOnPickup", "value": ["x"]}],
        })

    def tearDown(self):
        self.tmp.cleanup()

    def extract(self, out: str, *mods: Path) -> Path:
        store = AssetStore()
        store.load(mods[0], [(m, None) for m in mods[1:]])  # the first stands in for the base game
        bundle = extract.Bundle(store)
        extract.build_species(store, bundle)
        extract.build_items(store, bundle)
        target = Path(self.tmp.name) / out
        extract.write_bundle(bundle, target)
        return target

    def read(self, out: Path, mod: str, name: str) -> dict:
        return json.loads((out / mod / name).read_text())

    def test_each_folder_holds_only_its_own_mods_contribution(self):
        out = self.extract("all", self.base, self.cute, self.quiet)
        base, cute = self.read(out, "vanilla", "mod.json"), self.read(out, "cute", "mod.json")
        self.assertEqual(list(base["species"]), ["elf"])
        self.assertEqual(base["species"]["elf"]["config"]["genders"][0]["hair"], ["1"])  # unpatched
        self.assertEqual(cute["species"], {})
        self.assertEqual(list(cute["speciesPatches"]), ["elf"])
        self.assertEqual(sorted(cute["images"]), ["/humanoid/elf/hair/2.png", "/humanoid/elf/malehead.png"])
        self.assertIn("/humanoid/default.frames", base["frames"])

        base_items, cute_items = self.read(out, "vanilla", "items.json"), self.read(out, "cute", "items.json")
        self.assertEqual(base_items["items"][0]["frames"]["female"]["body"], "/items/armors/shirt/chestm.png")
        self.assertNotIn("patch", base_items["items"][0])
        self.assertEqual(cute_items["items"][0]["frames"]["female"]["body"], "/items/armors/shirt/chestf.png")
        self.assertTrue(cute_items["items"][0]["patch"])
        self.assertFalse((out / "quiet").exists())  # a patch the creator cannot see makes no folder

    def test_pack_offsets_give_back_each_mods_own_bytes(self):
        out = self.extract("all", self.base, self.cute)
        for mod, shade in (("vanilla", 2), ("cute", 9)):
            offset, length, _hash, frames = self.read(out, mod, "mod.json")["images"]["/humanoid/elf/malehead.png"]
            pack = (out / mod / extract.PACK_NAME).read_bytes()
            self.assertEqual(pack[offset:offset + length], png(shade))
            self.assertEqual(self.read(out, mod, "mod.json")["frameFiles"][frames], "/humanoid/default.frames")

    def test_deleting_a_folder_equals_never_extracting_the_mod(self):
        both = self.extract("both", self.base, self.cute)
        alone = self.extract("alone", self.base)
        for name in ("mod.json", "items.json", extract.PACK_NAME):
            self.assertEqual((both / "vanilla" / name).read_bytes(), (alone / "vanilla" / name).read_bytes(), name)

    def test_rerun_removes_the_folder_of_a_mod_no_longer_extracted(self):
        out = self.extract("all", self.base, self.cute)
        self.assertTrue((out / "cute").is_dir())
        self.extract("all", self.base)
        self.assertFalse((out / "cute").exists())
        self.assertEqual([m["id"] for m in json.loads((out / "mods.json").read_text())["mods"]], ["vanilla"])


if __name__ == "__main__":
    unittest.main()
