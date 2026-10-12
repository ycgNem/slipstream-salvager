// The Scrapper (the player): a small, hand-patched rust-orange robot on dark treads with a steel
// claw at the front. 32x32 frames, anchor (16,20). Sculpted per direction (sculpt.ts); the claw
// tip sits at clawTip(dirAngle(d)) in the drive frames. The rear stays clear for the booster.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { sculpt, sdBox, sdCapsule, sdCyl, sdEllipsoid, unpitch, type Hit, type Mat, type Px, type Scene } from './sculpt';

const BODY = 0, PATCH = 1, TREAD = 2, CLAW = 3, EYE = 4, HEAD = 5, ANT = 6, TIP = 7, VENT = 8;

interface Pose {
  /** claw thrust (units forward) and jaw spread */
  ext: number;
  open: number;
  /** body pitch, nose down > 0 (radians) */
  pitch: number;
  /** body height scale (squash) and lift */
  squash: number;
  lift: number;
  /** body slides back (recoil) */
  back: number;
  /** tread pattern phase */
  phase: number;
}

const BASE: Pose = { ext: 0, open: 0, pitch: 0, squash: 1, lift: 0, back: 0, phase: 0 };

function scene(p: Pose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    // treads: on the ground, never posed
    const ay = Math.abs(y);
    h.add(sdBox(x + 0.5, ay - 7.2, z - 2.5, 7.2, 1.9, 2.5, 1.4), TREAD, x + 0.5, y, z);
    // body group
    let bx = x + p.back, bz = z;
    [bx, bz] = unpitch(bx, bz, p.pitch, -6, 2.5);
    bz = (bz - p.lift - 2.5) / p.squash + 2.5;
    // nose: the low front hull the claw comes out of, its front corners cut off so the top view
    // points forward (and low, so the claw shows over it from behind)
    {
      const nb = sdBox(bx - 0.2, y, bz - 4.0, 6.4, 5.4, 1.7, 1.2);
      const cham = (ay + bx - 9.2) * 0.7071;
      h.add(Math.max(nb, cham), BODY, bx, y, bz);
    }
    // cab: the taller rear block, its one eye looking forward over the nose
    h.add(sdBox(bx + 3.7, y, bz - 7.6, 3.2, 4.8, 2.9, 1.5), HEAD, bx + 3.7, y, bz - 7.6);
    h.add(sdEllipsoid(bx + 0.45, y - 1.4, bz - 8.4, 0.9, 1.4, 1.3), EYE, bx, y, bz);
    // a mismatched plate bolted onto the nose (hand-patched)
    h.add(sdBox(bx - 2.4, y + 2.4, bz - 5.75, 2.0, 2.0, 0.3, 0.25), PATCH, bx - 2.4, y + 2.4, bz);
    // side vent on the right flank
    h.add(sdBox(bx + 3.7, y - 4.85, bz - 7.0, 2.0, 0.3, 1.0, 0.1), VENT, bx, y, bz);
    // antenna on the cab's left rear corner
    h.add(sdCapsule(bx, y, bz, -5.2, -3.2, 9.5, -5.6, -3.6, 13.2, 0.35), ANT);
    h.add(sdEllipsoid(bx + 5.6, y + 3.6, bz - 13.5, 0.8, 0.8, 0.8), TIP);
    // claw: arm, knuckle and two jaws
    const e = p.ext;
    const tipX = 11 + e;
    h.add(sdBox(bx - (6.6 + e / 2), y, bz - 4.3, 1.6 + e / 2, 1.3, 1.05, 0.5), CLAW, bx, y, bz);
    h.add(sdCyl(y, bx - (8.0 + e), bz - 4.4, 1.5, 2.0, 0.3), CLAW, bx, y, bz);
    const sp = 0.9 + p.open;
    h.add(sdCapsule(bx, ay, bz, 8.3 + e, 1.9, 4.3, tipX - 0.7, sp, 3.75, 0.85), CLAW, bx, y, bz);
  };
}

function treadPaint(phase: number) {
  return (q: Px) => {
    // cleats across the tread, shifting 1 px per drive frame
    const k = (Math.floor(-q.u + phase) & 1) === 0;
    if (q.nz > 0.5) return k ? 2 : 1;
    return k ? 1 : 0;
  };
}

function mats(p: Pose): Mat[] {
  const m: Mat[] = [];
  m[BODY] = {
    ramp: [20, 21, 22, 63],
    ink: 19,
  };
  m[PATCH] = { ramp: [3, 4, 4, 63], ink: 19, group: 1, paint: (q) => (Math.abs(Math.abs(q.u) - 1.9) < 0.6 && Math.abs(Math.abs(q.v) - 1.7) < 0.6 ? 20 : undefined) };
  m[TREAD] = { ramp: [1, 1, 2, 2], ink: 0, paint: treadPaint(p.phase) };
  m[CLAW] = { ramp: [2, 6, 7, 8], ink: 0 };
  m[EYE] = { ramp: [8, 8, 9, 9], ink: 0, group: 5 };
  m[HEAD] = { ramp: [20, 21, 22, 63], ink: 19 };
  m[ANT] = { ramp: [2, 6, 7, 7], noInk: true };
  m[TIP] = { ramp: [16, 16, 23, 63], noInk: true };
  m[VENT] = { ramp: [19, 19, 20, 20], group: HEAD };
  return m;
}

function draw(d: number, p: Pose) {
  return {
    w: 32, h: 32, ox: 16, oy: 20,
    draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 32, h: 32, ox: 16, oy: 20, angle: dirAngle(d), scene: scene(p), mats: mats(p), zMax: 14 });
    },
  };
}

export function registerScrapper() {
  DIRS.forEach((dn, d) => {
    for (const f of [0, 1]) {
      defSprite(`pl:scrapper:drive:${dn}:${f}`, draw(d, { ...BASE, phase: f }));
      defSprite(`pl:scrapper:rip:${dn}:${f}`, draw(d, { ...BASE, ext: f ? 4 : 3, open: f ? 1.8 : 1.3, pitch: 0.08, phase: f }));
    }
    defSprite(`pl:scrapper:hurt:${dn}`, draw(d, { ...BASE, ext: -2.5, open: 0.6, pitch: -0.2, squash: 0.85, back: 1.2, lift: 0.4 }));
  });
}
