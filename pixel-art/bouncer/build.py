"""The Bouncer (M6): a round chrome pinball of a bot in a ring of coil springs. It rolls at you and
its rolls bounce off walls and pillars.

32x32 frames, anchor (16,20), collision r = 9. A chrome ball (cool neutrals 5-8, white 9 highlight)
painted by what it reflects: pale sky above its horizon line, the floor below it, a lit rim; a dark
visor slit high on its front with a lit eye (blue-slate 44-47, never the speed blue 48); a little
vent grille on its back, so it faces somewhere from behind too; a blue-slate cap on top; a dark belt
low round its middle, level with the Springs' coils. Drawn WITHOUT its springs: they are the
`part:springs` overlay (pixel-art/parts6), drawn under it, the coils against the belt.

States (STYLE.md): idle (2, a bob), windup (2, squashed down, the eye white-hot), roll (2, the shell
spins under the fixed visor and cap: two blue bands round it turn 45 degrees between the frames, a
"+" and an "x", with speed dashes behind), stunned (2, dizzy, wobbling side to side, the eye out).
All 8 directions are rendered from the model, never mirrored.

Run: python pixel-art/bouncer/build.py -> bouncer.png (1x sheet: 8 rows = e se s sw w nw n ne,
8 columns = idle0 idle1 windup0 windup1 roll0 roll1 stunned0 stunned1), sprites.json, previews
in e2e/out/pixel-art/.
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
from sculpt import (DIRS, Mat, sculpt, dir_angle, sd_cyl, unroll, project,  # noqa: E402
                    put, get, isolated, colors_used, label_sheet, Canvas, shadow_img, to_image,
                    despeckle, add_outline, blank, stamp, LIGHT)
from PIL import Image  # noqa: E402
import model as parts  # noqa: E402

PREV = ROOT / 'e2e/out/pixel-art'
W = H = 32
OX, OY = 16, 20
ZMAX = 18

SHELL, VISOR, CAP, BELT = range(4)
R = 7.6          # ball radius
CZ = 7.8         # ball center height
BELT_Z = 3.4     # the belt, level with the springs' coils
VIS_Z = 4.2      # the visor slit, high on its front (it looks forward and up)
VIEW = (0.0, -0.8, -0.6)   # the camera ray (world): north and down

BASE = dict(lift=0.0, squash=1.0, widen=1.0, lean=0.0, spin=None, eye='lit', streak=-1)


def scene(p):
    lift, sq, wd, lean = p['lift'], p['squash'], p['widen'], p['lean']

    def sc(h, x, y, z):
        # the posed ball: squashed about the ground, leaning (dizzy) about its contact point
        by, bz = unroll(y, z - lift, lean, 0.0, 0.0)
        bx = x / wd
        by = by / wd
        bz = bz / sq
        k = min(sq, wd, 1.0)
        ox, oy, oz = bx, by, bz - CZ
        h.add((math.sqrt(ox * ox + oy * oy + oz * oz) - R) * k, SHELL, ox, oy, oz)
        # the belt: a dark band round the ball low down, standing a little proud of the shell
        r = math.sqrt(bx * bx + by * by)
        rb = math.sqrt(max(0.0, R * R - (BELT_Z - CZ) ** 2)) + 1.1
        h.add(max(r - rb, abs(bz - BELT_Z) - 1.0) * k, BELT, bx, by, bz)
        # the cap on top
        h.add(sd_cyl(bz - (CZ + R + 0.2), bx, by, 2.2, 0.75, 0.5) * k, CAP, bx, by, bz)
    return sc


def mats(p):
    spin = p['spin']
    eye = p['eye']

    def shell(q):
        # chrome: the colour of what the shell reflects. q.u, q.v, q.w = the point on the ball
        # (body frame, unposed), q.nx/ny/nz = the world normal.
        nx, ny, nz = q.nx, q.ny, q.nz
        d = VIEW[0] * nx + VIEW[1] * ny + VIEW[2] * nz
        rx, ry, rz = VIEW[0] - 2 * d * nx, VIEW[1] - 2 * d * ny, VIEW[2] - 2 * d * nz
        spec = rx * LIGHT[0] + ry * LIGHT[1] + rz * LIGHT[2]
        # the visor slit: a dark band across the front, above the middle
        lu, lv, lw = q.u, q.v, q.w
        ang = math.atan2(lv, lu)
        if lu > 0 and abs(ang) < 0.62 and abs(lw - VIS_Z) < 0.8:
            if eye != 'dim' and abs(ang + 0.2) < 0.2 and abs(lw - VIS_Z) < 0.55:
                return 47 if eye == 'hot' else 46        # the eye, lit
            if eye == 'hot' and abs(ang) < 0.45 and abs(lw - VIS_Z) < 0.4:
                return 46
            return 44 if lw > VIS_Z else 0
        # a little vent grille on its back, so it faces somewhere from behind too
        if lu < 0 and abs(abs(ang) - math.pi) < 0.3 and abs(lw - VIS_Z) < 0.75:
            return 1 if (abs(lw - VIS_Z) > 0.3) else 6
        # the spinning bands: great circles through the ball's sides (its roll axis is y)
        if spin is not None:
            for phi in (spin, spin + math.pi / 2):
                # distance from the plane through the center that holds the y axis, turned phi
                dist = abs(lu * math.cos(phi) - lw * math.sin(phi))
                if dist < 0.75:
                    return 45 if rz > 0.1 else 44
        lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        if spec > 0.9:
            return 9
        if rz > 0.08:
            # the sky: pale, brightest toward the light, steel on the shadow side
            return 8 if lit > 0.45 else 7 if lit > -0.15 else 6
        if rz > -0.1:
            return 5 if lit > 0 else 1      # the horizon line
        # the floor, reflected: mid steel, plum away from the light, a lit rim at the very edge
        if abs(d) < 0.25 and lit > -0.4:
            return 7
        return 6 if lit > -0.45 else 5

    return {
        SHELL: Mat([5, 6, 7, 8], ink=1, paint=shell),
        VISOR: Mat([0, 44, 44, 45], ink=0),
        CAP: Mat([44, 45, 46, 47], ink=44),
        BELT: Mat([1, 2, 2, 6], ink=0),
    }


def streaks(img, angle, frame):
    """Speed dashes behind a rolling Bouncer: pale-steel dashes (2 px on, 2 off, marching back a
    step per frame) on empty pixels only, like the Snapper's snap."""
    lanes = [(-5.0, 3.0, 6), (5.0, 3.0, 6), (0.0, 8.0, 5)]
    for i, (yy, zz, ln) in enumerate(lanes):
        x0 = -8.6 - (i % 2)
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
    img, grid = sculpt(W, H, OX, OY, a, scene(p), mats(p), zmax=ZMAX, zmin=0, outline=False)
    despeckle(img, set())
    add_outline(img, 0)
    if p['streak'] >= 0:
        streaks(img, a, p['streak'])
    return img


