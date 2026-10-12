"""The M7 terrain, painted on the floor (anchor (0, 0), the footprint is the frame):

  fl:boost:<e|s|w|n>:<0-2>  16x16  a boost strip tile: a dark teal deck in a steel frame, bright
                            teal chevrons pointing its way with a glow trailing behind them; the
                            three frames move them FORWARD 8/3 px a frame (the period is 8 px so
                            the tiles join; 3, 2, 3 px steps). Teal: it's speed.
  fl:oil:<mask>             16x16  oil, a 4-bit neighbour mask like the walls (1 up, 2 right, 4 down,
                            8 left): a calm, flat, deep blue-black pool (44, never the outline's 0
                            as a base: bodies and shadows must read on it) with two faint
                            reflections a tile, lit along its upper-left rim, plum along its
                            lower-right one; its open edges wobble and its open corners round off,
                            so a patch reads as a spill, not a carpet
  fl:ramp:<e|s|w|n>         32x32  a jump ramp: a cool steel wedge with grip ridges, dark at its foot
                            and lit up the slope to a bright lip, a chunky teal arrow; shaded by
                            which way its slope faces (the light is upper left); the camera-side
                            cheek (east, west) or lip front (south) shows
  fl:crusher:<idle|warn|down> 32x32  a crusher plate: a bevelled steel frame round a dark grated pit,
                            dull red corner brackets at rest; warn: bright red brackets, the frame's
                            inner lip and an X (the renderer flashes it with idle); down: the
                            crusher's head on the plate, a bevelled steel block with its ram's hub

Every direction is drawn for its own light, not rotated. Palette: Resurrect 64; teal only on the
boost strips and the ramps' arrows (speed), red only on the crusher (danger).

Run: python pixel-art/terrain/build.py -> terrain.png, sprites.json, previews in e2e/out/pixel-art/.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / '_lib'))
from sculpt import blank, put, to_image, keep, colors_used, isolated  # noqa: E402
from PIL import Image  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'
FD = ['e', 's', 'w', 'n']


def uv(d, x, y, n):
    """(u along the arrow, v across it) for screen pixel (x, y) in an n x n tile pointing d."""
    if d == 0:
        return x, y
    if d == 1:
        return y, n - 1 - x
    if d == 2:
        return n - 1 - x, n - 1 - y
    return n - 1 - y, x


# ---------------------------------------------------------------- boost strip

def boost(d, f):
    img = blank(16, 16)
    off = (0, 3, 5)[f]
    horiz = d in (0, 2)
    for y in range(16):
        for x in range(16):
            u, v = uv(d, x, y, 16)
            # across the strip in screen terms: rails on the two long sides
            a = y if horiz else x
            if a == 0:
                c = 2            # the frame, its lit (upper/left) edge
            elif a == 15:
                c = 0 if horiz else 1   # its far edge in shade
            elif a in (1, 14):
                c = 39           # the deck's sunk edge
            else:
                c = 40 if keep(x, y, 0.18) else 39
                k = (u + abs(v - 7.5) * 0.9 - off) % 8
                if a in (2, 13) and k < 3:
                    c = 41 if k >= 2 else 40   # the arms' ends fade into the deck
                elif k >= 2 and k < 3:
                    c = 43       # the leading edge
                elif k >= 1 and k < 2:
                    c = 42
                elif k < 1:
                    c = 41
                elif k >= 6.5 and keep(x, y, 0.5):
                    c = 40       # a glow trailing behind
            img[y][x] = c
    return img


# ---------------------------------------------------------------- oil

# how far an open edge wobbles in from the tile's side, per pixel along it (periodic: the ends
# match so neighbouring edge tiles join)
WOB = [1, 1, 2, 2, 2, 1, 1, 0, 0, 1, 1, 1, 2, 2, 1, 1]


def oil(mask):
    up, right, down, left = mask & 1, mask & 2, mask & 4, mask & 8
    img = blank(16, 16)
    inside = [[False] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            # distances in from each open side (wobbling), then the open corners rounded off
            if not up and y < WOB[x]:
                continue
            if not down and 15 - y < WOB[(x + 5) % 16]:
                continue
            if not left and x < WOB[(y + 9) % 16]:
                continue
            if not right and 15 - x < WOB[(y + 3) % 16]:
                continue
            cx = (5.5 - x) if (not left and x < 6) else (x - 9.5) if (not right and x > 9) else 0
            cy = (5.5 - y) if (not up and y < 6) else (y - 9.5) if (not down and y > 9) else 0
            if cx > 0 and cy > 0 and cx * cx + cy * cy > 5.2 ** 2:
                continue
            inside[y][x] = True

    def ins(x, y):
        if 0 <= x < 16 and 0 <= y < 16:
            return inside[y][x]
        # off the tile: oil if the neighbour that way is oil (and we're not past an open side)
        if y < 0:
            return bool(up) and 0 <= x < 16
        if y > 15:
            return bool(down) and 0 <= x < 16
        if x < 0:
            return bool(left)
        return bool(right)

    def dist_out(x, y, dx, dy, k=3):
        """1 if the edge is 1 px away in direction (dx, dy), 2 if 2 px, ... up to k, else 0"""
        for i in range(1, k + 1):
            if not ins(x + dx * i, y + dy * i):
                return i
        return 0

    for y in range(16):
        for x in range(16):
            if not inside[y][x]:
                continue
            # a still, deep pool: flat, two faint reflections a tile, staggered so a lake of them
            # doesn't line up in a grid
            c = 45 if OIL_RIPPLE[y][x] == '-' else 44
            # the wet edge: where the oil meets the floor on its upper and left side it catches the
            # light (a bright rim, a softer line inside it); on its lower and right side it darkens
            # into the floor
            up_d, left_d = dist_out(x, y, 0, -1), dist_out(x, y, -1, 0)
            dn_d, rt_d = dist_out(x, y, 0, 1), dist_out(x, y, 1, 0)
            if up_d == 1 or left_d == 1:
                c = 46
            elif up_d == 2:
                c = 45
            if dn_d == 1 or rt_d == 1:
                c = 49 if not (up_d == 1 or left_d == 1) else 45
            img[y][x] = c
    return img


# the pool's faint reflections, the same in every tile: '-' a lighter swell
OIL_RIPPLE = [
    '................',
    '................',
    '................',
    '................',
    '....----........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........---..',
    '................',
    '................',
    '................',
    '................',
]


# ---------------------------------------------------------------- ramp

RAMP_H = 6   # px of the wedge's camera-side face at its lip


def ramp(d):
    n = 32
    img = blank(n, n)
    # the slope's tone by which way it faces, light from the upper left: an east ramp's slope faces
    # west (lit), a west ramp's east (shade), a south ramp's north (lit), a north ramp's south
    # (toward the camera, in shade)
    lit = d in (0, 1)
    R = [2, 6, 7, 8] if lit else [1, 2, 6, 7]
    # how many px of the wedge's camera-side face show at each step up the slope: the south cheek
    # of an east or west ramp grows toward its lip; a south ramp shows the front of its lip
    def face(u):
        return (u * RAMP_H) // (n - 1) if d in (0, 2) else 0
    for y in range(n):
        for x in range(n):
            u, v = uv(d, x, y, n)
            if d in (0, 2) and y >= n - 1 - face(u):
                # the south cheek: a vertical face toward the camera, dark plum-grey, its top edge
                # (the slope's edge) catching a line of light
                top = n - 1 - face(u)
                img[y][x] = 0 if y == n - 1 else 7 if y == top else 5 if y < n - 2 else 1
                continue
            if d == 1 and y >= n - RAMP_H:
                # a south ramp: the front of its lip
                img[y][x] = 0 if y == n - 1 else 7 if y == n - RAMP_H else 5 if y < n - 2 else 1
                continue
            # the slope: three steps up from its foot, dithered between them
            t = u / (n - 1)
            step = 0 if t < 0.28 else 1 if t < 0.62 else 2
            if step < 2 and abs(t - (0.28, 0.62)[step]) < 0.04 and keep(x, y, 0.5):
                step += 1
            c = R[step]
            # grip ridges across it every 4 px: a dark groove with a lit edge on its far side
            g = (u - 2) % 4
            if 2 <= u < n - 3:
                if g == 0:
                    c = R[max(0, step - 1)] if step else 1
                elif g == 1 and step >= 1:
                    c = R[min(3, step + 1)]
            # the lip: a bright edge at the top of the slope, and the drop behind it; the foot: a
            # dark crease where it meets the floor
            if u == n - 3:
                c = 9 if lit else 8
            elif u == n - 2:
                c = R[2]
            elif u == n - 1:
                c = 0
            elif u == 0:
                c = 0
            elif u == 1:
                c = 1
            # its two sides: rails, the one toward the light lit
            if v == 0 or v == n - 1:
                c = 0
            elif v in (1, n - 2):
                sx, sy = xy(d, u, v, n)
                toward_light = (sx < n // 2 and d in (1, 3)) or (sy < n // 2 and d in (0, 2))
                c = R[3] if toward_light else 1
            img[y][x] = c
    arrow(img, d, n)
    return img


ARROW = [  # east-pointing, u across 0..19, v rows 0..10 ('#' fill, '.' none); centred on v 5
    '............#.......',
    '............##......',
    '............###.....',
    '............####....',
    '#############*####..',
    '#############**####.',
    '#############*####..',
    '............####....',
    '............###.....',
    '............##......',
    '............#.......',
]


def arrow(img, d, n):
    """A chunky teal arrow up the slope (speed), outlined in dark teal, lit on its upper-left
    edges."""
    u0, v0 = 5, 10
    cells = {(u0 + i, v0 + j) for j, row in enumerate(ARROW) for i, ch in enumerate(row) if ch != '.'}
    scr = {xy(d, u, v, n) for u, v in cells}
    for (x, y) in scr:
        up_open = (x, y - 1) not in scr
        left_open = (x - 1, y) not in scr
        dn_open = (x, y + 1) not in scr
        rt_open = (x + 1, y) not in scr
        c = 42
        if up_open or left_open:
            c = 43
        elif dn_open or rt_open:
            c = 41
        put(img, x, y, c)
    for (x, y) in scr:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + a, y + b) not in scr:
                put(img, x + a, y + b, 39)


def xy(d, u, v, n):
    """Inverse of uv(): screen (x, y) for (u, v) in an n x n tile pointing d."""
    if d == 0:
        return u, v
    if d == 1:
        return n - 1 - v, u
    if d == 2:
        return n - 1 - u, n - 1 - v
    return v, n - 1 - u


# ---------------------------------------------------------------- crusher plate

def crusher(state):
    n = 32
    img = blank(n, n)
    for y in range(n):
        for x in range(n):
            # the steel frame, 4 px: lit on its top and left faces, shade on the others
            edge = min(x, y, n - 1 - x, n - 1 - y)
            if edge == 0:
                c = 0
            elif edge < 4:
                if y < 4 and y <= x and y <= n - 1 - x:
                    c = 6 if edge < 3 else 2
                elif x < 4 and x <= y:
                    c = 6 if edge < 3 else 2
                else:
                    c = 2 if edge < 3 else 1
                if edge == 3:
                    c = 0 if (x < 4 or y < 4) else 1     # the inner lip, into the pit
            else:
                # the pit: dark, a grate of bars over it, each bar lit on its top edge
                gy = (y - 4) % 4
                c = 34 if gy == 0 else 35 if gy == 1 else 0 if gy == 3 else 34
                if x in (4, n - 5):
                    c = 0
            img[y][x] = c
    # bolts on the frame
    for bx, by in ((2, 2), (n - 3, 2), (2, n - 3), (n - 3, n - 3), (15, 1), (16, 1), (15, n - 2), (16, n - 2)):
        put(img, bx, by, 7 if (bx < 16 and by < 16) else 6)
    # (dull red at rest, so the warning's bright red stands out from it)
    red = 15 if state == 'warn' else 10
    dark = 14 if state == 'warn' else 1
    # danger corner brackets on the frame
    for cx, cy, sx, sy in ((1, 1, 1, 1), (n - 2, 1, -1, 1), (1, n - 2, 1, -1), (n - 2, n - 2, -1, -1)):
        for k in range(7):
            put(img, cx + sx * k, cy, red)
            put(img, cx, cy + sy * k, red)
        for k in range(1, 6):
            put(img, cx + sx * k, cy + sy, dark)
            put(img, cx + sx, cy + sy * k, dark)
    if state == 'warn':
        # the frame's inner lip glows red, and an X over the pit: something's coming down
        for i in range(3, n - 3):
            for (x, y) in ((i, 3), (i, n - 4), (3, i), (n - 4, i)):
                put(img, x, y, 15)
        for i in range(6, n - 6):
            for (x, y) in ((i, i), (n - 1 - i, i)):
                put(img, x, y, 15)
                put(img, x + 1, y, 14)
    if state == 'down':
        # the crusher's head: a heavy steel block over the plate, bevelled, lit upper left
        for y in range(1, n - 1):
            for x in range(1, n - 1):
                edge = min(x - 1, y - 1, n - 2 - x, n - 2 - y)
                if edge == 0:
                    c = 0
                elif edge <= 2:
                    # the bevel: top and left faces lit, bottom and right in shade
                    top_left = (y - 1 <= x - 1 and y - 1 <= n - 2 - x) or (x - 1 <= y - 1 and x - 1 <= n - 2 - y)
                    c = 8 if top_left and edge == 1 else 7 if top_left else 5 if edge == 1 else 2
                else:
                    c = 6
                img[y][x] = c
        # the ram's hub in the middle: a round boss, lit upper left, a dark socket
        for y in range(9, 23):
            for x in range(9, 23):
                r = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
                if r < 6.5:
                    c = 7 if r < 5.5 else 2
                    if r < 5.5 and (x + 0.5 - 16) + (y + 0.5 - 16) > 3:
                        c = 6
                    if r < 3.0:
                        c = 2 if r > 2 else 1
                    img[y][x] = c
        for bx, by in ((5, 5), (n - 6, 5), (5, n - 6), (n - 6, n - 6)):
            put(img, bx, by, 8)
            put(img, bx + 1, by + 1, 2)
    return img


# ---------------------------------------------------------------- build

def entries():
    out = []
    for d, dn in enumerate(FD):
        for f in range(3):
            out.append((f'fl:boost:{dn}:{f}', boost(d, f)))
    for m in range(16):
        out.append((f'fl:oil:{m}', oil(m)))
    for d, dn in enumerate(FD):
        out.append((f'fl:ramp:{dn}', ramp(d)))
    for s in ('idle', 'warn', 'down'):
        out.append((f'fl:crusher:{s}', crusher(s)))
    return out


def floor_tiles():
    return [Image.open(ROOT / f'pixel-art/tiles/out/floor_{i}.png').convert('RGBA') for i in range(4)]


def mock(by, path, scale):
    """A slice of each yard at 1x on the real floor tiles: the oil lake's corner and a boost strip
    (The Slick), the ramps against a low wall (The Jumps), crushers (The Press)."""
    W, H = 320, 176
    im = Image.new('RGBA', (W, H))
    fl = floor_tiles()
    for ty in range(0, H, 16):
        for tx in range(0, W, 16):
            im.paste(fl[(tx * 7 + ty * 13) // 16 % 4], (tx, ty))

    def blit(img, x, y):
        im.alpha_composite(to_image(img), (x, y))
    # oil: a 6 x 4 patch with a notch
    cells = {(cx, cy) for cx in range(6) for cy in range(4)} - {(5, 0), (0, 3)}
    for cx, cy in cells:
        m = ((cx, cy - 1) in cells) | ((cx + 1, cy) in cells) << 1 | ((cx, cy + 1) in cells) << 2 | ((cx - 1, cy) in cells) << 3
        blit(by[f'fl:oil:{m}'], 16 + cx * 16, 16 + cy * 16)
    for i in range(8):
        blit(by['fl:boost:e:0'], 16 + i * 16, 96)
        blit(by['fl:boost:w:1'], 16 + i * 16, 128)
    for i in range(5):
        blit(by['fl:boost:s:2'], 128 + 16, 8 + i * 16)
        blit(by['fl:boost:n:0'], 128 + 40, 8 + i * 16)
    # ramps against a low wall (a stand-in: a dark block)
    wall = Image.open(ROOT / 'pixel-art/tiles/out/wall_5.png').convert('RGBA')
    for i in range(3):
        im.alpha_composite(wall, (240, 16 + i * 16))
    blit(by['fl:ramp:e'], 208, 24)
    blit(by['fl:ramp:w'], 256, 24)
    blit(by['fl:ramp:s'], 208, 72)
    blit(by['fl:ramp:n'], 256, 72)
    for i, s in enumerate(('idle', 'warn', 'down')):
        blit(by[f'fl:crusher:{s}'], 200 + i * 40, 128)
    im.resize((W * scale, H * scale), Image.NEAREST).save(path)


def main():
    ents = entries()
    by = dict(ents)
    # sheet: 16x16 tiles in rows of 16 (12 boost + 16 oil), then the 32x32 ramps and crushers
    small = [(n, i) for n, i in ents if len(i) == 16]
    big = [(n, i) for n, i in ents if len(i) == 32]
    sheet = Image.new('RGBA', (16 * 16, 32 + 32), (0, 0, 0, 0))
    recipe = []
    for k, (n, img) in enumerate(small):
        x, y = (k % 16) * 16, (k // 16) * 16
        sheet.paste(to_image(img), (x, y))
        recipe.append({'match': n, 'file': 'terrain.png', 'rect': [x, y, 16, 16], 'frame': [16, 16], 'origin': [0, 0]})
    for k, (n, img) in enumerate(big):
        x, y = k * 32, 32
        sheet.paste(to_image(img), (x, y))
        recipe.append({'match': n, 'file': 'terrain.png', 'rect': [x, y, 32, 32], 'frame': [32, 32], 'origin': [0, 0]})
    sheet.save(HERE / 'terrain.png')
    with open(HERE / 'sprites.json', 'w', newline='\n') as f:
        json.dump({'name': 'terrain', 'kind': 'sprites', 'scale': 1,
                   'defaults': {'place': 'none', 'keepStrays': True}, 'sprites': recipe}, f, indent=1)
    mock(by, PREV / 'terrain-1x.png', 1)
    mock(by, PREV / 'terrain-4x.png', 4)
    frames = [i for _, i in ents]
    print('terrain: %d sprites, colors %s, isolated px %d' % (len(frames), colors_used(frames), sum(len(isolated(f)) for f in frames)))


if __name__ == '__main__':
    main()
