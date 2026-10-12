// The Rammer (the enemy): a heavy, cold, blocky bot in steel blue and slate with a pale V-shaped
// ram plow at the front, a violet cab with a lit visor, exhaust stacks and a bolted mounting
// bracket on its back. The booster is NOT drawn here: the renderer overlays `part:booster:<dir>`
// on the bracket at rearMount(d, 10). 40x40 frames, anchor (20,26). No red anywhere (red means
// danger telegraphs only).
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { line } from '../pixel';
import { sculpt, sdBox, sdCyl, sdEllipsoid, unpitch, unroll, unyaw, project, type Hit, type Mat, type Scene } from './sculpt';

const HULL = 0, TREAD = 1, PLOW = 2, CAB = 3, VISOR = 4, STACK = 5, BRACKET = 6, BOLT = 7;

interface Pose {
  /** hull drop (negative) or bob (positive), units */
  lift: number;
  /** hull pitch, nose down > 0 (radians), about the rear bottom */
  pitch: number;
  /** hull roll, right side down > 0 */
  roll: number;
  /** hull slide along its facing */
  fwd: number;
  /** tread cleat phase */
  phase: number;
  /** visor: 'lit' (normal), 'hot' (winding up, charging), 'dim' (stunned) */
  visor: 'lit' | 'hot' | 'dim';
  /** motion streak frame (-1 = none) */
  streak: number;
}

const BASE: Pose = { lift: 0, pitch: 0, roll: 0, fwd: 0, phase: 0, visor: 'lit', streak: -1 };

const WING = (17.8 * Math.PI) / 180;

function scene(p: Pose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // treads stay on the ground
    h.add(sdBox(x + 0.5, ay - 11.3, z - 3.4, 9.7, 2.4, 3.4, 1.6), TREAD, x + 0.5, y, z);
    // the posed upper body
    let hx = x - p.fwd, hz = z - p.lift, hy = y;
    [hx, hz] = unpitch(hx, hz, p.pitch, -9, 2.5);
    [hy, hz] = unroll(hy, hz, p.roll, 0, 3);
    const hay = Math.abs(hy);
    // hull
    h.add(sdBox(hx + 1, hy, hz - 8.4, 8.2, 9.4, 5.2, 2.4), HULL, hx + 1, hy, hz - 8.4);
    // V plow: two angled plates meeting at the front, and the brace holding them
    {
      const [wx, wy] = unyaw(hx - 11, hay - 6.25, WING);
      h.add(sdBox(wx, wy, hz - 6.0, 0.95, 6.9, 5.0, 0.4), PLOW, wx, wy, hz);
      h.add(sdBox(hx - 7.6, hy, hz - 6.5, 1.8, 6.0, 1.1, 0.4), PLOW, hx, hy, hz);
    }
    // cab and visor
    h.add(sdBox(hx - 1.0, hy, hz - 15.0, 3.6, 5.4, 1.8, 1.0), CAB, hx, hy, hz);
    h.add(sdBox(hx - 4.55, hy, hz - 15.2, 0.4, 3.9, 0.75, 0.2), VISOR, hx, hy, hz);
    // exhaust stacks
    h.add(sdCyl(hz - 14.4, hx + 6.3, hay - 6.4, 1.3, 2.5, 0.3), STACK, hx + 6.3, hay - 6.4, hz - 14.4);
    // corner bolts on the hull top
    h.add(sdEllipsoid(hx - 5.3, hay - 7.4, hz - 13.4, 0.75, 0.75, 0.6), BOLT);
    // rear mounting bracket: two posts and a crossbar (the booster bolts on here)
    h.add(sdBox(hx + 9.6, hay - 4.4, hz - 4.6, 0.8, 0.9, 3.2, 0.3), BRACKET, hx, hy, hz);
    h.add(sdBox(hx + 9.9, hy, hz - 3.75, 0.7, 5.4, 0.9, 0.3), BRACKET, hx, hy, hz);
    h.add(sdEllipsoid(hx + 10.6, hay - 4.4, hz - 6.6, 0.6, 0.6, 0.6), BOLT);
    h.add(sdEllipsoid(hx + 10.6, hay - 4.4, hz - 2.6, 0.6, 0.6, 0.6), BOLT);
  };
}

