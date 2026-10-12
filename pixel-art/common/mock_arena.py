"""Mock of the Ring (src/data/arena.ts + src/render/renderer.ts background()) from the 1x PNGs the
build scripts export, so tiles, gates and obstacles can be judged together before the in-game
screenshot sweep. Writes pixel-art/_mock/arena_1x.png, arena_2x.png and a 4x crop of the top-left.

The layout matches the game: 40 x 23 tiles (the last row half off screen), floor variants by
hash2(cx, cy, 7), wall masks from the ring, the four gates at their rects, four pillars, plus a
post and a tower (M3) on the floor so they can be judged in context.
"""
import math
from pathlib import Path

from PIL import Image

from r64 import ROOT, hash2

PA = ROOT / "pixel-art"
OUT = PA / "_mock"


def _load(path):
    p = PA / path
    return Image.open(p).convert("RGBA") if p.exists() else None


def build(extra=None):
    OUT.mkdir(parents=True, exist_ok=True)
    W, H, T = 640, 360, 16
    im = Image.new("RGBA", (W, H), (255, 0, 255, 255))
    cols, rows = math.ceil(W / T), math.ceil(H / T)

    def is_wall(cx, cy):
        return cx < 0 or cy < 0 or cx >= cols or cy >= rows or cx in (0, cols - 1) or cy in (0, rows - 1)

    for cy in range(rows):
        for cx in range(cols):
            if is_wall(cx, cy):
                m = (1 if is_wall(cx, cy - 1) else 0) | (2 if is_wall(cx + 1, cy) else 0) | (4 if is_wall(cx, cy + 1) else 0) | (8 if is_wall(cx - 1, cy) else 0)
                t = _load(f"tiles/out/wall_{m}.png")
            else:
                t = _load(f"tiles/out/floor_{math.floor(hash2(cx, cy, 7) * 4)}.png")
            if t:
                im.alpha_composite(t, (cx * T, cy * T))

    def put(path, x, y, ox=0, oy=0):
        s = _load(path)
        if s:
            im.alpha_composite(s, (x - ox, y - oy))

    put("gates/out/gate_h_closed.png", 304, 0)
    put("gates/out/gate_h_warn.png", 304, H - T)
    put("gates/out/gate_v_open.png", 0, 164)
    put("gates/out/gate_v_closed.png", W - T, 164)
    for cx, cy in ((192, 120), (448, 120), (192, 240), (448, 240)):
        put("obstacles/out/pillar.png", cx - 16, cy - 16, 0, 8)
    put("obstacles/out/post.png", 312, 112, 0, 8)
    put("obstacles/out/post.png", 312, 232, 0, 8)
    put("obstacles/out/tower.png", 520, 156, 0, 8)
    put("obstacles/out/tower.png", 72, 156, 0, 8)
    if extra:
        extra(im)
    im.save(OUT / "arena_1x.png")
    im.resize((W * 2, H * 2), Image.NEAREST).save(OUT / "arena_2x.png")
    im.crop((0, 0, 240, 135)).resize((960, 540), Image.NEAREST).save(OUT / "arena_tl_4x.png")
    im.crop((400, 225, 640, 360)).resize((960, 540), Image.NEAREST).save(OUT / "arena_br_4x.png")
    print("mock ->", OUT / "arena_2x.png")


if __name__ == "__main__":
    build()
