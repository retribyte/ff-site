"""Read Starbound assets the way the game does: paks and loose mod folders, load order,
case-insensitive paths, JSON with comments, .patch files and .frames lookup.

Standard library only, so it runs on any machine that has Python 3.9+ and Starbound.
"""

from __future__ import annotations

import json
import os
import re
import struct
import sys
from pathlib import Path

VANILLA_ID = "vanilla"


def warn(msg: str) -> None:
    print(f"  ! {msg}", file=sys.stderr)


# --------------------------------------------------------------------------- lenient JSON

def strip_comments(text: str) -> str:
    """Remove // and /* */ comments, leaving anything inside strings alone."""
    out = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == '"':
            j = i + 1
            while j < n and text[j] != '"':
                j += 2 if text[j] == "\\" else 1
            out.append(text[i:j + 1])
            i = j + 1
        elif c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] not in "\r\n":
                i += 1
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


_TRAILING_COMMA = re.compile(r",(\s*[}\]])")


def parse_json(data: bytes | str):
    text = data.decode("utf-8-sig", "replace") if isinstance(data, bytes) else data
    text = strip_comments(text)
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        return json.loads(_TRAILING_COMMA.sub(r"\1", text), strict=False)


# --------------------------------------------------------------------------- JSON patch

class PatchError(Exception):
    pass


def _pointer(path: str) -> list[str]:
    if path == "":
        return []
    if not path.startswith("/"):
        raise PatchError(f"bad pointer {path!r}")
    return [p.replace("~1", "/").replace("~0", "~") for p in path[1:].split("/")]


def _walk(doc, parts):
    for p in parts:
        if isinstance(doc, list):
            try:
                doc = doc[int(p)]
            except (ValueError, IndexError):
                raise PatchError(f"no index {p}")
        elif isinstance(doc, dict):
            if p not in doc:
                raise PatchError(f"no key {p}")
            doc = doc[p]
        else:
            raise PatchError(f"cannot descend into {p}")
    return doc


def _add(doc, parts, value):
    if not parts:
        return value
    parent = _walk(doc, parts[:-1])
    key = parts[-1]
    if isinstance(parent, list):
        if key == "-":
            parent.append(value)
        else:
            idx = int(key)
            if idx > len(parent):
                raise PatchError(f"index {idx} past end")
            parent.insert(idx, value)
    elif isinstance(parent, dict):
        parent[key] = value
    else:
        raise PatchError("add into a scalar")
    return doc


def _remove(doc, parts):
    parent = _walk(doc, parts[:-1])
    key = parts[-1]
    try:
        if isinstance(parent, list):
            return parent.pop(int(key))
        return parent.pop(key)
    except (KeyError, IndexError, ValueError):
        raise PatchError(f"nothing to remove at {key}")


def _apply_ops(doc, ops):
    """Apply one flat list of operations; raises PatchError if any fails (incl. a test)."""
    doc = json.loads(json.dumps(doc))
    for op in ops:
        kind = op.get("op")
        parts = _pointer(op.get("path", ""))
        if kind == "test":
            inverse = op.get("inverse", False)
            try:
                found = _walk(doc, parts)
            except PatchError:
                if inverse:
                    continue
                raise
            if "value" not in op:
                if inverse:
                    raise PatchError("inverse test: path exists")
                continue
            if (found == op["value"]) == inverse:
                raise PatchError("test failed")
        elif kind == "add":
            doc = _add(doc, parts, op["value"])
        elif kind == "replace":
            _walk(doc, parts)
            if parts:
                _remove(doc, parts)
            doc = _add(doc, parts, op["value"])
        elif kind == "remove":
            _remove(doc, parts)
        elif kind == "move":
            doc = _add(doc, parts, _remove(doc, _pointer(op["from"])))
        elif kind == "copy":
            doc = _add(doc, parts, json.loads(json.dumps(_walk(doc, _pointer(op["from"])))))
        else:
            raise PatchError(f"unknown op {kind!r}")
    return doc


def apply_patch(doc, patch):
    """Starbound semantics: a patch is a list of ops, or a list of such lists (batches).
    A batch that fails (usually its `test`) is skipped; a failing flat patch changes nothing."""
    if not isinstance(patch, list):
        raise PatchError("patch is not a list")
    if patch and all(isinstance(b, list) for b in patch):
        for batch in patch:
            try:
                doc = _apply_ops(doc, batch)
            except (PatchError, KeyError, TypeError, ValueError):
                pass
        return doc
    try:
        return _apply_ops(doc, patch)
    except (KeyError, TypeError, ValueError) as e:
        raise PatchError(str(e))


