// The Booster: the part you tear off a Rammer's back and bolt onto your own. Gold salvage colors
// with a steel nozzle and strap. The same mounted overlay (`part:booster:<dir>`, 16x16, anchor 8,8
// = the rear mount point) is used on the Rammer and on the Scrapper, so the thing you tear off is
// visibly the thing you bolt on. Also: the loose pickup, the HUD icon, and the plume.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { px } from '../pixel';
import { sculpt, sdCyl, sdEllipsoid, sdFrustum, SQ, type Hit, type Mat, type Scene } from './sculpt';

const GOLD = 0, NOZZLE = 1, THROAT = 2, STRAP = 3, BOLT = 4;

/**
 * The booster in its carrier's frame: origin at the mount point, x = the carrier's forward, so the
 * nozzle points back (-x). The can sits a little forward of the mount so the nozzle exit is ~4 px
 * behind it and the plume has room.
 */
export const NOZZLE_EXIT = -3.7;

const boosterScene: Scene = (h: Hit, x: number, y: number, z: number) => {
  // can with a rounded nose
  h.add(sdCyl(x - 1.2, y, z, 3.4, 2.6, 1.2), GOLD, x, y, z);
  h.add(sdEllipsoid(x - 3.5, y, z, 1.5, 3.0, 3.0), GOLD, x, y, z);
  // steel strap round the middle with a bolt on top
  h.add(sdCyl(x - 0.9, y, z, 3.75, 0.6, 0.2), STRAP, x, y, z);
  h.add(sdEllipsoid(x - 0.9, y, z - 3.75, 0.65, 0.65, 0.55), BOLT);
  // nozzle bell (hollow) and the dark throat inside it
  const outer = sdFrustum(x, y, z, NOZZLE_EXIT, 3.0, -1.2, 2.0);
  const inner = sdFrustum(x, y, z, NOZZLE_EXIT - 1, 2.5, -1.5, 1.3);
  h.add(Math.max(outer, -inner), NOZZLE, x, y, z);
  h.add(sdCyl(x + 1.45, y, z, 1.5, 0.3), THROAT, x, y, z);
};

const MATS: Mat[] = [];
MATS[GOLD] = { ramp: [17, 18, 18, 28], ink: 17 };
MATS[NOZZLE] = { ramp: [2, 6, 7, 8], ink: 2 };
MATS[THROAT] = { ramp: [0, 1, 1, 1], ink: 0, group: NOZZLE };
MATS[STRAP] = { ramp: [2, 6, 7, 8], ink: 2 };
MATS[BOLT] = { ramp: [7, 8, 9, 9], noInk: true };

function mounted(d: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 8,
    draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 8, angle: dirAngle(d), scene: boosterScene, mats: MATS, zMax: 5, zMin: -5 });
    },
  };
}

/** The booster lying loose on the floor, resting on its side, slightly diagonal. */
const pickup = {
  w: 16, h: 16, ox: 8, oy: 12,
  draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
    const lying: Scene = (h, x, y, z) => boosterScene(h, x + 1, y, z - 3.3);
    const grid = sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 12, angle: -0.42, scene: lying, mats: MATS, zMax: 8 });
    // a salvage glint: a white cross on the brightest gold pixel nearest the top left
    let best = -1;
    grid.forEach((p, i) => {
      if (p && p.m === GOLD && !p.ink && p.lvl >= 2 && (best < 0 || (i % 16) + (i >> 4) < (best % 16) + (best >> 4))) best = i;
    });
    if (best >= 0) {
      const gx = best % 16, gy = best >> 4;
      px(ctx, gx, gy, 9);
      if (grid[best + 1]) px(ctx, gx + 1, gy, 28);
      if (grid[best + 16]) px(ctx, gx, gy + 1, 28);
    }
  },
};

/** HUD icon: the booster at a jaunty diagonal, seen more from above, filling 14x14. */
const icon = {
  w: 16, h: 16, ox: 0, oy: 0,
  draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
    sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 8, angle: -Math.PI / 4, scene: boosterScene, mats: MATS, zMax: 5, zMin: -5, scale: 1.15, view: [0.8, 0.6] });
  },
};

/**
 * The plume: flame out of the nozzle, pointing opposite the facing. Anchor (8,8) is the same
 * mount point as the booster's, so the renderer draws it at the same spot (under the booster).
 * Two flicker frames. Orange outside, pale yellow inside, a white core at the nozzle.
 */
function plume(d: number, f: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 8,
    draw: (ctx: CanvasRenderingContext2D) => {
      const a = dirAngle(d);
      // the flame axis on screen: back along the carrier's facing, with the 3/4 squash
      const bx = -Math.cos(a), by = -Math.sin(a) * SQ;
      const bl = Math.hypot(bx, by);
      const ux = bx / bl, uy = by / bl;
      // nozzle exit on screen, relative to the anchor
      const ex = Math.cos(a) * NOZZLE_EXIT, ey = Math.sin(a) * NOZZLE_EXIT * SQ;
      // as long as fits inside the frame from the nozzle (foreshortened end-on), shorter on frame 1
      let room = 99;
      if (ux) room = Math.min(room, ux > 0 ? (8 - ex) / ux : (8 + ex) / -ux);
      if (uy) room = Math.min(room, uy > 0 ? (8 - ey) / uy : (8 + ey) / -uy);
      const len = Math.min(6.5 * Math.max(0.8, bl), room - 0.3) * (f ? 0.78 : 1);
      const r0 = 2.6 * (1 - 0.15 * Math.abs(Math.sin(a))) + (f ? 0.3 : 0);
      for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
        const sx = xx + 0.5 - 8 - ex, sy = yy + 0.5 - 8 - ey;
        const s = sx * ux + sy * uy; // along the flame
        const q = -sx * uy + sy * ux; // across it
        if (s < -0.6 || s > len) continue;
        const tt = Math.max(0, s) / len;
        // teardrop: full width near the nozzle, tapering to a point, with a 1 px wobble
        const wob = f ? Math.sin(s * 1.7) * 0.35 : Math.sin(s * 1.7 + 1.5) * 0.35;
        const half = r0 * (1 - tt * tt) * (1 - 0.35 * tt) + wob * tt;
        if (Math.abs(q) > half) continue;
        const k = Math.abs(q) / Math.max(half, 0.01);
        let c: number;
        if (tt < 0.28 && k < 0.45) c = 9;
        else if (tt < 0.6 && k < 0.6) c = 28;
        else if (k < 0.85 && tt < 0.85) c = 17;
        else c = 16;
        px(ctx, xx, yy, c);
      }
    },
  };
}

export function registerParts() {
  DIRS.forEach((dn, d) => {
    defSprite(`part:booster:${dn}`, mounted(d));
    for (const f of [0, 1]) defSprite(`fx:plume:${dn}:${f}`, plume(d, f));
  });
  defSprite('pickup:booster', pickup);
  defSprite('icon:part:booster', icon);
}
