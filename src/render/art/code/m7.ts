// Code-drawn placeholders for the Milestone 7 terrain (STYLE.md, PLAN.md 9.4): boost strips (teal
// chevrons that scroll the way they push), oil (near-black, glossy, edged by a neighbor mask like
// the walls), jump ramps (a steel wedge rising toward its arrow) and crusher plates (a dark plate
// with danger-red corner marks; flashing red when it warns; the crusher's head when it's down).
import { defSprite } from '../../atlas';
import { px, rect, hline, vline, line } from '../pixel';
import { hash } from './common';

type Ctx = CanvasRenderingContext2D;

const FDIRS = ['e', 's', 'w', 'n'] as const;

/** Map (u, v) in a tile pointing east to the tile pointing `d` (u along the arrow, v across). */
function rot(d: number, u: number, v: number, n: number): [number, number] {
  switch (d) {
    case 0: return [u, v];
    case 1: return [n - 1 - v, u];
    case 2: return [n - 1 - u, n - 1 - v];
    default: return [v, n - 1 - u];
  }
}

/** A boost strip tile: dark teal deck, a bright chevron that moves along the arrow by frame. */
function boost(d: number, f: number) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
        const [x, y] = rot(d, u, v, 16);
        // the deck, with a darker rail along both edges
        let c = v === 0 || v === 15 ? 39 : (u + v) % 4 === 0 ? 40 : 39;
        // two chevrons per tile, scrolling forward by frame
        const k = (u + Math.abs(v - 7.5) * 0.9 - f * 5 + 64) % 8;
        if (v > 1 && v < 14 && k >= 0 && k < 2) c = k < 1 ? 43 : 42;
        px(ctx, x, y, c);
      }
    },
  };
}

/** Oil: a deep blue-black with a glossy sheen; edges where there's no oil next door are rounded
 * off, so a patch reads as a puddle, not a carpet. Its base is never palette 0 (the outline
 * colour), so bodies and shadows on it keep their edges. mask bits: 1 up, 2 right, 4 down, 8 left. */
function oil(mask: number) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      const up = mask & 1, right = mask & 2, down = mask & 4, left = mask & 8;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        // round the open corners off
        const cx = !left && x < 3 ? 3 - x : !right && x > 12 ? x - 12 : 0;
        const cy = !up && y < 3 ? 3 - y : !down && y > 12 ? y - 12 : 0;
        if (cx * cx + cy * cy > 6) continue;
        const edge = (!up && y === 0) || (!down && y === 15) || (!left && x === 0) || (!right && x === 15) || cx * cx + cy * cy > 3;
        let c = edge ? 49 : 44;
        // the sheen: dark slanted bands dithered in, a lighter streak, and a few bright glints
        const band = (x + y * 2 + 64) % 12;
        if (!edge && band > 6 && band < 10 && (x + y) % 2 === 0) c = 0;
        if (!edge && band === 1 && x % 3 === 0) c = 45;
        if (!edge && hash(x, y, 77) > 0.99) c = 47;
        px(ctx, x, y, c);
      }
    },
  };
}

/** A jump ramp, 32x32: a steel wedge rising toward the arrow, its lip lit, a teal arrow on it. */
function ramp(d: number) {
  return {
    w: 32, h: 32, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      for (let v = 0; v < 32; v++) for (let u = 0; u < 32; u++) {
        const [x, y] = rot(d, u, v, 32);
        let c: number;
        if (v < 2 || v > 29) c = 0;
        else if (u > 28) c = u === 31 ? 0 : 8; // the lip
        else c = u < 10 ? 2 : u < 20 ? 6 : 7; // rising: darker at the foot, lighter up the slope
        if (c !== 0 && v > 1 && v < 30 && u <= 28 && (u % 6 === 0)) c = c === 2 ? 1 : 2; // slats
        px(ctx, x, y, c);
      }
      // the arrow
      for (let i = 0; i < 9; i++)
        for (const s of [-1, 1]) {
          const [x, y] = rot(d, 12 + i, Math.round(15.5 + s * (8 - i) * 0.9), 32);
          px(ctx, x, y, 42);
        }
      for (let u = 6; u < 21; u++) {
        const [x, y] = rot(d, u, 15, 32);
        const [x2, y2] = rot(d, u, 16, 32);
        px(ctx, x, y, 43);
        px(ctx, x2, y2, 42);
      }
    },
  };
}

/** A crusher plate, 32x32: idle (dark plate, red corner marks), warn (the border flashing red,
 * drawn on the warn frame), down (the crusher's head on the plate). */
function crusher(state: 'idle' | 'warn' | 'down') {
  return {
    w: 32, h: 32, ox: 0, oy: 0,
    draw: (ctx: Ctx) => {
      rect(ctx, 0, 0, 32, 32, 0);
      rect(ctx, 1, 1, 30, 30, 34);
      // a grate
      for (let i = 4; i < 28; i += 4) {
        hline(ctx, 3, 28, i, 35);
      }
      vline(ctx, 3, 3, 28, 1);
      vline(ctx, 28, 3, 28, 1);
      const red = state === 'warn' ? 15 : 10;
      // corner marks: danger, always (it's a hazard)
      for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [30, 1, -1, 1], [1, 30, 1, -1], [30, 30, -1, -1]]) {
        for (let k = 0; k < 6; k++) {
          px(ctx, cx + sx * k, cy, red);
          px(ctx, cx, cy + sy * k, red);
        }
      }
      if (state === 'warn') {
        rect(ctx, 0, 0, 32, 1, 15);
        rect(ctx, 0, 31, 32, 1, 15);
        rect(ctx, 0, 0, 1, 32, 15);
        rect(ctx, 31, 0, 1, 32, 15);
        // a red X: something's coming down
        line(ctx, 8, 8, 23, 23, 14);
        line(ctx, 23, 8, 8, 23, 14);
      }
      if (state === 'down') {
        // the crusher's head, a heavy steel block filling the plate, lit from the upper left
        rect(ctx, 2, 2, 28, 28, 2);
        rect(ctx, 3, 3, 26, 25, 6);
        rect(ctx, 3, 3, 26, 2, 7);
        rect(ctx, 3, 3, 2, 25, 7);
        rect(ctx, 3, 26, 26, 2, 5);
        for (const [bx, by] of [[7, 7], [24, 7], [7, 22], [24, 22]]) px(ctx, bx, by, 8);
      }
    },
  };
}

export function registerM7() {
  FDIRS.forEach((dn, d) => {
    for (const f of [0, 1, 2]) defSprite(`fl:boost:${dn}:${f}`, boost(d, f));
    defSprite(`fl:ramp:${dn}`, ramp(d));
  });
  for (let m = 0; m < 16; m++) defSprite(`fl:oil:${m}`, oil(m));
  for (const s of ['idle', 'warn', 'down'] as const) defSprite(`fl:crusher:${s}`, crusher(s));
}
