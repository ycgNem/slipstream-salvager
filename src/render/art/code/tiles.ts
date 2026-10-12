// The arena: a dim, quiet scrapyard floor (four variants that tile in any combination), the ring
// wall of stacked scrap (16 neighbor masks), the crushed-scrap pillar and the gates. Warm neutrals
// and olive, low contrast against each other, so everything that moves pops.
import { defSprite } from '../../atlas';
import { px, rect, outline } from '../pixel';
import { keep, hash } from './common';

type Ctx = CanvasRenderingContext2D;

// ---- floor ----
// Long deck plates: every variant has a dark seam on its top row and one vertical joint at its
// own spot, and nothing else crosses the tile's edges, so any variant sits next to any other and
// the joints stagger like laid plates instead of a grid. Base plum 1, details one step away (0, 2,
// olive 24) so the floor stays dark and quiet.

const JOINT = [5, 11, -1, 8];

function floor(v: number) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      rect(ctx, 0, 0, 16, 16, 1);
      rect(ctx, 0, 0, 16, 1, 0);
      const j = JOINT[v];
      if (j >= 0) {
        rect(ctx, j, 1, 1, 15, 0);
        // rivets either side of the joint
        px(ctx, j - 2, 3, 2);
        px(ctx, j + 2, 12, 2);
      } else {
        px(ctx, 3, 3, 2);
      }
      // grit: a couple of dark specks
      for (let i = 0; i < 2; i++) {
        const x = 1 + Math.floor(hash(i, v, 1) * 14), y = 3 + Math.floor(hash(v, i, 2) * 11);
        if (x !== j) px(ctx, x, y, 0);
      }
      if (v === 1) {
        // a faint scuff
        for (let i = 0; i < 3; i++) px(ctx, 3 + i, 10 - i, 2);
      } else if (v === 2) {
        // a faint oil smear: olive-brown dither, densest in the middle
        for (let y = 6; y < 13; y++) for (let x = 4; x < 14; x++) {
          const dx = (x + 0.5 - 9) / 4, dy = (y + 0.5 - 9.5) / 2.4;
          const r = dx * dx + dy * dy + (hash(x, y, 9) - 0.5) * 0.4;
          if (r < 0.35 ? keep(x, y, 0.75) : r < 1 && keep(x, y, 0.3)) px(ctx, x, y, 24);
        }
      } else if (v === 3) {
        // a little olive grime collected along the joint
        for (let y = 2; y < 15; y++) if (hash(y, 3, 4) > 0.7) px(ctx, 9, y, 24);
      }
    },
  };
}

// ---- scrap texture ----
// Crushed scrap seen from above: irregular chunks (a Voronoi pattern on a 16x16 torus, so it tiles
// seamlessly), dark crevices between them, each chunk lit on its upper-left side.

interface Chunk { x: number; y: number; cols: readonly [number, number, number] }

function chunks(seed: number, n: number, palette: readonly (readonly [number, number, number])[]): Chunk[] {
  const out: Chunk[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: hash(i, 1, seed) * 16, y: hash(i, 2, seed) * 16, cols: palette[Math.floor(hash(i, 3, seed) * palette.length)] });
  }
  return out;
}

/** color of the scrap texture at (x, y); sy stretches chunks horizontally (front faces) */
function scrapAt(cs: Chunk[], x: number, y: number, period = 16, sy = 1, crev = 1): number {
  let d1 = 1e9, d2 = 1e9, best: Chunk = cs[0];
  for (const c of cs) {
    let dx = Math.abs(x + 0.5 - c.x), dy = Math.abs(y + 0.5 - c.y);
    dx = Math.min(dx, period - dx);
    dy = Math.min(dy, period - dy) * sy;
    const d = Math.hypot(dx, dy);
    if (d < d1) { d2 = d1; d1 = d; best = c; } else if (d < d2) d2 = d;
  }
  if (d2 - d1 < 0.9) return crev; // crevice
  let rx = x + 0.5 - best.x, ry = y + 0.5 - best.y;
  if (rx > period / 2) rx -= period; if (rx < -period / 2) rx += period;
  if (ry > period / 2) ry -= period; if (ry < -period / 2) ry += period;
  const lit = rx + ry * sy;
  if (d2 - d1 < 1.9 && lit < 0) return best.cols[2]; // lit rim on the upper-left side
  if (d2 - d1 < 1.9 && lit > 0) return best.cols[0]; // shaded rim on the lower-right
  return best.cols[1];
}

// ---- walls ----
// Mask bits are the neighbors that are also wall (1 = north, 2 = east, 4 = south, 8 = west).
// The top face is scrap texture; open sides get an outline and a lit (north, west) or shaded
// (east) rim, and an open south side shows the wall's front face: flatter, darker layers.

