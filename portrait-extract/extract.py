#!/usr/bin/env python3
"""Build the portrait creator's sprite bundle from a Starbound install.

    python3 portrait-extract/extract.py                 # auto-detects Starbound + workshop mods
    python3 portrait-extract/extract.py --mod ../squoatling-mod --out public/portrait-bundle

Reads the vanilla pak, <Starbound>/mods, every subscribed workshop mod and any --mod given
(a .pak or an unpacked mod folder), in the game's load order, and writes:

    <out>/manifest.json   mods, species (each file plus every mod's patch to it), frame rects, images
    <out>/items.json      every head/chest/legs/back item, shared colour lists, the images used
    <out>/sprites/<mod id>/<asset path>   the PNGs, one copy per mod that provides the path

Every mod's version of a sprite is kept (the site decides which to show), so nothing is
lost when mods override each other. Standard library only. See README.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sbassets  # noqa: E402
from sbassets import AssetStore, warn  # noqa: E402

MANIFEST_VERSION = 1
STARBOUND_APP_ID = "211820"
ITEM_SLOTS = {".head": "head", ".chest": "chest", ".legs": "legs", ".back": "back"}


# --------------------------------------------------------------------------- finding Starbound

def steam_libraries() -> list[Path]:
    home = Path.home()
    roots = [
        home / ".local/share/Steam",
        home / ".steam/steam",
        home / ".var/app/com.valvesoftware.Steam/.local/share/Steam",
        home / "Library/Application Support/Steam",
        Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)")) / "Steam",
        Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Steam",
    ]
    libs: list[Path] = []
    for root in roots:
        if not (root / "steamapps").is_dir():
            continue
        libs.append(root)
        vdf = root / "steamapps/libraryfolders.vdf"
        if vdf.is_file():
            for m in re.finditer(r'"path"\s+"([^"]+)"', vdf.read_text("utf-8", "replace")):
                libs.append(Path(m.group(1).replace("\\\\", "\\")))
    seen, out = set(), []
    for lib in libs:
        key = str(lib.resolve()) if lib.exists() else str(lib)
        if key not in seen:
            seen.add(key)
            out.append(lib)
    return out


def find_starbound(explicit: str | None) -> Path:
    candidates = [Path(explicit)] if explicit else []
    if os.environ.get("STARBOUND_DIR"):
        candidates.append(Path(os.environ["STARBOUND_DIR"]))
    candidates += [lib / "steamapps/common/Starbound" for lib in steam_libraries()]
    for c in candidates:
        if (c / "assets/packed.pak").is_file():
            return c
    raise SystemExit("Starbound not found. Pass --starbound <folder that contains assets/packed.pak> "
                     "or set STARBOUND_DIR.")


def mod_entries(folder: Path) -> list[Path]:
    """Paks and unpacked mods directly inside a mods folder."""
    out = []
    if folder.is_dir():
        for p in sorted(folder.iterdir()):
            if p.suffix.lower() == ".pak" or (p.is_dir() and any(
                    (p / m).is_file() for m in ("_metadata", ".metadata"))):
                out.append(p)
    return out


def discover_mods(starbound: Path, workshop: Path | None, extra: list[str]) -> list[tuple[Path, str | None]]:
    mods: list[tuple[Path, str | None]] = [(p, None) for p in mod_entries(starbound / "mods")]
    if workshop is None:
        guess = starbound.parent.parent / "workshop/content" / STARBOUND_APP_ID
        workshop = guess if guess.is_dir() else None
    if workshop:
        for item in sorted(workshop.iterdir()):
            if not item.is_dir():
                continue
            paks = sorted(item.glob("*.pak"))
            if paks:
                mods += [(p, item.name if len(paks) == 1 else f"{item.name}-{p.stem}") for p in paks]
            else:
                mods.append((item, item.name))
    for e in extra:
        p = Path(e).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"--mod {e}: no such file or folder")
        mods.append((p, None))
    return mods


# --------------------------------------------------------------------------- helpers

_COLOR_CODE = re.compile(r"\^[^;^]*;")


def plain(text) -> str:
    return _COLOR_CODE.sub("", text).strip() if isinstance(text, str) else ""


def deep_merge(base, over):
    if isinstance(base, dict) and isinstance(over, dict):
        out = dict(base)
        for k, v in over.items():
            out[k] = deep_merge(base.get(k), v)
        return out
    return over


def resolve(directory: str, ref: str) -> str:
    """An asset reference relative to `directory`, lowercased, without :frame or ?directives."""
    ref = re.split(r"[:?]", ref, maxsplit=1)[0]
    return (ref if ref.startswith("/") else directory + ref).lower()


def color_options(raw) -> list:
    """Each option is a {from: to} hex map (a palette swap) or a raw directive string."""
    out = []
    for entry in raw if isinstance(raw, list) else []:
        if isinstance(entry, dict):
            out.append({str(k).lower(): str(v).lower() for k, v in entry.items()})
        elif isinstance(entry, str):
            out.append(entry)
    return out


class Bundle:
    """Collects the images a manifest refers to and writes one copy per providing mod."""

    def __init__(self, store: AssetStore):
        self.store = store
        self.frames: dict[str, dict] = {}
        self._providers: dict[str, list] = {}
        self.hashes: dict[tuple[str, str], str] = {}

    def image(self, path: str) -> dict | None:
        """Manifest entry {"m": [mod ids, load order], "f": frames file} or None if missing."""
        path = path.lower()
        if path not in self.store.providers:
            return None
        if path not in self._providers:
            kept, last = [], None
            for src in self.store.providers[path]:
                digest = hashlib.sha1(src.read(path)).hexdigest()
                if digest != last:  # an identical re-ship of the same file is not a variant
                    kept.append(src)
                    self.hashes[(src.id, path)] = digest
                last = digest
            self._providers[path] = kept
        entry: dict = {"m": [s.id for s in self._providers[path]]}
        frames_path = self.store.frames_file(path)
        if frames_path and self.store.frames(frames_path) is not None:
            self.frames[frames_path] = self.store.frames(frames_path)
            entry["f"] = frames_path
        return entry

    def write_sprites(self, out: Path) -> tuple[int, int, int]:
        root = out / "sprites"
        wanted: set[Path] = set()
        written = total = 0
        for path, sources in self._providers.items():
            for src in sources:
                target = root / src.id / path.lstrip("/")
                wanted.add(target)
                data = src.read(path)
                total += len(data)
                if target.is_file() and target.stat().st_size == len(data) and target.read_bytes() == data:
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                written += 1
        removed = 0
        if root.is_dir():
            for existing in sorted(root.rglob("*"), reverse=True):
                if existing.is_file() and existing not in wanted:
                    existing.unlink()
                    removed += 1
                elif existing.is_dir() and not any(existing.iterdir()):
                    existing.rmdir()
        return written, removed, total


# --------------------------------------------------------------------------- species

def build_species(store: AssetStore, bundle: Bundle) -> tuple[dict, dict]:
    """Each species as its unpatched file plus every mod's patch, in load order. The site applies
    the patches itself, so a race that leaves a mod out also loses that mod's changes to the
    species (its hair lists, colours and which options exist), not just its sprites."""
    creation = store.json("/interface/windowconfig/charcreation.config") or {}
    ordering = [str(s).lower() for s in creation.get("speciesOrdering", [])]
    species: dict[str, dict] = {}
    images: dict[str, dict] = {}

    for path in store.glob("/species/", (".species",)):
        patched = store.json(path)
        if not isinstance(patched, dict) or not patched.get("kind"):
            continue
        kind = str(patched["kind"])
        image_dir = f"/humanoid/{kind.lower()}/"
        sprites = store.glob(image_dir, (".png",))
        if not any(p.endswith("body.png") and p.count("/") == 3 for p in sprites):
            warn(f"{kind}: no body sprite found under {image_dir}, left out")
            continue
        for sprite in sprites:  # all of them: unlisted hair and alternate heads included
            images[sprite] = bundle.image(sprite)
        patches = []
        for src, patch_path in store.patches.get(path, []):
            try:
                patches.append({"m": src.id, "p": sbassets.parse_json(src.read(patch_path))})
            except ValueError:
                pass  # already reported by store.json above
        humanoid = deep_merge(store.json(patched.get("humanoidConfig", "/humanoid.config")) or {},
                              patched.get("humanoidOverrides") or {})
        species[kind] = {
            "kind": kind,
            "mod": store.winner(path).id,
            "playable": kind.lower() in ordering,
            "order": ordering.index(kind.lower()) if kind.lower() in ordering else None,
            "personalities": humanoid.get("personalities") or [["idle.1", "idle.1", [0, 0], [0, 0]]],
            "config": sbassets.parse_json(store.read(path)),
            "patches": patches,
        }
    return species, images


# --------------------------------------------------------------------------- items

def build_items(store: AssetStore, bundle: Bundle) -> tuple[list, dict, list]:
    items: dict[str, dict] = {}
    images: dict[str, dict] = {}
    skipped = 0

    def use(directory: str, ref) -> str | None:
        if not isinstance(ref, str) or not ref:
            return None
        path = resolve(directory, ref)
        entry = bundle.image(path)
        if entry is None:
            return None
        images[path] = entry
        return path

    for path in store.glob("/", tuple(ITEM_SLOTS)):
        cfg = store.json(path)
        if not isinstance(cfg, dict) or not cfg.get("itemName"):
            continue
        slot = ITEM_SLOTS[path[path.rindex("."):]]
        directory = path.rsplit("/", 1)[0] + "/"
        frames = {}
        for gender in ("male", "female"):
            raw = cfg.get(gender + "Frames")
            if isinstance(raw, dict):
                frames[gender] = {k: use(directory, v) for k, v in raw.items()
                                  if k in ("body", "backSleeve", "frontSleeve") and use(directory, v)}
            elif use(directory, raw):
                frames[gender] = {"body": use(directory, raw)}
        if not frames:
            skipped += 1
            continue
        item = {
            "id": str(cfg["itemName"]),
            "slot": slot,
            "name": plain(cfg.get("shortdescription")) or str(cfg["itemName"]),
            "mod": store.winner(path).id,
            "frames": frames,
            "colors": color_options(cfg.get("colorOptions")),
        }
        icon = cfg.get("inventoryIcon")
        if isinstance(icon, str) and use(directory, icon):
            item["icon"] = use(directory, icon) + (":" + icon.split(":", 1)[1].split("?")[0] if ":" in icon else "")
        if slot == "head" and use(directory, cfg.get("mask")):
            item["mask"] = use(directory, cfg.get("mask"))
        if isinstance(cfg.get("directives"), str) and cfg["directives"]:
            item["directives"] = cfg["directives"]
        if cfg.get("hideBody"):
            item["hideBody"] = True
        items[item["id"]] = item
    if skipped:
        warn(f"{skipped} wearable item(s) have no sprite sheets, left out")
    # Most items share a handful of colour lists: store each list once, items point at it.
    palettes: list[list] = []
    index: dict[str, int] = {}
    for item in items.values():
        key = json.dumps(item["colors"], sort_keys=True)
        if key not in index:
            index[key] = len(palettes)
            palettes.append(item["colors"])
        item["colors"] = index[key]
    ordered = sorted(items.values(), key=lambda i: (i["mod"], i["slot"], i["name"].lower()))
    return ordered, images, palettes


# --------------------------------------------------------------------------- main

def write_json(path: Path, data) -> None:
    # Key order is kept as the game files have it: a palette lists its main colours first,
    # and the site's swatches show the first few.
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), "utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--starbound", help="Starbound install folder (auto-detected from Steam otherwise)")
    ap.add_argument("--workshop", help="workshop content folder (default: next to the install)")
    ap.add_argument("--no-workshop", action="store_true", help="ignore workshop mods")
    ap.add_argument("--mod", action="append", default=[], metavar="PATH",
                    help="extra mod: a .pak or an unpacked mod folder; repeatable. A mod with the "
                         "same name as a workshop mod replaces it")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "public/portrait-bundle"),
                    help="bundle folder (default: ff-site/public/portrait-bundle)")
    args = ap.parse_args()

    starbound = find_starbound(args.starbound)
    workshop = Path(args.workshop) if args.workshop else None
    mods = discover_mods(starbound, workshop, args.mod) if not args.no_workshop else \
        [(p, None) for p in mod_entries(starbound / "mods")] + [(Path(m).expanduser().resolve(), None) for m in args.mod]
    print(f"Starbound: {starbound}\nMods found: {len(mods)}")

    store = AssetStore()
    store.load(starbound / "assets/packed.pak", mods)
    bundle = Bundle(store)
    species, species_images = build_species(store, bundle)
    items, item_images, palettes = build_items(store, bundle)

    used_mods = {m for e in list(species_images.values()) + list(item_images.values()) for m in e["m"]}
    used_mods |= {s["mod"] for s in species.values()} | {i["mod"] for i in items}
    mod_list = []
    for src in store.sources:
        if src.id in used_mods:
            entry = {"id": src.id, "name": src.title}
            if src.priority:
                entry["priority"] = src.priority
            if str(src.meta.get("steamContentId") or "").isdigit():
                entry["workshopId"] = str(src.meta["steamContentId"])
            mod_list.append(entry)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    written, removed, total = bundle.write_sprites(out)
    digest = hashlib.sha1()
    for key in sorted(bundle.hashes):
        digest.update(f"{key[0]}{key[1]}{bundle.hashes[key]}".encode())
    digest.update(json.dumps([species, items], sort_keys=True).encode())
    build = digest.hexdigest()[:12]
    used_frames = {e["f"] for e in list(species_images.values()) + list(item_images.values()) if "f" in e}
    write_json(out / "manifest.json", {
        "version": MANIFEST_VERSION, "build": build, "mods": mod_list, "species": species,
        "images": species_images, "frames": {k: v for k, v in bundle.frames.items() if k in used_frames},
    })
    write_json(out / "items.json", {"version": MANIFEST_VERSION, "build": build, "items": items,
                                    "palettes": palettes, "images": item_images})

    playable = sum(1 for s in species.values() if s["playable"])
    conflicts = sum(1 for e in species_images.values() if len(e["m"]) > 1)
    print(f"Species: {len(species)} ({playable} in the game's creator)")
    print(f"Items: {len(items)}  " + ", ".join(
        f"{slot} {sum(1 for i in items if i['slot'] == slot)}" for slot in ITEM_SLOTS.values()))
    print(f"Sprites: {len(bundle.hashes)} files, {total / 1e6:.1f} MB "
          f"({written} written, {removed} removed); {conflicts} species sprites have more than one version")
    print(f"Bundle {build} -> {out}")


if __name__ == "__main__":
    main()
