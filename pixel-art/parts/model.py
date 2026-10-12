"""The part models (Grip Treads, Plow, Jaws), shared by pixel-art/parts/build.py and the body
build scripts' composite previews. Salvage is gold (17/18/23/28) on steel; gold means salvage and
nothing else."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '_lib'))
from sculpt import Mat, sd_box, sd_cyl, sd_ellipsoid, sd_capsule, sd_frustum  # noqa: E402

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
    # the gold guard, an L in section: a rail along the outer top edge and a skirt down the outer
    # face, so the near guard shows below a body and the far one is a thin line beyond it
    rail = sd_box(tx + 0.3, ay - (POD_Y + 1.2), z - (POD_H + 0.1), 4.2, 0.6, 0.45, 0.25)
    skirt = sd_box(tx + 0.5, ay - (POD_Y + POD_HY + 0.15), z - (POD_H - 0.6), 3.6, 0.35, 0.75, 0.25)
    h.add(min(rail, skirt), T_GUARD, tx, y, z)
    # bolts on the skirt
    for bx in (-2.0, 1.6):
        h.add(sd_ellipsoid(tx - bx, ay - (POD_Y + POD_HY + 0.5), z - (POD_H - 0.6), 0.45, 0.4, 0.45), T_BOLT)
    # sprocket hub on the outer face, at the front of the loop, ahead of the skirt
    h.add(sd_cyl(ay - (POD_Y + POD_HY), tx - (POD_HX - 1.0), z - 1.6, 1.0, 0.3, 0.1), T_HUB, tx, y, z)


# (part:bigtreads) the same pods set further out, past the Hauler's own wide treads (their outer edge
# is ~10.5 px out), so a bolted pair shows in every direction
BIG_TREAD_SHIFT = 3.4


def bigtreads_scene(h, x, y, z):
    ay = abs(y) - BIG_TREAD_SHIFT
    treads_scene(h, x, math.copysign(abs(ay), y), z)


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


# ---------------------------------------------------------------- M6 helpers

def sd_seg_frustum(x, y, z, a, b, ra, rb):
    """A capped cone from point a (radius ra) to point b (radius rb), any orientation."""
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    L = math.sqrt(ux * ux + uy * uy + uz * uz)
    ux, uy, uz = ux / L, uy / L, uz / L
    px_, py_, pz = x - a[0], y - a[1], z - a[2]
    s = px_ * ux + py_ * uy + pz * uz
    qx, qy, qz = px_ - s * ux, py_ - s * uy, pz - s * uz
    return sd_frustum(s, math.sqrt(qx * qx + qy * qy + qz * qz), 0.0, 0.0, ra, L, rb)


def sd_round_rect(x, y, hx, hy, r):
    """2D rounded rectangle (r <= min(hx, hy))."""
    qx, qy = abs(x) - hx + r, abs(y) - hy + r
    return math.sqrt(max(qx, 0.0) ** 2 + max(qy, 0.0) ** 2) + min(max(qx, qy), 0.0) - r


# ---------------------------------------------------------------- Jump Jets (M6)
# In the CARRIER's frame at the rear mount (origin = the mount point, ~3.75 units above the ground;
# x = the carrier's forward, so its back is -x): two upright gold canisters side by side on a steel
# strap, with a steel plate at the front that bolts onto the carrier, and a steel nozzle under each
# can pointing down and back (the plume fires out behind them).

JT_CAN, JT_STRAP, JT_NOZ, JT_THROAT, JT_BOLT, JT_PLATE = range(6)
JET_Y = 2.25      # can centers, either side
JET_X = -1.1      # can centers along the carrier
JET_R = 1.55      # can radius
JET_Z0, JET_Z1 = -0.6, 5.55  # can body bottom and top (capsule ends: rounded off)


def jets_scene(h, x, y, z):
    ay = abs(y)
    cx, cy = x - JET_X, ay - JET_Y
    # the cans: upright capsules, a dome on top
    h.add(sd_capsule(cx, cy, z, 0.0, 0.0, JET_Z0, 0.0, 0.0, JET_Z1, JET_R), JT_CAN, cx, cy, z)
    # the strap round both cans
    band = max(sd_round_rect(cx, y, JET_R + 0.25, JET_Y + JET_R + 0.25, JET_R + 0.2), abs(z - 1.4) - 0.45)
    h.add(band, JT_STRAP, cx, y, z)
    # the plate between the cans that bolts onto the carrier's back
    h.add(sd_box(x - 0.55, y, z - 1.4, 0.45, 1.4, 2.0, 0.25), JT_PLATE, x, y, z)
    # nozzles: bells under the cans, angled down and back
    a, b = (JET_X - 0.2, JET_Y, JET_Z0 - 0.9), (JET_X - 1.0, JET_Y, JET_Z0 - 2.3)
    outer = sd_seg_frustum(x, ay, z, a, b, 0.95, 1.3)
    inner = sd_seg_frustum(x, ay, z, (a[0] - 0.3, a[1], a[2] - 0.5), (b[0] - 0.3, b[1], b[2] - 0.6), 0.5, 0.95)
    h.add(max(outer, -inner), JT_NOZ, x, y, z)
    h.add(sd_seg_frustum(x, ay, z, a, (b[0] + 0.25, b[1], b[2] + 0.45), 0.6, 0.8), JT_THROAT, x, y, z)
    # a bolt on the strap at the back, between the cans
    h.add(sd_ellipsoid(cx + JET_R + 0.3, y, z - 1.4, 0.5, 0.6, 0.55), JT_BOLT)


def jets_mats():
    return {
        JT_CAN: Mat([17, 18, 18, 28], ink=17),
        JT_STRAP: Mat([2, 6, 7, 8], ink=2, group=JT_CAN),
        JT_PLATE: Mat([1, 2, 6, 7], ink=0),
        JT_NOZ: Mat([2, 6, 7, 8], ink=2),
        JT_THROAT: Mat([0, 1, 1, 1], ink=0, group=JT_NOZ),
        JT_BOLT: Mat([7, 8, 9, 9], noInk=True),
    }


# ---------------------------------------------------------------- Springs (M6)
# In the BODY's frame (anchor = body center, z = 0 on the ground), like the treads: a coil bumper
# either side of the body's footprint. Each is a gold coil spring lying along the body (its axis =
# the body's forward) between two steel end plates. Set ~10.5 px out on the Scrapper and the
# Bouncer (outside the Scrapper's treads, against the Bouncer's belt); the big pair for a Rammer
# (part:bigsprings) sits ~14.6 px out, past its treads. The coils' turns are painted afterwards in
# screen space (coil_turns), so every direction gets even 1 px gaps.

S_COIL, S_CAP = range(2)
COIL_Y = 10.5     # coil axis, either side
COIL_X = -0.3     # coil center along the body
COIL_Z = 3.0      # coil axis height
COIL_R = 2.5      # coil radius
COIL_L = 5.3      # coil half length
BIG = dict(cy=14.6, cx=0.4, cz=3.3, length=7.0, radius=2.5)   # on a Rammer


def coil_scene(h, x, y, z, cx=COIL_X, cy=0.0, cz=COIL_Z, length=COIL_L, side=1, radius=COIL_R, caps=True):
    """One coil bumper with its axis along x through (cx, cy, cz). Hit coords: u = along the axis,
    v = across (outward positive), w = up."""
    u, v, w = x - cx, (y - cy) * side, z - cz
    r = math.sqrt(v * v + w * w)
    # the coil: a tube, its ends tucked into the plates
    h.add(max(r - radius, abs(u) - length), S_COIL, u, v, w)
    # end plates: steel discs a little smaller than the coil, capping its ends
    if caps:
        h.add(max(r - (radius - 0.5), abs(abs(u) - (length + 0.3)) - 0.3), S_CAP, u, v, w)


def springs_scene(h, x, y, z):
    side = 1 if y >= 0 else -1
    coil_scene(h, x, y, z, cy=COIL_Y * side, side=side)


def bigsprings_scene(h, x, y, z):
    side = 1 if y >= 0 else -1
    coil_scene(h, x, y, z, cx=BIG['cx'], cy=BIG['cy'] * side, cz=BIG['cz'], length=BIG['length'], side=side, radius=BIG['radius'])


def springs_mats():
    return {
        S_COIL: Mat([17, 18, 18, 28], ink=17),
        S_CAP: Mat([2, 6, 7, 8], ink=2),
    }


def coil_turns(img, grid, angle, pitch=3, gap_lit=17, gap_dark=24, slant=0.0):
    """Paint the coil's turns onto a sculpted frame: along the coil's axis as it shows on screen,
    every `pitch` px one dark gap px (the dark core between two turns), tilted a pixel across the
    tube like a helix. Works per direction from the pixel's position along the projected axis, so
    the gaps are 1 px everywhere (the axis is foreshortened differently in each direction)."""
    k = math.sqrt(math.cos(angle) ** 2 + (0.6 * math.sin(angle)) ** 2)
    for py_, row in enumerate(grid):
        for px_, p in enumerate(row):
            if not p or p.m != S_COIL or p.ink:
                continue
            # screen px along the axis from the coil's middle, plus a tilt from the angle round it
            th = math.atan2(p.w, p.v)  # 0 = outward, pi/2 = top
            s = p.u * k + slant * th / math.pi
            if math.floor(s + 0.5) % pitch == pitch - 1:
                img[py_][px_] = gap_lit if p.lvl >= 2 else gap_dark
