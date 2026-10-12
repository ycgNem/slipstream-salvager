"""Arena tiles: t:floor:<0-3> and t:wall:<0-15> (16 x 16, anchor (0, 0)).

Floor: the packed, oily ground of the scrapyard ring. Plum 1 with warm olive dirt (24) in
little horizontal clods, pits (0) and a few lit pebbles (2 over a 0 shadow). Every variant is
statistically uniform right up to its edges and has no feature big enough to notice, so any
variant sits next to any other without a seam and nothing repeats visibly every 16 px. The
variants differ a little in how much dirt they hold, which reads as a natural mottle.

Walls: the ring is a row of heavy chamfered barrier blocks (jersey barriers), one per 16 px. A
block's cross-section is foot, slope, crest, slope; each face is shaded by where it faces, with
the light from the upper left: north and west faces lit, east faces in shade, and the south face
(the side the camera sees, only where the south side is open) is the dark front. Corners and
ends are square posts with a cap bolt. Masks: 1 N, 2 E, 4 S, 8 W = neighbour is also wall.

Run: python pixel-art/tiles/build.py  (writes out/*.png at 1x, previews, and the mock arena)
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from r64 import Grid, keep, rng, save_png, to_sprite, to_image, check_palette, write_recipe  # noqa: E402

OUT = HERE / "out"
ARENA = [0, 1, 2, 3, 4, 5, 24, 25]  # STYLE.md: the arena is warm neutrals 1-5 and olive 24-25 (+ the plum outline 0)

# ---------------------------------------------------------------- floor
F, DIRT, PIT, GRIT = 1, 24, 0, 2
DIRT_AMOUNT = [16, 22, 12, 19]  # olive pixels per variant: a gentle mottle between tiles


def floor(v):
    g = Grid(16, 16, F)
    r = rng(1000 + v)
    free = lambda x, y: g.get(x, y) == F  # noqa: E731
    # dirt clods: mostly 2 px horizontal dashes (the ground is a plane seen from above), some singles
    n = 0
    while n < DIRT_AMOUNT[v]:
        x, y = r.randrange(16), r.randrange(16)
        if not free(x, y):
            continue
        g.set(x, y, DIRT)
        n += 1
        if r.random() < 0.55 and x < 15 and free(x + 1, y):
            g.set(x + 1, y, DIRT)
            n += 1
    # pits: lone dark pixels, a few under a dirt clod (its shadow)
    n = 0
    while n < 6:
        x, y = r.randrange(16), r.randrange(16)
        if free(x, y):
            g.set(x, y, PIT)
            n += 1
    # pebbles: a lit grit pixel with its shadow at the lower right
    n = 0
    while n < 3:
        x, y = r.randrange(15), r.randrange(15)
        if free(x, y) and g.get(x + 1, y + 1) in (F, DIRT):
            g.set(x, y, GRIT)
            g.set(x + 1, y + 1, PIT)
            n += 1
    return g


# ---------------------------------------------------------------- walls
OUTL = 0
LIT_EDGE, LIT, CREST, SHADE, FRONT, FRONT_DK, FOOT = 4, 3, 2, 5, 5, 1, 1
# cross-section from the side that faces the arena outward (16 px):
#   outline, foot, inner slope x3, inner crest edge, crest x5, outer crest edge, outer slope x3, outer foot
PROFILE = ["outl", "foot", "in", "in", "in", "in_edge", "crest", "crest", "crest", "crest", "crest", "out_edge", "out", "out", "out", "out_foot"]


def face_color(kind, inner_faces):
    """Color of a profile slot. inner_faces = which way the inner slope faces: 'E', 'W', 'S', 'N'.
    Lit = faces north or west; shade = faces east; front = faces south (toward the camera)."""
    outer_faces = {"E": "W", "W": "E", "S": "N", "N": "S"}[inner_faces]

    def slope(f):
        return {"N": LIT, "W": LIT, "E": SHADE, "S": FRONT}[f]

    def edge(f):
        return {"N": LIT_EDGE, "W": LIT_EDGE, "E": SHADE, "S": SHADE}[f]

    return {
        "outl": OUTL,
        "foot": {"N": LIT, "W": LIT, "E": FOOT, "S": FOOT}[inner_faces],
        "in": slope(inner_faces),
        "in_edge": edge(inner_faces),
        "crest": CREST,
        "out_edge": edge(outer_faces),
        "out": slope(outer_faces),
        "out_foot": {"N": LIT, "W": LIT, "E": SHADE, "S": FRONT}[outer_faces],
    }[kind]


def run_tile(axis, inner, seed):
    """A barrier block running along `axis` ('h' east-west, 'v' north-south) whose inner side
    (facing the arena) is `inner` ('N', 'S', 'E', 'W', or None for an inner-less run)."""
    g = Grid(16, 16, CREST)
    for i, kind in enumerate(PROFILE):
        c = face_color(kind, inner)
        if axis == "v":
            x = 15 - i if inner == "E" else i
            g.vline(x, 0, 15, c)
        else:
            y = 15 - i if inner == "S" else i
            g.hline(0, 15, y, c)
    # the south slope of a top-wall block is the front the camera sees: make it a taller, darker
    # face with vertical ribs, and the shadow line under the crest's lip
    if axis == "h" and inner == "S":
        g.hline(0, 15, 9, SHADE)  # the crest's south chamfer
        g.hline(0, 15, 10, FRONT_DK)  # shadow under the lip
        g.hline(0, 15, 11, FRONT)
        g.hline(0, 15, 12, FRONT)
        g.hline(0, 15, 13, FRONT_DK)  # the rub strip, scuffed by every robot that hit it
        g.hline(0, 15, 14, FRONT_DK)
        for x in (3, 4, 9, 12):
            g.set(x, 13, 2)
        g.hline(0, 15, 15, OUTL)
    # block ends: a lit chamfer where the block starts (north / west end), a shaded one where it
    # ends, and the gap between blocks
    if axis == "v":
        for x in range(16):
            c = g.get(x, 0)
            if c != OUTL:
                g.set(x, 0, LIT_EDGE if c in (LIT, CREST, LIT_EDGE) else LIT)
                g.set(x, 14, FOOT)
                g.set(x, 15, OUTL)
    else:
        for y in range(16):
            c = g.get(0, y)
            if c != OUTL:
                g.set(0, y, LIT_EDGE if c in (LIT, CREST, LIT_EDGE) else (SHADE if c == FRONT_DK else LIT))
                g.set(14, y, FOOT)
                g.set(15, y, OUTL)
    # a rivet line along the crest, every 8 px (divides 16, so the spacing runs on unbroken from
    # block to block): a lit head with its shadow below-right
    k = 8  # profile slot: middle of the crest
    for t in (3, 11):
        if axis == "v":
            x = 15 - k if inner == "E" else k
            g.set(x, t, LIT_EDGE)
            g.set(x + 1, t + 1, FOOT)
        else:
            y = 15 - k if inner == "S" else k
            g.set(t, y, LIT_EDGE)
            g.set(t + 1, y + 1, FOOT)
    wear(g, seed)
    return g


def wear(g, seed):
    """Chips and grime: a few darker pixels on the lit faces and olive grime near the feet."""
    r = rng(seed)
    for _ in range(5):
        x, y = r.randrange(2, 13), r.randrange(2, 13)
        c = g.get(x, y)
        if c in (CREST, LIT):
            g.set(x, y, SHADE)
            if r.random() < 0.5:
                g.set(x + 1, y, SHADE)
    for _ in range(3):
        x, y = r.randrange(1, 14), r.randrange(1, 14)
        if g.get(x, y) in (FRONT, SHADE, FOOT):
            g.set(x, y, 24)


def post_tile(N, E, S, W, seed):
    """Square post: chamfered on all four sides (lit north/west), a cap bolt in the middle; open
    sides get the outline; an open south side shows the post's front face."""
    g = Grid(16, 16, CREST)
    top_end = 15 if S else 8
    g.rect(0, 0, 15, top_end, CREST)
    g.hline(0, 15, 0, LIT_EDGE)
    g.vline(0, 0, top_end, LIT_EDGE)
    g.hline(1, 15, 1, LIT)
    g.vline(1, 1, top_end, LIT)
    g.hline(1, 15, top_end, FOOT)
    g.vline(15, 0, top_end, FOOT)
    g.hline(2, 14, top_end - 1, SHADE)
    g.vline(14, 2, top_end - 1, SHADE)
    cy = (top_end + 1) // 2
    g.stamp(5, cy - 3, [
        ".2222.",
        "244331",
        "243351",
        "233551",
        "235551",
        ".1111.",
    ], {"2": 2, "4": 4, "3": 3, "5": 5, "1": 1})
    if not S:
        g.hline(0, 15, top_end + 1, OUTL)
        for y in range(top_end + 2, 15):
            for x in range(16):
                g.set(x, y, LIT if x == 0 else (FOOT if x >= 14 else FRONT))
        g.hline(0, 15, 15, OUTL)
    if not N:
        g.hline(0, 15, 0, OUTL)
    if not W:
        g.vline(0, 0, 15, OUTL)
    if not E:
        g.vline(15, 0, 15, OUTL)
    wear(g, seed)
    return g


