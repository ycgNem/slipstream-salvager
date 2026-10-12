"""The pixel sculptor, in Python, for the pixel-art build scripts.

A faithful port of src/render/art/code/sculpt.ts (the code-drawn placeholders use it), so the art
drawn here sits in the same world: the same 3/4 camera (ground depth 0.6 px per unit, height 0.8),
the same light from the upper left, the same four light bands, the same inked internal edges and
the 1 px plum outline. Every direction is rendered from the model; nothing is rotated as an image.

On top of the port, the build scripts place pixels by hand (glints, eyes, teeth, cleanup), so the
model is the armature and the script is the artist.

Coordinates: body-local units of one pixel, x forward, y to the body's right, z up, the anchor (the
center of the footprint) at the origin. Palette indices into Resurrect 64 everywhere.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

# the pixel-art-studio skill (repo copy first, then the user-level install)
_local = Path(__file__).resolve().parents[2] / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

PALETTE = [
    '#2e222f', '#3e3546', '#625565', '#966c6c', '#ab947a',
    '#694f62', '#7f708a', '#9babb2', '#c7dcd0', '#ffffff',
    '#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#ae2334', '#e83b3b',
    '#fb6b1d', '#f79617', '#f9c22b',
    '#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954',
    '#4c3e24', '#676633', '#a2a947', '#d5e04b', '#fbff86',
    '#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c',
    '#313638', '#374e4a', '#547e64', '#92a984', '#b2ba90',
    '#0b5e65', '#0b8a8f', '#0eaf9b', '#30e1b9', '#8ff8e2',
    '#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff',
    '#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded',
    '#753c54', '#a24b6f', '#cf657f', '#ed8099',
    '#831c5d', '#c32454', '#f04f78', '#f68181', '#fca790', '#fdcbb0',
]
RGB = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in PALETTE]

DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']
SQ = 0.6   # screen px per unit of ground depth
HT = 0.8   # screen px per unit of height

_LX, _LY, _LZ = -0.58, -0.36, 0.73
_LN = math.sqrt(_LX * _LX + _LY * _LY + _LZ * _LZ)
LIGHT = (_LX / _LN, _LY / _LN, _LZ / _LN)


def dir_angle(d: int) -> float:
    return (d % 8) * (math.pi / 4)


# ---------------------------------------------------------------- hits and pixels

class Hit:
    __slots__ = ('d', 'm', 'u', 'v', 'w')

    def __init__(self):
        self.d = 1e9; self.m = -1; self.u = 0.0; self.v = 0.0; self.w = 0.0

    def reset(self):
        self.d = 1e9; self.m = -1

    def add(self, d, m, u=0.0, v=0.0, w=0.0):
        if d < self.d:
            self.d = d; self.m = m; self.u = u; self.v = v; self.w = w


class Px:
    __slots__ = ('m', 'lvl', 't', 'X', 'Y', 'Z', 'x', 'y', 'z', 'u', 'v', 'w', 'nx', 'ny', 'nz', 'c', 'ink', 'diff')

    def __init__(self, **k):
        for a, b in k.items():
            setattr(self, a, b)


class Mat:
    """A material: dark -> light ramp by light level (4 entries), ink for the far side of an
    internal edge, a group (edges inside one group aren't inked), an optional paint(p) hook that
    returns a palette index or None, and noInk for thin details."""

    def __init__(self, ramp, ink=None, group=None, paint=None, noInk=False):
        self.ramp = list(ramp); self.ink = ink; self.group = group; self.paint = paint; self.noInk = noInk


# ---------------------------------------------------------------- the sculptor

def sculpt(w, h, ox, oy, angle, scene, mats, zmax, zmin=0.0, scale=1.0, bands=(-0.22, 0.32, 0.86),
           ink_jump=2.6, outline=True, view=(SQ, HT), bound=None):
    """Render a model into a w x h index image (list of rows, -1 = empty). Returns (img, grid);
    grid[y][x] is a Px or None, for hand-placed details afterwards. `bound` = (cx, cy, r) in body
    units skips rays that can't come near the model (speed only)."""
    k = scale
    sq, ht = view
    ca, sa = math.cos(angle), math.sin(angle)
    grid = [[None] * w for _ in range(h)]
    Z0 = zmax + 0.5
    t_end = (Z0 - zmin) / sq + 0.5
    dY, dZ = -ht, -sq
    hit = Hit()

    def ev(X, Y, Z):
        hit.reset()
        scene(hit, X * ca + Y * sa, -X * sa + Y * ca, Z)
        return hit.d

    for py in range(h):
        for pxl in range(w):
            sx = (pxl + 0.5 - ox) / k
            sy = (py + 0.5 - oy) / k
            X = sx
            Y0 = (sy + ht * Z0) / sq
            t = 0.0
            ok = False
            for _ in range(160):
                if t > t_end:
                    break
                d = ev(X, Y0 + dY * t, Z0 + dZ * t)
                if d < 0.015:
                    ok = True
                    break
                t += max(d * 0.8, 0.015)
            if not ok:
                continue
            Y = Y0 + dY * t
            Z = Z0 + dZ * t
            hit.reset()
            lx, ly = X * ca + Y * sa, -X * sa + Y * ca
            scene(hit, lx, ly, Z)
            m, u, v, ww = hit.m, hit.u, hit.v, hit.w
            e = 0.3
            nx = ev(X + e, Y, Z) - ev(X - e, Y, Z)
            ny = ev(X, Y + e, Z) - ev(X, Y - e, Z)
            nz = ev(X, Y, Z + e) - ev(X, Y, Z - e)
            nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            nx /= nl; ny /= nl; nz /= nl
            diff = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
            lvl = 3 if diff > bands[2] else 2 if diff > bands[1] else 1 if diff > bands[0] else 0
            grid[py][pxl] = Px(m=m, lvl=lvl, t=t, X=X, Y=Y, Z=Z, x=lx, y=ly, z=Z, u=u, v=v, w=ww,
                               nx=nx, ny=ny, nz=nz, c=-1, ink=False, diff=diff)

    # lone light-level pixels inside one material (shading speckle)
    for _ in range(2):
        for py in range(1, h - 1):
            for pxl in range(1, w - 1):
                p = grid[py][pxl]
                if not p:
                    continue
                n4 = [grid[py][pxl - 1], grid[py][pxl + 1], grid[py - 1][pxl], grid[py + 1][pxl]]
                if any((q is None or q.m != p.m) for q in n4):
                    continue
                if all(q.lvl != p.lvl for q in n4):
                    counts = [0, 0, 0, 0]
                    for q in n4:
                        counts[q.lvl] += 1
                    best = max(range(4), key=lambda l: (counts[l], -l))
                    if counts[best] >= 3:
                        p.lvl = best

    def grp(m):
        mt = mats.get(m) if isinstance(mats, dict) else (mats[m] if 0 <= m < len(mats) else None)
        return mt.group if (mt and mt.group is not None) else m

    def mat(m):
        if isinstance(mats, dict):
            return mats.get(m)
        return mats[m] if 0 <= m < len(mats) else None

    for py in range(h):
        for pxl in range(w):
            p = grid[py][pxl]
            if not p:
                continue
            mp = mat(p.m)
            if mp and mp.noInk:
                continue
            nb = [grid[py][pxl - 1] if pxl > 0 else None, grid[py][pxl + 1] if pxl < w - 1 else None,
                  grid[py - 1][pxl] if py > 0 else None, grid[py + 1][pxl] if py < h - 1 else None]
            for q in nb:
                if not q:
                    continue
                mq = mat(q.m)
                if mq and mq.noInk:
                    continue
                if q.t >= p.t - 0.2:
                    continue
                gap = math.sqrt((p.X - q.X) ** 2 + (p.Y - q.Y) ** 2 + (p.Z - q.Z) ** 2)
                if gap > ink_jump or (grp(q.m) != grp(p.m) and gap > 0.9):
                    p.ink = True
                    break

    img = [[-1] * w for _ in range(h)]
    for py in range(h):
        for pxl in range(w):
            p = grid[py][pxl]
            if not p:
                continue
            mp = mat(p.m)
            if not mp:
                p.c = 0
            elif p.ink:
                p.c = mp.ink if mp.ink is not None else (0 if p.lvl == 0 else mp.ramp[0])
            else:
                c = mp.paint(p) if mp.paint else None
                p.c = c if c is not None else mp.ramp[min(p.lvl, len(mp.ramp) - 1)]
            img[py][pxl] = p.c
    if outline:
        add_outline(img, 0)
    return img, grid


# ---------------------------------------------------------------- signed distances

def sd_box(x, y, z, hx, hy, hz, r=0.0):
    qx = abs(x) - hx + r; qy = abs(y) - hy + r; qz = abs(z) - hz + r
    mx = qx if qx > 0 else 0.0; my = qy if qy > 0 else 0.0; mz = qz if qz > 0 else 0.0
    inner = max(qx, qy, qz)
    return math.sqrt(mx * mx + my * my + mz * mz) + (inner if inner < 0 else 0.0) - r


def sd_ellipsoid(x, y, z, rx, ry, rz):
    k0 = math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2)
    k1 = math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2)
    return -min(rx, ry, rz) if k1 == 0 else (k0 * (k0 - 1)) / k1


