"""Shared helpers for the Slipstream Salvager pixel-art build scripts (STYLE.md "The art overhaul").

Every build script draws on a Grid of Resurrect 64 palette INDICES (None = transparent), then
hands the grid to pixel-art-studio's Sprite for export, previews and stats. Indices keep the
color language honest: the arena uses 0-5 and 24-25, danger 10-12/15/59-60, and so on.
"""
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite  # noqa: E402

# src/data/palette.ts, in order (index = palette index)
R64 = [
    "#2e222f", "#3e3546", "#625565", "#966c6c", "#ab947a",
    "#694f62", "#7f708a", "#9babb2", "#c7dcd0", "#ffffff",
    "#6e2727", "#b33831", "#ea4f36", "#f57d4a", "#ae2334", "#e83b3b",
    "#fb6b1d", "#f79617", "#f9c22b",
    "#7a3045", "#9e4539", "#cd683d", "#e6904e", "#fbb954",
    "#4c3e24", "#676633", "#a2a947", "#d5e04b", "#fbff86",
    "#165a4c", "#239063", "#1ebc73", "#91db69", "#cddf6c",
    "#313638", "#374e4a", "#547e64", "#92a984", "#b2ba90",
    "#0b5e65", "#0b8a8f", "#0eaf9b", "#30e1b9", "#8ff8e2",
    "#323353", "#484a77", "#4d65b4", "#4d9be6", "#8fd3ff",
    "#45293f", "#6b3e75", "#905ea9", "#a884f3", "#eaaded",
    "#753c54", "#a24b6f", "#cf657f", "#ed8099",
    "#831c5d", "#c32454", "#f04f78", "#f68181", "#fca790", "#fdcbb0",
]
assert len(R64) == 64

BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]


def keep(x, y, t):
    """Ordered dither: is (x, y) drawn at density t (0..1)?"""
    return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < t


def rng(seed):
    return random.Random(seed)


class Grid:
    """A w x h canvas of palette indices (None = transparent)."""

    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.a = [[fill] * w for _ in range(h)]

    def inb(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x, y, c):
        if self.inb(x, y):
            self.a[y][x] = c

    def get(self, x, y, default=None):
        return self.a[y][x] if self.inb(x, y) else default

    def rect(self, x0, y0, x1, y1, c):
        """Filled rectangle, inclusive corners."""
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.set(x, y, c)

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x, y1, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def stamp(self, x0, y0, rows, key):
        """Stamp a little picture: rows of chars, key maps char -> index (missing chars skip)."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in key:
                    self.set(x0 + i, y0 + j, key[ch])

    def replace(self, old, new):
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x] == old:
                    self.a[y][x] = new

    def copy(self):
        g = Grid(self.w, self.h)
        g.a = [row[:] for row in self.a]
        return g

    def blit(self, other, x0, y0):
        for y in range(other.h):
            for x in range(other.w):
                c = other.a[y][x]
                if c is not None:
                    self.set(x0 + x, y0 + y, c)

    def outline_outside(self, c):
        """1 px outline around the opaque shape, in the transparent pixels (4-neighbour)."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x] is None and any(
                    self.get(x + dx, y + dy) is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                ):
                    add.append((x, y))
        for x, y in add:
            self.a[y][x] = c

    def colors(self):
        s = set()
        for row in self.a:
            for c in row:
                if c is not None:
                    s.add(c)
        return s


def to_sprite(grids):
    """One Sprite with a frame per grid (all the same size): for previews, stats and export."""
    g0 = grids[0]
    s = Sprite(g0.w, g0.h, palette=R64)
    for k, g in enumerate(grids):
        if k:
            s.add_frame(copy=False)
        for y in range(g.h):
            for x in range(g.w):
                if g.a[y][x] is not None:
                    s.px(x, y, g.a[y][x])
    return s


def save_png(grid, path):
    """Export one grid as a 1x PNG (exactly the frame size)."""
    to_sprite([grid]).save_png(str(path))


def to_image(grid, scale=1):
    """A PIL RGBA image of the grid (for composites)."""
    from PIL import Image

    im = Image.new("RGBA", (grid.w, grid.h), (0, 0, 0, 0))
    p = im.load()
    for y in range(grid.h):
        for x in range(grid.w):
            c = grid.a[y][x]
            if c is not None:
                h = R64[c]
                p[x, y] = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
    if scale > 1:
        im = im.resize((grid.w * scale, grid.h * scale), Image.NEAREST)
    return im


def check_palette(grids, allowed, tag):
    """Fail loudly if a grid uses an index outside `allowed` (the color language)."""
    used = set()
    for g in grids:
        used |= g.colors()
    bad = sorted(used - set(allowed))
    if bad:
        raise SystemExit(f"{tag}: uses palette indices {bad}, outside the allowed set {sorted(allowed)}")
    return sorted(used)


# ---- the game's tile hash (src/engine/rng.ts hash2), to lay floor variants out as the game does ----

def _u32(v):
    return int(v) & 0xFFFFFFFF


def _i32(v):
    v = int(v) & 0xFFFFFFFF
    return v - (1 << 32) if v & 0x80000000 else v


def write_recipe(path, name, entries, keep_strays=False):
    """Write a scripts/sprites-import.mjs recipe: entries = [(sprite name, png relative to the
    recipe, (w, h), (ox, oy))]. Every PNG is already exactly its frame (place "none", scale 1).
    keep_strays: keep isolated single pixels (particles are made of them; the import drops them
    by default because generators leave noise)."""
    import json

    sprites = [{"match": m, "file": f, "frame": list(fr), "origin": list(o)} for m, f, fr, o in entries]
    defaults = {"place": "none", **({"keepStrays": True} if keep_strays else {})}
    body = {"name": name, "kind": "sprites", "scale": 1, "defaults": defaults, "sprites": []}
    text = json.dumps(body, indent=1).replace('"sprites": []', '"sprites": [\n' + ",\n".join("  " + json.dumps(s) for s in sprites) + "\n ]")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text + "\n")


def hash2(x, y, seed=0):
    h = float(x) * 374761393 + float(y) * 668265263 + float(seed) * 2147483647
    h = _i32(_i32(h) ^ (_u32(h) >> 13))
    h = float(h) * 1274126177
    h = _i32(_i32(h) ^ (_u32(h) >> 16))
    return (h & 0xFFFFFFFF) / 4294967296