function mats(p: Pose): Mat[] {
  const m: Mat[] = [];
  m[HULL] = {
    ramp: [44, 45, 46, 47],
    ink: 0,
    paint: (q) => {
      // a seam across the top plate
      if (q.nz > 0.75 && Math.abs(q.u + 1.5) < 0.45) return 45;
      return undefined;
    },
  };
  m[TREAD] = {
    ramp: [34, 34, 35, 35],
    ink: 0,
    paint: (q) => {
      const k = (Math.floor(-q.u / 1.5 + p.phase) & 1) === 0;
      if (q.nz > 0.5) return k ? 36 : 35;
      return k ? 35 : 34;
    },
  };
  m[PLOW] = {
    ramp: [6, 7, 8, 8],
    ink: 44,
    paint: (q) => {
      // horizontal ribs on the blade faces
      if (q.nz < 0.5 && Math.abs(((q.w - 1.2) % 3 + 3) % 3 - 1.5) < 0.4) return q.lvl >= 2 ? 7 : 6;
      return undefined;
    },
  };
  m[CAB] = { ramp: [49, 50, 51, 52], ink: 0 };
  m[VISOR] = { ramp: p.visor === 'dim' ? [49, 50, 50, 50] : p.visor === 'hot' ? [9, 9, 9, 9] : [53, 53, 53, 9], ink: 0, group: CAB };
  m[STACK] = {
    ramp: [34, 2, 6, 6],
    ink: 0,
    paint: (q) => (q.nz > 0.8 && Math.hypot(q.u, q.v) < 0.75 ? 0 : undefined),
  };
  m[BRACKET] = { ramp: [34, 35, 37, 38], ink: 0 };
  m[BOLT] = { ramp: [6, 7, 8, 8], noInk: true };
  return m;
}

/** Motion streaks behind a charging Rammer: dashed lines in pale steel, on empty pixels only. */
function streaks(ctx: CanvasRenderingContext2D, occ: Uint8Array, angle: number, frame: number) {
  const lanes: [number, number, number][] = [[-12.5, 2, 9], [12.5, 2, 9], [-6, 11, 6], [6, 11, 6]];
  lanes.forEach(([yy, zz, len], i) => {
    const off = (frame + i) % 2 ? 2 : 0;
    const x0 = -11 - off, x1 = x0 - len + ((i + frame) % 2) * 2;
    const [ax, ay] = project(angle, x0, yy, zz);
    const [bx, by] = project(angle, x1, yy, zz);
    const sx0 = Math.round(20 + ax), sy0 = Math.round(26 + ay), sx1 = Math.round(20 + bx), sy1 = Math.round(26 + by);
    // walk the line ourselves so body pixels are never overdrawn
    const n = Math.max(Math.abs(sx1 - sx0), Math.abs(sy1 - sy0));
    for (let s = 0; s <= n; s++) {
      const px = Math.round(sx0 + ((sx1 - sx0) * s) / (n || 1));
      const py = Math.round(sy0 + ((sy1 - sy0) * s) / (n || 1));
      if (px < 0 || py < 0 || px >= 40 || py >= 40) continue;
      if (occ[py * 40 + px]) continue;
      if ((s + frame) % 4 === 3) continue;
      line(ctx, px, py, px, py, s < n / 2 ? 8 : 7);
    }
  });
}

function draw(d: number, p: Pose) {
  return {
    w: 40, h: 40, ox: 20, oy: 26,
    draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 40, h: 40, ox: 20, oy: 26, angle: dirAngle(d), scene: scene(p), mats: mats(p), zMax: 19 });
      if (p.streak >= 0) {
        // streaks only on empty pixels, so they never cut into the body or its outline
        const id = ctx.getImageData(0, 0, 40, 40).data;
        const occ = new Uint8Array(40 * 40);
        for (let i = 0; i < occ.length; i++) occ[i] = id[i * 4 + 3] ? 1 : 0;
        streaks(ctx, occ, dirAngle(d), p.streak);
      }
    },
  };
}

export function registerRammer() {
  DIRS.forEach((dn, d) => {
    for (const f of [0, 1]) {
      defSprite(`en:rammer:stalk:${dn}:${f}`, draw(d, { ...BASE, phase: f, lift: f ? 0.8 : 0 }));
      defSprite(`en:rammer:windup:${dn}:${f}`, draw(d, { ...BASE, phase: 0, lift: f ? -2.0 : -1.5, pitch: f ? 0.22 : 0.16, visor: 'hot' }));
      defSprite(`en:rammer:charge:${dn}:${f}`, draw(d, { ...BASE, phase: f, lift: -0.6, pitch: 0.24, fwd: 1, visor: 'hot', streak: f }));
      defSprite(`en:rammer:stunned:${dn}:${f}`, draw(d, { ...BASE, lift: f ? -2.4 : -2.0, pitch: 0.08, roll: f ? 0.2 : 0.16, visor: 'dim' }));
    }
    defSprite(`en:rammer:skid:${dn}`, draw(d, { ...BASE, pitch: -0.17, fwd: -1, roll: 0.05 }));
  });
}