def sd_cyl(a, b, c, rad, hl, rnd=0.0):
    """Cylinder along an axis: a = along the axis, b, c across it, half length hl."""
    dr = math.sqrt(b * b + c * c) - rad + rnd
    da = abs(a) - hl + rnd
    return min(max(dr, da), 0.0) + math.sqrt(max(dr, 0.0) ** 2 + max(da, 0.0) ** 2) - rnd


def sd_frustum(a, b, c, a0, r0, a1, r1):
    s = min(1.0, max(0.0, (a - a0) / (a1 - a0)))
    rad = r0 + (r1 - r0) * s
    slope = (r1 - r0) / (a1 - a0)
    side = (math.sqrt(b * b + c * c) - rad) / math.sqrt(1 + slope * slope)
    cap = max(a0 - a, a - a1)
    return max(side, cap)


def sd_capsule(x, y, z, ax, ay, az, bx, by, bz, r):
    pax, pay, paz = x - ax, y - ay, z - az
    bax, bay, baz = bx - ax, by - ay, bz - az
    hh = min(1.0, max(0.0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)))
    return math.sqrt((pax - bax * hh) ** 2 + (pay - bay * hh) ** 2 + (paz - baz * hh) ** 2) - r


def unpitch(x, z, ang, px_, pz):
    """Undo a pitch (nose down for ang > 0) about (px_, pz). Returns (x, z)."""
    if not ang:
        return x, z
    c, s = math.cos(ang), math.sin(ang)
    dx, dz = x - px_, z - pz
    return px_ + dx * c - dz * s, pz + dx * s + dz * c