def poses():
    P = lambda **k: {**BASE, **k}  # noqa: E731
    return [
        ('idle', 0, P()),
        ('idle', 1, P(lift=0.7)),
        ('windup', 0, P(squash=0.86, widen=1.07, eye='hot')),
        ('windup', 1, P(squash=0.78, widen=1.11, eye='hot')),
        ('roll', 0, P(spin=0.0, eye='hot', streak=0, lift=0.2)),
        ('roll', 1, P(spin=math.pi / 4, eye='hot', streak=1, lift=0.2)),
        ('stunned', 0, P(lean=0.24, eye='dim', squash=0.95)),
        ('stunned', 1, P(lean=-0.24, eye='dim', squash=0.95)),
    ]


def name(state, dn, f):
    return f'en:bouncer:{state}:{dn}:{f}'


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
            recipe.append({'match': n, 'file': 'bouncer.png', 'rect': [c * W, r * H, W, H]})
    sheet.save(HERE / 'bouncer.png')
    with open(HERE / 'sprites.json', 'w', newline='\n') as f:
        json.dump({'name': 'bouncer', 'kind': 'sprites', 'scale': 1,
                   'defaults': {'frame': [W, H], 'origin': [OX, OY], 'place': 'none', 'keepStrays': True},
                   'sprites': recipe}, f, indent=1)
    # previews: bare, and with the springs under it (near rows over it, like the renderer)
    springs = {}
    for d in range(8):
        a = dir_angle(d)
        im, gr = sculpt(32, 32, 16, 20, a, parts.springs_scene, parts.springs_mats(), zmax=7, outline=False)
        parts.coil_turns(im, gr, a)
        add_outline(im, 0)
        springs[d] = im

    def with_springs(img, d):
        out = blank(W, H)
        stamp(out, springs[d], 0, 0)
        stamp(out, img, 0, 0)
        if DIRS[d] not in ('n', 's'):
            near = [row[:] if y > OY else [-1] * W for y, row in enumerate(springs[d])]
            stamp(out, near, 0, 0)
        return out
    label_sheet([(dn, [img for _, img in row]) for dn, row in zip(DIRS, rows)], 4, PREV / 'bouncer-states.png')
    label_sheet([(dn, [with_springs(img, d) for _, img in row]) for d, (dn, row) in enumerate(zip(DIRS, rows))], 4, PREV / 'bouncer-springs.png')
    cv = Canvas(40 * ncol + 8, 40 * 16 + 8)
    for r, row in enumerate(rows):
        for c, (n, img) in enumerate(row):
            for k, im in enumerate((img, with_springs(img, r))):
                x, y = 22 + c * 40, 26 + (r * 2 + k) * 40
                cv.draw(shadow_img('m'), x, y + 1, 12, 4, shadow=True)
                cv.draw(im, x, y, OX, OY)
    cv.save(PREV / 'bouncer-1x.png', 1)
    cv.save(PREV / 'bouncer-3x.png', 3)
    used = colors_used(frames)
    iso = sum(len(isolated(f)) for f in frames)
    print('bouncer: %d frames, colors %s, isolated px %d' % (len(frames), used, iso))


if __name__ == '__main__':
    main()
