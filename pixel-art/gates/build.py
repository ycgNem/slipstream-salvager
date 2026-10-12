"""Arena gates: ob:gate:<h|v>:<closed|open|warn> (h: 32 x 16 in the top and bottom walls, v:
16 x 32 in the side walls; anchor (0, 0), drawn over the wall tiles).

A gate is a heavy steel door between two posts of the barrier. The door is olive-painted plate
(the arena's olive, so it reads as a door in the wall without borrowing a meaning color) with
slats, under a roller housing. Open: the door is rolled up into the housing and the passage
behind it is dark. Warn: the same closed door with red hazard chevrons and red lamps lit on
both posts; the renderer blinks warn against closed, so the red flashes on and off. Danger red
(11, 12, 15) appears only on the warn frames. One sprite per orientation serves both walls, so
lighting is the global one: lit from the upper left.

Run: python pixel-art/gates/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from r64 import Grid, save_png, to_sprite, to_image, check_palette, write_recipe  # noqa: E402

OUT = HERE / "out"
ARENA = [0, 1, 2, 3, 4, 5, 24, 25]
DANGER = [10, 11, 12, 15]
OUTL = 0
DOOR, DOOR_DK, DOOR_LIT = 25, 24, 4


def post_cap(g, x0, y0, x1, y1, lamp=None, lamp_at=None):
    """A square post seen from above: outline, lit top/left bevel, shaded bottom/right, a bolt
    (or a lamp: red when lit) in the middle."""
    g.rect(x0, y0, x1, y1, 2)
    g.hline(x0, x1, y0, OUTL)
    g.hline(x0, x1, y1, OUTL)
    g.vline(x0, y0, y1, OUTL)
    g.vline(x1, y0, y1, OUTL)
    g.hline(x0 + 1, x1 - 1, y0 + 1, 4)
    g.vline(x0 + 1, y0 + 1, y1 - 1, 4)
    g.hline(x0 + 2, x1 - 1, y1 - 1, 1)
    g.vline(x1 - 1, y0 + 2, y1 - 1, 1)
    if lamp_at:
        lx, ly = lamp_at
        if lamp:
            g.stamp(lx, ly, ["rc", "cR"], {"r": 15, "c": 12, "R": 11})
        else:
            g.stamp(lx, ly, ["15", "51"], {"1": 1, "5": 5})


def post_front(g, x0, x1, y0, y1):
    """The front face of a post (top-wall context): plate, lit left edge, dark right, outline."""
    g.rect(x0, y0, x1, y1, 5)
    g.vline(x0, y0, y1, OUTL)
    g.vline(x1, y0, y1, OUTL)
    g.vline(x0 + 1, y0, y1, 3)
    g.vline(x1 - 1, y0, y1, 1)
    g.hline(x0, x1, y0, OUTL)
    g.hline(x0, x1, y1, OUTL)


def chevrons(g, x0, y0, x1, y1, vertical):
    """Hazard chevrons over the door area: red bands and dark gaps on the diagonal."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = g.get(x, y)
            if c in (OUTL,):
                continue
            k = ((x - x0) + (y - y0)) % 6 if not vertical else ((x - x0) - (y - y0)) % 6
            if k < 3:
                lit = c in (DOOR_LIT, 3)
                dark = c in (DOOR_DK, 1)
                g.set(x, y, 12 if lit else (11 if dark else 15))
            else:
                g.set(x, y, 1 if c in (DOOR_DK, 1) else 10)


def gate_h(state):
    g = Grid(32, 16, 1)
    # posts: caps over rows 0..8, fronts below (the top wall's front face is rows 9..15)
    for x0 in (0, 27):
        post_cap(g, x0, 0, x0 + 4, 9, lamp=state == "warn", lamp_at=(x0 + 2, 3))
        post_front(g, x0, x0 + 4, 9, 15)
    # the roller housing across the top of the opening
    g.rect(5, 0, 26, 3, 2)
    g.hline(5, 26, 0, OUTL)
    g.hline(5, 26, 1, 3)
    g.hline(5, 26, 3, 1)
    g.hline(5, 26, 4, OUTL)
    for x in range(7, 26, 6):
        g.set(x, 2, 4)  # bolts on the housing
    if state == "open":
        # the door rolled up: the passage under the housing is in deep shadow, the ground at the
        # threshold catches a little light, the door's bottom bar peeks out under the housing
        g.rect(5, 5, 26, 15, OUTL)
        g.hline(5, 26, 5, DOOR_DK)
        g.hline(5, 26, 6, OUTL)
        # the ground running out through the gap: the floor's own plum and dirt clods near the
        # arena, sinking into shadow further in (no dither: it would read as a grate)
        g.rect(5, 12, 26, 15, 1)
        for x, y in ((7, 12), (8, 12), (13, 13), (19, 12), (23, 14), (24, 14), (10, 15), (17, 15), (21, 13)):
            g.set(x, y, 24)
        for x, y in ((6, 11), (11, 11), (12, 11), (18, 11), (25, 11), (15, 10), (22, 10)):
            g.set(x, y, 1)
        g.hline(5, 26, 15, 1)
    else:
        # slatted door: 2 px slats, lit top row, dark groove; bottom bar lit, outline below
        for y in range(5, 15):
            c = DOOR_LIT if y == 5 else (DOOR if (y - 5) % 3 != 2 else DOOR_DK)
            g.hline(5, 26, y, c)
        g.vline(5, 5, 14, 3)
        g.vline(26, 5, 14, DOOR_DK)
        g.hline(5, 26, 13, 3)  # the bottom bar
        g.hline(5, 26, 14, 1)
        g.hline(5, 26, 15, OUTL)
        # a handle in the middle of the bottom bar
        g.set(15, 12, OUTL)
        g.set(16, 12, OUTL)
        if state == "warn":
            chevrons(g, 6, 6, 25, 12, vertical=False)
    return g


