// Code-drawn bodies for the Milestone 9 chassis (PLAN.md 9.6): the Skiff and the Hauler. Same
// frames, anchor and claw as the Scrapper (32x32, (16,20); the claw tip at clawTip in the drive
// frames), so every part, the tier glow and the heading tick sit where they do on it. Both stay in
// the player's rust and orange; the shapes say which is which.
// - The Skiff: a low, long wedge on two thin skids (no treads: it glides), a bubble cab, a tail fin.
// - The Hauler: a tall slab on wide treads, a steel push plate across its nose, a stack on its cab.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { sculpt, sdBox, sdCapsule, sdCyl, sdEllipsoid, unpitch, type Hit, type Mat, type Px, type Scene } from './sculpt';

const BODY = 0, PLATE = 1, TREAD = 2, CLAW = 3, EYE = 4, HEAD = 5, FIN = 6, SKID = 7, STACK = 8;

interface Pose {
  ext: number;
  open: number;
  pitch: number;
  lift: number;
  back: number;
  phase: number;
}
const BASE: Pose = { ext: 0, open: 0, pitch: 0, lift: 0, back: 0, phase: 0 };

/** The claw, the Scrapper's: arm, knuckle and two jaws at the nose, low enough to show over it. */
function claw(h: Hit, bx: number, y: number, ay: number, bz: number, p: Pose) {
  const e = p.ext, tipX = 11 + e;
  h.add(sdBox(bx - (6.6 + e / 2), y, bz - 4.3, 1.6 + e / 2, 1.3, 1.05, 0.5), CLAW, bx, y, bz);
  h.add(sdCyl(y, bx - (8.0 + e), bz - 4.4, 1.5, 2.0, 0.3), CLAW, bx, y, bz);
  h.add(sdCapsule(bx, ay, bz, 8.3 + e, 1.9 + p.open * 0.5, 4.3, tipX - 0.7, 0.9 + p.open, 3.75, 0.85), CLAW, bx, y, bz);
}

function skiff(p: Pose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // two thin skids on the ground
    h.add(sdBox(x + 0.5, ay - 6.4, z - 0.7, 8.2, 0.8, 0.7, 0.6), SKID, x, y, z);
    let bx = x + p.back, bz = z - p.lift;
    [bx, bz] = unpitch(bx, bz, p.pitch, -6, 2.5);
    // the low wedge hull, its nose cut to a point
    {
      const hull = sdBox(bx - 0.5, y, bz - 3.0, 7.8, 5.0, 1.3, 1.1);
      const cham = (ay * 1.3 + bx - 7.6) * 0.61;
      h.add(Math.max(hull, cham), BODY, bx, y, bz);
    }
    // side pods over the skids
    h.add(sdEllipsoid(bx + 1.6, ay - 5.4, bz - 2.4, 4.2, 1.3, 1.1), PLATE, bx, y, bz);
    // the bubble cab and its eye
    h.add(sdEllipsoid(bx + 2.6, y, bz - 5.4, 3.0, 3.2, 1.9), HEAD, bx + 2.6, y, bz - 5.4);
    h.add(sdEllipsoid(bx + 0.1, y - 1.2, bz - 6.0, 0.9, 1.3, 1.1), EYE, bx, y, bz);
    // the tail fin
    h.add(sdBox(bx + 6.0, y, bz - 6.6, 1.6, 0.35, 2.4, 0.3), FIN, bx, y, bz);
    claw(h, bx, y, ay, bz, p);
  };
}

function hauler(p: Pose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // wide, tall treads
    h.add(sdBox(x + 0.5, ay - 8.2, z - 3.0, 7.8, 2.3, 3.0, 1.6), TREAD, x + 0.5, y, z);
    let bx = x + p.back, bz = z - p.lift;
    [bx, bz] = unpitch(bx, bz, p.pitch, -6, 2.5);
    // the slab hull
    h.add(sdBox(bx + 0.2, y, bz - 5.2, 6.6, 6.2, 2.6, 1.4), BODY, bx + 0.2, y, bz - 5.2);
    // the push plate across the nose
    h.add(sdBox(bx - 6.9, y, bz - 4.6, 0.9, 6.4, 2.2, 0.4), PLATE, bx, y, bz);
    // the tall cab, its eye, and a stack
    h.add(sdBox(bx + 3.2, y, bz - 10.0, 3.2, 4.8, 2.4, 1.3), HEAD, bx + 3.2, y, bz - 10.0);
    h.add(sdEllipsoid(bx + 0.1, y - 1.4, bz - 10.6, 0.9, 1.4, 1.2), EYE, bx, y, bz);
    h.add(sdCyl(bz - 12.0, bx + 4.6, y + 3.2, 0.9, 1.8, 0.3), STACK, bx + 4.6, y + 3.2, bz - 12.0);
    claw(h, bx, y, ay, bz, p);
  };
}

function treadPaint(phase: number) {
  return (q: Px) => {
    const k = (Math.floor(-q.u + phase) & 1) === 0;
    if (q.nz > 0.5) return k ? 2 : 1;
    return k ? 1 : 0;
  };
}

function mats(p: Pose, kind: 'skiff' | 'hauler'): Mat[] {
  const m: Mat[] = [];
  // the Skiff is the lighter orange, the Hauler the darker rust
  m[BODY] = { ramp: kind === 'skiff' ? [21, 22, 63, 63] : [19, 20, 21, 22], ink: 19 };
  m[HEAD] = { ramp: kind === 'skiff' ? [20, 21, 22, 63] : [20, 21, 22, 63], ink: 19 };
  m[PLATE] = { ramp: [2, 6, 7, 8], ink: 0 };
  m[TREAD] = { ramp: [1, 1, 2, 2], ink: 0, paint: treadPaint(p.phase) };
  m[SKID] = { ramp: [1, 2, 6, 7], ink: 0 };
  m[CLAW] = { ramp: [2, 6, 7, 8], ink: 0 };
  m[EYE] = { ramp: [8, 8, 9, 9], ink: 0, group: HEAD };
  m[FIN] = { ramp: [19, 20, 21, 22], ink: 19, group: HEAD };
  m[STACK] = { ramp: [0, 2, 6, 6], ink: 0, paint: (q) => (q.nz > 0.8 && Math.hypot(q.u, q.v) < 0.5 ? 0 : undefined) };
  return m;
}

function draw(kind: 'skiff' | 'hauler', d: number, p: Pose) {
  return {
    w: 32, h: 32, ox: 16, oy: 20,
    draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 32, h: 32, ox: 16, oy: 20, angle: dirAngle(d), scene: kind === 'skiff' ? skiff(p) : hauler(p), mats: mats(p, kind), zMax: 15 });
    },
  };
}

export function registerM9() {
  for (const kind of ['skiff', 'hauler'] as const)
    DIRS.forEach((dn, d) => {
      for (const f of [0, 1]) {
        // the Skiff hovers a touch, bobbing; the Hauler's treads turn
        defSprite(`pl:${kind}:drive:${dn}:${f}`, draw(kind, d, { ...BASE, phase: f, lift: kind === 'skiff' ? (f ? 0.6 : 0.3) : 0 }));
        defSprite(`pl:${kind}:rip:${dn}:${f}`, draw(kind, d, { ...BASE, ext: f ? 4 : 3, open: f ? 1.8 : 1.3, pitch: 0.08, phase: f }));
      }
      defSprite(`pl:${kind}:hurt:${dn}`, draw(kind, d, { ...BASE, ext: -2.5, open: 0.6, pitch: -0.2, back: 1.2, lift: 0.4 }));
    });
}
