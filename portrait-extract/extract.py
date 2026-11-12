#!/usr/bin/env python3
"""Build the portrait creator's sprite bundle from a Starbound install.

    python3 portrait-extract/extract.py                 # auto-detects Starbound + workshop mods
    python3 portrait-extract/extract.py --mod ../squoatling-mod --out public/portrait-bundle

Reads the vanilla pak, <Starbound>/mods, every subscribed workshop mod and any --mod given
(a .pak or an unpacked mod folder), in the game's load order, and writes one folder per mod
holding only what that mod's own files contribute:

    <out>/<mod id>/mod.json      its species files, its patches to other species, frame rects,
                                 and where each of its species sprites sits in the pack
    <out>/<mod id>/items.json    its head/chest/legs/back items and where their sprites sit
    <out>/<mod id>/sprites.pack  its PNGs end to end; the site fetches the byte ranges it needs
    <out>/mods.json, items.json  every folder's file of that name, concatenated

Nothing is merged here: the site combines whichever folders are present, so deleting a folder
removes that mod and nothing else. Standard library only. See README.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sbassets  # noqa: E402
from sbassets import AssetStore, warn  # noqa: E402

BUNDLE_VERSION = 2
PACK_NAME = "sprites.pack"
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


def skipped_mods(curation: Path | None) -> dict[str, str]:
    """Mod ids the site's curation file says to leave out altogether ({id: name})."""
    if curation is None or not curation.is_file():
        return {}
    skip = json.loads(curation.read_text("utf-8")).get("skipMods") or {}
    return {str(k): str(v) for k, v in skip.items()}


def without_skipped(mods: list[tuple[Path, str | None]], skip: dict[str, str]) -> list[tuple[Path, str | None]]:
    """Drops skipped mods before anything is read from them, so their items, sprites and
    patches to other mods' files never reach the bundle. A workshop folder with several paks
    gets ids like 123-name; all of them go."""
    def skipped(path: Path, forced: str | None) -> bool:
        ident = forced or path.stem
        return any(ident == s or ident.startswith(s + "-") for s in skip)
    return [(p, f) for p, f in mods if not skipped(p, f)]


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


class ModOut:
    """What one mod contributes to the bundle."""

    def __init__(self, src, order: int):
        self.src = src
        self.order = order
        self.species: dict[str, dict] = {}
        self.species_patches: dict[str, object] = {}
        self.items: list[dict] = []
        self.frames: dict[str, dict] = {}
        self.species_images: set[str] = set()
        self.item_images: set[str] = set()

    def empty(self) -> bool:
        return not (self.species or self.species_patches or self.items or self.frames
                    or self.species_images or self.item_images)


