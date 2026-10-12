// Effects: claw slashes per speed tier, sparks, dust, steam, smoke, stun stars and the dithered
// contact shadows. All pixel geometry in palette colors; fades are dither, never alpha.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle, wrapAngle } from '../../../data/dirs';
import { TIERS } from '../../names';
import { px } from '../pixel';
import { SQ } from './sculpt';
import { keep } from './common';

type Ctx = CanvasRenderingContext2D;

// ---- claw slash ----

interface SlashTier {
  /** outer radius (ground units from the Scrapper's anchor) and the max thickness */
  r: number;
  thick: number;
  /** half the arc's sweep (radians) */
  span: number;
  /** inner .. outer colors, and the hot outer edge */
  cols: readonly number[];
  hot: number;
  /** end taper sharpness (higher = more pointed tips) */
  sharp: number;
}

const SLASH: Record<(typeof TIERS)[number], SlashTier> = {
  crawl: { r: 12.5, thick: 2.6, span: 0.9, cols: [6, 6, 7], hot: 7, sharp: 1 },
  cruise: { r: 13.5, thick: 3.2, span: 1.05, cols: [32, 32, 33], hot: 33, sharp: 1.2 },
  slip: { r: 15.4, thick: 4.4, span: 1.3, cols: [41, 42, 43], hot: 9, sharp: 1.8 },
};

/**
 * A crescent in front of the body, in ground space (so it lies flat like the swing), lifted to
 * the claw's height. Frame 0 snaps the leading part in, 1 is the full arc, 2 fades out the tail.
 */
function slash(d: number, tier: (typeof TIERS)[number], f: number) {
  const T = SLASH[tier];
  return {
    w: 32, h: 32, ox: 16, oy: 16,
    draw: (ctx: Ctx) => {
      const a = dirAngle(d);
      // visible part of the sweep (u: 0 = start of the swing, 1 = end)
      const [u0, u1] = f === 0 ? [0, 0.68] : f === 1 ? [0, 1] : [0.25, 1];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const gx = x + 0.5 - 16, gy = (y + 0.5 - 16 + 3) / SQ;
        const R = Math.hypot(gx, gy);
        const rel = wrapAngle(Math.atan2(gy, gx) - a);
        const u = (rel + T.span) / (2 * T.span);
        if (u < u0 || u > u1) continue;
        const vis = (u - u0) / (u1 - u0);
        // thickness profile: a crescent, pointed at the tips
        let prof = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05))), T.sharp);
        if (f === 0) prof *= 0.5 + 0.5 * vis; // the leading edge is the fat end while snapping in
        if (f === 2) prof *= 0.45 + 0.25 * vis; // thinning out, the tail end goes first
        // foreshortened rows (n/s facings) get a little extra so the swing stays readable
        const th = T.thick * prof * (1 + 0.5 * Math.abs(Math.sin(rel + a)));
        const ro = T.r - (f === 0 ? 0.6 : f === 2 ? 0.4 : 0);
        if (R > ro || R < ro - Math.max(th, f === 2 ? 1 : 0)) continue;
        const k = (ro - R) / Math.max(th, 0.01); // 0 at the outer edge, 1 at the inner
        let c: number;
        if (f === 2) {
          // fading: cooler colors, the inner part dithered away
          if (k > 0.5 && !keep(x, y, 0.5)) continue;
          if (vis < 0.3 && !keep(x, y, 0.5)) continue;
          c = k < 0.5 ? T.cols[1] : T.cols[0];
        } else {
          if (k < 0.3) c = T.hot;
          else if (k < 0.6) c = T.cols[2];
          else if (k < 0.85) c = T.cols[1];
          else c = T.cols[0];
          if (f === 0 && vis < 0.2 && !keep(x, y, 0.5)) continue;
        }
        px(ctx, x, y, c);
      }
    },
  };
}

// ---- small particles (8x8, anchor 4,4) ----