def unroll(y, z, ang, py_, pz):
    """Undo a roll (right side down for ang > 0) about (py_, pz). Returns (y, z)."""
    if not ang:
        return y, z
    c, s = math.cos(ang), math.sin(ang)
    dy, dz = y - py_, z - pz
    return py_ + dy * c - dz * s, pz + dy * s + dz * c


def unyaw(x, y, ang):
    if not ang:
        return x, y
    c, s = math.cos(ang), math.sin(ang)
    return x * c + y * s, -x * s + y * c


def project(angle, x, y, z):
    """Screen offset (from the anchor) of a body-local point for a facing angle."""
    c, s = math.cos(angle), math.sin(angle)
    X = x * c - y * s
    Y = x * s + y * c
    return X, Y * SQ - z * HT


class Painter:
    """Hand-placed details on a sculpted frame, positioned in 3D and depth-tested against the
    sculpt, so an eye or a tooth lands exactly where it belongs in every direction and hides
    behind whatever is nearer the camera. Units and frame as in sculpt()."""

    def __init__(self, img, grid, angle, ox, oy, zmax, view=(SQ, HT)):
        self.img, self.grid, self.ox, self.oy = img, grid, ox, oy
        self.ca, self.sa = math.cos(angle), math.sin(angle)
        self.sq, self.ht = view
        self.Z0 = zmax + 0.5
        self.mark = set()

    def screen(self, x, y, z):
        """Body-local point -> (pixel x, pixel y, ray depth t)."""
        X = x * self.ca - y * self.sa
        Y = x * self.sa + y * self.ca
        sx = X + self.ox
        sy = Y * self.sq - z * self.ht + self.oy
        # the ray through this pixel starts at height Z0; depth t = distance along it
        t = (self.Z0 - z) / self.sq
        return int(math.floor(sx)), int(math.floor(sy)), t

    def visible(self, x, y, z, eps=0.8, normal=None):
        px_, py_, t = self.screen(x, y, z)
        h, w = len(self.img), len(self.img[0])
        if not (0 <= px_ < w and 0 <= py_ < h):
            return None
        g = self.grid[py_][px_]
        if g is None:
            return (px_, py_, False)
        if g.t < t - eps:
            return None
        # the surface seen in this pixel must be the one the detail sits on (not a nearer face of
        # the same part seen from behind)
        if g.t < t + eps and math.sqrt((g.x - x) ** 2 + (g.y - y) ** 2 + (g.z - z) ** 2) > max(1.25, eps):
            return None
        if normal is not None:
            # the face seen here must point the way the detail's face does (body-local normal)
            nx, ny, nz = normal
            wx = nx * self.ca - ny * self.sa
            wy = nx * self.sa + ny * self.ca
            if g.nx * wx + g.ny * wy + g.nz * nz < 0.35:
                return None
        return (px_, py_, True)

    def dot(self, x, y, z, c, on_empty=False, eps=0.8, only=None, normal=None):
        v = self.visible(x, y, z, eps, normal)
        if not v:
            return False
        px_, py_, solid = v
        if not solid and not on_empty:
            return False
        if only is not None and solid and self.grid[py_][px_].m not in only:
            return False
        self.img[py_][px_] = c
        self.mark.add((px_, py_))
        return True

    def line(self, a, b, c, steps=None, **kw):
        n = steps or max(2, int(math.dist(a, b) * 2.5))
        for i in range(n + 1):
            t = i / n
            self.dot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, c, **kw)


