"""The Compactor (M8 boss): a crusher truck you take apart. 64x64 frames, anchor (32,44), collision
r = 20, sculpted at 2 px per unit (the code placeholder's scale, src/render/art/code/m8.ts).

A plum hull (49-52) on heavy dark-sage treads (34-36) with steel road wheels; a ribbed steel-blue
bin on its back (44-47) under a lid plate with a round core hatch in it (dark steel, a ring of
bolts); a dark plum cab at the front (0/49-51) with a visor band wrapping round it, set high so it
shows over the plow facing south-ish: lavender when lit, white-hot winding up and charging, dim
when stunned; headlamps in the hull's front face match it; exhaust stacks at the back corners;
the plow's bracket at the front, the booster's at the back. Drawn WITHOUT its parts (bossparts.py:
`bo:part:*`). No red, no teal, no gold on the body: gold is its parts only.

When the core opens (crouch, air, land) the hatch is thrown back over the rear on its hinge (the
back edge of the hole) and the core swells up out of the hole, a white dome with a lavender halo
on the plate round it. It's on top, so it reads from every direction, and the hatch lies behind it.

States (STYLE.md), the code placeholder's poses, so the renderer's mounts still fit:
  stalk (2) treads roll | windup (2) crouched nose down, visor white-hot | charge (2) lunging |
  stunned (2) sagging and rocking, visor dim | crouch (2) core open, crouched to leap |
  skid nose up | air core open, treads hanging | land core open, stuck and sunk, visor dim
All 8 directions are rendered from the model (light stays upper left), never mirrored.

Run: python pixel-art/compactor/build.py build -> compactor.png (1x sheet: 8 rows = e se s sw w nw
n ne by 13 columns = the states above; then the 8 springs, then the 8 plows), sprites.json.
     python pixel-art/compactor/build.py [state,state..] -> previews in e2e/out/pixel-art/
(compactor-states.png at 3x, compactor-1x/-3x.png: with its parts on the floor, as the renderer
draws them); python pixel-art/compactor/build.py parts -> the parts alone.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / '_lib'))
sys.path.insert(0, str(HERE.parent / 'parts'))
sys.path.insert(0, str(HERE))
from sculpt import (DIRS, Mat, sculpt, dir_angle, sd_box, sd_cyl, sd_ellipsoid,  # noqa: E402
                    unpitch, unroll, label_sheet, add_outline, blank, stamp, Canvas)

PREV = ROOT / 'e2e/out/pixel-art'
K = 2
W = H = 64
OX, OY = 32, 44
ZMAX = 24

(TREAD, WHEEL, HULL, BIN, LID, CAB, VISOR, STACK, BRACKET, BOLT, CORE, HATCH, LAMP) = range(13)

P0 = dict(lift=0.0, pitch=0.0, roll=0.0, fwd=0.0, phase=0, visor='lit', lid=0.0, sink=0.0)

TR_Y, TR_HY, TR_HX, TR_H = 7.6, 2.0, 10.4, 5.2
WHEELS = (-6.9, -2.3, 2.3, 6.9)
BIN_X, BIN_HX, BIN_HY, BIN_Z0, BIN_Z1 = -2.4, 6.4, 6.0, 9.4, 15.2
LID_T = 0.6          # lid plate thickness on top of the bin
HOLE_R = 3.5         # the core hatch
HOLE_X = 0.7         # its centre, forward of the bin's
HATCH_OPEN = -3.05   # radians the hatch is thrown back (a pitch: negative = its free edge up): over and down on the back
CORE_H = 3.0         # how high the core's dome swells out of the hole


def scene(p):
    lid = p['lid']
    top = BIN_Z1 + LID_T

    def sc(h, x, y, z):
        ay = abs(y)
        # ---- treads, on the ground (sunk on a landing)
        tz = z + p['sink']
        h.add(sd_box(x, ay - TR_Y, tz - TR_H / 2, TR_HX, TR_HY, TR_H / 2, 1.6), TREAD, x, y, tz)
        for wx in WHEELS:
            h.add(sd_cyl(ay - (TR_Y + TR_HY - 0.05), x - wx, tz - 2.4, 1.45, 0.3, 0.15), WHEEL, x - wx, ay, tz - 2.4)
        # ---- the posed body
        hx, hz, hy = x - p['fwd'], z - p['lift'], y
        hx, hz = unpitch(hx, hz, p['pitch'], -10, 3)
        hy, hz = unroll(hy, hz, p['roll'], 0, 3)
        hay = abs(hy)
        # hull
        h.add(sd_box(hx, hy, hz - 6.6, 9.6, 7.4, 3.4, 1.6), HULL, hx, hy, hz - 6.6)
        # headlamps in the hull's front face
        h.add(sd_box(hx - 9.55, hay - 5.0, hz - 7.6, 0.2, 1.0, 0.6, 0.15), LAMP, hx, hy, hz)
        # bin and its lid plate, the core hatch cut through both
        bx = hx - BIN_X
        bzc = (BIN_Z0 + BIN_Z1) / 2
        cx = bx - HOLE_X
        hole = math.hypot(cx, hy) - HOLE_R
        b = sd_box(bx, hy, hz - bzc, BIN_HX, BIN_HY, (BIN_Z1 - BIN_Z0) / 2, 0.9)
        lp = sd_box(bx, hy, hz - (BIN_Z1 + LID_T / 2), BIN_HX + 0.25, BIN_HY + 0.25, LID_T / 2 + 0.05, 0.3)
        HR = HOLE_R + 0.4
        if lid > 0:
            cut = max(hole, BIN_Z1 - 1.0 - hz)
            b = max(b, -cut)
            lp = max(lp, -cut)
            # the core: a glowing dome swelling up out of the hole
            h.add(sd_ellipsoid(cx, hy, hz - (BIN_Z1 - 0.2), HOLE_R + 0.2, HOLE_R + 0.2, CORE_H), CORE, cx, hy, hz)
            # the hatch thrown back on its hinge (the back edge of the hole), lying back over the rear
            qx, qz = unpitch(cx + HR, hz - top, HATCH_OPEN * lid, 0.0, 0.0)
            h.add(sd_cyl(qz - 0.4, qx - HR, hy, HR, 0.4, 0.2), HATCH, qx - HR, hy, qz - 0.4)
        else:
            h.add(sd_cyl(hz - (top + 0.4), cx, hy, HR, 0.4, 0.2), HATCH, cx, hy, hz - (top + 0.4))
        h.add(b, BIN, bx, hy, hz - bzc)
        h.add(lp, LID, bx, hy, hz - BIN_Z1)
        # cab and its wrap-round visor
        # (the visor sits high on the cab, so it shows over the plow facing south-ish)
        h.add(sd_box(hx - 6.6, hy, hz - 11.9, 2.6, 4.8, 2.5, 0.8), CAB, hx - 6.6, hy, hz - 11.9)
        h.add(sd_box(hx - 7.9, hy, hz - 13.0, 1.45, 4.95, 0.95, 0.3), VISOR, hx - 7.9, hy, hz - 13.0)
        # exhaust stacks at the back corners
        h.add(sd_cyl(hz - 13.4, hx + 8.0, hay - 6.4, 0.9, 3.2, 0.25), STACK, hx + 8.0, hay - 6.4, hz - 13.4)
        # corner bolts on the hull
        for bxx in (-8.3, 8.3):
            h.add(sd_ellipsoid(hx - bxx, hay - 6.3, hz - 9.9, 0.65, 0.65, 0.5), BOLT)
        # brackets: the plow's at the front, the booster's at the back
        h.add(sd_box(hx - 10.0, hy, hz - 4.6, 0.6, 4.4, 1.3, 0.3), BRACKET, hx, hy, hz)
        h.add(sd_box(hx + 10.0, hay - 3.0, hz - 4.4, 0.6, 0.8, 2.4, 0.3), BRACKET, hx, hy, hz)
    return sc


def mats(p):
    phase = p['phase']

    def tread(q):
        k = (math.floor(-q.u / 1.6 + phase) & 1) == 0
        if q.nz > 0.5:
            return 36 if k else 35
        return 35 if k else 34

    def hull(q):
        if q.nz < 0.5 and abs(q.w + 0.6) < 0.3:
            return 49 if q.lvl < 2 else 50
        return None

    def bin_(q):
        if q.nz > 0.6:
            return None
        # ribs on the sides: a lit edge, the face, a shadow, every 2 units along the face
        s = q.u if abs(q.v) > BIN_HY - 0.6 else q.v
        f = (s / 2.0) % 1.0
        if f < 0.25:
            return [45, 46, 47, 47][q.lvl]
        if f > 0.75:
            return [44, 44, 45, 46][q.lvl]
        return None

    def core(q):
        # glows from inside: white where it faces up (the middle as seen from above), paling to
        # lavender round its foot
        return 9 if q.nz > 0.5 else 8 if q.nz > 0.25 else 53

    def lid_(q):
        # the core's glow spills onto the plate round the open hole
        if p['lid'] > 0 and q.nz > 0.5 and math.hypot(q.u - HOLE_X, q.v) < HOLE_R + 1.0:
            return 52
        return None

    def hatch(q):
        if q.w < -0.2:
            return [1, 1, 2, 6][q.lvl]   # its underside (it shows once thrown back)
        # a ring of bolts round the rim, on its outer face
        r = math.hypot(q.u, q.v)
        if q.w > 0.2 and HOLE_R - 0.5 < r < HOLE_R + 0.1:
            a = math.atan2(q.v, q.u)
            if (a / (2 * math.pi) * 8 + 0.5) % 1.0 < 0.3:
                return 8
        return None

    vis = {'dim': [49, 50, 50, 51], 'hot': [8, 9, 9, 9], 'lit': [52, 53, 53, 9]}[p['visor']]
    return {
        TREAD: Mat([34, 34, 35, 35], ink=0, paint=tread),
        WHEEL: Mat([1, 2, 6, 7], ink=0),
        HULL: Mat([49, 50, 51, 52], ink=0, paint=hull),
        BIN: Mat([44, 45, 46, 47], ink=0, paint=bin_),
        LID: Mat([44, 45, 46, 46], ink=0, paint=lid_),
        CAB: Mat([0, 49, 50, 51], ink=0),
        VISOR: Mat(vis, ink=0),
        LAMP: Mat(vis, ink=0, group=HULL),
        STACK: Mat([1, 2, 6, 7], ink=0),
        BRACKET: Mat([1, 2, 6, 7], ink=0),
        BOLT: Mat([6, 7, 8, 8], noInk=True),
        CORE: Mat([53, 8, 9, 9], ink=52, paint=core),
        HATCH: Mat([1, 2, 6, 7], ink=0, paint=hatch),
    }


def render(d, p):
    a = dir_angle(d)
    img, grid = sculpt(W, H, OX, OY, a, scene(p), mats(p), zmax=ZMAX, scale=K, outline=False)
    add_outline(img, 0)
    return img


def poses():
    P = lambda **k: {**P0, **k}  # noqa: E731
    return [
        ('stalk', 0, P()),
        ('stalk', 1, P(phase=1, lift=0.5)),
        ('windup', 0, P(lift=-1.2, pitch=0.12, visor='hot')),
        ('windup', 1, P(lift=-1.6, pitch=0.16, visor='hot')),
        ('charge', 0, P(lift=-0.4, pitch=0.18, fwd=1, visor='hot')),
        ('charge', 1, P(phase=1, lift=-0.4, pitch=0.18, fwd=1, visor='hot')),
        ('stunned', 0, P(lift=-1.8, pitch=0.06, roll=0.08, visor='dim')),
        ('stunned', 1, P(lift=-1.8, pitch=0.06, roll=0.12, visor='dim')),
        ('crouch', 0, P(lift=-2.2, pitch=0.1, visor='hot', lid=1)),
        ('crouch', 1, P(lift=-2.6, pitch=0.1, visor='hot', lid=1)),
        ('skid', None, P(pitch=-0.12, fwd=-1, roll=0.05)),
        ('air', None, P(pitch=0.1, lid=1, sink=0.8)),
        ('land', None, P(lift=-2.0, roll=0.06, visor='dim', lid=1, sink=0.6)),
    ]


# ---------------------------------------------------------------- composites, like the renderer

def jsround(v):
    return math.floor(v + 0.5)


def mount(d, dist, lift, front):
    """rearMount / frontMount (src/data/mounts.ts): (dx, dy, behind)."""
    a = dir_angle(d)
    s = 1 if front else -1
    dx = jsround(s * math.cos(a) * dist)
    dy = jsround(s * math.sin(a) * dist * 0.6) - lift
    behind = math.sin(a) < -0.1 if front else math.sin(a) > 0.1
    return dx, dy, behind


CW, CH, CAX, CAY = 88, 80, 44, 56   # composite frame and its anchor


#: px the renderer lowers the boss's mounts by in a pose that sits low (its mount lift is 7 px)
MOUNT_DROP = {'windup': 5, 'charge': 6, 'stunned': 4}


def compose(body, d, parts, plume=None, drop=0):
    """The body with its parts on, drawn as drawEnemy does (src/render/renderer.ts)."""
    out = blank(CW, CH)
    rm = mount(d, 20, 7 - drop, False)
    fm = mount(d, 22, 7 - drop, True)

    def put32(img, m):
        stamp(out, img, CAX + m[0] - 16, CAY + m[1] - 16)

    def rear():
        if 'booster' in parts:
            if plume is not None:
                put32(plume, rm)
            put32(parts['booster'], rm)

    def front():
        if 'plow' in parts:
            put32(parts['plow'], fm)
    if 'springs' in parts:
        stamp(out, parts['springs'], CAX - OX, CAY - OY)
    if rm[2]:
        rear()
    if fm[2]:
        front()
    stamp(out, body, CAX - OX, CAY - OY)
    if not rm[2]:
        rear()
    if not fm[2]:
        front()
    if 'springs' in parts and DIRS[d] not in ('n', 's'):
        near = [row[:] if y > OY else [-1] * len(row) for y, row in enumerate(parts['springs'])]
        stamp(out, near, CAX - OX, CAY - OY)
    return out


def shadow_xl():
    w, h = 56, 16
    img = blank(w, h)
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2)
            if dx * dx + dy * dy <= 1 and (x + y) % 2 == 0:
                img[y][x] = 0
    return img


def scene_1x(cells, cols, path, scale):
    """cells: list of composites (CW x CH, anchor CAX, CAY), laid out on the floor at 1x with the
    xl shadow, then scaled."""
    rows = (len(cells) + cols - 1) // cols
    cv = Canvas(cols * 72 + 16, rows * 64 + 16)
    sh = shadow_xl()
    for i, c in enumerate(cells):
        r, k = divmod(i, cols)
        x, y = 44 + k * 72, 50 + r * 64
        if c is None:
            continue
        img, lift = c if isinstance(c, tuple) else (c, 0)
        cv.draw(sh, x, y + 1, 28, 8, shadow=True)
        cv.draw(img, x, y - lift, CAX, CAY)
    return cv.save(path, scale)


def preview(want=None):
    import time
    t0 = time.time()
    ps = [x for x in poses() if not want or x[0] in want]
    bodies = {(d, s, f): render(d, p) for d in range(8) for s, f, p in ps}
    print('bodies %.1fs' % (time.time() - t0))
    from bossparts import booster, plow, springs, plume
    P = {d: {'booster': booster(d)[0], 'plow': plow(d)[0], 'springs': springs(d)[0]} for d in range(8)}
    rows = [(dn, [bodies[(d, s, f)] for s, f, _ in ps]) for d, dn in enumerate(DIRS)]
    label_sheet(rows, 3, PREV / 'compactor-states.png')
    cells = []
    for s, f, _ in ps:
        for d in range(8):
            whole = s in ('stalk', 'windup', 'charge', 'stunned', 'skid')
            pl = plume(d, f or 0) if s == 'charge' else None
            cells.append(compose(bodies[(d, s, f)], d, P[d] if whole else {}, pl, MOUNT_DROP.get(s, 0)))
    scene_1x(cells, 8, PREV / 'compactor-1x.png', 1)
    scene_1x(cells, 8, PREV / 'compactor-3x.png', 3)
    print('done %.1fs' % (time.time() - t0))


def parts_preview():
    from bossparts import booster, plow, springs, plume
    from sculpt import grid_sheet
    grid_sheet([(dn, springs(d)[0]) for d, dn in enumerate(DIRS)], 4, PREV / 'compactor-springs.png', cols=4)
    small = [(f'b {dn}', booster(d)[0]) for d, dn in enumerate(DIRS)] + [(f'p {dn}', plow(d)[0]) for d, dn in enumerate(DIRS)]
    small += [(f'fl {dn}{f}', plume(d, f)) for d, dn in enumerate(DIRS) for f in (0, 1)]
    grid_sheet(small, 5, PREV / 'compactor-parts.png', cols=8)


def name(state, dn, f):
    return f'bo:compactor:{state}:{dn}' + (f':{f}' if f is not None else '')


def main():
    from bossparts import plow, springs
    from sculpt import to_image, isolated, colors_used, bbox
    from PIL import Image
    import json
    ps = poses()
    rows = []
    for d, dn in enumerate(DIRS):
        rows.append([(name(s, dn, f), render(d, p)) for s, f, p in ps])
    spr = [(f'bo:part:springs:{dn}', springs(d)[0]) for d, dn in enumerate(DIRS)]
    plows = [(f'bo:part:plow:{dn}', plow(d)[0]) for d, dn in enumerate(DIRS)]
    ncol = len(rows[0])
    sheet = Image.new('RGBA', (W * ncol, H * 9 + 32), (0, 0, 0, 0))
    recipe = []
    for r, row in enumerate(rows):
        for c, (n, img) in enumerate(row):
            sheet.paste(to_image(img), (c * W, r * H))
            recipe.append({'match': n, 'file': 'compactor.png', 'rect': [c * W, r * H, W, H], 'frame': [W, H], 'origin': [OX, OY]})
    for c, (n, img) in enumerate(spr):
        sheet.paste(to_image(img), (c * W, 8 * H))
        recipe.append({'match': n, 'file': 'compactor.png', 'rect': [c * W, 8 * H, W, H], 'frame': [W, H], 'origin': [OX, OY]})
    for c, (n, img) in enumerate(plows):
        sheet.paste(to_image(img), (c * 32, 9 * H))
        recipe.append({'match': n, 'file': 'compactor.png', 'rect': [c * 32, 9 * H, 32, 32], 'frame': [32, 32], 'origin': [16, 16]})
    sheet.save(HERE / 'compactor.png')
    with open(HERE / 'sprites.json', 'w', newline='\n') as f:
        json.dump({'name': 'compactor', 'kind': 'sprites', 'scale': 1,
                   'defaults': {'place': 'none', 'keepStrays': True}, 'sprites': recipe}, f, indent=1)
    frames = [img for row in rows for _, img in row] + [i for _, i in spr] + [i for _, i in plows]
    for n, img in [x for row in rows for x in row] + spr + plows:
        edges = [e for e, hit in (('top', any(c >= 0 for c in img[0])), ('bottom', any(c >= 0 for c in img[-1])),
                                  ('left', any(r[0] >= 0 for r in img)), ('right', any(r[-1] >= 0 for r in img))) if hit]
        if edges:
            print(f'  NOTE {n}: art touches the frame edge ({", ".join(edges)})')
    b = [bbox(img) for row in rows for _, img in row]
    print('body art: %d-%d wide, %d-%d tall' % (min(x[2] - x[0] + 1 for x in b), max(x[2] - x[0] + 1 for x in b),
                                               min(x[3] - x[1] + 1 for x in b), max(x[3] - x[1] + 1 for x in b)))
    print('compactor: %d frames, colors %s, isolated px %d' % (len(frames), colors_used(frames), sum(len(isolated(f)) for f in frames)))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'parts':
        parts_preview()
    elif len(sys.argv) > 1 and sys.argv[1] == 'build':
        main()
    else:
        preview(sys.argv[1].split(',') if len(sys.argv) > 1 else None)
