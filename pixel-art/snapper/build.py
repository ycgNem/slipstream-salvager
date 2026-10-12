"""The Snapper (M3): a small, low, fast hunting tread-bot, a hound of scrap.

32x32 frames, anchor (16,20), collision r = 8. Violet hull (purples 49-53) with steel-blue
accents (44-47): the snout and its lower jaw, the spine plate and two swept-back ear fins; pale
teeth; lilac eyes that go white when it winds up and dim when stunned. Drawn WITHOUT its treads:
they are the `part:treads` overlay (pixel-art/parts), drawn under the body; bare, it stands on four
steel axle stubs. No red, no teal, no gold anywhere on the body.

States: hunt (2), windup (2, crouched, snout down), snap (2, stretched forward, jaw open/shut),
slide (1, broadside and leaning so its flank shows), stunned (2). All 8 directions are rendered
from the model (light stays upper left), never mirrored.

Run: python pixel-art/snapper/build.py  ->  snapper.png (1x sheet: 8 rows = e se s sw w nw n ne,
9 columns = hunt0 hunt1 windup0 windup1 snap0 snap1 slide stunned0 stunned1), sprites.json, and
previews in e2e/out/pixel-art/.
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
from sculpt import (DIRS, Mat, sculpt, dir_angle, sd_box, sd_capsule, sd_cyl, sd_ellipsoid,  # noqa: E402
                    unpitch, unroll, project, put, get, isolated, colors_used, save_strip,
                    label_sheet, Canvas, shadow_img, compose, grid_sheet, to_image, Painter,
                    despeckle, add_outline)
from PIL import Image  # noqa: E402
import model as parts  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'
W = H = 32
OX, OY = 16, 20

HULL, HEAD, JAW, AXLE, MOUTH, TAIL, NECK, FLANK = range(8)

BASE = dict(stripe=False, earsOn=True, plating=True, lift=0.0, pitch=0.0, roll=0.0, fwd=0.0, neck=0.0, jaw=0.0, ears=0.0, eye='lit',
            streak=-1, droop=0.0)


# hull geometry (body frame); the head and jaw are offset by the pose
HULL_C, HULL_HX = -2.2, 4.2


HULL_Z0, HULL_Z1 = 1.3, 4.8   # bottom, top at the haunches
HEAD_C, HEAD_Z = 5.4, 3.95    # head center x (before the neck stretch) and z
HEAD_HX, HEAD_HY, HEAD_HZ = 2.6, 3.4, 1.6


def hull_top(x):
    """Height of the hull's sloping back at body-x (haunches high, shoulders low)."""
    return HULL_Z1 - max(0.0, x - HULL_C) * 0.17


def scene(p):
    lift, pitch, roll, fwd, neck = p['lift'], p['pitch'], p['roll'], p['fwd'], p['neck']
    jaw, droop = p['jaw'], p['droop']

    def sc(h, x, y, z):
        ay = abs(y)
        # axle stubs: two axles under the hull, ends poking out either side (they carry the treads)
        for axx in (-4.4, 1.8):
            h.add(sd_cyl(ay - 5.8, x - axx, z - 1.4, 0.8, 1.75, 0.25), AXLE, x, y, z)
        # the posed body
        bx, by, bz = x - fwd, y, z - lift
        bx, bz = unpitch(bx, bz, pitch, -6.0, 2.0)
        by, bz = unroll(by, bz, roll, 0.0, 2.0)
        bay = abs(by)
        # chassis: a low bolted wedge, high haunches sloping down to the shoulders
        hz0 = (HULL_Z0 + HULL_Z1) / 2
        hull = sd_box(bx - HULL_C, by, bz - hz0, HULL_HX, 4.6, (HULL_Z1 - HULL_Z0) / 2, 1.1)
        slope = (bz - HULL_Z1 + (bx - HULL_C) * 0.17) * 0.986
        h.add(max(hull, slope), HULL, bx - HULL_C, by, bz - hz0)
        # flank armor: a steel-blue band along each side, so a broadside reads as a side
        h.add(sd_box(bx - (HULL_C + 0.3), bay - 4.65, bz - 2.75, HULL_HX - 0.9, 0.3, 0.55, 0.2), FLANK, bx, by, bz)
        # a stubby tail antenna at the back
        h.add(sd_capsule(bx, by, bz, -6.0, 0.0, 4.5, -7.3, 0.0, 6.6, 0.45), TAIL)
        # the head, on a dark neck that stretches when it snaps
        hx = bx - neck
        hz = bz + droop
        h.add(sd_box(hx - (1.4 + neck) / 2 - 1.6, by, hz - 3.2, max(0.6, (1.4 + neck) / 2 + 0.3), 2.0, 0.9, 0.3), NECK, bx, by, bz)
        head = sd_box(hx - HEAD_C, by, hz - HEAD_Z, HEAD_HX, HEAD_HY, HEAD_HZ, 0.9)
        snout = (hx - (HEAD_C + HEAD_HX) + 0.4 + bay * 0.5) * 0.894  # blunt wedge nose
        h.add(max(head, snout), HEAD, hx - HEAD_C, by, hz - HEAD_Z)
        # mouth: dark inside, shows when the jaw drops
        h.add(sd_box(hx - 5.6, by, hz - 2.35, 2.2, 2.8, 0.45, 0.3), MOUTH, hx, by, hz)
        # lower jaw (steel blue), hinged at the back of the head, jutting a little (underbite)
        jx, jz = unpitch(hx, hz, jaw, 3.0, 2.2)
        jaw_box = sd_box(jx - 6.0, by, jz - 1.65, 2.9, 3.2, 0.6, 0.4)
        jaw_pt = (jx - 8.9 + abs(by) * 0.5) * 0.894
        h.add(max(jaw_box, jaw_pt), JAW, jx, by, jz)

    return sc