def wall(mask):
    N, E, S, W = bool(mask & 1), bool(mask & 2), bool(mask & 4), bool(mask & 8)
    seed = 40 + mask
    if E and W and not (N and S):
        g = run_tile("h", "S" if not S else "N", seed)
        if not N and not S:
            g.hline(0, 15, 0, OUTL)  # a free-standing run: outline its back too
        return g
    if N and S and not (E and W):
        g = run_tile("v", "E" if not E else "W", seed)
        if not E and not W:
            g.vline(0, 0, 15, OUTL)
        return g
    return post_tile(N, E, S, W, seed)


def main():
    OUT.mkdir(exist_ok=True)
    floors = [floor(v) for v in range(4)]
    walls = [wall(m) for m in range(16)]
    used = check_palette(floors + walls, ARENA, "tiles")
    for v, g in enumerate(floors):
        save_png(g, OUT / f"floor_{v}.png")
    for m, g in enumerate(walls):
        save_png(g, OUT / f"wall_{m}.png")
    write_recipe(HERE / "sprites.json", "tiles",
                 [(f"t:floor:{v}", f"out/floor_{v}.png", (16, 16), (0, 0)) for v in range(4)]
                 + [(f"t:wall:{m}", f"out/wall_{m}.png", (16, 16), (0, 0)) for m in range(16)])
    s = to_sprite(floors + walls)
    s.preview(str(HERE / "preview.png"), scale=6, cols=10, labels=True)
    s.stats()
    print("palette indices used:", used)
    # seam check: floor variants in a scrambled 8x8 block, at 4x
    from PIL import Image

    seam = Image.new("RGBA", (16 * 8, 16 * 8))
    for j in range(8):
        for i in range(8):
            seam.alpha_composite(to_image(floors[(i * 7 + j * 5 + i * j) % 4]), (i * 16, j * 16))
    seam.resize((seam.width * 4, seam.height * 4), Image.NEAREST).save(HERE / "seams.png")
    # every mask in a configuration the M3 yards may use (a 2x2 block reads as four bolted posts,
    # a thick block as barriers laid side by side: the ring is built from barriers and posts): a free-standing horizontal wall (Long
    # Lanes), a vertical one, a 2x2 and a 3x3 block (Jaw Yard), a single post, on floor at 4x
    layout = [
        "..............",
        ".#######......",
        "...........#..",
        ".##..###...#..",
        ".##..###...#..",
        ".....###...#..",
        "..#........#..",
        "..............",
    ]
    is_w = lambda x, y: 0 <= y < len(layout) and 0 <= x < len(layout[0]) and layout[y][x] == "#"  # noqa: E731
    mk = Image.new("RGBA", (16 * len(layout[0]), 16 * len(layout)))
    for y, row in enumerate(layout):
        for x, ch in enumerate(row):
            if ch == "#":
                m = (1 if is_w(x, y - 1) else 0) | (2 if is_w(x + 1, y) else 0) | (4 if is_w(x, y + 1) else 0) | (8 if is_w(x - 1, y) else 0)
                mk.alpha_composite(to_image(walls[m]), (x * 16, y * 16))
            else:
                mk.alpha_composite(to_image(floors[(x * 3 + y * 5 + x * y) % 4]), (x * 16, y * 16))
    mk.resize((mk.width * 4, mk.height * 4), Image.NEAREST).save(HERE / "masks_in_yards_4x.png")
    import mock_arena

    mock_arena.build()


if __name__ == "__main__":
    main()