# --------------------------------------------------------------------------- sources

def _vlq(f) -> int:
    v = 0
    while True:
        b = f.read(1)[0]
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v


def _svlq(f) -> int:
    v = _vlq(f)
    return -((v >> 1) + 1) if v & 1 else v >> 1


def _str(f) -> str:
    return f.read(_vlq(f)).decode("utf-8", "replace")


def _dynamic(f):
    t = f.read(1)[0]
    if t == 1:
        return None
    if t == 2:
        return struct.unpack(">d", f.read(8))[0]
    if t == 3:
        return f.read(1)[0] != 0
    if t == 4:
        return _svlq(f)
    if t == 5:
        return _str(f)
    if t == 6:
        return [_dynamic(f) for _ in range(_vlq(f))]
    if t == 7:
        return {_str(f): _dynamic(f) for _ in range(_vlq(f))}
    raise ValueError(f"unknown SBON type {t}")


class Source:
    """One asset source. `files` maps lowercased asset path -> opaque handle for read()."""

    def __init__(self, path: Path):
        self.path = path
        self.meta: dict = {}
        self.files: dict[str, object] = {}
        self.id = ""  # set by AssetStore

    @property
    def name(self) -> str:
        return str(self.meta.get("name") or self.path.stem)

    @property
    def title(self) -> str:
        return str(self.meta.get("friendlyName") or self.meta.get("name") or self.path.name)

    @property
    def priority(self) -> float:
        try:
            return float(self.meta.get("priority", 0))
        except (TypeError, ValueError):
            return 0.0

    def read(self, path: str) -> bytes:
        raise NotImplementedError


class PakSource(Source):
    def __init__(self, path: Path):
        super().__init__(path)
        with open(path, "rb") as f:
            if f.read(8) != b"SBAsset6":
                raise ValueError("not an SBAsset6 pak")
            f.seek(struct.unpack(">Q", f.read(8))[0])
            if f.read(5) != b"INDEX":
                raise ValueError("pak index missing")
            self.meta = {_str(f): _dynamic(f) for _ in range(_vlq(f))}
            for _ in range(_vlq(f)):
                p = _str(f)
                self.files[p.lower()] = struct.unpack(">QQ", f.read(16))

    def read(self, path: str) -> bytes:
        off, length = self.files[path]
        with open(self.path, "rb") as f:
            f.seek(off)
            return f.read(length)


class DirSource(Source):
    SKIP_DIRS = {".git", "node_modules", "__pycache__"}

    def __init__(self, path: Path):
        super().__init__(path)
        for name in ("_metadata", ".metadata"):
            if (path / name).is_file():
                try:
                    self.meta = parse_json((path / name).read_bytes())
                except ValueError as e:
                    warn(f"{path / name}: unreadable metadata ({e})")
                break
        for root, dirs, names in os.walk(path):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            for n in names:
                full = Path(root) / n
                rel = "/" + full.relative_to(path).as_posix()
                self.files[rel.lower()] = full

    def read(self, path: str) -> bytes:
        return Path(self.files[path]).read_bytes()


def open_source(path: Path) -> Source:
    return DirSource(path) if path.is_dir() else PakSource(path)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "mod"


# --------------------------------------------------------------------------- the merged store