def mats(p):
    return {
        HULL: Mat([50, 50, 52, 53], ink=49),
        NECK: Mat([44, 44, 45, 45], ink=0),
        FLANK: Mat([45, 46, 46, 47], ink=0, group=HULL),
        HEAD: Mat([50, 51, 52, 53], ink=49),
        JAW: Mat([44, 45, 46, 46], ink=0),
        MOUTH: Mat([0, 0, 49, 49], ink=0),
        AXLE: Mat([1, 2, 6, 7], ink=0),
        TAIL: Mat([45, 46, 47, 47], noInk=True),
    }


def posed(p):
    """Body-local transforms for the details: hull frame, head frame and jaw frame -> body."""
    def body(x, y, z):
        y, z = unroll(y, z, -p['roll'], 0.0, 2.0)
        x, z = unpitch(x, z, -p['pitch'], -6.0, 2.0)
        return x + p['fwd'], y, z + p['lift']

    def head(x, y, z):
        return body(x + p['neck'], y, z - p['droop'])

    def jaw(x, y, z):
        x, z = unpitch(x, z, -p['jaw'], 3.0, 2.2)
        return head(x, y, z)
    return body, head, jaw


def details(img, grid, a, p):
    pt = Painter(img, grid, a, OX, OY, ZMAX)
    body, head, jaw = posed(p)
    # dorsal stripe (the hackles): steel blue down the middle of the back, pointing the way it
    # faces; brightest at the shoulders
    for i in range(15 if p['stripe'] else 0):
        x = -5.6 + i * 0.5
        c = 47 if x > 0.2 else 46
        pt.dot(*body(x, 0.0, hull_top(x) + 0.05), c, eps=1.4, only={HULL})
    # plating: a seam across the back, and rivets at its corners
    if p['plating']:
        for t in range(-8, 9):
            y = t * 0.5
            pt.dot(*body(-3.0, y, hull_top(-3.0) + 0.05), 51, eps=1.4, only={HULL})
    # eyes: on top of the head, either side, lit lilac (white when it winds up, dim when stunned)
    eye = {'lit': 53, 'hot': 9, 'dim': 50}[p['eye']]
    # set into the upper front of the snout, so they show from the front and the side and never
    # from behind (facing reads at a glance), each with a dark socket under it
    for sy in (-1.5, 1.5):
        xf = HEAD_C + HEAD_HX - 0.4 - 0.5 * abs(sy) + 0.25
        pt.dot(*head(xf, sy, HEAD_Z + 0.95), eye, eps=1.6, only={HEAD}, normal=(1, 0, 0))
        pt.dot(*head(xf, sy, HEAD_Z + 0.1), 49, eps=1.6, only={HEAD}, normal=(1, 0, 0))
    # teeth: pale along the front of the upper jaw, and standing up on the lower jaw
    for t in (-2.2, -1.1, 0.0, 1.1, 2.2):
        pt.dot(*head(7.9 - 0.5 * abs(t), t, HEAD_Z - HEAD_HZ + 0.1), 8, eps=1.4, only={HEAD, MOUTH, JAW})
        pt.dot(*jaw(8.8 - 0.5 * abs(t), t, 2.2), 8 if abs(t) > 0.5 else 9, eps=1.4, only={JAW, HEAD, MOUTH})
    # ear fins: two short steel-blue spikes swept back off the back of the head
    ang = 0.9 + p['ears']
    for sy in ((-1, 1) if p['earsOn'] else ()):
        x0, z0 = 3.5, HEAD_Z + HEAD_HZ - 0.2
        x1, z1 = x0 - 2.6 * math.cos(ang), z0 + 2.6 * math.sin(ang)
        pt.line(head(x0, 2.4 * sy, z0), head(x1, 2.9 * sy, z1), 46, on_empty=True, eps=1.0)
        pt.dot(*head(x1, 2.9 * sy, z1), 47, on_empty=True, eps=1.0)
    return pt.mark


