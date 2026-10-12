"""Small effects: fx:dust / fx:steam / fx:smoke :<0-3> and fx:spark:<0-2> (8 x 8, anchor (4, 4)).

Hand-placed frames (at 8 x 8 a formula makes blobs; a hand makes clouds):
- Puffs, one shape for all three kinds, dust and steam keeping the placeholder's colors so the
  meaning doesn't move (dust taupe/mist/frost, steam mist/frost/white), smoke a step lighter on
  top so it shows on the floor (ink/slate/lilac-grey):
  0 a tight new puff, 1 a lobed cloud lit on its upper left, 2 breaking into two lobes and
  rising, 3 a few wisps. No dither: each frame is clusters, so nothing shimmers as it moves.
- Spark: 0 the impact flash (white core, frost rays, orange tips, flecks flying off), 1 a
  smaller star, 2 an ember. White, frost and orange only: gold means salvage (STYLE.md).

Run: python pixel-art/fx/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from r64 import Grid, save_png, to_sprite, to_image, write_recipe, check_palette  # noqa: E402

OUT = HERE / "out"

# L lit, B base, S shadow; drawn into the 8 x 8 cell, anchor (4, 4) is the puff's start point
PUFF = [
    [
        "........",
        "........",
        "........",
        "...LB...",
        "..LBBS..",
        "...BS...",
        "........",
        "........",
    ],
    [
        "........",
        "..LL....",
        ".LBBLL..",
        ".LBBBBB.",
        ".BBBBBS.",
        "..SBSS..",
        "........",
        "........",
    ],
    [
        ".LL.....",
        "LBBS.LL.",
        "BBS.LBBS",
        ".S..BBS.",
        "..L..S..",
        ".LBS....",
        "..S.....",
        "........",
    ],
    [
        "L.....L.",
        ".B..L.B.",
        "....S...",
        ".L......",
        "......S.",
        "..S.....",
        "........",
        "........",
    ],
]
PUFF_COLORS = {
    "dust": {"S": 4, "B": 7, "L": 8},
    "steam": {"S": 7, "B": 8, "L": 9},
    # the placeholder's smoke (1/2/5) vanished on the plum floor: 5 is no lighter than 2. Ink
    # under, slate body, a lilac-grey top: still dark smoke, but it reads against the ground
    "smoke": {"S": 0, "B": 2, "L": 6},
}

# W white, F frost, O orange, P salmon (the cooler orange), M mist
SPARK = [
    [
        "....O..P",
        ".P..F...",
        "....F.F.",
        "...FWF..",
        "OFFWWWFO",
        "...FWF..",
        "..F.F...",
        "....O...",
    ],
    [
        "........",
        "......P.",
        "....O...",
        "...FWF..",
        "..OWWWO.",
        "...FWF..",
        "....O...",
        ".P......",
    ],
    [
        "........",
        "........",
        "........",
        "....O...",
        "...OPO..",
        "....O...",
        "........",
        "..P.....",
    ],
]
SPARK_KEY = {"W": 9, "F": 8, "O": 16, "P": 13, "M": 7}


def frame(rows, key):
    g = Grid(8, 8)
    g.stamp(0, 0, rows, key)
    return g


def main():
    OUT.mkdir(exist_ok=True)
    entries, sheet = [], []
    for kind, cols in PUFF_COLORS.items():
        for f, rows in enumerate(PUFF):
            g = frame(rows, cols)
            check_palette([g], list(cols.values()), f"fx:{kind}:{f}")
            save_png(g, OUT / f"{kind}_{f}.png")
            entries.append((f"fx:{kind}:{f}", f"out/{kind}_{f}.png", (8, 8), (4, 4)))
            sheet.append(g)
    for f, rows in enumerate(SPARK):
        g = frame(rows, SPARK_KEY)
        check_palette([g], [9, 8, 16, 13, 7], f"fx:spark:{f}")
        save_png(g, OUT / f"spark_{f}.png")
        entries.append((f"fx:spark:{f}", f"out/spark_{f}.png", (8, 8), (4, 4)))
        sheet.append(g)
    write_recipe(HERE / "sprites.json", "particles", entries, keep_strays=True)
    to_sprite(sheet).preview(str(HERE / "preview.png"), scale=8, cols=4, bg="#3e3546")
    # on the floor at 1x and 4x, the way the game shows them
    from PIL import Image

    T = HERE.parent / "tiles" / "out"
    floor = [Image.open(T / f"floor_{v}.png").convert("RGBA") for v in range(4)]
    im = Image.new("RGBA", (64, 48))
    for ty in range(3):
        for tx in range(4):
            im.alpha_composite(floor[(tx + ty * 3) % 4], (tx * 16, ty * 16))
    for i, g in enumerate(sheet):
        im.alpha_composite(to_image(g), ((i % 4) * 16 + 4, (i // 4) * 12 + 2))
    im.resize((64 * 6, 48 * 6), Image.NEAREST).save(HERE / "on_floor_6x.png")


if __name__ == "__main__":
    main()
