"""Arena obstacles: ob:post (16 x 24), ob:pillar (32 x 40), ob:tower (48 x 56), all anchored at
(0, 8): the footprint is the bottom w x w of the frame and the obstacle rises 8 px above it.

All three are scrap skips, one object at three sizes: a heavy steel bin painted the arena's
olive, heaped full of junk. In the game's high 3/4 view you see the open top (a thick rim, lit
on its outer back and left edges, its inner edge in the bin's shadow on the back and left and
catching the light on the front and right; inside, a bed of scrap rubble with a few things you
can name lying on it: a car-door panel, tyres, a wheel rim, a pipe) and a 12 px front face: the
skip's side, narrowing to its foot like a real skip, two panels, a reinforcing band, side lugs.
The solid rim makes the silhouette as solid as the collision square; the junk says scrapyard.
Light from the upper left, the plum outline all round, warm neutrals and olive only.

Tried and rejected on the way (all in the arena's warm neutrals and olive): crushed car bales
(many-colored crush bands read as layered rock or bacon, one paint read as a wooden crate, a car
side as a chest of drawers), tyre stacks (bagels, then a cooktop when banded, then cans in 3/4),
a giant dirt-filled tyre (a planter).

Run: python pixel-art/obstacles/build.py
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from r64 import Grid, rng, save_png, to_sprite, to_image, check_palette, write_recipe  # noqa: E402

OUT = HERE / "out"
ARENA = [0, 1, 2, 3, 4, 5, 24, 25]
OUTL = 0
FRONT_H = 12  # the same on every size, so they all stand the same height
BODY, SH, LIT, DK = 25, 24, 4, 1  # olive paint: body, shade, highlight, deep shade


# ---- the junk ------------------------------------------------------------------------------

def ell(g, cx, cy, rx, ry, fn):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = math.hypot(dx, dy)
            if d <= 1:
                c = fn(d, -(dx + dy) / max(d, 1e-6))
                if c is not None:
                    g.set(x, y, c)


def tyre(g, cx, cy, rx=4.6, ry=3.8):
    """A tyre lying in the heap: the rolled tread edge (lit shoulder on the upper left, ink on
    the lower right), the sidewall a step lighter, the hole dark with its far wall catching light."""
    def c(d, l):
        if d > 0.78:
            return 3 if l > 0.35 else (OUTL if l < -0.45 else 1)
        if d > 0.46:
            return 3 if l > 0.7 else 2
        return 2 if l < -0.5 and d > 0.3 else OUTL

    ell(g, cx, cy, rx, ry, c)


def rim(g, cx, cy, rx=3.6, ry=3.0):
    """A wheel rim: light metal ring, darker dish, the hub hole."""
    ell(g, cx, cy, rx, ry, lambda d, l: (1 if d < 0.3 else (3 if d < 0.6 else (4 if l > 0 else 5))))


def pipe(g, x0, y0, n, slope=3):
    """A pipe lying across the heap, rising to the right, its open end dark."""
    for i in range(n):
        x, y = x0 + i, y0 - i // slope
        g.set(x, y - 1, 3)
        g.set(x, y, 2)
        g.set(x, y + 1, 1)
    x, y = x0 + n, y0 - n // slope
    g.set(x, y - 1, 1)
    g.set(x, y, OUTL)
    g.set(x, y + 1, 1)


def panel(g, x0, y0, w, h):
    """A rose car-door panel lying flat, lit top/left, its window a dark slot with a glint."""
    for j in range(h):
        for i in range(w):
            c = 3
            if j == 0 or i == 0:
                c = 4
            elif j == h - 1 or i == w - 1:
                c = 5
            g.set(x0 + i, y0 + j, c)
    for i in range(2, w - 2):
        g.set(x0 + i, y0 + 1, 1)
    g.set(x0 + 3, y0 + 1, 2)


JUNK = {"tyre": tyre, "rim": rim, "pipe": pipe, "panel": panel}


def rubble(g, x0, y0, x1, y1, seed):
    """The bed of scrap: small chunks of grey, mauve and rose metal, each lit on its top-left and
    shaded on its bottom-right, packed over a dark base."""
    r = rng(seed)
    g.rect(x0, y0, x1, y1, 1)
    # no taupe (4) highlights in the bed: it stays quieter than the named junk and the robots
    mats = ((1, 5, 3), (1, 2, 3), (5, 3, 3), (1, 5, 2))
    for _ in range((x1 - x0) * (y1 - y0) // 6):
        cx, cy = r.randint(x0, x1 - 1), r.randint(y0, y1 - 1)
        cw, ch = r.choice((2, 3, 3, 4)), r.choice((2, 2, 3))
        m = r.choice(mats)
        for j in range(ch):
            for i in range(cw):
                x, y = cx + i, cy + j
                if x0 <= x <= x1 and y0 <= y <= y1:
                    c = m[1]
                    if j == 0 and i < cw - 1:
                        c = m[2]
                    elif i == cw - 1 or j == ch - 1:
                        c = m[0] if (i + j) % 3 else OUTL
                    g.set(x, y, c)


# ---- the skip ------------------------------------------------------------------------------

def skip(w, h, items, seed):
    top_h = h - FRONT_H
    g = Grid(w, h, BODY)
    # inside: the far wall's inner face in shadow under the back rim, then the heap
    rubble(g, 3, 5, w - 4, top_h - 3, seed)
    g.hline(3, w - 4, 3, OUTL)
    g.hline(3, w - 4, 4, SH)
    for kind, *a in items:
        JUNK[kind](g, *a)
    # the rim, 3 px all round the top
    for y in range(top_h):
        for x in range(w):
            if 3 <= x <= w - 4 and 3 <= y <= top_h - 3:
                continue
            c = BODY
            if y == 1 or x == 1:
                c = LIT  # outer edge, back and left: lit
            if x == w - 2:
                c = SH  # outer edge, right: shade
            if (y == 2 and 2 <= x <= w - 3) or (x == 2 and 2 <= y <= top_h - 3):
                c = SH  # inner edge, back and left: in the bin's own shadow
            if (y == top_h - 2 and 2 <= x <= w - 3) or (x == w - 3 and 2 <= y <= top_h - 2):
                c = LIT  # inner edge, front and right: facing the light
            g.set(x, y, c)
    g.hline(1, w - 2, top_h - 1, BODY)
    # front face: narrowing to the foot (3 px each side over its height), two panels with a seam,
    # a reinforcing band across the middle, the foot in shadow
    g.hline(0, w - 1, top_h, OUTL)
    fh = h - 1 - top_h
    for k in range(1, fh):
        y = top_h + k
        inset = (k * 3) // fh
        span = w - 2 * inset
        for x in range(w):
            if x < inset or x > w - 1 - inset:
                g.set(x, y, None)
                continue
            rel = x - inset
            c = BODY
            if rel == 1:
                c = LIT
            elif rel >= span - 2:
                c = DK
            elif span > 20 and x == w // 2:
                c = DK
            elif span > 20 and x == w // 2 + 1:
                c = LIT
            if k == 1 and rel > 0:
                c = LIT
            if k == fh // 2 - 1 and rel > 0:
                c = LIT
            if k == fh // 2 and rel > 0:
                c = SH
            if k >= fh - 1:
                c = DK
            g.set(x, y, c)
    by = top_h + FRONT_H // 2 - 1
    g.set(2, by, LIT)  # lifting lugs
    g.set(w - 3, by, LIT)
    # outline round everything, sloped sides included
    edge = []
    for y in range(h):
        for x in range(w):
            if g.get(x, y) is None:
                continue
            if x in (0, w - 1) or y in (0, h - 1) or any(g.get(x + dx, y + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for x, y in edge:
        g.set(x, y, OUTL)
    g.set(0, 0, None)
    g.set(w - 1, 0, None)
    return g


def post():
    return skip(16, 24, [("tyre", 8, 7.5, 4.2, 3.2)], seed=1)


def pillar():
    return skip(32, 40, [("panel", 4, 7, 11, 5), ("tyre", 22, 11, 5.2, 4.2), ("pipe", 5, 21, 13), ("rim", 23.5, 21.5)], seed=2)


def tower():
    return skip(48, 56, [
        ("panel", 5, 7, 13, 6), ("tyre", 33, 11, 5.5, 4.5), ("rim", 12, 22.5), ("pipe", 21, 26, 16),
        ("tyre", 34, 33, 5.2, 4.2), ("panel", 6, 31, 10, 5), ("rim", 24, 37),
    ], seed=3)


def main():
    OUT.mkdir(exist_ok=True)
    sprites = {"post": post(), "pillar": pillar(), "tower": tower()}
    used = check_palette(list(sprites.values()), ARENA, "obstacles")
    for name, g in sprites.items():
        save_png(g, OUT / f"{name}.png")
        s = to_sprite([g])
        s.preview(str(HERE / f"preview_{name}.png"), scale=8, labels=False)
        s.save_silhouette(str(HERE / f"silhouette_{name}.png"), scale=4)
    print("palette indices used:", used)
    write_recipe(HERE / "sprites.json", "obstacles", [
        ("ob:pillar", "out/pillar.png", (32, 40), (0, 8)),
        ("ob:post", "out/post.png", (16, 24), (0, 8)),
        ("ob:tower", "out/tower.png", (48, 56), (0, 8)),
    ])
    # all three on a strip of floor, the way the game draws them, at 4x and 2x
    from PIL import Image

    floor = [Image.open(HERE.parent / "tiles" / "out" / f"floor_{v}.png").convert("RGBA") for v in range(4)]
    strip = Image.new("RGBA", (144, 80))
    for ty in range(5):
        for tx in range(9):
            strip.alpha_composite(floor[(tx * 3 + ty * 5 + tx * ty) % 4], (tx * 16, ty * 16))
    strip.alpha_composite(to_image(sprites["post"]), (8, 40))
    strip.alpha_composite(to_image(sprites["pillar"]), (32, 24))
    strip.alpha_composite(to_image(sprites["tower"]), (80, 16))
    strip.resize((144 * 4, 80 * 4), Image.NEAREST).save(HERE / "in_context_4x.png")
    strip.resize((144 * 2, 80 * 2), Image.NEAREST).save(HERE / "in_context_2x.png")
    import mock_arena

    mock_arena.build()


if __name__ == "__main__":
    main()