ZMAX = 11
# light bands: only edges turned well into the light get the palest purple (a tilted back stays lavender)
BANDS = (-0.22, 0.32, 0.93)


def streaks(img, angle, frame):
    """Motion streaks behind a snapping Snapper: pale-steel dashes (2 px on, 2 off, marching back
    a step per frame) on empty pixels only, like the Rammer's charge."""
    lanes = [(-4.6, 1.6, 7), (4.6, 1.6, 7), (0.0, 4.4, 5)]
    for i, (yy, zz, ln) in enumerate(lanes):
        x0 = -8.0 - (i % 2)
        x1 = x0 - ln
        ax, ay = project(angle, x0, yy, zz)
        bx, by = project(angle, x1, yy, zz)
        sx0, sy0 = math.floor(OX + ax), math.floor(OY + ay)
        sx1, sy1 = math.floor(OX + bx), math.floor(OY + by)
        n = max(abs(sx1 - sx0), abs(sy1 - sy0)) or 1
        for st in range(n + 1):
            if (st + frame * 2 + i) % 4 >= 2:
                continue
            px_ = round(sx0 + (sx1 - sx0) * st / n)
            py_ = round(sy0 + (sy1 - sy0) * st / n)
            if get(img, px_, py_) >= 0:
                continue
            put(img, px_, py_, 8 if st < n / 2 else 7)


def render(d, p):
    a = dir_angle(d)
    img, grid = sculpt(W, H, OX, OY, a, scene(p), mats(p), zmax=ZMAX, zmin=0, outline=False, bands=BANDS)
    keep = details(img, grid, a, p)
    despeckle(img, keep)
    add_outline(img, 0)
    if p['streak'] >= 0:
        streaks(img, a, p['streak'])
    return img


# ---------------------------------------------------------------- the poses

def side_roll(d, amt):
    """Roll that lifts the camera-near flank into view (the slide)."""
    c = math.cos(dir_angle(d))
    if abs(c) < 0.1:
        return amt * 0.65  # facing straight up/down the screen: lean to its right, less
    return -amt if c > 0 else amt


def poses(d):
    P = lambda **k: {**BASE, **k}  # noqa: E731
    return [
        ('hunt', 0, P()),
        ('hunt', 1, P(lift=-0.5, pitch=0.06, ears=-0.15)),
        ('windup', 0, P(lift=-1.3, pitch=0.2, jaw=0.22, ears=-0.45, eye='hot', droop=-0.4)),
        ('windup', 1, P(lift=-1.6, pitch=0.26, jaw=0.3, ears=-0.5, eye='hot', droop=-0.5)),
        ('snap', 0, P(lift=-0.4, pitch=0.1, fwd=1.0, neck=1.6, jaw=0.62, ears=-0.55, eye='hot', streak=0)),
        ('snap', 1, P(lift=-0.6, pitch=0.12, fwd=1.5, neck=2.2, jaw=0.05, ears=-0.55, eye='hot', streak=1)),
        ('slide', None, P(lift=0.2, roll=side_roll(d, 0.48), ears=-0.5, droop=-0.3)),
        ('stunned', 0, P(lift=-1.7, pitch=0.12, roll=0.16, jaw=0.4, ears=-0.9, eye='dim', droop=-0.6)),
        ('stunned', 1, P(lift=-1.9, pitch=0.1, roll=0.24, jaw=0.32, ears=-1.0, eye='dim', droop=-0.7)),
    ]