/**
 * The wall's top face: a seamless 16x16 pile of scrap seen from above (stamped with wrap-around):
 * a riveted plate, an old tire, a pipe running along the pile, and crushed blocks.
 */
const WALL_TOP: number[] = (() => {
  const t: number[] = new Array(256).fill(2);
  const set = (x: number, y: number, c: number) => { t[(((y % 16) + 16) % 16) * 16 + (((x % 16) + 16) % 16)] = c; };
  for (let i = 0; i < 256; i++) if (hash(i & 15, i >> 4, 40) > 0.62) t[i] = 1; // grit between pieces
  // crushed blocks along the bottom, wrapping into the top row
  for (let y = 13; y <= 16; y++) for (let x = 0; x < 16; x++) {
    const olive = x >= 8 && x <= 14;
    if (x === 7 || x === 15) { set(x, y, 1); continue; }
    let c = olive ? 25 : 5;
    if (y === 13) c = olive ? 3 : 3; // lit top edge
    else if (y === 16) c = olive ? 24 : 2;
    else if (x === 0 || x === 8) c = olive ? 3 : 3;
    else if (hash(x, y, 41) > 0.8) c = olive ? 24 : 2;
    set(x, y, c);
  }
  // riveted plate
  for (let y = 1; y <= 6; y++) for (let x = 1; x <= 7; x++) {
    let c = 3;
    if (y === 1 || x === 1) c = 4;
    else if (y === 6 || x === 7) c = 5;
    set(x, y, c);
  }
  set(2, 2, 5); set(6, 5, 2); set(4, 3, 5); set(5, 4, 5); // rivets and a dent
  // an old tire: dark ring, lit upper-left, tread notches
  for (let y = 0; y < 8; y++) for (let x = 8; x < 16; x++) {
    const dx = x + 0.5 - 12, dy = y + 0.5 - 3.8;
    const r = Math.hypot(dx, dy);
    if (r > 3.7) continue;
    if (r < 1.5) { set(x, y, 0); continue; }
    let c = (dx + dy < -1.5) ? 2 : 1;
    if (r > 3.0 && ((x + y) & 1)) c = 0;
    set(x, y, c);
  }
  // a pipe along the pile with a collar
  for (let x = 0; x < 16; x++) {
    const collar = x === 5 || x === 6;
    set(x, 8, collar ? 3 : 1);
    set(x, 9, collar ? 4 : 4);
    set(x, 10, 3);
    set(x, 11, collar ? 3 : 5);
    set(x, 12, 1);
  }
  return t;
})();
const FRONT_CHUNKS = chunks(8, 6, [[1, 2, 5], [1, 5, 3], [1, 2, 3], [0, 24, 25]]);
const FRONT = 6; // rows of front face when the south side is open

function wall(mask: number) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      const n = !(mask & 1), e = !(mask & 2), s = !(mask & 4), w = !(mask & 8);
      const topH = s ? 16 - FRONT : 16;
      for (let y = 0; y < topH; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, WALL_TOP[y * 16 + x]);
      if (s) {
        for (let y = topH; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, scrapAt(FRONT_CHUNKS, x, y * 2, 16, 1.6));
        rect(ctx, 0, topH - 1, 16, 1, 4); // lit lip on the top face's front edge
        rect(ctx, 0, topH, 16, 1, 1); // the overhang's shadow
        rect(ctx, 0, 15, 16, 1, 0);
      }
      if (n) { rect(ctx, 0, 0, 16, 1, 0); rect(ctx, 0, 1, 16, 1, 4); }
      if (w) { rect(ctx, 0, 0, 1, 16, 0); for (let y = n ? 1 : 0; y < (s ? 15 : 16); y++) px(ctx, 1, y, y >= topH ? 2 : 4); }
      if (e) { rect(ctx, 15, 0, 1, 16, 0); for (let y = n ? 1 : 0; y < (s ? 15 : 16); y++) px(ctx, 14, y, y >= topH ? 1 : 2); }
    },
  };
}

// ---- pillar ----
// A stack of three crushed bales: 32x32 footprint (rows 8..39), the top face in the upper 10 px.
// Each bale a little darker going down, its edges lit top-left.

const PILLAR_TOP = chunks(21, 9, [[3, 4, 4], [2, 3, 4], [3, 4, 4], [5, 3, 4]]);
const BALES: readonly (readonly [number, number, number])[][] = [
  [[1, 3, 4], [2, 3, 4], [1, 5, 3]],
  [[1, 5, 3], [1, 2, 5], [1, 2, 3]],
  [[0, 24, 25], [1, 25, 3], [0, 24, 25]],
];