class Bundle:
    """Collects, per mod, the images the species and items refer to. Every mod that ships a
    path keeps its own copy, so the site can choose between them and a mod can be removed
    without touching another's folder."""

    def __init__(self, store: AssetStore):
        self.store = store
        self.mods: dict[str, ModOut] = {src.id: ModOut(src, i) for i, src in enumerate(store.sources)}
        self.frames_of: dict[str, str | None] = {}
        self.icons: set[str] = set()
        self.sheets: set[str] = set()
        self._frames_done: set[str] = set()

    def use(self, path: str, species: bool = False) -> bool:
        """Notes that an image is needed; False if no mod ships it."""
        path = path.lower()
        if path not in self.store.providers:
            return False
        for src in self.store.providers[path]:
            out = self.mods[src.id]
            (out.species_images if species else out.item_images).add(path)
        if path not in self.frames_of:
            frames_path = self.store.frames_file(path)
            rects = self.store.frames(frames_path) if frames_path else None
            self.frames_of[path] = frames_path if rects is not None else None
            if rects is not None and frames_path not in self._frames_done:
                self._frames_done.add(frames_path)
                self._share_frames(frames_path)
        return True

    def _share_frames(self, frames_path: str) -> None:
        """Every mod that ships or patches a frames file gets the rectangles as they stand
        after its own contribution, so the file survives the removal of whichever mod wins."""
        doc = None
        steps = [(src, frames_path, False) for src in self.store.providers[frames_path]]
        steps += [(src, patch_path, True) for src, patch_path in self.store.patches.get(frames_path, [])]
        for src, file, is_patch in steps:
            try:
                parsed = sbassets.parse_json(src.read(file))
                doc = sbassets.apply_patch(json.loads(json.dumps(doc)), parsed) if is_patch else parsed
                if isinstance(doc, dict):
                    self.mods[src.id].frames[frames_path] = sbassets.parse_frames(doc)
            except (ValueError, KeyError, TypeError, IndexError, sbassets.PatchError):
                pass  # already reported when the merged file was read

    def pack_order(self, path: str) -> tuple:
        """Images the site asks for together sit together in the pack, so it can fetch them
        as one byte range: a mod's item icons first, then everything folder by folder."""
        return (0, path) if path in self.icons and path not in self.sheets else (1, path.rsplit("/", 1)[0] + "/", path)

    def build_mod(self, mod: ModOut) -> tuple[dict, dict, bytes]:
        """(mod.json, items.json, sprites.pack) for one mod."""
        src = mod.src
        item_images = mod.item_images - mod.species_images
        blob = bytearray()
        frame_files: list[str] = []
        frame_index: dict[str, int] = {}
        refs: dict[str, list] = {}
        for path in sorted(mod.species_images | item_images, key=self.pack_order):
            data = src.read(path)
            frames_path = self.frames_of[path]
            if frames_path is not None and frames_path not in frame_index:
                frame_index[frames_path] = len(frame_files)
                frame_files.append(frames_path)
            # offset, length, content hash (two mods shipping the same bytes are one version),
            # frames file or -1
            refs[path] = [len(blob), len(data), hashlib.sha1(data).hexdigest()[:10], frame_index.get(frames_path, -1)]
            blob += data

        # Most items share a handful of colour lists: store each list once, items point at it.
        palettes: list[list] = []
        palette_index: dict[str, int] = {}
        items = []
        for item in sorted(mod.items, key=lambda i: (i["slot"], i["name"].lower(), i["id"])):
            key = json.dumps(item["colors"], sort_keys=True)
            if key not in palette_index:
                palette_index[key] = len(palettes)
                palettes.append(item["colors"])
            items.append({**item, "colors": palette_index[key]})

        info: dict = {"version": BUNDLE_VERSION, "id": src.id, "name": src.title, "order": mod.order}
        if src.priority:
            info["priority"] = src.priority
        if str(src.meta.get("steamContentId") or "").isdigit():
            info["workshopId"] = str(src.meta["steamContentId"])
        content = {
            "frameFiles": frame_files,
            "images": {p: r for p, r in refs.items() if p in mod.species_images},
            "species": mod.species,
            "speciesPatches": mod.species_patches,
            "frames": mod.frames,
        }
        item_content = {"items": items, "palettes": palettes, "images": {p: r for p, r in refs.items() if p in item_images}}
        digest = hashlib.sha1(bytes(blob))
        digest.update(json.dumps([content, item_content], sort_keys=True).encode())
        build = digest.hexdigest()[:12]
        return ({**info, "build": build, **content},
                {"version": BUNDLE_VERSION, "id": src.id, "build": build, **item_content},
                bytes(blob))


