// The "pixel sculptor": renders tiny 3D models (signed-distance shapes) straight onto the pixel
// grid in the game's 3/4 view, one facing direction at a time. Nothing is ever rotated as an
// image. Each pixel casts a ray into the model, gets the surface's material and a light level from
// its normal (light from the upper left), and takes that palette color. Then the far side of every
// internal edge is inked, stray pixels are cleaned up, and the silhouette is outlined in plum.
//
// Coordinates: a model is built in body-local units of one pixel, x forward, y to the body's right,
// z up, with the anchor (the center of the footprint) at the origin. The camera looks down at
// ~37°: ground depth shows at 0.6 px per unit and height at 0.8 px per unit (the same squash the
// mounts in src/data/mounts.ts use).
import { PALETTE } from '../../../data/palette';
import { outline, type Ctx } from '../pixel';

/** screen pixels per unit of ground depth (the 3/4 squash) */
export const SQ = 0.6;
/** screen pixels per unit of height */
export const HT = 0.8;

/** The nearest surface found by a scene evaluation (reused to avoid garbage). */
export class Hit {
  d = 1e9;
  m = -1;
  /** the winning shape's own coordinates, for patterns (stripes, rivets) */
  u = 0;
  v = 0;
  w = 0;
  reset() { this.d = 1e9; this.m = -1; }
  /** Offer a shape: keep it if it's the nearest so far. */
  add(d: number, m: number, u = 0, v = 0, w = 0) {
    if (d < this.d) { this.d = d; this.m = m; this.u = u; this.v = v; this.w = w; }
  }
}

/** A model: evaluate every shape at a body-local point and offer each to the hit. */
export type Scene = (h: Hit, x: number, y: number, z: number) => void;

/** One sculpted pixel. */
export interface Px {
  m: number;
  /** light level 0 (dark) .. 3 (highlight) */
  lvl: number;
  /** distance along the view ray (smaller is nearer the camera) */
  t: number;
  /** world hit point (x east, y south, z up) relative to the anchor */
  X: number; Y: number; Z: number;
  /** the shape's own coordinates */
  u: number; v: number; w: number;
  /** world normal */
  nx: number; ny: number; nz: number;
  /** final palette index (-1 = leave transparent) */
  c: number;
  /** on an inked internal edge */
  ink: boolean;
}

export interface Mat {
  /** dark → light ramp, indexed by light level (pad to 4 entries) */
  ramp: readonly number[];
  /** color for the far side of an internal edge (default ramp[0], or 0 when already darkest) */
  ink?: number;
  /** edges are only inked between different groups (default: each material is its own group) */
  group?: number;
  /** custom color: return a palette index, or undefined for the ramp color */
  paint?: (p: Px) => number | undefined;
  /** never ink this material's pixels (thin details) */
  noInk?: boolean;
}

export interface SculptOpts {
  w: number;
  h: number;
  /** anchor pixel in the frame */
  ox: number;
  oy: number;
  /** facing angle (radians, screen space, 0 = east, clockwise) */
  angle: number;
  scene: Scene;
  mats: readonly Mat[];
  /** model height range (units); rays start above zMax and stop at zMin */
  zMax: number;
  zMin?: number;
  /** pixels per model unit (1 = one pixel) */
  scale?: number;
  /** n·L thresholds between light levels 0|1|2|3 */
  bands?: readonly [number, number, number];
  /** 3D gap (units) between neighboring hits that counts as an edge */
  inkJump?: number;
  /** add the plum outline around the silhouette (default true) */
  outline?: boolean;
  /** camera elevation override: [depth squash, height squash] (sin and cos of the elevation) */
  view?: readonly [number, number];
}

// light from the upper left of the screen: west, north (up the screen) and above
const LX = -0.58, LY = -0.36, LZ = 0.73;
const LN = Math.hypot(LX, LY, LZ);
export const LIGHT = [LX / LN, LY / LN, LZ / LN] as const;

const h0 = new Hit();

/**
 * Sculpt a model into ctx (and outline it on canvas). Returns the pixel grid (row-major, null =
 * empty) so a caller can add hand-placed details afterwards.
 */