def name(state, dn, f):
    return f'en:snapper:{state}:{dn}' + (f':{f}' if f is not None else '')


def main():
    rows = []
    for d, dn in enumerate(DIRS):
        row = []
        for state, f, p in poses(d):
            row.append((name(state, dn, f), render(d, p)))
        rows.append(row)
    # 1x sheet: one row per direction
    frames = [img for row in rows for _, img in row]
    sheet = Image.new('RGBA', (W * 9, H * 8), (0, 0, 0, 0))
    recipe = []
    for r, row in enumerate(rows):
        for c, (n, img) in enumerate(row):
            sheet.paste(to_image(img), (c * W, r * H))
            recipe.append({'match': n, 'file': 'snapper.png', 'rect': [c * W, r * H, W, H]})
    sheet.save(HERE / 'snapper.png')
    json.dump({'name': 'snapper', 'kind': 'sprites', 'scale': 1,
               'defaults': {'frame': [W, H], 'origin': [OX, OY], 'place': 'none', 'keepStrays': True},
               'sprites': recipe}, open(HERE / 'sprites.json', 'w'), indent=1)
    # previews
    label_sheet([(dn, [img for _, img in row]) for dn, row in zip(DIRS, rows)], 6, PREV / 'snapper-states.png')
    # composite: in all 8 directions with treads under it, at 1x and 4x, on the floor with a shadow
    tr = {dn: sculpt(W, H, OX, OY, dir_angle(d), parts.treads_scene, parts.treads_mats(), zmax=6)[0] for d, dn in enumerate(DIRS)}
    for scale, fn in ((4, 'snapper-composite.png'),):
        cv = Canvas(48 * 9 + 8, 44 * 8 + 8)
        for r, row in enumerate(rows):
            dn = DIRS[r]
            for c, (n, img) in enumerate(row):
                x, y = 24 + c * 48, 26 + r * 44
                cv.draw(shadow_img('m'), x, y + 1, 12, 4, shadow=True)
                cv.draw(tr[dn], x, y, OX, OY)
                cv.draw(img, x, y, OX, OY)
        cv.save(PREV / fn, scale)
    # focus: a few key frames, bare, at 7x
    pick = {n: img for row in rows for n, img in row}
    keys = ['en:snapper:hunt:e:0', 'en:snapper:hunt:se:0', 'en:snapper:hunt:s:0', 'en:snapper:hunt:ne:0',
            'en:snapper:windup:se:1', 'en:snapper:snap:se:0', 'en:snapper:snap:se:1', 'en:snapper:stunned:se:0',
            'en:snapper:slide:e', 'en:snapper:slide:se', 'en:snapper:slide:s', 'en:snapper:slide:ne']
    grid_sheet([(k[11:], pick[k]) for k in keys], 7, PREV / 'snapper-key.png', cols=4)
    # focus: hunt 0 bare and with treads, every direction, at 8x
    cells = []
    for r, row in enumerate(rows):
        dn = DIRS[r]
        img = row[0][1]
        cells.append((f'{dn} bare', img))
        cells.append((f'{dn} treads', tr[dn]))
        cells.append((f'{dn} +treads', compose([(tr[dn], OX, OY), (img, OX, OY)], W, H)))
    grid_sheet(cells[:12], 7, PREV / 'snapper-focus1.png', cols=6)
    grid_sheet(cells[12:], 7, PREV / 'snapper-focus2.png', cols=6)
    # per direction: the 9 frames bare and with treads, at 3x (fits a screen unscaled)
    for r, row in enumerate(rows):
        dn = DIRS[r]
        cells = [(':'.join(n.split(':')[2:3] + n.split(':')[4:]), img) for n, img in row]
        cells += [('+treads', compose([(tr[dn], OX, OY), (img, OX, OY)], W, H)) for n, img in row]
        grid_sheet(cells, 3, PREV / f'snapper-dir-{dn}.png', cols=9, pad=4)
    used = colors_used(frames)
    iso = sum(len(isolated(f)) for f in frames)
    print('snapper: %d frames, colors %s, isolated px %d' % (len(frames), used, iso))


if __name__ == '__main__':
    main()
