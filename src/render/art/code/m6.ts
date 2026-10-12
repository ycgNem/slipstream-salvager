// Code-drawn placeholders for the Milestone 6 sprites (STYLE.md, PLAN.md 9.1-9.2): the Hopper, the
// Bouncer, the Jump Jets and the Springs (mounted, loose and as HUD icons). Sculpted per direction
// like the other robots (sculpt.ts), at the final names, sizes and anchors; the pixel-art-studio
// sheets in src/art/ replace them where they're better.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { px } from '../pixel';
import { sculpt, sdBox, sdCapsule, sdCyl, sdEllipsoid, unpitch, type Hit, type Mat, type Px, type Scene } from './sculpt';

type Ctx = CanvasRenderingContext2D;

// ---- the Hopper ----
// A squat scrap frog in sage and slate: a low dome of a body, big haunches either side, little front
// legs and two pale eye domes. Its jump jets are the `part:jets` overlay on its back.

const BODY = 0, LEG = 1, FOOT = 2, EYE = 3, BELLY = 4;
const HOPPER_MATS: Mat[] = [];
HOPPER_MATS[BODY] = { ramp: [35, 36, 37, 38], ink: 34 };
HOPPER_MATS[LEG] = { ramp: [34, 35, 36, 37], ink: 0, group: 1 };
HOPPER_MATS[FOOT] = { ramp: [1, 2, 6, 7], ink: 0, group: 1 };
HOPPER_MATS[EYE] = { ramp: [7, 8, 9, 9], ink: 5 };
HOPPER_MATS[BELLY] = { ramp: [5, 6, 7, 7], ink: 1 };

interface HPose {
  /** body height (units above the ground) */
  lift: number;
  /** how far the haunches are folded (1 = crouched, 0 = standing, -1 = legs stretched out behind) */
  fold: number;
  /** nose up (> 0) */
  pitch: number;
  /** feet splayed out sideways (landing) */
  splay: number;
}
const H0: HPose = { lift: 0, fold: 0, pitch: 0, splay: 0 };

function hopperScene(p: HPose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // back feet on the ground (pushed back and lifted when the legs stretch out)
    const ext = Math.max(0, -p.fold);
    h.add(sdBox(x + 2 + ext * 3, ay - 7.6 - p.splay, z - 0.7 - ext * 3, 3.4, 1.7, 0.7, 0.4), FOOT, x, y, z);
    // the haunches: big folded thighs either side
    h.add(sdEllipsoid(x + 2.6 + ext * 2, ay - 6.4 - p.splay * 0.6, z - 3.2 - p.lift * 0.5 - ext * 1.5, 4.4, 2.5, 3.0 + p.fold * 0.4), LEG, x, y, z);
    // little front legs
    h.add(sdCapsule(x, ay, z, -3.4, 3.6, 3.2 + p.lift * 0.6, -5.0, 5.2 + p.splay * 0.6, 0.6, 1.0), LEG, x, y, z);
    // the posed body
    let bx = x, bz = z - p.lift;
    [bx, bz] = unpitch(bx, bz, -p.pitch, 3, 4);
    h.add(sdEllipsoid(bx, y, bz - 5.6, 7.0, 6.2, 4.0), BODY, bx, y, bz);
    h.add(sdEllipsoid(bx - 1.5, y, bz - 3.0, 6.0, 5.0, 2.2), BELLY, bx, y, bz);
    // the head bump and two eye domes
    h.add(sdEllipsoid(bx - 4.6, y, bz - 7.6, 3.4, 4.6, 2.6), BODY, bx, y, bz);
    h.add(sdEllipsoid(bx - 5.6, ay - 2.6, bz - 9.6, 1.4, 1.4, 1.3), EYE, bx, y, bz);
    // the bracket on its back the jets bolt to
    h.add(sdBox(bx + 6.4, y, bz - 6.6, 1.0, 2.6, 1.4, 0.4), FOOT, bx, y, bz);
  };
}

function hopper(d: number, pose: HPose) {
  return {
    w: 40, h: 40, ox: 20, oy: 26,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 40, h: 40, ox: 20, oy: 26, angle: dirAngle(d), scene: hopperScene(pose), mats: HOPPER_MATS, zMax: 14 });
    },
  };
}