export function sculpt(ctx: Ctx, canvas: HTMLCanvasElement, o: SculptOpts): (Px | null)[] {
  const { w, h, ox, oy, scene, mats } = o;
  const k = o.scale ?? 1;
  const zMin = o.zMin ?? 0;
  const [sq, ht] = o.view ?? [SQ, HT];
  const ca = Math.cos(o.angle), sa = Math.sin(o.angle);
  const bands = o.bands ?? [-0.22, 0.32, 0.86];
  const grid: (Px | null)[] = new Array(w * h).fill(null);
  const Z0 = o.zMax + 0.5;
  const tEnd = (Z0 - zMin) / sq + 0.5;
  // ray direction (world): toward north and down, unit length
  const dY = -ht, dZ = -sq;
  const evalAt = (X: number, Y: number, Z: number) => {
    h0.reset();
    scene(h0, X * ca + Y * sa, -X * sa + Y * ca, Z);
    return h0.d;
  };
  for (let py = 0; py < h; py++) {
    for (let pxl = 0; pxl < w; pxl++) {
      const sx = (pxl + 0.5 - ox) / k;
      const sy = (py + 0.5 - oy) / k;
      const X = sx;
      const Y0 = (sy + ht * Z0) / sq;
      let t = 0, hit = false;
      for (let i = 0; i < 160 && t <= tEnd; i++) {
        const d = evalAt(X, Y0 + dY * t, Z0 + dZ * t);
        if (d < 0.015) { hit = true; break; }
        t += Math.max(d * 0.8, 0.015);
      }
      if (!hit) continue;
      const Y = Y0 + dY * t, Z = Z0 + dZ * t;
      // capture the hit's material and shape coordinates
      h0.reset();
      scene(h0, X * ca + Y * sa, -X * sa + Y * ca, Z);
      const m = h0.m, u = h0.u, v = h0.v, ww = h0.w;
      // normal by central differences (world space)
      const e = 0.3;
      let nx = evalAt(X + e, Y, Z) - evalAt(X - e, Y, Z);
      let ny = evalAt(X, Y + e, Z) - evalAt(X, Y - e, Z);
      let nz = evalAt(X, Y, Z + e) - evalAt(X, Y, Z - e);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const diff = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      const lvl = diff > bands[2] ? 3 : diff > bands[1] ? 2 : diff > bands[0] ? 1 : 0;
      grid[py * w + pxl] = { m, lvl, t, X, Y, Z, u, v, w: ww, nx, ny, nz, c: -1, ink: false };
    }
  }

  // clean up lone light-level pixels inside one material (shading speckle)
  for (let pass = 0; pass < 2; pass++) {
    for (let py = 1; py < h - 1; py++) {
      for (let pxl = 1; pxl < w - 1; pxl++) {
        const p = grid[py * w + pxl];
        if (!p) continue;
        const n4 = [grid[py * w + pxl - 1], grid[py * w + pxl + 1], grid[(py - 1) * w + pxl], grid[(py + 1) * w + pxl]];
        if (n4.some((q) => !q || q.m !== p.m)) continue;
        if (n4.every((q) => q!.lvl !== p.lvl)) {
          const counts = [0, 0, 0, 0];
          for (const q of n4) counts[q!.lvl]++;
          let best = 0;
          for (let l = 1; l < 4; l++) if (counts[l] > counts[best]) best = l;
          if (counts[best] >= 3) p.lvl = best;
        }
      }
    }
  }

  // ink the far side of internal edges: a nearer neighbor of another group, or a depth jump
  const jump = o.inkJump ?? 2.6;
  const grp = (m: number) => mats[m]?.group ?? m;
  for (let py = 0; py < h; py++) {
    for (let pxl = 0; pxl < w; pxl++) {
      const p = grid[py * w + pxl];
      if (!p || mats[p.m]?.noInk) continue;
      const nb = [pxl > 0 ? grid[py * w + pxl - 1] : null, pxl < w - 1 ? grid[py * w + pxl + 1] : null,
        py > 0 ? grid[(py - 1) * w + pxl] : null, py < h - 1 ? grid[(py + 1) * w + pxl] : null];
      for (const q of nb) {
        if (!q || mats[q.m]?.noInk) continue;
        if (q.t >= p.t - 0.2) continue;
        const gap = Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
        if (gap > jump || (grp(q.m) !== grp(p.m) && gap > 0.9)) { p.ink = true; break; }
      }
    }
  }

  // color
  for (const p of grid) {
    if (!p) continue;
    const mat = mats[p.m];
    if (!mat) { p.c = 0; continue; }
    if (p.ink) {
      p.c = mat.ink ?? (p.lvl === 0 ? 0 : mat.ramp[0]);
      continue;
    }
    const c = mat.paint?.(p);
    p.c = c ?? mat.ramp[Math.min(p.lvl, mat.ramp.length - 1)];
  }

  for (let py = 0; py < h; py++) {
    for (let pxl = 0; pxl < w; pxl++) {
      const p = grid[py * w + pxl];
      if (!p || p.c < 0) continue;
      ctx.fillStyle = PALETTE[p.c];
      ctx.fillRect(pxl, py, 1, 1);
    }
  }
  if (o.outline !== false) outline(canvas, 0);
  return grid;
}