function spark(f: number) {
  return {
    w: 8, h: 8, ox: 4, oy: 4,
    draw: (ctx: Ctx) => {
      if (f === 0) {
        // a 5 px cross: white core, frost, orange tips, plus two stray flecks (no gold: gold is salvage)
        px(ctx, 4, 4, 9);
        for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]]) px(ctx, x, y, 8);
        for (const [x, y] of [[2, 4], [6, 4], [4, 2], [4, 6]]) px(ctx, x, y, 16);
        px(ctx, 1, 1, 8);
        px(ctx, 6, 7, 16);
      } else if (f === 1) {
        px(ctx, 4, 4, 8);
        for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]]) px(ctx, x, y, 16);
        px(ctx, 6, 2, 13);
      } else {
        px(ctx, 4, 4, 16);
        px(ctx, 2, 6, 13);
      }
    },
  };
}

/** A puff: grows and thins out with ordered dither; lit side upper left. cols: shadow, base, lit. */
function puff(f: number, cols: readonly [number, number, number]) {
  const R = [1.8, 2.6, 3.2, 3.7][f];
  const core = [1, 1, 0.7, 0.35][f];
  const rim = [1, 0.6, 0.35, 0.15][f];
  return {
    w: 8, h: 8, ox: 4, oy: 4,
    draw: (ctx: Ctx) => {
      const cy = 4 - f * 0.3; // rises a little
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const dx = x + 0.5 - 4, dy = y + 0.5 - cy;
        const r = Math.hypot(dx, dy * 1.15);
        if (r > R) continue;
        if (!keep(x, y, r > R - 1 ? rim : core)) continue;
        const lit = dx + dy < -R * 0.45;
        const dark = dx + dy > R * 0.55;
        px(ctx, x, y, lit ? cols[2] : dark ? cols[0] : cols[1]);
      }
    },
  };
}

/** Stun stars: three little white stars circling on a flat ellipse (not gold: gold is salvage); 4 frames loop. */
function stars(f: number) {
  return {
    w: 16, h: 8, ox: 8, oy: 8,
    draw: (ctx: Ctx) => {
      const pts = [0, 1, 2].map((i) => {
        const t = f * (Math.PI / 6) + (i * Math.PI * 2) / 3;
        return { x: Math.round(8 + Math.cos(t) * 5.5 - 0.5), y: Math.round(4 + Math.sin(t) * 1.6 - 0.5), front: Math.sin(t) > -0.2 };
      });
      // far stars first, smaller and dimmer
      pts.sort((p, q) => (p.front ? 1 : 0) - (q.front ? 1 : 0));
      for (const p of pts) {
        if (p.front) {
          px(ctx, p.x, p.y, 9);
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(ctx, p.x + dx, p.y + dy, 8);
        } else {
          px(ctx, p.x, p.y, 8);
          px(ctx, p.x + 1, p.y, 7);
        }
      }
    },
  };
}

/** Contact shadow: a checkerboard ellipse in plum, which reads as ~50% without alpha. */
function shadow(w: number, h: number) {
  return {
    w, h, ox: w / 2, oy: h / 2,
    draw: (ctx: Ctx) => {
      const rx = w / 2, ry = h / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if ((x + y) % 2 === 0) px(ctx, x, y, 0);
      }
    },
  };
}

export function registerFx() {
  DIRS.forEach((dn, d) => {
    for (const t of TIERS) for (const f of [0, 1, 2]) defSprite(`fx:slash:${t}:${dn}:${f}`, slash(d, t, f));
  });
  for (const f of [0, 1, 2]) defSprite(`fx:spark:${f}`, spark(f));
  for (const f of [0, 1, 2, 3]) {
    defSprite(`fx:dust:${f}`, puff(f, [4, 7, 8]));
    defSprite(`fx:steam:${f}`, puff(f, [7, 8, 9]));
    defSprite(`fx:smoke:${f}`, puff(f, [1, 2, 5]));
    defSprite(`fx:stars:${f}`, stars(f));
  }
  defSprite('fx:shadow:s', shadow(16, 6));
  defSprite('fx:shadow:m', shadow(24, 8));
  defSprite('fx:shadow:l', shadow(32, 10));
  defSprite('fx:shadow:xl', shadow(56, 16));
}
