"""The M6 parts: the Jump Jets (rear, off the Hopper) and the Springs (sides, off the Bouncer), as
mounted overlays, loose pickups and HUD icons. Same conventions as pixel-art/parts (the M3 parts):
salvage reads gold (17/18/28, glint 9) on steel (2/6/7/8), the models live in
pixel-art/parts/model.py, and every direction is rendered from the model, never rotated or mirrored.

  part:jets:<dir>     16x16, anchor (8,8)   = the rear mount (rearMount in src/data/mounts.ts), like
                      the booster: two upright gold canisters on a steel strap, nozzles down and back
  part:springs:<dir>  32x32, anchor (16,20) = the body's anchor, like the treads; drawn UNDER the body
                      (the renderer redraws the rows below the anchor over it): a gold coil bumper
                      either side between steel end plates
  part:bigsprings:<dir> 40x40, anchor (20,26): the same pair on a Rammer, set wide enough to show past
                      its hull and treads
  pickup:<part>       16x16, anchor (8,12)  = lying loose on the floor, with the salvage glint
  icon:part:<part>    16x16, anchor (0,0)   = HUD slot, hand-drawn side on like the other four icons

A separate sheet (src/art/parts6.png) so the M3 parts sheet stays byte-identical.
Run: python pixel-art/parts6/build.py -> parts6.png, sprites.json, previews in e2e/out/pixel-art/.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / '_lib'))
sys.path.insert(0, str(HERE.parent / 'parts'))
from sculpt import (DIRS, sculpt, dir_angle, put, get, bbox, isolated, colors_used, to_image,  # noqa: E402
                    grid_sheet, blank, add_outline, unroll)
from PIL import Image  # noqa: E402
import model as M  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'


# ---------------------------------------------------------------- mounted overlays

def jets(d):
    return sculpt(16, 16, 8, 8, dir_angle(d), M.jets_scene, M.jets_mats(), zmax=6, zmin=-4)[0]


def springs(d, big=False):
    a = dir_angle(d)
    w, ox, oy = (40, 20, 26) if big else (32, 16, 20)
    img, grid = sculpt(w, w, ox, oy, a, M.bigsprings_scene if big else M.springs_scene, M.springs_mats(), zmax=7, outline=False)
    M.coil_turns(img, grid, a)
    add_outline(img, 0)
    return img


# ---------------------------------------------------------------- pickups and icons

def glint(img, grid, gold_mats):
    """The salvage glint (as pixel-art/parts): white on the brightest gold pixel nearest the top
    left, with two pale-yellow arms."""
    best = None
    for y, row in enumerate(grid):
        for x, p in enumerate(row):
            if p and p.m in gold_mats and not p.ink and p.lvl >= 2 and img[y][x] in (18, 28):
                if best is None or x + y < best[0] + best[1]:
                    best = (x, y)
    if best:
        gx, gy = best
        put(img, gx, gy, 9)
        if get(img, gx + 1, gy) > 0:
            put(img, gx + 1, gy, 28)
        if get(img, gx, gy + 1) > 0:
            put(img, gx, gy + 1, 28)


def pickup_jets():
    # the pair dropped standing on its nozzles, leaning a little, seen from behind (the strap and
    # its bolt toward the viewer), so it's the same thing as on the Hopper's back and in the icon
    def sc(h, x, y, z):
        yy, zz = unroll(y, z - 3.3, 0.2, 0.0, -3.3)
        M.jets_scene(h, x, yy, zz)
    img, grid = sculpt(16, 16, 8, 12, math.pi / 2 + 0.3, sc, M.jets_mats(), zmax=12, zmin=0)
    glint(img, grid, {M.JT_CAN})
    return img


def pickup_springs():
    # one coil bumper on the floor, at a diagonal
    sc = lambda h, x, y, z: M.coil_scene(h, x, y, z, cx=0.0, cy=0.0, cz=M.COIL_R + 0.1, length=4.3)  # noqa: E731
    a = -0.5
    img, grid = sculpt(16, 16, 8, 12, a, sc, M.springs_mats(), zmax=6, outline=False)
    M.coil_turns(img, grid, a)
    add_outline(img, 0)
    glint(img, grid, {M.S_COIL})
    return img


def icon_jets():
    """Hand-drawn, to sit with the other part icons: the pair standing up, side by side, the near
    (right) can a row lower; gold cans with domed tops lit on their left, the steel strap across
    both with its bolt in the gap, a steel nozzle bell under each. Art 13x14 with its outline."""
    img = blank(16, 16)

    def can(x0, y0, h):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + 5):
                col, row = x - x0, y - y0
                if row == 0 and col in (0, 4):
                    continue                               # the dome's rounded shoulders
                if row == 0:
                    c = 28 if col < 3 else 18
                elif col == 0:
                    c = 28 if row < h - 2 else 18
                elif col == 4:
                    c = 17
                elif row == h - 1:
                    c = 17
                else:
                    c = 28 if (col == 1 and row < 3) else 18
                img[y][x] = c

    def bell(x0, y0):
        # a nozzle under the can: narrow at the top, flaring out, darker to the right
        for x, c in zip(range(x0 + 1, x0 + 4), (7, 6, 2)):
            img[y0][x] = c
        for x, c in zip(range(x0, x0 + 5), (8, 7, 6, 6, 2)):
            img[y0 + 1][x] = c
        for x, c in zip(range(x0, x0 + 5), (6, 1, 1, 1, 2)):
            img[y0 + 2][x] = c                             # the dark mouth of the bell
    can(2, 2, 8)
    can(8, 3, 8)
    bell(2, 10)
    bell(8, 11)
    # the strap across both cans
    for x in range(2, 13):
        img[7][x] = 8 if x < 7 else 7
        img[8][x] = 6 if x < 12 else 2
    img[7][7] = 9                                          # the bolt, in the gap
    img[8][7] = 7
    add_outline(img, 0)
    return img


def icon_springs():
    """Hand-drawn: a coil bumper side on, between two steel end plates: gold turns lit on top, a
    dark gap between each two, the turns slanting like a helix; the steel rod through
    them shows in the gaps. Art 14x12 with its outline."""
    img = blank(16, 16)
    y0, y1 = 4, 11                                         # coil rows (inclusive)
    for y in range(y0, y1 + 1):
        for x in range(4, 12):
            i = x - 4
            gap = (i - (y - y0) // 3) % 3 == 2                # the turns slant down to the left
            if y in (y0, y1) and gap:
                continue                                   # round each turn off top and bottom
            if gap:
                c = 1 if y in (y0 + 1, y1 - 1) else 2
            elif y == y0:
                c = 28
            elif y == y0 + 1:
                c = 28 if i < 4 else 18
            elif y >= y1 - 1:
                c = 17
            else:
                c = 18
            img[y][x] = c
    # steel end plates, a row taller than the coil each way
    for y in range(y0 - 1, y1 + 2):
        img[y][2] = 8 if y < 7 else 7 if y < 10 else 6
        img[y][3] = 7 if y < 7 else 6 if y < 10 else 2
        img[y][12] = 7 if y < 7 else 6 if y < 10 else 2
        img[y][13] = 6 if y < 7 else 2
    img[y0 - 1][2] = img[y1 + 1][2] = 7
    add_outline(img, 0)
    return img


# ---------------------------------------------------------------- build

def main():
    entries = []  # (name, img, origin)
    for d, dn in enumerate(DIRS):
        entries.append((f'part:springs:{dn}', springs(d), (16, 20)))
    for d, dn in enumerate(DIRS):
        entries.append((f'part:bigsprings:{dn}', springs(d, True), (20, 26)))
    for d, dn in enumerate(DIRS):
        entries.append((f'part:jets:{dn}', jets(d), (8, 8)))
    entries += [
        ('pickup:jets', pickup_jets(), (8, 12)),
        ('pickup:springs', pickup_springs(), (8, 12)),
        ('icon:part:jets', icon_jets(), (0, 0)),
        ('icon:part:springs', icon_springs(), (0, 0)),
    ]
    # sheet: the 40x40 big springs on the first row, the 32x32 springs on the second, the 16x16
    # sprites in rows of 8 under them
    sheet = Image.new('RGBA', (40 * 8, 40 + 32 + 16 * 2), (0, 0, 0, 0))
    recipe = []
    small = 0
    for n, img, o in entries:
        w, h = len(img[0]), len(img)
        if w == 40:
            x, y = DIRS.index(n.split(':')[2]) * 40, 0
        elif w == 32:
            x, y = DIRS.index(n.split(':')[2]) * 32, 40
        else:
            x, y = (small % 8) * 16, 72 + (small // 8) * 16
            small += 1
        sheet.paste(to_image(img), (x, y))
        recipe.append({'match': n, 'file': 'parts6.png', 'rect': [x, y, w, h], 'frame': [w, h], 'origin': list(o)})
    sheet.save(HERE / 'parts6.png')
    with open(HERE / 'sprites.json', 'w', newline='\n') as f:
        json.dump({'name': 'parts6', 'kind': 'sprites', 'scale': 1,
                   'defaults': {'place': 'none', 'keepStrays': True}, 'sprites': recipe}, f, indent=1)
    # checks: sizes inside the STYLE limits
    for n, img, o in entries:
        b = bbox(img)
        if not b:
            print(f'  NOTE {n}: empty')
            continue
        bw, bh = b[2] - b[0] + 1, b[3] - b[1] + 1
        lim = {'pickup': (14, 12), 'icon': (14, 14)}.get(n.split(':')[0])
        if n.startswith('part:jets'):
            lim = (14, 14)
        if lim and (bw > lim[0] or bh > lim[1]):
            print(f'  NOTE {n}: art {bw}x{bh} > {lim[0]}x{lim[1]}')
        if any(c >= 0 for c in img[0]) or any(c >= 0 for c in img[-1]) or any(r[0] >= 0 or r[-1] >= 0 for r in img):
            print(f'  NOTE {n}: art touches the frame edge')
    # previews
    by = {n: img for n, img, _ in entries}
    grid_sheet([(n[5:], by[n]) for n in by if n.startswith('part:springs')], 5, PREV / 'parts6-springs.png', cols=4)
    grid_sheet([(n[5:], by[n]) for n in by if n.startswith('part:bigsprings')], 4, PREV / 'parts6-bigsprings.png', cols=4)
    grid_sheet([(n[5:], by[n]) for n in by if n.startswith('part:jets')], 8, PREV / 'parts6-jets.png', cols=8)
    old_pk = {e['match']: e for e in json.loads((HERE.parent / 'parts' / 'sprites.json').read_text())['sprites'] if e['match'].startswith('pickup:')}
    oldim = Image.open(HERE.parent / 'parts' / 'parts.png').convert('RGBA')
    from sculpt import RGB
    inv = {RGB[i]: i for i in range(64)}

    def idx(im):
        return [[inv[im.getpixel((x, y))[:3]] if im.getpixel((x, y))[3] else -1 for x in range(im.width)] for y in range(im.height)]
    olds = [(n, idx(oldim.crop((e['rect'][0], e['rect'][1], e['rect'][0] + 16, e['rect'][1] + 16)))) for n, e in old_pk.items()]
    grid_sheet([(n, by[n]) for n in by if n.startswith('pickup') or n.startswith('icon')] + olds, 10, PREV / 'parts6-loose.png', cols=4)
    # the HUD set: the four M3/M4 icons (from pixel-art/parts) and the two new ones, at 1x and 6x
    old = Image.open(HERE.parent / 'parts' / 'parts.png').convert('RGBA')
    rec = json.loads((HERE.parent / 'parts' / 'sprites.json').read_text())
    icons = [old.crop((e['rect'][0], e['rect'][1], e['rect'][0] + 16, e['rect'][1] + 16)) for e in rec['sprites'] if e['match'].startswith('icon:')]
    icons += [to_image(by['icon:part:jets']), to_image(by['icon:part:springs'])]
    hud = Image.new('RGBA', (len(icons) * 18 + 2, 20), (46, 34, 47, 255))
    for i, im in enumerate(icons):
        hud.alpha_composite(im, (2 + i * 18, 2))
    hud.resize((hud.width * 6, hud.height * 6), Image.NEAREST).save(PREV / 'parts6-icons.png')
    frames = [img for _, img, _ in entries]
    print('parts6: %d sprites, colors %s, isolated px %d' % (len(frames), colors_used(frames), sum(len(isolated(f)) for f in frames)))
    return by


if __name__ == '__main__':
    main()
