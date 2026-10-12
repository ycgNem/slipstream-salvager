"""The Compactor's parts at 2x (bo:part:*) and its booster's flame (bo:plume:*): the same models as
the parts you bolt on, so what you tear off it is visibly the part you get.

  plow     pixel-art/parts/model.py's plow (the imported one), exported as bo:part:plow
  springs  pixel-art/parts/model.py's coil bumper, its turns painted at 2x like pixel-art/parts6's
           (fat beads, a dark gap down the full height, grey steel end caps), bo:part:springs
  booster  the code-drawn booster's model (src/render/art/code/parts.ts), ported as is for the
           previews only: the small booster is still code-drawn, so bo:part:booster stays the
           code one at 2x
  plume    the code-drawn plume (plumeGen in parts.ts) at 2x, ported for the previews only

Units: the part models' own (1 unit = 1 px on a small body); rendered at scale 2, so 1 unit = 2 px,
which is also the boss body's unit.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / '_lib'))
sys.path.insert(0, str(HERE.parent / 'parts'))
from sculpt import (Mat, sculpt, dir_angle, sd_cyl, sd_ellipsoid, sd_frustum, add_outline, blank,  # noqa: E402
                    SQ)
import model as PM  # noqa: E402

K = 2

# ---------------------------------------------------------------- the booster (port of parts.ts)
B_GOLD, B_NOZ, B_THROAT, B_STRAP, B_BOLT = range(5)
NOZZLE_EXIT = -3.7


def booster_scene(h, x, y, z):
    h.add(sd_cyl(x - 1.2, y, z, 3.4, 2.6, 1.2), B_GOLD, x, y, z)
    h.add(sd_ellipsoid(x - 3.5, y, z, 1.5, 3.0, 3.0), B_GOLD, x, y, z)
    h.add(sd_cyl(x - 0.9, y, z, 3.75, 0.6, 0.2), B_STRAP, x, y, z)
    h.add(sd_ellipsoid(x - 0.9, y, z - 3.75, 0.65, 0.65, 0.55), B_BOLT)
    outer = sd_frustum(x, y, z, NOZZLE_EXIT, 3.0, -1.2, 2.0)
    inner = sd_frustum(x, y, z, NOZZLE_EXIT - 1, 2.5, -1.5, 1.3)
    h.add(max(outer, -inner), B_NOZ, x, y, z)
    h.add(sd_cyl(x + 1.45, y, z, 1.5, 0.3), B_THROAT, x, y, z)


def booster_mats():
    return {
        B_GOLD: Mat([17, 18, 18, 28], ink=17),
        B_NOZ: Mat([2, 6, 7, 8], ink=2),
        B_THROAT: Mat([0, 1, 1, 1], ink=0, group=B_NOZ),
        B_STRAP: Mat([2, 6, 7, 8], ink=2),
        B_BOLT: Mat([7, 8, 9, 9], noInk=True),
    }


def booster(d):
    return sculpt(32, 32, 16, 16, dir_angle(d), booster_scene, booster_mats(), zmax=6, zmin=-5, scale=K)


# ---------------------------------------------------------------- the plow (pixel-art/parts/model.py)

def plow(d):
    return sculpt(32, 32, 16, 16, dir_angle(d), PM.plow_scene, PM.plow_mats(), zmax=4, zmin=-5, scale=K)


# ---------------------------------------------------------------- the springs, in the body frame
# a coil bumper either side of the hull, low and outside the treads like the small pair
SPR = dict(cx=0.4, cy=10.6, cz=3.0, length=7.0, radius=2.5)
TURN_PX = 6.0     # screen px per turn along the coil (the small coil's 3, doubled)
GAP = 0.3         # the dark gap's share of a turn (~2 px)
SLANT = 0.8       # px the turns lean across the tube (a helix)


def _turn_k(angle):
    """screen px per model unit along the coil's axis (x), for a facing angle"""
    return math.sqrt(math.cos(angle) ** 2 + (SQ * math.sin(angle)) ** 2) * K


def _phase(u, v, w, k):
    """where a point on the coil is within its turn: 0 at a turn's start .. 1 at the next"""
    # the lean goes with the height round the tube, the same on every side of it
    return ((u * k + SLANT * w / SPR['radius']) / TURN_PX) % 1.0


