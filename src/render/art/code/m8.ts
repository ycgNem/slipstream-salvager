// Code-drawn placeholders for the Milestone 8 sprites (STYLE.md, PLAN.md 9.5): The Compactor and
// the parts it wears. It's a crusher truck sculpted at 2 px per unit: a plum hull on heavy treads,
// a ribbed steel bin on its back (the lid opens once its core is open and it starts to leap), a
// slate cab with a lit visor at the front, and brackets front and back. Its Booster, Springs and
// Plow are the same models as the small ones, drawn at the same 2x (`bo:part:<id>:<dir>`), so what
// you tear off it is visibly the part you bolt on.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { sculpt, sdBox, sdCyl, sdEllipsoid, unpitch, unroll, type Hit, type Mat, type Scene } from './sculpt';
import { boosterScene, BOOSTER_MATS, plumeGen } from './parts';
import { plowScene, PART_MATS as FRONT_MATS } from './m3';
import { coil, SPRING_MATS } from './m6';

type Ctx = CanvasRenderingContext2D;

/** pixels per model unit */
const K = 2;
/** the body frame */
const BW = 64, BH = 64, BOX = 32, BOY = 44;

const HULL = 0, TREAD = 1, BIN = 2, CAB = 3, VISOR = 4, STACK = 5, BRACKET = 6, BOLT = 7, CORE = 8, LID = 9;

interface Pose {
  lift: number;
  /** nose down > 0 */
  pitch: number;
  roll: number;
  fwd: number;
  phase: number;
  visor: 'lit' | 'hot' | 'dim';
  /** the bin lid: 0 shut, 1 thrown open (core open, leaping) */
  lid: number;
}
const P0: Pose = { lift: 0, pitch: 0, roll: 0, fwd: 0, phase: 0, visor: 'lit', lid: 0 };

function scene(p: Pose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // treads on the ground
    h.add(sdBox(x, ay - 7.6, z - 2.6, 10.4, 2.0, 2.6, 1.4), TREAD, x, y, z);
    let hx = x - p.fwd, hz = z - p.lift, hy = y;
    [hx, hz] = unpitch(hx, hz, p.pitch, -10, 3);
    [hy, hz] = unroll(hy, hz, p.roll, 0, 3);
    const hay = Math.abs(hy);
    // the hull
    h.add(sdBox(hx, hy, hz - 6.6, 9.6, 7.4, 3.4, 1.6), HULL, hx, hy, hz - 6.6);
    // the bin on its back, ribbed, and its lid
    h.add(sdBox(hx + 2.6, hy, hz - 12.4, 6.2, 6.4, 2.8, 1.0), BIN, hx + 2.6, hy, hz - 12.4);
    if (p.lid > 0) {
      // thrown open, hinged at the back: the core glows inside
      h.add(sdEllipsoid(hx + 2.6, hy, hz - 14.8, 3.6, 3.6, 1.6), CORE, hx + 2.6, hy, hz);
      let lx = hx - 9.0, lz = hz - 15.6;
      [lx, lz] = unpitch(lx, lz, -1.1 * p.lid, 0, 0);
      h.add(sdBox(lx + 6.2, hy, lz, 6.0, 6.2, 0.5, 0.3), LID, lx, hy, lz);
    } else h.add(sdBox(hx + 2.6, hy, hz - 15.5, 6.0, 6.2, 0.5, 0.3), LID, hx + 2.6, hy, hz);
    // the cab and its visor
    h.add(sdBox(hx - 6.2, hy, hz - 11.6, 2.6, 4.6, 2.0, 0.8), CAB, hx, hy, hz);
    h.add(sdBox(hx - 8.85, hy, hz - 11.9, 0.35, 3.4, 0.8, 0.2), VISOR, hx, hy, hz);
    // exhaust stacks either side of the bin
    h.add(sdCyl(hz - 14.2, hx + 7.6, hay - 5.6, 1.0, 2.6, 0.3), STACK, hx + 7.6, hay - 5.6, hz - 14.2);
    // corner bolts
    h.add(sdEllipsoid(hx - 8.4, hay - 6.2, hz - 9.9, 0.7, 0.7, 0.6), BOLT);
    h.add(sdEllipsoid(hx + 8.4, hay - 6.2, hz - 9.9, 0.7, 0.7, 0.6), BOLT);
    // brackets: the plow's at the front, the booster's at the back
    h.add(sdBox(hx - 10.0, hy, hz - 4.6, 0.7, 4.6, 1.4, 0.3), BRACKET, hx, hy, hz);
    h.add(sdBox(hx + 10.0, hay - 3.2, hz - 4.4, 0.7, 0.8, 2.6, 0.3), BRACKET, hx, hy, hz);
  };
}