def despeckle(img, keep=()):
    """A pixel whose four neighbors all share one other color takes that color (sculpt noise),
    except pixels in `keep` (hand-placed details)."""
    h, w = len(img), len(img[0])
    out = [row[:] for row in img]
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = img[y][x]
            if c < 0 or (x, y) in keep:
                continue
            n = {img[y][x - 1], img[y][x + 1], img[y - 1][x], img[y + 1][x]}
            if len(n) == 1:
                o = n.pop()
                if o >= 0 and o != c:
                    out[y][x] = o
    for y in range(h):
        img[y][:] = out[y]


# ---------------------------------------------------------------- index-image helpers

def blank(w, h):
    return [[-1] * w for _ in range(h)]


def add_outline(img, color=0):
    h, w = len(img), len(img[0])
    on = [[img[y][x] >= 0 for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if on[y][x]:
                continue
            if (x > 0 and on[y][x - 1]) or (x < w - 1 and on[y][x + 1]) or (y > 0 and on[y - 1][x]) or (y < h - 1 and on[y + 1][x]):
                img[y][x] = color


def put(img, x, y, c, only=None):
    """Set a pixel; only = None (any), 'opaque', 'empty', or a palette index / set to paint over."""
    h, w = len(img), len(img[0])
    if not (0 <= x < w and 0 <= y < h):
        return
    cur = img[y][x]
    if only == 'opaque' and cur < 0:
        return
    if only == 'empty' and cur >= 0:
        return
    if isinstance(only, int) and cur != only:
        return
    if isinstance(only, (set, frozenset, tuple, list)) and cur not in only:
        return
    img[y][x] = c


def get(img, x, y):
    h, w = len(img), len(img[0])
    return img[y][x] if 0 <= x < w and 0 <= y < h else -1


def stamp(dst, src, dx, dy):
    """Draw src over dst (non-empty pixels win), src's (0,0) at dst (dx, dy)."""
    for y, row in enumerate(src):
        for x, c in enumerate(row):
            if c >= 0:
                put(dst, x + dx, y + dy, c)


def bline(img, x0, y0, x1, y1, c, only=None):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        put(img, x0, y0, c, only)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy


def bbox(img):
    xs = [x for row in img for x, c in enumerate(row) if c >= 0]
    ys = [y for y, row in enumerate(img) if any(c >= 0 for c in row)]
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def isolated(img):
    """Opaque pixels with no opaque 4-neighbor (the importer drops these unless keepStrays)."""
    h, w = len(img), len(img[0])
    out = []
    for y in range(h):
        for x in range(w):
            if img[y][x] >= 0 and all(get(img, x + a, y + b) < 0 for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.append((x, y))
    return out


def colors_used(imgs):
    s = set()
    for img in imgs:
        for row in img:
            for c in row:
                if c >= 0:
                    s.add(c)
    return sorted(s)


BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]


def keep(x, y, t):
    """Ordered-dither test, same as src/render/art/code/common.ts."""
    return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < t


# ---------------------------------------------------------------- export and preview

def to_image(img, scale=1, bg=None):
    h, w = len(img), len(img[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0) if bg is None else bg)
    p = im.load()
    for y in range(h):
        for x in range(w):
            c = img[y][x]
            if c >= 0:
                p[x, y] = RGB[c] + (255,)
    if scale != 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    return im


def save_strip(path, frames):
    """Frames (index images, all the same size) side by side at 1x."""
    h, w = len(frames[0]), len(frames[0][0])
    sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(to_image(f), (i * w, 0))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def floor_tile():
    """A stand-in for t:floor:0 (plum deck plate with a dark seam), for previews."""
    t = [[1] * 16 for _ in range(16)]
    for x in range(16):
        t[0][x] = 0
    for y in range(1, 16):
        t[y][5] = 0
    t[3][3] = 2
    t[12][7] = 2
    return t


def floor_image(w, h):
    tile = to_image(floor_tile())
    im = Image.new('RGBA', (w, h))
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            im.paste(tile, (x, y))
    return im


SHADOWS = {'s': (16, 6), 'm': (24, 8), 'l': (32, 10)}


def shadow_img(size):
    """A stand-in for fx:shadow: plum 0, checker-dithered ellipse (centered)."""
    w, h = SHADOWS[size]
    img = blank(w, h)
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / (w / 2), (y + 0.5 - cy) / (h / 2)
            r = dx * dx + dy * dy
            if r < 1 and (r < 0.45 or (x + y) % 2 == 0):
                img[y][x] = 0
    return img


class Canvas:
    """A 1x composition canvas (RGBA) for previews: place sprites by anchor like the renderer."""

    def __init__(self, w, h, floor=True):
        self.im = floor_image(w, h) if floor else Image.new('RGBA', (w, h), RGB[1] + (255,))

    def draw(self, img, x, y, ox, oy, shadow=False):
        """Draw index image `img` with anchor (ox, oy) at (x, y). shadow=True: 50% darken pixels."""
        src = to_image(img)
        if shadow:
            # the in-game shadow is plum at ~35%: darken instead of covering
            px_ = src.load()
            dst = self.im.load()
            for yy in range(src.height):
                for xx in range(src.width):
                    if px_[xx, yy][3]:
                        X, Y = x - ox + xx, y - oy + yy
                        if 0 <= X < self.im.width and 0 <= Y < self.im.height:
                            r, g, b, a = dst[X, Y]
                            dst[X, Y] = (int(r * 0.65 + 46 * 0.35), int(g * 0.65 + 34 * 0.35), int(b * 0.65 + 47 * 0.35), 255)
            return
        self.im.alpha_composite(src, (x - ox, y - oy))

    def save(self, path, scale):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.im.resize((self.im.width * scale, self.im.height * scale), Image.NEAREST).save(path)
        return path


def compose(layers, w, h):
    """Stack index images (each with its own anchor) into one w x h index image at anchor (w//2,
    h//2 + 4): layers = [(img, ox, oy), ...] bottom first. Handy for body + part previews."""
    out = blank(w, h)
    ax, ay = w // 2, h // 2 + 4
    for img, ox, oy in layers:
        stamp(out, img, ax - ox, ay - oy)
    return out


def grid_sheet(cells, scale, path, cols=6, pad=6, floor=True, bg=(29, 22, 32)):
    """cells: list of (label, index image). One cell each at `scale`, labelled, on a floor."""
    font = ImageFont.load_default()
    cw = max(len(im[0]) for _, im in cells)
    ch = max(len(im) for _, im in cells)
    cols = max(1, min(cols, len(cells)))
    rows = (len(cells) + cols - 1) // cols
    W = pad + cols * (cw * scale + pad)
    H = pad + rows * (ch * scale + pad + 12)
    sheet = Image.new('RGBA', (W, H), bg + (255,))
    d = ImageDraw.Draw(sheet)
    for i, (lab, im) in enumerate(cells):
        r, c = divmod(i, cols)
        x0 = pad + c * (cw * scale + pad)
        y0 = pad + r * (ch * scale + pad + 12)
        d.text((x0, y0), lab, fill=(220, 220, 220), font=font)
        if floor:
            sheet.alpha_composite(floor_image(cw, ch).resize((cw * scale, ch * scale), Image.NEAREST), (x0, y0 + 12))
        sheet.alpha_composite(to_image(im, scale), (x0, y0 + 12))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    return path


def label_sheet(rows, scale, path, cell=None, pad=4, bg=(29, 22, 32)):
    """rows: list of (label, [index images]). Each image is drawn at `scale` on a floor cell, with
    the anchor-free layout used by the import preview. Saves a PNG to read."""
    font = ImageFont.load_default()
    cw = max(len(im[0]) for _, ims in rows for im in ims) if cell is None else cell[0]
    ch = max(len(im) for _, ims in rows for im in ims) if cell is None else cell[1]
    ncol = max(len(ims) for _, ims in rows)
    W = pad + ncol * (cw * scale + pad) + 120
    H = pad + len(rows) * (ch * scale + pad + 12)
    sheet = Image.new('RGBA', (W, H), bg + (255,))
    d = ImageDraw.Draw(sheet)
    for r, (lab, ims) in enumerate(rows):
        y0 = pad + r * (ch * scale + pad + 12)
        d.text((pad, y0), lab, fill=(220, 220, 220), font=font)
        for i, im in enumerate(ims):
            x0 = pad + i * (cw * scale + pad)
            fl = floor_image(cw, ch).resize((cw * scale, ch * scale), Image.NEAREST)
            sheet.alpha_composite(fl, (x0, y0 + 12))
            sheet.alpha_composite(to_image(im, scale), (x0, y0 + 12))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    return path
