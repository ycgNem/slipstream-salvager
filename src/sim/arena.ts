// Geometry for The Ring: circle-vs-rectangle contacts, line of sight and how far a lane runs.
import type { ArenaDef, FloorKind, FloorPatch, Gate, Rect } from '../data/arena';

export interface Contact {
  /** push-out normal (unit) and depth */
  nx: number;
  ny: number;
  depth: number;
}

/** Contact between a circle and a rectangle, or null if they don't touch. */
export function circleRect(x: number, y: number, r: number, rc: Rect): Contact | null {
  const cx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
  const cy = Math.max(rc.y, Math.min(y, rc.y + rc.h));
  const dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // center inside the rectangle: push out along the shortest axis
  const left = x - rc.x, right = rc.x + rc.w - x, top = y - rc.y, bottom = rc.y + rc.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/**
 * Every contact a circle has with the arena's solids. The four walls are half-planes that only
 * push inward, so nothing shoved deep into a wall can come out on the far side (the critic's
 * softlock); pillars are rectangles.
 */
export function contacts(a: ArenaDef, x: number, y: number, r: number, open: Gate[] = [], obstacles = true): Contact[] {
  const out: Contact[] = [];
  const lo = a.wall + r, hx = a.w - a.wall - r, hy = a.h - a.wall - r;
  // an open exit gate lets you out through its span of the wall
  const through = (id: Gate['id']) => open.some((g) => g.id === id && (g.orient === 'v' ? y > g.rect.y && y < g.rect.y + g.rect.h : x > g.rect.x && x < g.rect.x + g.rect.w));
  if (x < lo && !through('w')) out.push({ nx: 1, ny: 0, depth: lo - x });
  if (x > hx && !through('e')) out.push({ nx: -1, ny: 0, depth: x - hx });
  if (y < lo && !through('n')) out.push({ nx: 0, ny: 1, depth: lo - y });
  if (y > hy && !through('s')) out.push({ nx: 0, ny: -1, depth: y - hy });
  if (!obstacles) return out;
  for (const s of a.pillars) {
    const c = circleRect(x, y, r, s);
    if (c) out.push(c);
  }
  return out;
}

/** Where a circle ends up once it's pushed out of every solid (position only, no bounce). */
export function pushOut(a: ArenaDef, x: number, y: number, r: number): { x: number; y: number } {
  for (let pass = 0; pass < 3; pass++) {
    const cs = contacts(a, x, y, r);
    if (!cs.length) break;
    for (const c of cs) {
      x += c.nx * c.depth;
      y += c.ny * c.depth;
    }
  }
  return { x, y };
}

/** Does a segment pass through a rectangle grown by pad? (slab test) */
export function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, rc: Rect, pad = 0): boolean {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  const minX = rc.x - pad, maxX = rc.x + rc.w + pad, minY = rc.y - pad, maxY = rc.y + rc.h + pad;
  return clip(-dx, x0 - minX) && clip(dx, maxX - x0) && clip(-dy, y0 - minY) && clip(dy, maxY - y0);
}

/** Clear line between two points (pillars block it; the walls are outside the play area). */
export function lineOfSight(a: ArenaDef, x0: number, y0: number, x1: number, y1: number): boolean {
  for (const p of a.pillars) if (segmentHitsRect(x0, y0, x1, y1, p, 2)) return false;
  return true;
}

/**
 * The way a body of radius r rolling along `angle` comes off the solid it meets at (x, y) (the
 * Bouncer's telegraph stub): the angle reflected about the contact normal.
 */
export function reflectAt(a: ArenaDef, x: number, y: number, angle: number, r: number): number {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  let nx = 0, ny = 0;
  for (const c of contacts(a, x + cx * 3, y + cy * 3, r)) {
    nx += c.nx;
    ny += c.ny;
  }
  const n = Math.hypot(nx, ny);
  if (n < 1e-6) return angle;
  nx /= n;
  ny /= n;
  const d = cx * nx + cy * ny;
  return Math.atan2(cy - 2 * d * ny, cx - 2 * d * nx);
}

/** The terrain patch of a kind under a point, if any (PLAN.md 9.4). */
export function floorAt(a: ArenaDef, x: number, y: number, kind: FloorKind): FloorPatch | null {
  for (const f of a.floor ?? []) if (f.kind === kind && x >= f.rect.x && x < f.rect.x + f.rect.w && y >= f.rect.y && y < f.rect.y + f.rect.h) return f;
  return null;
}

export function onOil(a: ArenaDef, x: number, y: number): boolean {
  return !!a.floor?.length && !!floorAt(a, x, y, 'oil');
}

/** A boost strip's or ramp's arrow (0 east, 1 south, 2 west, 3 north), as an angle. */
export const FLOOR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/** Moving along a patch's arrow, within coneDeg of it? */
export function along(f: FloorPatch, heading: number, coneDeg: number): boolean {
  let d = heading - FLOOR_ANGLE[f.dir ?? 0];
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.abs(d) <= (coneDeg * Math.PI) / 180;
}

/** How far a body of radius r can travel from (x, y) along an angle before touching a solid. */
export function laneLength(a: ArenaDef, x: number, y: number, angle: number, maxLen: number, r: number): number {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  for (let d = 0; d <= maxLen; d += 2) {
    const px = x + cx * d, py = y + cy * d;
    for (const s of a.solids) if (circleRect(px, py, r, s)) return Math.max(0, d - 2);
  }
  return maxLen;
}