def write_if_changed(path: Path, data: bytes) -> bool:
    if path.is_file() and path.stat().st_size == len(data) and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def encode_json(data) -> bytes:
    # Key order is kept as the game files have it: a palette lists its main colours first,
    # and the site's swatches show the first few.
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def write_bundle(bundle: Bundle, out: Path) -> dict:
    """Writes every mod's folder and the two concatenated files; removes folders of mods that
    are no longer extracted and what the older single-manifest layout left behind."""
    out.mkdir(parents=True, exist_ok=True)
    mod_files, item_files = [], []
    stats = {"mods": 0, "written": 0, "removed": 0, "bytes": 0, "sprites": 0}
    kept: set[str] = set()
    for mod in bundle.mods.values():
        if mod.empty():
            continue
        info, items, blob = bundle.build_mod(mod)
        folder = out / info["id"]
        kept.add(info["id"])
        stats["written"] += write_if_changed(folder / "mod.json", encode_json(info))
        stats["written"] += write_if_changed(folder / "items.json", encode_json(items))
        stats["written"] += write_if_changed(folder / PACK_NAME, blob)
        stats["mods"] += 1
        stats["bytes"] += len(blob)
        stats["sprites"] += len(info["images"]) + len(items["images"])
        mod_files.append(info)
        item_files.append(items)
    for existing in sorted(out.iterdir()):
        if existing.is_dir() and existing.name not in kept and (
                (existing / "mod.json").is_file() or existing.name == "sprites"):
            shutil.rmtree(existing)
            stats["removed"] += 1
    if (out / "manifest.json").is_file():
        (out / "manifest.json").unlink()
    # The same shape a server gets by reading each folder present: nothing here is merged.
    write_if_changed(out / "mods.json", encode_json({"version": BUNDLE_VERSION, "mods": mod_files}))
    write_if_changed(out / "items.json", encode_json({"version": BUNDLE_VERSION, "mods": item_files}))
    return stats


# --------------------------------------------------------------------------- species

def build_species(store: AssetStore, bundle: Bundle) -> tuple[int, int]:
    """Each mod gets the species files it ships, unpatched, and its patches to species files.
    The site applies the patches itself, so a race that leaves a mod out also loses that mod's
    changes to the species (its hair lists, colours and which options exist), not just its
    sprites. Returns (species, how many the game's own creator offers)."""
    creation = store.json("/interface/windowconfig/charcreation.config") or {}
    ordering = [str(s).lower() for s in creation.get("speciesOrdering", [])]
    count = playable = 0

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
            bundle.use(sprite, species=True)
        humanoid = deep_merge(store.json(patched.get("humanoidConfig", "/humanoid.config")) or {},
                              patched.get("humanoidOverrides") or {})
        shared = {
            "kind": kind,
            "playable": kind.lower() in ordering,
            "order": ordering.index(kind.lower()) if kind.lower() in ordering else None,
            "personalities": humanoid.get("personalities") or [["idle.1", "idle.1", [0, 0], [0, 0]]],
        }
        for src in store.providers[path]:
            try:
                bundle.mods[src.id].species[kind] = {**shared, "config": sbassets.parse_json(src.read(path))}
            except ValueError:
                pass  # already reported by store.json above
        for src, patch_path in store.patches.get(path, []):
            try:
                bundle.mods[src.id].species_patches[kind] = sbassets.parse_json(src.read(patch_path))
            except ValueError:
                pass
        count += 1
        playable += shared["playable"]
    return count, playable


# --------------------------------------------------------------------------- items

def item_record(cfg, path: str, bundle: Bundle) -> dict | None:
    """What the creator needs from one item file, or None if it has no sprite sheets."""
    if not isinstance(cfg, dict) or not cfg.get("itemName"):
        return None
    slot = ITEM_SLOTS[path[path.rindex("."):]]
    directory = path.rsplit("/", 1)[0] + "/"

    def use(ref, icon: bool = False) -> str | None:
        if not isinstance(ref, str) or not ref:
            return None
        image = resolve(directory, ref)
        if not bundle.use(image):
            return None
        (bundle.icons if icon else bundle.sheets).add(image)
        return image

    frames = {}
    for gender in ("male", "female"):
        raw = cfg.get(gender + "Frames")
        if isinstance(raw, dict):
            frames[gender] = {k: use(v) for k, v in raw.items()
                              if k in ("body", "backSleeve", "frontSleeve") and use(v)}
        elif use(raw):
            frames[gender] = {"body": use(raw)}
    if not frames:
        return None
    item = {
        "id": str(cfg["itemName"]),
        "slot": slot,
        "name": plain(cfg.get("shortdescription")) or str(cfg["itemName"]),
        "frames": frames,
        "colors": color_options(cfg.get("colorOptions")),
    }
    icon = cfg.get("inventoryIcon")
    if isinstance(icon, str) and use(icon, icon=True):
        item["icon"] = use(icon, icon=True) + (":" + icon.split(":", 1)[1].split("?")[0] if ":" in icon else "")
    if slot == "head" and use(cfg.get("mask")):
        item["mask"] = use(cfg.get("mask"))
    if isinstance(cfg.get("directives"), str) and cfg["directives"]:
        item["directives"] = cfg["directives"]
    if cfg.get("hideBody"):
        item["hideBody"] = True
    return item