function bale(ctx: Ctx, x0: number, y0: number, w: number, h: number, i: number) {
  const cs = chunks(30 + i, 7, BALES[i]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = scrapAt(cs, x / 2, y, 16, 1.4);
    if (y === 0) c = BALES[i][0][2]; // lit top edge
    if (x === 0) c = BALES[i][1][2]; // lit left edge
    if (y === h - 1) c = BALES[i][0][0];
    if (x === w - 1) c = 1;
    px(ctx, x0 + x, y0 + y, c);
  }
}

const pillar = {
  w: 32, h: 40, ox: 0, oy: 8,
  draw: (ctx: Ctx, c: HTMLCanvasElement) => {
    // top face (rows 1..10): the top bale seen from above, the lightest part
    for (let y = 1; y <= 10; y++) for (let x = 1; x < 31; x++) px(ctx, x, y, scrapAt(PILLAR_TOP, x / 2, y * 1.5));
    rect(ctx, 1, 1, 30, 1, 4);
    // front face: three bales, the middle one sticking out a pixel (jagged silhouette)
    bale(ctx, 1, 11, 30, 9, 0);
    bale(ctx, 0, 20, 31, 10, 1);
    bale(ctx, 1, 30, 30, 9, 2);
    rect(ctx, 1, 11, 30, 1, 2); // shadow under the top face's lip
    outline(c, 0);
  },
};

// ---- gates ----

function gateFrameH(ctx: Ctx) {
  // posts and lintel in the wall's colors
  rect(ctx, 0, 0, 32, 16, 0);
  rect(ctx, 1, 1, 30, 2, 3);
  rect(ctx, 1, 1, 30, 1, 4);
  rect(ctx, 1, 3, 3, 12, 3);
  rect(ctx, 28, 3, 3, 12, 2);
  rect(ctx, 1, 3, 1, 12, 4);
  rect(ctx, 30, 3, 1, 12, 1);
}

function gateFrameV(ctx: Ctx) {
  rect(ctx, 0, 0, 16, 32, 0);
  rect(ctx, 1, 1, 14, 3, 3);
  rect(ctx, 1, 1, 14, 1, 4);
  rect(ctx, 1, 28, 14, 3, 2);
  rect(ctx, 1, 1, 2, 30, 3);
  rect(ctx, 1, 1, 1, 30, 4);
  rect(ctx, 13, 4, 2, 24, 2);
}

/** shutter slats; warn adds red/magenta hazard stripes (danger colors are allowed here only) */
function shutter(ctx: Ctx, x0: number, y0: number, w: number, h: number, vertical: boolean, warn: boolean) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const along = vertical ? x : y;
    const k = along % 3;
    let c = k === 0 ? 7 : k === 1 ? 6 : 5;
    if (warn) {
      const band = Math.floor((x + y) / 3) % 2;
      c = band ? (k === 0 ? 12 : k === 1 ? 15 : 59) : (k === 2 ? 0 : 1);
    }
    px(ctx, x0 + x, y0 + y, c);
  }
}

function gate(o: 'h' | 'v', st: 'closed' | 'open' | 'warn') {
  const [w, h] = o === 'h' ? [32, 16] : [16, 32];
  return {
    w, h, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      if (o === 'h') gateFrameH(ctx); else gateFrameV(ctx);
      const [x0, y0, iw, ih] = o === 'h' ? [4, 3, 24, 12] : [3, 4, 10, 24];
      if (st === 'open') {
        // a dark doorway, a hint of floor at the threshold
        rect(ctx, x0, y0, iw, ih, 0);
        if (o === 'h') { rect(ctx, x0, y0 + ih - 2, iw, 2, 1); for (let x = x0; x < x0 + iw; x += 2) px(ctx, x, y0 + ih - 3, 1); }
        else { rect(ctx, x0, y0, 2, ih, 1); }
      } else {
        shutter(ctx, x0, y0, iw, ih, o === 'v', st === 'warn');
        // bottom bar of the shutter
        if (o === 'h') rect(ctx, x0, y0 + ih - 1, iw, 1, 0);
        else rect(ctx, x0 + iw - 1, y0, 1, ih, 0);
      }
    },
  };
}

export function registerTiles() {
  for (let v = 0; v < 4; v++) defSprite(`t:floor:${v}`, floor(v));
  for (let m = 0; m < 16; m++) defSprite(`t:wall:${m}`, wall(m));
  defSprite('ob:pillar', pillar);
  for (const o of ['h', 'v'] as const) for (const st of ['closed', 'open', 'warn'] as const) defSprite(`ob:gate:${o}:${st}`, gate(o, st));
}