// ---- signed-distance shapes (all centered at the origin; translate by subtracting first) ----

/** Box with half sizes hx, hy, hz and corner rounding r (r <= every half size). */
export function sdBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, r = 0): number {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Ellipsoid (approximate distance; fine for sphere tracing with a step factor). */
export function sdEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number): number {
  const k0 = Math.hypot(x / rx, y / ry, z / rz);
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

/** Cylinder along an axis: a = coordinate along the axis, b, c across it. Half length hl. */
export function sdCyl(a: number, b: number, c: number, rad: number, hl: number, round = 0): number {
  const dr = Math.hypot(b, c) - rad + round, da = Math.abs(a) - hl + round;
  return Math.min(Math.max(dr, da), 0) + Math.hypot(Math.max(dr, 0), Math.max(da, 0)) - round;
}

/** Frustum along an axis from a0 (radius r0) to a1 (radius r1), a0 < a1. Approximate. */
export function sdFrustum(a: number, b: number, c: number, a0: number, r0: number, a1: number, r1: number): number {
  const s = Math.min(1, Math.max(0, (a - a0) / (a1 - a0)));
  const rad = r0 + (r1 - r0) * s;
  const slope = (r1 - r0) / (a1 - a0);
  const side = (Math.hypot(b, c) - rad) / Math.sqrt(1 + slope * slope);
  const cap = Math.max(a0 - a, a - a1);
  return Math.max(side, cap);
}

/** Capsule from (ax,ay,az) to (bx,by,bz) with radius r. */
export function sdCapsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): number {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const hh = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * hh, pay - bay * hh, paz - baz * hh) - r;
}

// ---- pose helpers: map a world point into a part's own frame ----

/** Undo a pitch (nose down for ang > 0) about the pivot (px, pz). Returns [x, z]. */
export function unpitch(x: number, z: number, ang: number, px: number, pz: number): [number, number] {
  if (!ang) return [x, z];
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = x - px, dz = z - pz;
  return [px + dx * c - dz * s, pz + dx * s + dz * c];
}

/** Undo a roll (right side down for ang > 0) about the pivot (py, pz). Returns [y, z]. */
export function unroll(y: number, z: number, ang: number, py: number, pz: number): [number, number] {
  if (!ang) return [y, z];
  const c = Math.cos(ang), s = Math.sin(ang);
  const dy = y - py, dz = z - pz;
  return [py + dy * c - dz * s, pz + dy * s + dz * c];
}

/** Undo a yaw (clockwise on screen for ang > 0). Returns [x, y]. */
export function unyaw(x: number, y: number, ang: number): [number, number] {
  if (!ang) return [x, y];
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c + y * s, -x * s + y * c];
}

/** Screen offset (from the anchor) of a body-local point for a facing angle. */
export function project(angle: number, x: number, y: number, z: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  const X = x * c - y * s, Y = x * s + y * c;
  return [X, Y * SQ - z * HT];
}
