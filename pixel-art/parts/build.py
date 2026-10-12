"""The M3 parts: Grip Treads, the Plow and the Jaws, as mounted overlays, loose pickups and HUD
icons. Salvage reads gold (17/18/28, glint 9) on steel (2/6/7/8), like the Booster, so the thing
you tear off is visibly the thing you bolt on.

  part:treads:<dir>   32x32, anchor (16,20) = the body's anchor; drawn UNDER the body
  part:plow:<dir>     16x16, anchor (8,8)   = the front mount (frontMount in src/data/mounts.ts)
  part:jaws:<dir>     16x16, anchor (8,8)   = the front mount
  pickup:<part>       16x16, anchor (8,12)  = the part lying loose on the floor, with a glint
  icon:part:<part>    16x16, anchor (0,0)   = HUD slot icon, art <= 14x14

Every direction is rendered from the model (pixel-art/parts/model.py), never rotated or mirrored.
Run: python pixel-art/parts/build.py -> parts.png, sprites.json, previews in e2e/out/pixel-art/.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / '_lib'))
sys.path.insert(0, str(HERE))
from sculpt import (DIRS, sculpt, dir_angle, put, get, bbox, isolated, colors_used, to_image,  # noqa: E402
                    grid_sheet, compose, blank)
from PIL import Image  # noqa: E402
import model as M  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'


# ---------------------------------------------------------------- mounted overlays

def treads(d):
    return sculpt(32, 32, 16, 20, dir_angle(d), M.treads_scene, M.treads_mats(), zmax=6)[0]


def plow(d):
    return sculpt(16, 16, 8, 8, dir_angle(d), M.plow_scene, M.plow_mats(), zmax=4, zmin=-5)[0]


def jaws(d):
    return sculpt(16, 16, 8, 8, dir_angle(d), M.jaws_scene, M.jaws_mats(), zmax=2.5, zmin=-2.5)[0]


# ---------------------------------------------------------------- pickups and icons

def glint(img, grid, gold_mats):
    """The salvage glint: a white pixel with two pale-yellow arms, on the brightest gold pixel
    nearest the top left (same rule as the code-drawn booster pickup)."""
    best = None
    for y, row in enumerate(grid):
        for x, p in enumerate(row):
            if p and p.m in gold_mats and not p.ink and p.lvl >= 2:
                if best is None or x + y < best[0] + best[1]:
                    best = (x, y)
    if best:
        gx, gy = best
        put(img, gx, gy, 9)
        if get(img, gx + 1, gy) > 0:
            put(img, gx + 1, gy, 28)
        if get(img, gx, gy + 1) > 0:
            put(img, gx, gy + 1, 28)


def pod_scene(h, x, y, z):
    """One Grip Tread off its body: a track loop on its side, the gold rail along its outer top
    edge, two steel hubs on its outer face and the stub of its axle on the inner face."""
    h.add(M.sd_box(x, y, z - 1.9, 5.0, 1.6, 1.9, 1.7), M.T_TRACK, x, y, z)
    h.add(M.sd_box(x - 0.2, y - 0.85, z - 3.95, 3.7, 0.85, 0.45, 0.25), M.T_GUARD, x, y, z)
    for hx in (-3.0, 0.0, 3.0):
        h.add(M.sd_cyl(y - 1.6, x - hx, z - 1.8, 1.05, 0.3, 0.15), M.T_HUB, x, y, z)
    h.add(M.sd_cyl(y + 2.0, x - 0.0, z - 1.75, 0.6, 0.6, 0.1), M.T_HUB, x, y, z)


def pickup_treads():
    img, grid = sculpt(16, 16, 8, 12, -0.38, lambda h, x, y, z: pod_scene(h, x, y + 0.3, z), M.treads_mats(), zmax=5)
    glint(img, grid, {M.T_GUARD})
    return img


def pickup_plow():
    # standing on its cutting edge, a quarter turn toward the viewer
    sc = lambda h, x, y, z: M.plow_scene(h, x + 2.2, y, z - 3.7)  # noqa: E731
    img, grid = sculpt(16, 16, 8, 12, 1.15, sc, M.plow_mats(), zmax=8)
    glint(img, grid, {M.P_BLADE})
    return img


def pickup_jaws():
    sc = lambda h, x, y, z: M.jaws_scene(h, x + 3.0, y, z - 0.85)  # noqa: E731
    img, grid = sculpt(16, 16, 8, 12, -0.55, sc, M.jaws_mats(), zmax=4)
    glint(img, grid, {M.J_MAND})
    return img


ICON_VIEW = (0.8, 0.6)


def icon_treads():
    # side on, from low down: the loop, its hubs and the gold rail read as a tread
    return sculpt(16, 16, 8, 10, -0.3, pod_scene, M.treads_mats(), zmax=5, scale=1.2, view=(0.5, 0.866))[0]


def icon_plow():
    sc = lambda h, x, y, z: M.plow_scene(h, x + 2.0, y, z - 1.0)  # noqa: E731
    return sculpt(16, 16, 8, 8, math.pi * 0.75, sc, M.plow_mats(), zmax=5, zmin=-5, scale=1.0, view=ICON_VIEW)[0]


def icon_jaws():
    sc = lambda h, x, y, z: M.jaws_scene(h, x + 3.2, y, z, spread=0.6)  # noqa: E731
    return sculpt(16, 16, 8, 8, -math.pi / 4, sc, M.jaws_mats(), zmax=3, zmin=-3, scale=1.15, view=ICON_VIEW)[0]


# ---------------------------------------------------------------- build

def main():
    entries = []  # (name, img, origin)
    for d, dn in enumerate(DIRS):
        entries.append((f'part:treads:{dn}', treads(d), (16, 20)))
    for d, dn in enumerate(DIRS):
        entries.append((f'part:plow:{dn}', plow(d), (8, 8)))
    for d, dn in enumerate(DIRS):
        entries.append((f'part:jaws:{dn}', jaws(d), (8, 8)))
    entries += [
        ('pickup:treads', pickup_treads(), (8, 12)),
        ('pickup:plow', pickup_plow(), (8, 12)),
        ('pickup:jaws', pickup_jaws(), (8, 12)),
        ('icon:part:treads', icon_treads(), (0, 0)),
        ('icon:part:plow', icon_plow(), (0, 0)),
        ('icon:part:jaws', icon_jaws(), (0, 0)),
    ]
    # sheet: the 32x32 treads on the first row, the 16x16 sprites in rows of 8 under it
    sheet = Image.new('RGBA', (32 * 8, 32 + 16 * 4), (0, 0, 0, 0))
    recipe = []
    small = 0
    for n, img, o in entries:
        w, h = len(img[0]), len(img)
        if w == 32:
            x, y = DIRS.index(n.split(':')[2]) * 32, 0
        else:
            x, y = (small % 8) * 16, 32 + (small // 8) * 16
            small += 1
        sheet.paste(to_image(img), (x, y))
        recipe.append({'match': n, 'file': 'parts.png', 'rect': [x, y, w, h], 'frame': [w, h], 'origin': list(o)})
    sheet.save(HERE / 'parts.png')
    json.dump({'name': 'parts', 'kind': 'sprites', 'scale': 1,
               'defaults': {'place': 'none', 'keepStrays': True}, 'sprites': recipe},
              open(HERE / 'sprites.json', 'w'), indent=1)
    # checks: sizes inside the STYLE limits
    for n, img, o in entries:
        b = bbox(img)
        bw, bh = b[2] - b[0] + 1, b[3] - b[1] + 1
        lim = {'pickup': (14, 12), 'icon': (14, 14)}.get(n.split(':')[0])
        if n.startswith('part:') and not n.startswith('part:treads'):
            lim = (14, 14)
        if lim and (bw > lim[0] or bh > lim[1]):
            print(f'  NOTE {n}: art {bw}x{bh} > {lim[0]}x{lim[1]}')
        if any(c >= 0 for c in img[0]) or any(c >= 0 for c in img[-1]) or any(r[0] >= 0 or r[-1] >= 0 for r in img):
            print(f'  NOTE {n}: art touches the frame edge')
    # previews
    by = {n: img for n, img, _ in entries}
    grid_sheet([(n, by[n]) for n in by if n.startswith('part:treads')], 4, PREV / 'parts-treads.png', cols=4)
    grid_sheet([(n[5:], by[n]) for n in by if n.startswith('part:plow') or n.startswith('part:jaws')], 7, PREV / 'parts-front.png', cols=8)
    grid_sheet([(n, by[n]) for n in by if n.startswith('pickup') or n.startswith('icon')], 10, PREV / 'parts-loose.png', cols=3)
    frames = [img for _, img, _ in entries]
    print('parts: %d sprites, colors %s, isolated px %d' % (len(frames), colors_used(frames), sum(len(isolated(f)) for f in frames)))
    return by


if __name__ == '__main__':
    main()