function mats(p: Pose): Mat[] {
  const m: Mat[] = [];
  m[HULL] = {
    ramp: [49, 50, 51, 52],
    ink: 0,
    // a seam round the hull
    paint: (q) => (q.nz < 0.5 && Math.abs(q.w + 0.4) < 0.35 ? 50 : undefined),
  };
  m[TREAD] = {
    ramp: [34, 34, 35, 35],
    ink: 0,
    paint: (q) => {
      const k = (Math.floor(-q.u / 1.6 + p.phase) & 1) === 0;
      if (q.nz > 0.5) return k ? 36 : 35;
      return k ? 35 : 34;
    },
  };
  m[BIN] = {
    ramp: [44, 45, 46, 47],
    ink: 0,
    // vertical ribs down the bin's sides
    paint: (q) => (q.nz < 0.6 && ((Math.floor(q.u / 1.4) % 2) + 2) % 2 === 0 ? (q.lvl >= 2 ? 46 : 45) : undefined),
  };
  m[LID] = { ramp: [44, 45, 46, 47], ink: 0, group: BIN };
  m[CAB] = { ramp: [34, 35, 37, 38], ink: 0 };
  m[VISOR] = { ramp: p.visor === 'dim' ? [49, 50, 50, 50] : p.visor === 'hot' ? [9, 9, 9, 9] : [53, 53, 53, 9], ink: 0, group: CAB };
  m[STACK] = { ramp: [34, 2, 6, 6], ink: 0, paint: (q) => (q.nz > 0.8 && Math.hypot(q.u, q.v) < 0.6 ? 0 : undefined) };
  m[BRACKET] = { ramp: [34, 35, 37, 38], ink: 0 };
  m[BOLT] = { ramp: [6, 7, 8, 8], noInk: true };
  m[CORE] = { ramp: [53, 8, 9, 9], ink: 51 };
  return m;
}

function body(d: number, p: Pose) {
  return {
    w: BW, h: BH, ox: BOX, oy: BOY,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: BW, h: BH, ox: BOX, oy: BOY, angle: dirAngle(d), scene: scene(p), mats: mats(p), zMax: 18, scale: K });
    },
  };
}

/** A part at the boss's rear or front mount: the small part's model at 2x. */
function mountedPart(scene: Scene, mats: readonly Mat[], d: number) {
  return {
    w: 32, h: 32, ox: 16, oy: 16,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 32, h: 32, ox: 16, oy: 16, angle: dirAngle(d), scene, mats, zMax: 6, zMin: -5, scale: K });
    },
  };
}

/** Its Springs, in the body frame: a coil bumper either side of the hull. */
const springsScene: Scene = (h, x, y, z) => coil(h, x, Math.abs(y), z, 0.5, 10.4, 3.2, 7.0);

function mountedSprings(d: number) {
  return {
    w: BW, h: BH, ox: BOX, oy: BOY,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: BW, h: BH, ox: BOX, oy: BOY, angle: dirAngle(d), scene: springsScene, mats: SPRING_MATS, zMax: 8, scale: K });
    },
  };
}

export function registerM8() {
  DIRS.forEach((dn, d) => {
    for (const f of [0, 1]) {
      defSprite(`bo:compactor:stalk:${dn}:${f}`, body(d, { ...P0, phase: f, lift: f ? 0.5 : 0 }));
      defSprite(`bo:compactor:windup:${dn}:${f}`, body(d, { ...P0, lift: f ? -1.6 : -1.2, pitch: f ? 0.16 : 0.12, visor: 'hot' }));
      defSprite(`bo:compactor:charge:${dn}:${f}`, body(d, { ...P0, phase: f, lift: -0.4, pitch: 0.18, fwd: 1, visor: 'hot' }));
      defSprite(`bo:compactor:stunned:${dn}:${f}`, body(d, { ...P0, lift: -1.8, pitch: 0.06, roll: f ? 0.12 : 0.08, visor: 'dim' }));
      defSprite(`bo:compactor:crouch:${dn}:${f}`, body(d, { ...P0, lift: f ? -2.6 : -2.2, pitch: 0.1, visor: 'hot', lid: 1 }));
      defSprite(`bo:plume:${dn}:${f}`, plumeGen(d, f, K));
    }
    defSprite(`bo:compactor:skid:${dn}`, body(d, { ...P0, pitch: -0.12, fwd: -1, roll: 0.05 }));
    defSprite(`bo:compactor:air:${dn}`, body(d, { ...P0, lift: 1.0, pitch: 0.15, lid: 1 }));
    defSprite(`bo:compactor:land:${dn}`, body(d, { ...P0, lift: -2.0, roll: 0.06, visor: 'dim', lid: 1 }));
    defSprite(`bo:part:booster:${dn}`, mountedPart(boosterScene, BOOSTER_MATS, d));
    defSprite(`bo:part:plow:${dn}`, mountedPart(plowScene, FRONT_MATS, d));
    defSprite(`bo:part:springs:${dn}`, mountedSprings(d));
  });
}
