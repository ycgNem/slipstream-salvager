"""The Hopper (M6): a squat scrap frog with jump jets on its back. It punishes hiding: it leaps over
cover and slams down where you'll be.

40x40 frames, anchor (20,26), collision r = 10. A sage carapace (35-38) that sits like a frog's
back, high at the hips and sloping down into a broad flat head with a dark mouth seam; two pale eye
domes with dark pupils looking forward; big dark sage-slate haunches either side (34-37) on steel
shins and webbed feet, and little steel front legs (1/2/6/7). Drawn WITHOUT its jets: they are the
`part:jets` overlay (pixel-art/parts6) on the rear mount, just behind the hip hump; bare, its back
shows the steel bracket they bolt to. No red, no teal, no gold anywhere on the body.

States (STYLE.md), each its own silhouette at 1x:
  stalk  (2) sitting up, a waddle bob between the frames
  crouch (2) flattened low and spread wide, haunches out flat, eyes glaring white (no pupils); the
             frames quiver a pixel and the renderer shakes it
  air    (1) stretched long: hind legs trailing behind, front legs tucked back
  land   (1) stuck: flat and wide, legs splayed back and out and sunk in, eyes lidded (also its
             stunned frame)
All 8 directions are rendered from the model (light stays upper left), never mirrored.

Run: python pixel-art/hopper/build.py -> hopper.png (1x sheet: 8 rows = e se s sw w nw n ne,
6 columns = stalk0 stalk1 crouch0 crouch1 air land), sprites.json, previews in e2e/out/pixel-art/.
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
from sculpt import (DIRS, Mat, sculpt, dir_angle, sd_box, sd_capsule, sd_ellipsoid,  # noqa: E402
                    unpitch, isolated, colors_used, label_sheet, Canvas, shadow_img, to_image,
                    Painter, despeckle, add_outline, blank, stamp)
from PIL import Image  # noqa: E402
import model as parts  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'
W = H = 40
OX, OY = 20, 26
ZMAX = 14

BODY, BELLY, THIGH, SHIN, FOOT, EYE, BRACKET, BOLT = range(8)

HAUNCH = [34, 35, 36, 37]   # the big thighs: dark sage-slate
LEGS = [1, 2, 6, 7]         # shins, feet and front legs: steel


def smin(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(a, b, t):
    return tuple(lerp(p, q, t) for p, q in zip(a, b))


# ---------------------------------------------------------------- the model

BASE = dict(lift=0.0, pitch=0.0, squash=1.0, widen=1.0, longer=1.0, fold=0.0, splay=0.0, sink=0.0, reach=0.0,
            eye='lit')

# leg joints (x, |y|, z) for three key poses; fold blends sit (0) -> crouch (1), and air (-1)
SIT = dict(hip=(-3.6, 4.4, 3.7), knee=(1.0, 7.9, 4.3), ankle=(-4.8, 8.9, 1.1), toe=(2.6, 9.7, 0.55))
CROUCH = dict(hip=(-3.6, 5.2, 1.7), knee=(1.2, 10.4, 2.0), ankle=(-5.2, 11.2, 0.8), toe=(2.2, 12.4, 0.55))
AIR = dict(hip=(-4.6, 4.2, 4.2), knee=(-8.8, 5.8, 3.6), ankle=(-12.4, 6.4, 3.3), toe=(-15.2, 6.8, 3.2))
SPLAY = dict(hip=(-3.6, 5.0, 1.8), knee=(-4.6, 10.6, 1.5), ankle=(-9.0, 11.2, 0.4), toe=(-7.4, 13.2, -0.3))


def leg_joints(p):
    f = p['fold']
    if f >= 0:
        J = {k: lerp3(SIT[k], CROUCH[k], f) for k in SIT}
    else:
        J = {k: lerp3(SIT[k], AIR[k], -f) for k in SIT}
    if p['splay']:
        J = {k: lerp3(J[k], SPLAY[k], p['splay']) for k in J}
    return J


HUMP, HUMP_R = (-3.0, 0.0, 5.4), (5.6, 5.6, 4.3)
HEAD, HEAD_R = (4.4, 0.0, 4.4), (5.2, 5.0, 2.7)
EYE_P = (5.0, 2.9, 6.75)
EYE_R = (1.75, 1.7, 1.55)
MOUTH_Z = 3.95


def scene(p):
    J = leg_joints(p)
    lift, pitch, sq, wd, sink, reach = p['lift'], p['pitch'], p['squash'], p['widen'], p['sink'], p['reach']
    # front legs: shoulder -> hand; reach > 0 forward (air), < 0 tucked
    sh = (3.8, 3.3, 3.2 + lift * 0.7)
    hand = (6.2 + reach * (3.0 if reach > 0 else 5.4), 5.0 + p['splay'] * 2.4 + max(0.0, p['fold']) * 1.2 - min(0.0, reach) * 0.3,
            0.5 + abs(reach) * 1.6 + max(0.0, lift) * 0.8 - sink)
    J = dict(J)
    J['toe'] = (J['toe'][0], J['toe'][1], J['toe'][2] - sink)
    J['ankle'] = (J['ankle'][0], J['ankle'][1], J['ankle'][2] - sink * 0.7)

    def sc(h, x, y, z):
        ay = abs(y)
        # ---- legs (not posed with the body: they reach the ground)
        # the haunch: a big thigh from hip to knee, fattest in the middle
        hx, hy, hz = J['hip']
        kx, ky, kz = J['knee']
        # an oval along the thigh (hip -> knee), squashed flatter as it folds into the crouch
        mx, my, mz = (hx + kx) / 2, (hy + ky) / 2, (hz + kz) / 2
        yaw = math.atan2(ky - hy, kx - hx)
        half = math.hypot(kx - hx, ky - hy) / 2
        c, s_ = math.cos(yaw), math.sin(yaw)
        lx, ly = (x - mx) * c + (ay - my) * s_, -(x - mx) * s_ + (ay - my) * c
        h.add(sd_ellipsoid(lx, ly, z - mz, half + 1.6, 2.5, 2.5 - 0.85 * max(0.0, p['fold']) - 0.8 * p['splay']), THIGH, x, y, z)
        # shin: knee -> ankle, and the long foot: ankle -> toes, flat on the ground
        ax_, ay_, az_ = J['ankle']
        h.add(sd_capsule(x, ay, z, kx, ky, kz, ax_, ay_, az_, 1.05), SHIN, x, y, z)
        tx, ty, tz = J['toe']
        foot = sd_capsule(x, ay, z, ax_, ay_, az_, tx, ty, tz, 0.75)
        # webbed toes: three short splayed toes at the end of the foot
        fdx, fdy = tx - ax_, ty - ay_
        fl = math.hypot(fdx, fdy) or 1.0
        fdx, fdy = fdx / fl, fdy / fl
        for a in (-0.55, 0.0, 0.55):
            c, s = math.cos(a), math.sin(a)
            ex, ey = fdx * c - fdy * s, fdx * s + fdy * c
            foot = min(foot, sd_capsule(x, ay, z, tx, ty, tz, tx + ex * 1.6, ty + ey * 1.6, tz - 0.1, 0.5))
        h.add(max(foot, -z), FOOT, x, y, z)
        # little front legs
        arm = sd_capsule(x, ay, z, sh[0], sh[1], sh[2], hand[0], hand[1], hand[2] + 0.4, 0.8)
        for a in (-0.6, 0.0, 0.6):
            arm = min(arm, sd_capsule(x, ay, z, hand[0], hand[1], hand[2] + 0.2, hand[0] + 1.2 * math.cos(a), hand[1] + 1.2 * math.sin(a), hand[2], 0.42))
        h.add(max(arm, -z), SHIN, x, y, z)
        # ---- the posed body
        bx, bz = x, z - lift
        bx, bz = unpitch(bx, bz, -pitch, -6.5, 1.5)
        by = y / wd
        bx = (bx + 2.0) / p['longer'] - 2.0
        bz = (bz - 1.0) / sq + 1.0
        # carapace: a frog's sitting back, high at the hips (the hump the jets sit behind) and
        # sloping down into a broad flat head
        hump = sd_ellipsoid(bx - HUMP[0], by, bz - HUMP[2], *HUMP_R)
        head = sd_ellipsoid(bx - HEAD[0], by, bz - HEAD[2], *HEAD_R)
        body = smin(hump, head, 2.6)
        h.add(body * min(sq, 1.0), BODY, bx, by, bz)
        # belly / chin: a paler underside, seen from the front
        h.add(sd_ellipsoid(bx - 1.2, by, bz - 2.9, 7.2, 4.9, 2.0) * min(sq, 1.0), BELLY, bx, by, bz)
        # eye domes on top of the head
        h.add(sd_ellipsoid(bx - EYE_P[0], abs(by) - EYE_P[1], bz - EYE_P[2], *EYE_R), EYE, bx, by, bz)
        # the bracket on its back the jets bolt to: a steel block with two bolts
        h.add(sd_box(bx + 8.0, by, bz - 4.3, 0.7, 1.8, 1.2, 0.3), BRACKET, bx, by, bz)
        h.add(sd_ellipsoid(bx + 8.6, abs(by) - 1.05, bz - 4.8, 0.45, 0.5, 0.5), BOLT)

    return sc


def mats(p):
    def body(q):
        # a dark plate seam across the back, behind the eyes
        if q.nz > 0.55 and abs(q.u - 1.6) < 0.35:
            return 35
        return None
    return {
        BODY: Mat([35, 36, 37, 38], ink=34, paint=body),
        BELLY: Mat([36, 37, 38, 38], ink=35, group=BODY),
        THIGH: Mat(HAUNCH, ink=0),
        SHIN: Mat(LEGS, ink=0, group=THIGH),
        FOOT: Mat(LEGS, ink=0, group=THIGH),
        EYE: Mat({'lit': [7, 8, 8, 9], 'hot': [8, 9, 9, 9], 'dim': [6, 7, 7, 8]}[p['eye']], ink=34),
        BRACKET: Mat([1, 2, 6, 7], ink=0),
        BOLT: Mat([7, 8, 9, 9], noInk=True),
    }


def posed(p):
    """body-frame point -> body-local (the inverse of the pose in scene())."""
    def body(x, y, z):
        z = (z - 1.0) * p['squash'] + 1.0
        y = y * p['widen']
        x = (x + 2.0) * p['longer'] - 2.0
        x, z = unpitch(x, z, p['pitch'], -6.5, 1.5)
        return x, y, z + p['lift']
    return body


def details(img, grid, a, p):
    pt = Painter(img, grid, a, OX, OY, ZMAX)
    body = posed(p)
    # pupils: a dark dot on the front of each eye dome (they look the way it faces); lidded when dim
    for sy in (-1, 1):
        ex, ey, ez = EYE_P[0], EYE_P[1] * sy, EYE_P[2]
        if p['eye'] == 'dim':
            # lids: the top half of the dome in carapace sage, a dark slit under it
            for t in range(-3, 4):
                yy = ey + t * 0.4
                pt.dot(*body(ex + 0.9, yy, ez + 0.9), 37, eps=1.4, only={EYE})
                pt.dot(*body(ex + 0.4, yy, ez + 1.3), 37, eps=1.4, only={EYE})
                pt.dot(*body(ex + 1.35, yy, ez + 0.15), 0, eps=1.4, only={EYE})
        elif p['eye'] == 'lit':
            # (white-hot eyes in the crouch have no pupils: a glare)
            # high on the front of the dome, so it's the middle of the eye seen from in front and
            # its front edge seen side on
            pt.dot(*body(ex + EYE_R[0] * 0.72, ey, ez + EYE_R[2] * 0.62), 0, eps=1.3, only={EYE}, normal=(0.75, 0, 0.66))
    # the mouth: a dark seam round the front of the snout, a wide frog grin (not when it's
    # flattened on landing: the snout is half sunk and the seam only muddies the face)
    for t in (range(-16, 17) if p['splay'] < 0.5 else ()):
        ang = t / 16 * 1.25
        k = math.sqrt(max(0.0, 1 - ((MOUTH_Z - HEAD[2]) / HEAD_R[2]) ** 2))
        yy = math.sin(ang) * HEAD_R[1] * k
        xx = HEAD[0] + math.cos(ang) * HEAD_R[0] * k
        pt.dot(*body(xx, yy, MOUTH_Z), 34, eps=1.3, only={BODY, BELLY})
    return pt.mark


def render(d, p):
    a = dir_angle(d)
    img, grid = sculpt(W, H, OX, OY, a, scene(p), mats(p), zmax=ZMAX, zmin=0, outline=False)
    keep = details(img, grid, a, p)
    despeckle(img, keep)
    add_outline(img, 0)
    return img


def poses():
    P = lambda **k: {**BASE, **k}  # noqa: E731
    return [
        ('stalk', 0, P()),
        ('stalk', 1, P(lift=0.7, pitch=0.06, fold=-0.12, reach=0.25)),
        ('crouch', 0, P(lift=-2.6, squash=0.72, widen=1.18, longer=1.1, fold=1.0, pitch=0.04, eye='hot', reach=-0.2)),
        ('crouch', 1, P(lift=-3.0, squash=0.68, widen=1.2, longer=1.12, fold=1.0, pitch=0.04, eye='hot', reach=-0.2)),
        ('air', None, P(lift=1.8, pitch=0.18, widen=0.94, longer=1.08, fold=-1.0, reach=-1.0)),
        ('land', None, P(lift=-2.4, squash=0.68, widen=1.3, longer=1.05, fold=0.4, splay=1.0, sink=0.6, pitch=-0.1, eye='dim', reach=0.2)),
    ]


def name(state, dn, f):
    return f'en:hopper:{state}:{dn}' + (f':{f}' if f is not None else '')


# ---------------------------------------------------------------- previews

def rear_mount(d, dist=9, lift=3):
    a = dir_angle(d)
    return math.floor(-math.cos(a) * dist + 0.5), math.floor(-math.sin(a) * dist * 0.6 + 0.5) - lift, math.sin(a) > 0.1


def with_jets(img, d, jets):
    """The body with its jets at the rear mount, like the renderer: a 40x40 composite."""
    dx, dy, behind = rear_mount(d)
    out = blank(W, H)
    if behind:
        stamp(out, jets, OX + dx - 8, OY + dy - 8)
    stamp(out, img, 0, 0)
    if not behind:
        stamp(out, jets, OX + dx - 8, OY + dy - 8)
    return out


def main():
    rows = []
    for d, dn in enumerate(DIRS):
        rows.append([(name(s, dn, f), render(d, p)) for s, f, p in poses()])
    frames = [img for row in rows for _, img in row]
    ncol = len(rows[0])
    sheet = Image.new('RGBA', (W * ncol, H * 8), (0, 0, 0, 0))
    recipe = []
    for r, row in enumerate(rows):
        for c, (n, img) in enumerate(row):
            sheet.paste(to_image(img), (c * W, r * H))
            recipe.append({'match': n, 'file': 'hopper.png', 'rect': [c * W, r * H, W, H]})
    sheet.save(HERE / 'hopper.png')
    with open(HERE / 'sprites.json', 'w', newline='\n') as f:
        json.dump({'name': 'hopper', 'kind': 'sprites', 'scale': 1,
                   'defaults': {'frame': [W, H], 'origin': [OX, OY], 'place': 'none', 'keepStrays': True},
                   'sprites': recipe}, f, indent=1)
    # previews
    jets = {d: sculpt(16, 16, 8, 8, dir_angle(d), parts.jets_scene, parts.jets_mats(), zmax=6, zmin=-4)[0] for d in range(8)}
    label_sheet([(dn, [img for _, img in row]) for dn, row in zip(DIRS, rows)], 4, PREV / 'hopper-states.png')
    label_sheet([(dn, [with_jets(img, d, jets[d]) for _, img in row]) for d, (dn, row) in enumerate(zip(DIRS, rows))], 4, PREV / 'hopper-jets.png')
    # in context at 1x: every frame on the floor with its shadow and jets (air lifted 14 px)
    cv = Canvas(48 * ncol + 8, 48 * 8 + 8)
    for r, row in enumerate(rows):
        for c, (n, img) in enumerate(row):
            x, y = 28 + c * 48, 34 + r * 48
            cv.draw(shadow_img('l'), x, y + 1, 16, 5, shadow=True)
            lift = 12 if ':air:' in n else 0
            cv.draw(with_jets(img, r, jets[r]), x, y - lift, OX, OY)
    cv.save(PREV / 'hopper-1x.png', 1)
    cv.save(PREV / 'hopper-3x.png', 3)
    used = colors_used(frames)
    iso = sum(len(isolated(f)) for f in frames)
    print('hopper: %d frames, colors %s, isolated px %d' % (len(frames), used, iso))


if __name__ == '__main__':
    main()