def build_items(store: AssetStore, bundle: Bundle) -> int:
    """Each mod gets the items its own files define. A mod that patches another mod's item in
    a way the creator can see (Cuter gives base-game clothes other sprite sheets) gets its
    version of that item too, marked `patch`: the site uses it while that mod is present and
    the item still belongs to the mod that defines it. Returns how many items there are."""
    count = skipped = 0
    for path in store.glob("/", tuple(ITEM_SLOTS)):
        doc = record = None
        for src in store.providers[path]:  # normally one; each ships its own whole file
            try:
                doc = sbassets.parse_json(src.read(path))
            except ValueError as e:
                warn(f"{path} ({src.title}): bad JSON, skipped ({e})")
                continue
            record = item_record(doc, path, bundle)
            if record:
                bundle.mods[src.id].items.append(record)
        for src, patch_path in store.patches.get(path, []):
            if doc is None:
                break
            try:
                doc = sbassets.apply_patch(json.loads(json.dumps(doc)), sbassets.parse_json(src.read(patch_path)))
            except (ValueError, sbassets.PatchError) as e:
                warn(f"{patch_path} ({src.title}): patch not applied ({e})")
                continue
            patched = item_record(doc, path, bundle)
            if patched and patched != record:
                record = patched
                bundle.mods[src.id].items.append({**patched, "patch": True})
        if record:
            count += 1
        else:
            skipped += 1
    if skipped:
        warn(f"{skipped} wearable item(s) have no sprite sheets, left out")
    return count


# --------------------------------------------------------------------------- main

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
    ap.add_argument("--curation", default=str(Path(__file__).resolve().parent.parent / "src/data/portrait/curation.json"),
                    help="curation file whose skipMods are left out (default: the site's); 'none' to ignore")
    args = ap.parse_args()

    starbound = find_starbound(args.starbound)
    workshop = Path(args.workshop) if args.workshop else None
    mods = discover_mods(starbound, workshop, args.mod) if not args.no_workshop else \
        [(p, None) for p in mod_entries(starbound / "mods")] + [(Path(m).expanduser().resolve(), None) for m in args.mod]
    skip = skipped_mods(None if args.curation == "none" else Path(args.curation))
    found = len(mods)
    mods = without_skipped(mods, skip)
    print(f"Starbound: {starbound}\nMods found: {found}" + (f" ({found - len(mods)} left out by the curation file)" if skip else ""))

    store = AssetStore()
    store.load(starbound / "assets/packed.pak", mods)
    bundle = Bundle(store)
    species, playable = build_species(store, bundle)
    items = build_items(store, bundle)
    stats = write_bundle(bundle, Path(args.out))

    print(f"Species: {species} ({playable} in the game's creator)")
    print(f"Items: {items}")
    print(f"Mods with something to offer: {stats['mods']}; {stats['sprites']} sprites, {stats['bytes'] / 1e6:.1f} MB "
          f"({stats['written']} files written, {stats['removed']} folders removed)")
    print(f"Bundle -> {args.out}")


if __name__ == "__main__":
    main()