// ---- the Bouncer ----
// A round chrome pinball of a bot with a dark visor slit and a cap on top. The Springs are the
// `part:springs` overlay round its middle. A meridian band shifts between the roll frames, so it
// reads as rolling.

const SHELL = 0, VISOR = 1, CAP = 2, BAND = 3;

function bouncerMats(phase: number): Mat[] {
  const m: Mat[] = [];
  m[SHELL] = {
    ramp: [5, 6, 7, 8],
    ink: 44,
    paint: (q: Px) => {
      // a band round the ball, moved along by the roll frame
      const a = Math.atan2(q.v, q.u + 0.01);
      if (Math.abs(Math.sin(a * 1 + phase * 1.6)) < 0.18 && q.nz > -0.2) return q.lvl >= 2 ? 45 : 44;
      return undefined;
    },
  };
  m[VISOR] = { ramp: [44, 44, 46, 47], ink: 0, noInk: true };
  m[CAP] = { ramp: [44, 45, 46, 47], ink: 0 };
  m[BAND] = { ramp: [1, 2, 6, 6], ink: 0 };
  return m;
}

interface BPose {
  lift: number;
  /** squashed down (winding up, landing a bounce) */
  squash: number;
  phase: number;
  /** leaning (dizzy) */
  lean: number;
}
const B0: BPose = { lift: 0, squash: 0, phase: 0, lean: 0 };

function bouncerScene(p: BPose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const bz = z - p.lift;
    const by = y - p.lean * (bz - 2) * 0.25;
    h.add(sdEllipsoid(x, by, bz - 7.0 + p.squash, 7.4, 7.4, 6.8 - p.squash), SHELL, x, by, bz - 7);
    // the visor slit across its front
    h.add(sdBox(x - 6.1, by, bz - 8.2 + p.squash * 0.5, 1.4, 3.8, 0.9, 0.3), VISOR, x, by, bz);
    // a dark belt under the springs
    h.add(sdCyl(bz - 4.4 + p.squash * 0.6, x, by, 7.6, 0.7, 0.3), BAND, x, by, bz);
    // the cap on top
    h.add(sdCyl(bz - 13.8 + p.squash * 1.6, x, by, 2.0, 0.9, 0.4), CAP, x, by, bz);
  };
}

function bouncer(d: number, pose: BPose) {
  return {
    w: 32, h: 32, ox: 16, oy: 20,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 32, h: 32, ox: 16, oy: 20, angle: dirAngle(d), scene: bouncerScene(pose), mats: bouncerMats(pose.phase), zMax: 16 });
    },
  };
}

// ---- the parts ----
// Salvage gold on steel, like the others, so a part reads as "take this" on any body.

const GOLD = 0, STEEL = 1, DARK = 2;
const PART_MATS: Mat[] = [];
PART_MATS[GOLD] = { ramp: [17, 18, 18, 28], ink: 17 };
PART_MATS[STEEL] = { ramp: [2, 6, 7, 8], ink: 2 };
PART_MATS[DARK] = { ramp: [0, 1, 1, 2], ink: 0 };

/** The Jump Jets at the rear mount (origin at the mount, +x the carrier's forward): two upright
 * gold canisters on a strap, nozzles pointing down and back. */
const jetsScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y);
  h.add(sdCyl(z - 1.6, x + 0.4, ay - 2.4, 1.9, 2.6, 0.6), GOLD, x, y, z);
  h.add(sdCyl(z + 1.6, x + 0.9, ay - 2.4, 1.2, 0.8, 0.2), STEEL, x, y, z);
  h.add(sdBox(x - 1.4, y, z - 1.0, 0.6, 1.4, 1.2, 0.2), STEEL, x, y, z);
};

/** One coil bumper of the Springs: a striped capsule (gold coils on a steel core). */
export function coil(h: Hit, x: number, y: number, z: number, cx: number, cy: number, cz: number, len: number) {
  h.add(sdCapsule(x, y, z, cx - len, cy, cz, cx + len, cy, cz, 2.5), GOLD, x - cx, y, z);
  h.add(sdCapsule(x, y, z, cx - len - 0.6, cy, cz, cx + len + 0.6, cy, cz, 1.2), STEEL, x - cx, y, z);
}

