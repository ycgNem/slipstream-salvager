"""The part models (Grip Treads, Plow, Jaws), shared by pixel-art/parts/build.py and the body
build scripts' composite previews. Salvage is gold (17/18/23/28) on steel; gold means salvage and
nothing else."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '_lib'))
from sculpt import Mat, sd_box, sd_cyl, sd_ellipsoid, sd_capsule  # noqa: E402

# ---------------------------------------------------------------- Grip Treads
# In the BODY's frame (anchor = body center, z = 0 on the ground): two tread pods either side of a
# ~14 px wide footprint. Each is a steel track loop with cleats, a gold guard rail along its outer
# top edge that wraps down over the front, and a steel sprocket hub on the outer face.

T_TRACK, T_GUARD, T_BOLT, T_HUB = range(4)

POD_Y = 9.3       # pod center, either side
POD_HY = 1.75     # pod half width (track)
POD_X = -0.6      # pod center along the body
POD_HX = 5.9      # pod half length
POD_H = 3.2       # track height


def treads_scene(h, x, y, z):
    ay = abs(y)
    tx = x - POD_X
    # the track loop: a long rounded box, cleats painted on
    h.add(sd_box(tx, ay - POD_Y, z - POD_H / 2, POD_HX, POD_HY, POD_H / 2, 1.6), T_TRACK, tx, y, z)
    # the gold guard: a rail along the outer top edge, wrapping down over the front of the loop
    rail = sd_box(tx + 0.3, ay - (POD_Y + 0.85), z - (POD_H + 0.15), 4.2, 0.95, 0.5, 0.3)
    nose = sd_box(tx - (POD_HX - 1.6), ay - (POD_Y + 0.85), z - (POD_H - 0.3), 0.7, 0.95, 0.7, 0.3)
    h.add(min(rail, nose), T_GUARD, tx, y, z)
    # bolts on the rail
    for bx in (-2.6, 1.8):
        h.add(sd_ellipsoid(tx - bx, ay - (POD_Y + 0.85), z - (POD_H + 0.62), 0.55, 0.55, 0.4), T_BOLT)
    # sprocket hub on the outer face, at the front of the loop
    h.add(sd_cyl(ay - (POD_Y + POD_HY), tx - (POD_HX - 1.9), z - 1.75, 1.05, 0.25, 0.1), T_HUB, tx, y, z)


def treads_mats():
    def track(q):
        # cleats across the track: light/dark stripes along its length
        k = (math.floor(q.u * 0.7 + 0.5) & 1) == 0
        if q.nz > 0.5:
            return 7 if k else 6
        if q.lvl >= 2:
            return 6 if k else 2
        return 2 if k else 1
    return {
        T_TRACK: Mat([1, 2, 6, 7], ink=0, paint=track),
        T_GUARD: Mat([17, 18, 18, 28], ink=17),
        T_BOLT: Mat([7, 8, 9, 9], noInk=True),
        T_HUB: Mat([6, 7, 8, 8], ink=1),
    }


# ---------------------------------------------------------------- Plow
# In the CARRIER's frame at the front mount (origin = the mount point, ~3.75 units above the
# ground; x = the carrier's forward): a dozer blade a little ahead of the mount, leaning back, its
# face gold with two horizontal ribs, a pale steel cutting edge along the bottom, steel side cheeks
# and two braces back to the mount.

P_BLADE, P_EDGE, P_CHEEK, P_BRACE, P_BOLT = range(5)
PLOW_LEAN = 0.32   # radians the blade leans back
PLOW_HY = 5.0      # half width


def plow_scene(h, x, y, z):
    ay = abs(y)
    # the blade's own frame: u out of its face (forward), w up its face
    c, s = math.cos(PLOW_LEAN), math.sin(PLOW_LEAN)
    bx, bz = x - 2.4, z + 0.7
    u = bx * c + bz * s
    w = -bx * s + bz * c
    # a gently curved face: pushed forward at the bottom and top edges (a scoop)
    curve = 0.13 * w * w
    h.add(sd_box(u + curve - 0.2, y, w, 0.55, PLOW_HY, 2.35, 0.3), P_BLADE, u, y, w)
    # cutting edge along the bottom, standing a little proud of the face
    h.add(sd_box(u - 0.25, y, w + 2.35, 0.75, PLOW_HY + 0.1, 0.42, 0.25), P_EDGE, u, y, w)
    # side cheeks
    h.add(sd_box(u + 0.7, ay - PLOW_HY, w + 0.1, 1.1, 0.35, 2.1, 0.25), P_CHEEK, u, y, w)
    # braces from the back of the blade to the mount
    h.add(sd_capsule(x, ay, z, -0.2, 2.2, 0.1, 2.2, 2.2, -0.5, 0.6), P_BRACE)
    # bolts on the face
    for by in (-2.6, 2.6):
        h.add(sd_ellipsoid(u - 0.35 + 0.13 * 0.36, y - by, w - 0.6, 0.45, 0.5, 0.5), P_BOLT)


def plow_mats():
    def blade(q):
        # two horizontal ribs across the face
        if q.lvl < 3 and (abs(q.w - 0.8) < 0.3 or abs(q.w + 0.8) < 0.3) and abs(q.u) > 0.2:
            return 17
        return None
    return {
        P_BLADE: Mat([17, 18, 18, 28], ink=17, paint=blade),
        P_EDGE: Mat([6, 7, 8, 9], ink=2),
        P_CHEEK: Mat([2, 6, 7, 8], ink=2),
        P_BRACE: Mat([2, 6, 7, 7], ink=0),
        P_BOLT: Mat([7, 8, 9, 9], noInk=True),
    }


# ---------------------------------------------------------------- Jaws
# In the CARRIER's frame at the front mount: a steel hinge bar on the mount and a pair of gold
# mandibles hooking forward and in, open at the front, pale steel teeth along their inner edges.

J_MAND, J_TOOTH, J_HINGE, J_PIN = range(4)
# mandible spine (x, |y|) from the hinge to the tip
JAW_PTS = [(0.5, 2.6), (2.3, 3.3), (4.3, 3.1), (5.6, 2.2), (6.1, 1.3)]


def jaws_scene(h, x, y, z, spread=0.0):
    ay = abs(y)
    d = 1e9
    pts = [(px_, py_ + spread * (px_ / 6.6)) for px_, py_ in JAW_PTS]
    for i, ((ax, ay0), (bx, by0)) in enumerate(zip(pts, pts[1:])):
        rad = (1.0, 0.85, 0.65, 0.45)[i]
        d = min(d, sd_capsule(x, ay, z, ax, ay0, 0.0, bx, by0, 0.0, rad))
    h.add(max(d, z - 0.7, -z - 0.9), J_MAND, x, y, z)
    # teeth on the inner edges, pointing inward
    for tx, ty in ((2.4, 2.3), (4.0, 2.1)):
        ty += spread * (tx / 6.6)
        h.add(sd_ellipsoid(x - tx, ay - ty, z - 0.05, 0.45, 0.55, 0.42), J_TOOTH)
    # hinge bar and its pins
    h.add(sd_box(x + 0.4, y, z + 0.05, 0.7, 2.5, 0.65, 0.3), J_HINGE, x, y, z)
    h.add(sd_cyl(z - 0.25, x - 0.6, ay - 2.5, 0.6, 0.9, 0.1), J_PIN)


def jaws_mats():
    return {
        J_MAND: Mat([17, 18, 18, 28], ink=17),
        J_TOOTH: Mat([7, 8, 9, 9], noInk=True),
        J_HINGE: Mat([0, 1, 2, 6], ink=0),
        J_PIN: Mat([7, 8, 9, 9], noInk=True),
    }
