// Procedural shapes on the 640x360 pixel grid (STYLE.md pixel rule 4): lines, lanes, rings and
// silhouettes, always whole pixels in palette colors. Pixel art itself is never rotated; shapes
// that need an exact angle (telegraph lanes, the heading tick, the cable) are drawn here instead.
import { PALETTE } from '../data/palette';
import { makeCanvas, ctx2d } from './art/pixel';
import type { Sprite } from './atlas';

type Ctx = CanvasRenderingContext2D;

export function dot(ctx: Ctx, x: number, y: number, c: number, size = 1) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(Math.round(x), Math.round(y), size, size);
}

/** Bresenham line; `dash` draws only pixels where (step / dash) is even, offset by phase. */
export function pline(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: number, dash = 0, phase = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, i = 0;
  ctx.fillStyle = PALETTE[c];
  for (let guard = 0; guard < 4000; guard++) {
    if (!dash || Math.floor((i + phase) / dash) % 2 === 0) ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    i++;
  }
}

/**
 * A telegraph lane: a strip `width` wide from (x, y) along `angle` for `len` px. Two edge lines
 * (dashed or solid) with a sparse dither between them, never an alpha gradient.
 */
export function lane(ctx: Ctx, x: number, y: number, angle: number, len: number, width: number, edge: number, fill: number, opts: { dash?: number; phase?: number; density?: number } = {}) {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  const nx = -cy, ny = cx, hw = width / 2;
  // dither fill: pixels inside the strip on a sparse checker
  const pts = [
    [x + nx * hw, y + ny * hw], [x - nx * hw, y - ny * hw],
    [x + cx * len + nx * hw, y + cy * len + ny * hw], [x + cx * len - nx * hw, y + cy * len - ny * hw],
  ];
  const minX = Math.floor(Math.min(...pts.map((p) => p[0]))), maxX = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const minY = Math.floor(Math.min(...pts.map((p) => p[1]))), maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  const density = opts.density ?? 4;
  ctx.fillStyle = PALETTE[fill];
  for (let py = minY; py <= maxY; py++)
    for (let px = minX; px <= maxX; px++) {
      if ((px + py * 2) % density !== 0 || py % 2 !== 0) continue;
      const rx = px + 0.5 - x, ry = py + 0.5 - y;
      const u = rx * cx + ry * cy, v = rx * nx + ry * ny;
      if (u >= 0 && u <= len && Math.abs(v) < hw - 1) ctx.fillRect(px, py, 1, 1);
    }
  const d = opts.dash ?? 0, ph = opts.phase ?? 0;
  pline(ctx, x + nx * hw, y + ny * hw, x + cx * len + nx * hw, y + cy * len + ny * hw, edge, d, ph);
  pline(ctx, x - nx * hw, y - ny * hw, x + cx * len - nx * hw, y + cy * len - ny * hw, edge, d, ph);
  // the end cap
  pline(ctx, x + cx * len + nx * hw, y + cy * len + ny * hw, x + cx * len - nx * hw, y + cy * len - ny * hw, edge);
}

/** A 1 px pixel circle outline (midpoint algorithm). */
export function ring(ctx: Ctx, cx: number, cy: number, r: number, c: number) {
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = PALETTE[c];
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + a, cy + b, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

/**
 * A ring painted on the floor (a Hopper's landing, your leap's): a 1 px circle, dashed or solid,
 * with a sparse dither inside, like a telegraph lane. Whole pixels, never alpha.
 */
export function floorRing(ctx: Ctx, cx: number, cy: number, r: number, edge: number, fill: number, opts: { dash?: number; phase?: number; density?: number } = {}) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const density = opts.density ?? 0;
  if (density) {
    ctx.fillStyle = PALETTE[fill];
    for (let y = -r + 1; y < r; y++) {
      if ((cy + y) % 2 !== 0) continue;
      for (let x = -r + 1; x < r; x++) if ((cx + x + (cy + y) * 2) % density === 0 && x * x + y * y < (r - 1) * (r - 1)) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  const n = Math.max(12, Math.round(Math.PI * 2 * r));
  const dash = opts.dash ?? 0, ph = opts.phase ?? 0;
  ctx.fillStyle = PALETTE[edge];
  for (let i = 0; i < n; i++) {
    if (dash && Math.floor((i + ph) / dash) % 2 !== 0) continue;
    const a = (i / n) * Math.PI * 2;
    ctx.fillRect(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 1, 1);
  }
}

const silCache = new Map<string, HTMLCanvasElement>();

/**
 * A sprite's silhouette in one palette color (hurt flashes, afterimages). `dither` keeps only every
 * other pixel in a checker, for a fading afterimage without alpha.
 */
export function silhouette(s: Sprite, key: string, c: number, dither = 0): HTMLCanvasElement {
  const k = `${key}|${c}|${dither}`;
  let cv = silCache.get(k);
  if (cv) return cv;
  cv = makeCanvas(s.w, s.h);
  const x = ctx2d(cv);
  x.drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
  const id = x.getImageData(0, 0, s.w, s.h);
  const hex = PALETTE[c];
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < s.w * s.h; i++) {
    const px = i % s.w, py = (i / s.w) | 0;
    const keep = dither === 0 || (dither === 1 ? (px + py) % 2 === 0 : (px + py) % 4 === 0 && py % 2 === 0);
    if (id.data[i * 4 + 3] && keep) {
      id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255;
    } else id.data[i * 4 + 3] = 0;
  }
  x.putImageData(id, 0, 0);
  silCache.set(k, cv);
  return cv;
}

export function clearSilhouettes() {
  silCache.clear();
}

/** A 1 px outline round a sprite in one color (draw it, then the sprite on top). */
export function outline(ctx: Ctx, s: Sprite, key: string, x: number, y: number, c: number) {
  const sil = silhouette(s, key, c);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, x - s.ox + dx, y - s.oy + dy);
}

/** A cracked part: a white zigzag with an ink edge on its right, so it reads on gold and on
 * dark steel alike (anchor-relative). */
export function crack(ctx: Ctx, x: number, y: number) {
  const zig = [[-2, -2], [-1, -1], [-1, 0], [0, 1], [1, 1], [1, 2]];
  for (const [dx, dy] of zig) dot(ctx, x + dx + 1, y + dy, 0);
  for (const [dx, dy] of zig) dot(ctx, x + dx, y + dy, 9);
}