export const SPRING_MATS: Mat[] = [...PART_MATS];
SPRING_MATS[GOLD] = {
  ramp: [17, 18, 18, 28],
  ink: 17,
  // the coils: a dark gap every 1.6 units along the bumper
  paint: (q) => (((Math.floor(q.u / 1.6) % 2) + 2) % 2 === 0 ? undefined : q.lvl >= 2 ? 17 : 24),
};

/** The Springs in a body's frame (anchor at the footprint centre): a coil bumper either side. */
const springsScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y);
  coil(h, x, ay, z, 0, 10.2, 3.0, 5.0);
};

/** The Springs on a big body (a Spring Rammer): the pair set wide enough to show past its hull. */
const bigSpringsScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y);
  coil(h, x, ay, z, 0.5, 14.2, 3.2, 7.0);
};

function mountedRear(scene: Scene, d: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 8,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 8, angle: dirAngle(d), scene, mats: PART_MATS, zMax: 6, zMin: -5 });
    },
  };
}

function mountedSprings(d: number, big = false) {
  const [w, h, ox, oy] = big ? [40, 40, 20, 26] : [32, 32, 16, 20];
  return {
    w, h, ox, oy,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w, h, ox, oy, angle: dirAngle(d), scene: big ? bigSpringsScene : springsScene, mats: SPRING_MATS, zMax: 8 });
    },
  };
}

/** A part lying loose: on its side at a slight diagonal, with a salvage glint. */
function loose(scene: Scene, mats: Mat[], zLift: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 12,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      const grid = sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 12, angle: -0.42, scene: (h, x, y, z) => scene(h, x, y, z - zLift), mats, zMax: 9, zMin: -2 });
      let best = -1;
      grid.forEach((p, i) => {
        if (p && p.m === GOLD && !p.ink && p.lvl >= 2 && (best < 0 || (i % 16) + (i >> 4) < (best % 16) + (best >> 4))) best = i;
      });
      if (best >= 0) px(ctx, best % 16, best >> 4, 9);
    },
  };
}

function iconOf(scene: Scene, mats: Mat[], scale = 1) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 9, angle: -Math.PI / 4, scene, mats, zMax: 7, zMin: -5, scale, view: [0.8, 0.6] });
    },
  };
}

/** One coil, on its own (the pickup and the icon). */
const oneCoil: Scene = (h, x, y, z) => coil(h, x, y, z, 0, 0, 2.2, 4.4);

export function registerM6() {
  DIRS.forEach((dn, d) => {
    for (const f of [0, 1]) {
      defSprite(`en:hopper:stalk:${dn}:${f}`, hopper(d, { ...H0, lift: f ? 0.6 : 0, fold: f ? 0.2 : 0 }));
      defSprite(`en:hopper:crouch:${dn}:${f}`, hopper(d, { ...H0, lift: f ? -3.0 : -2.6, fold: 1.2, splay: 0.9, pitch: 0.15 }));
      defSprite(`en:bouncer:idle:${dn}:${f}`, bouncer(d, { ...B0, lift: f ? 0.5 : 0 }));
      defSprite(`en:bouncer:windup:${dn}:${f}`, bouncer(d, { ...B0, squash: f ? 1.4 : 1.0 }));
      defSprite(`en:bouncer:roll:${dn}:${f}`, bouncer(d, { ...B0, phase: f ? 1 : 0, lift: 0.3 }));
      defSprite(`en:bouncer:stunned:${dn}:${f}`, bouncer(d, { ...B0, lean: f ? 1 : -1 }));
    }
    defSprite(`en:hopper:air:${dn}`, hopper(d, { ...H0, lift: 1.5, fold: -1, pitch: 0.25 }));
    defSprite(`en:hopper:land:${dn}`, hopper(d, { ...H0, lift: -1.8, fold: 1, splay: 1.4, pitch: -0.1 }));
    defSprite(`part:jets:${dn}`, mountedRear(jetsScene, d));
    defSprite(`part:springs:${dn}`, mountedSprings(d));
    defSprite(`part:bigsprings:${dn}`, mountedSprings(d, true));
  });
  defSprite('pickup:jets', loose((h, x, y, z) => jetsScene(h, z, y, -x), PART_MATS, 1));
  defSprite('pickup:springs', loose(oneCoil, SPRING_MATS, 0));
  defSprite('icon:part:jets', iconOf(jetsScene, PART_MATS, 1.15));
  defSprite('icon:part:springs', iconOf(oneCoil, SPRING_MATS, 1.2));
}