def gate_v(state):
    g = Grid(16, 32, 1)
    for y0 in (0, 27):
        post_cap(g, 0, y0, 15, y0 + 4, lamp=state == "warn", lamp_at=(7, y0 + 2))
    # door frame rails along both sides of the opening (rows 5..26)
    g.rect(0, 5, 15, 26, 1)
    g.vline(0, 5, 26, OUTL)
    g.vline(15, 5, 26, OUTL)
    g.vline(1, 5, 26, 3)
    g.vline(2, 5, 26, 5)
    g.vline(14, 5, 26, 1)
    g.vline(13, 5, 26, 5)
    if state == "open":
        # the door slid away into the posts; the passage: dark, with the two floor tracks
        g.rect(3, 5, 12, 26, OUTL)
        for y in range(5, 27):
            for x in range(3, 13):
                if (x + y) % 2 == 0 and x in (4, 5, 10, 11):
                    g.set(x, y, 1)
        g.vline(5, 5, 26, 2)
        g.vline(10, 5, 26, 2)
        g.hline(3, 12, 5, 24)  # the door's end, just visible under the post
    else:
        # the door from above: a thick slab with slats across it, lit left, dark right
        for y in range(5, 27):
            for x in range(3, 13):
                c = DOOR if (y - 5) % 3 != 2 else DOOR_DK
                if x == 3:
                    c = DOOR_LIT if (y - 5) % 3 != 2 else 3
                elif x == 12:
                    c = DOOR_DK if c == DOOR else 1
                g.set(x, y, c)
        g.hline(3, 12, 5, 3)
        g.hline(3, 12, 26, 1)
        g.set(7, 15, OUTL)
        g.set(8, 15, OUTL)
        g.set(7, 16, OUTL)
        g.set(8, 16, OUTL)
        if state == "warn":
            chevrons(g, 4, 6, 11, 25, vertical=True)
    return g


def main():
    OUT.mkdir(exist_ok=True)
    gates = {}
    for o, fn in (("h", gate_h), ("v", gate_v)):
        for st in ("closed", "open", "warn"):
            gates[(o, st)] = fn(st)
    for (o, st), g in gates.items():
        allowed = ARENA + (DANGER if st == "warn" else [])
        check_palette([g], allowed, f"gate {o} {st}")
        save_png(g, OUT / f"gate_{o}_{st}.png")
    write_recipe(HERE / "sprites.json", "gates",
                 [(f"ob:gate:{o}:{st}", f"out/gate_{o}_{st}.png", (32, 16) if o == "h" else (16, 32), (0, 0)) for (o, st) in gates])
    to_sprite([gates[("h", s)] for s in ("closed", "open", "warn")]).preview(str(HERE / "preview_h.png"), scale=8, cols=3)
    to_sprite([gates[("v", s)] for s in ("closed", "open", "warn")]).preview(str(HERE / "preview_v.png"), scale=8, cols=3)
    # in the wall: each gate drawn over a strip of the ring (top wall / left wall), at 4x
    from PIL import Image

    T = HERE.parent / "tiles" / "out"
    wall11 = Image.open(T / "wall_11.png").convert("RGBA")
    wall13 = Image.open(T / "wall_13.png").convert("RGBA")
    floors = [Image.open(T / f"floor_{v}.png").convert("RGBA") for v in range(4)]
    im = Image.new("RGBA", (16 * 12, 16 * 10))
    for ty in range(10):
        for tx in range(12):
            im.alpha_composite(floors[(tx * 3 + ty) % 4], (tx * 16, ty * 16))
    for tx in range(12):
        im.alpha_composite(wall11, (tx * 16, 0))
    for st, x in (("closed", 16), ("open", 72), ("warn", 128)):
        im.alpha_composite(to_image(gates[("h", st)]), (x, 0))
    for ty in range(1, 10):
        im.alpha_composite(wall13, (0, ty * 16))
    im.alpha_composite(to_image(gates[("v", "closed")]), (0, 24))
    im.alpha_composite(to_image(gates[("v", "warn")]), (0, 80))
    im.alpha_composite(to_image(gates[("v", "open")]), (0, 120))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(HERE / "in_wall_4x.png")
    import mock_arena

    mock_arena.build()


if __name__ == "__main__":
    main()