def springs_scene_for(angle):
    k = _turn_k(angle)

    def sc(h, x, y, z):
        side = 1 if y >= 0 else -1
        u, v, w = x - SPR['cx'], (y - SPR['cy'] * side) * side, z - SPR['cz']
        t = _phase(u, v, w, k)
        # each turn a fat bead, pinched at the gap so the coil's outline ripples
        pinch = 0.45 * max(0.0, math.cos(math.pi * (t - (1 - GAP / 2)) / GAP)) ** 2 if t > 1 - GAP else 0.0
        r = math.hypot(v, w)
        L = SPR['length']
        h.add(max(r - (SPR['radius'] - pinch), abs(u) - L), PM.S_COIL, u, v, w)
        h.add(max(r - (SPR['radius'] - 0.5), abs(abs(u) - (L + 0.3)) - 0.3), PM.S_CAP, u, v, w)
    return sc


def coil_turns2(img, grid, angle):
    """The small coil's turns at 2x (pixel-art/parts6 paints 2 px of coil and a 1 px gap): here 4
    px of coil, lit on the side the light comes from and shaded on the other, then a ~2 px dark
    gap, leaning a little like a helix."""
    k = _turn_k(angle)
    ramp = [17, 18, 18, 28]
    for py_, row in enumerate(grid):
        for px_, p in enumerate(row):
            if not p or p.m != PM.S_COIL or p.ink:
                continue
            t = _phase(p.u, p.v, p.w, k)
            if t > 1 - GAP:
                img[py_][px_] = 17 if p.lvl >= 2 else 24
                continue
            # light from the upper left of the screen: a turn's start (its -x side) is lit when
            # that side faces up-left on screen, else its end is
            lead = t / (1 - GAP)
            start_lit = math.cos(angle) + SQ * math.sin(angle) > 0
            lit = lead < 0.3 if start_lit else lead > 0.7
            dark = lead > 0.75 if start_lit else lead < 0.25
            lvl = p.lvl + (1 if lit else 0) - (1 if dark else 0)
            img[py_][px_] = ramp[max(0, min(3, lvl))]


def springs(d):
    a = dir_angle(d)
    img, grid = sculpt(64, 64, 32, 44, a, springs_scene_for(a), PM.springs_mats(), zmax=7, scale=K, outline=False)
    coil_turns2(img, grid, a)
    add_outline(img, 0)
    return img, grid


# ---------------------------------------------------------------- the plume (port of plumeGen, k = 2)

def plume(d, f, k=K):
    S, Hh = 16 * k, 8 * k
    img = blank(S, S)
    a = dir_angle(d)
    bx, by = -math.cos(a), -math.sin(a) * SQ
    bl = math.hypot(bx, by)
    ux, uy = bx / bl, by / bl
    ex, ey = math.cos(a) * NOZZLE_EXIT * k, math.sin(a) * NOZZLE_EXIT * SQ * k
    room = 99 * k
    if ux:
        room = min(room, (Hh - ex) / ux if ux > 0 else (Hh + ex) / -ux)
    if uy:
        room = min(room, (Hh - ey) / uy if uy > 0 else (Hh + ey) / -uy)
    ln = min(6.5 * k * max(0.8, bl), room - 0.3) * (0.78 if f else 1)
    r0 = (2.6 * (1 - 0.15 * abs(math.sin(a))) + (0.3 if f else 0)) * k
    for yy in range(S):
        for xx in range(S):
            sx, sy = xx + 0.5 - Hh - ex, yy + 0.5 - Hh - ey
            s = sx * ux + sy * uy
            q = -sx * uy + sy * ux
            if s < -0.6 or s > ln:
                continue
            tt = max(0.0, s) / ln
            wob = (math.sin((s / k) * 1.7) if f else math.sin((s / k) * 1.7 + 1.5)) * 0.35 * k
            half = r0 * (1 - tt * tt) * (1 - 0.35 * tt) + wob * tt
            if abs(q) > half:
                continue
            e = abs(q) / max(half, 0.01)
            if tt < 0.28 and e < 0.45:
                c = 9
            elif tt < 0.6 and e < 0.6:
                c = 28
            elif e < 0.85 and tt < 0.85:
                c = 17
            else:
                c = 16
            img[yy][xx] = c
    return img