class AssetStore:
    """Sources in load order. Later sources override earlier ones, as in the game, but every
    provider of a path is kept so a caller can pick a different one."""

    def __init__(self):
        self.sources: list[Source] = []
        self.providers: dict[str, list[Source]] = {}
        self.patches: dict[str, list[tuple[Source, str]]] = {}
        self._json: dict[str, object] = {}
        self._frames: dict[str, dict | None] = {}

    def load(self, base: Path, mods: list[tuple[Path, str | None]]) -> None:
        """`base` is the vanilla packed.pak; `mods` are (path, forced id or None) in the order
        found. Duplicate mod names: the later one wins (as the game does at equal priority)."""
        vanilla = open_source(base)
        vanilla.id = VANILLA_ID
        by_name: dict[str, Source] = {}
        for path, forced_id in mods:
            try:
                src = open_source(path)
            except (OSError, ValueError, IndexError, struct.error) as e:
                warn(f"{path}: skipped ({e})")
                continue
            src.id = forced_id or slugify(src.name)
            old = by_name.get(src.name)
            if old is not None and old.priority > src.priority:
                continue
            by_name[src.name] = src
        ordered = sorted(by_name.values(), key=lambda s: (s.priority, str(s.path)))
        placed: list[Source] = []
        seen: set[str] = set()

        def place(src: Source, stack: tuple = ()):
            if src.name in seen or src.name in stack:
                return
            for dep in list(src.meta.get("includes") or []) + list(src.meta.get("requires") or []):
                if dep in by_name:
                    place(by_name[dep], stack + (src.name,))
            seen.add(src.name)
            placed.append(src)

        for src in ordered:
            place(src)
        used: dict[str, int] = {}
        for src in placed:  # ids must be unique: they are bundle directory names
            n = used.get(src.id, 0)
            used[src.id] = n + 1
            if n:
                src.id = f"{src.id}-{n + 1}"
        self.sources = [vanilla] + placed
        for src in self.sources:
            for p in src.files:
                self.providers.setdefault(p, []).append(src)
        for src in self.sources:
            for p in src.files:
                if p.endswith(".patch") and p[:-6] in self.providers:
                    self.patches.setdefault(p[:-6], []).append((src, p))

    def exists(self, path: str) -> bool:
        return path.lower() in self.providers

    def winner(self, path: str) -> Source:
        return self.providers[path.lower()][-1]

    def read(self, path: str, source: Source | None = None) -> bytes:
        path = path.lower()
        return (source or self.winner(path)).read(path)

    def json(self, path: str):
        """The winning file with every source's .patch applied in load order. None if missing
        or unparseable (logged)."""
        path = path.lower()
        if path in self._json:
            return self._json[path]
        doc = None
        if path in self.providers:
            try:
                doc = parse_json(self.read(path))
            except ValueError as e:
                warn(f"{path} ({self.winner(path).title}): bad JSON, skipped ({e})")
        if doc is not None:
            for src, patch_path in self.patches.get(path, []):
                try:
                    doc = apply_patch(doc, parse_json(src.read(patch_path)))
                except (ValueError, PatchError) as e:
                    warn(f"{patch_path} ({src.title}): patch not applied ({e})")
        self._json[path] = doc
        return doc

    def glob(self, prefix: str = "/", suffixes: tuple[str, ...] = ()) -> list[str]:
        prefix = prefix.lower()
        return sorted(p for p in self.providers
                      if p.startswith(prefix) and (not suffixes or p.endswith(suffixes)))

    # ----- frames

    def frames_file(self, image_path: str) -> str | None:
        """<image>.frames, else default.frames, walking up to the root (StarAssets.cpp)."""
        image_path = image_path.lower()
        directory, _, filename = image_path.rpartition("/")
        stem = filename.rsplit(".", 1)[0]
        directory += "/"
        while directory:
            for candidate in (directory + stem + ".frames", directory + "default.frames"):
                if candidate in self.providers:
                    return candidate
            if directory == "/":
                break
            directory = directory[:-1].rpartition("/")[0] + "/"
        return None

    def frames(self, frames_path: str) -> dict | None:
        """{name: [x, y, w, h]} in PNG (top-left) coordinates, aliases resolved in."""
        if frames_path in self._frames:
            return self._frames[frames_path]
        result = None
        cfg = self.json(frames_path)
        if isinstance(cfg, dict):
            try:
                result = parse_frames(cfg)
            except (KeyError, TypeError, ValueError, IndexError) as e:
                warn(f"{frames_path}: bad frames file ({e})")
        self._frames[frames_path] = result
        return result


def parse_frames(cfg: dict) -> dict:
    frames: dict[str, list[int]] = {}
    for name, r in (cfg.get("frameList") or {}).items():
        frames[name] = [r[0], r[1], r[2] - r[0], r[3] - r[1]]
    grid = cfg.get("frameGrid")
    if grid:
        bx, by = grid.get("begin", [0, 0])
        w, h = grid["size"]
        cols, rows = grid["dimensions"]
        names = grid.get("names")
        if names:
            for y, row in enumerate(names[:rows]):
                if not row:
                    continue
                for x, name in enumerate(row[:cols]):
                    if name:
                        frames[str(name)] = [bx + x * w, by + y * h, w, h]
        else:
            for y in range(rows):
                for x in range(cols):
                    frames[str(y * cols + x)] = [bx + x * w, by + y * h, w, h]
    aliases = cfg.get("aliases") or {}
    for key, value in aliases.items():
        for _ in range(len(aliases) + 1):
            if value in aliases:
                value = aliases[value]
        if value in frames:
            frames[key] = frames[value]
    return frames


def png_size(data: bytes) -> tuple[int, int] | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])
