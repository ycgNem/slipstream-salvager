// Code-drawn placeholders for the Milestone 3 sprites (STYLE.md, PLAN.md section 8): the Snapper,
// the Grip Treads, the Plow and the Jaws (mounted, loose and as HUD icons), and the post and tower
// obstacles. Sculpted per direction like the slice's robots (sculpt.ts), at the final names, sizes
// and anchors; the pixel-art-studio sheets in src/art/ replace them where they're better.
import { defSprite } from '../../atlas';
import { DIRS, dirAngle } from '../../../data/dirs';
import { px, rect, outline } from '../pixel';
import { hash } from './common';
import { sculpt, sdBox, sdCapsule, sdCyl, sdEllipsoid, unpitch, unroll, type Hit, type Mat, type Scene } from './sculpt';

type Ctx = CanvasRenderingContext2D;

// ---- the Snapper ----
// A low, wide hound of scrap in violet and steel, with a snout and a pale eye slit. Drawn without
// its treads (the `part:treads` overlay goes under it); bare axle stubs show at its sides.

const HULL = 0, SNOUT = 1, AXLE = 2, EYE = 3, FIN = 4;
const SNAPPER_MATS: Mat[] = [];
SNAPPER_MATS[HULL] = { ramp: [49, 50, 51, 52], ink: 49 };
SNAPPER_MATS[SNOUT] = { ramp: [44, 45, 46, 47], ink: 44 };
SNAPPER_MATS[AXLE] = { ramp: [0, 1, 2, 2], ink: 0 };
SNAPPER_MATS[EYE] = { ramp: [8, 9, 9, 9], noInk: true };
SNAPPER_MATS[FIN] = { ramp: [44, 45, 46, 46], ink: 44 };

interface SPose { pitch: number; stretch: number; roll: number; lift: number; jaw: number }
const S0: SPose = { pitch: 0, stretch: 0, roll: 0, lift: 0, jaw: 0 };

function snapperScene(p: SPose): Scene {
  return (h: Hit, x: number, y: number, z: number) => {
    const ay = Math.abs(y);
    // axle stubs, on the ground either side
    h.add(sdCyl(y > 0 ? y - 6.2 : -y - 6.2, x, z - 2, 1.3, 1.2), AXLE, x, y, z);
    let bx = x, by = y, bz = z - p.lift;
    [by, bz] = unroll(by, bz, p.roll, 0, 2);
    [bx, bz] = unpitch(bx, bz, p.pitch, -5, 2);
    // hull: a low wedge-ish ellipsoid, stretched forward when it lunges
    h.add(sdEllipsoid(bx + 0.5, by, bz - 3.6, 6.4 + p.stretch, 5.2, 2.6), HULL, bx, by, bz);
    // a dorsal fin ridge
    h.add(sdBox(bx + 1.5, by, bz - 6, 3.2, 0.7, 0.9, 0.4), FIN, bx, by, bz);
    // the snout, out front; the jaw drops when it snaps
    h.add(sdBox(bx - 7.2 - p.stretch, by, bz - 3.2 + p.jaw * 0.5, 2.6, 2.6, 1.4, 0.9), SNOUT, bx, by, bz);
    h.add(sdBox(bx - 7.0 - p.stretch, by, bz - 1.6 - p.jaw, 2.2, 2.2, 0.6, 0.4), SNOUT, bx, by, bz);
    // the eye slit
    h.add(sdBox(bx - 4.6 - p.stretch, ay > 0 ? by : by, bz - 5.2, 0.6, 2.4, 0.5), EYE);
  };
}

function snapper(d: number, pose: SPose) {
  return {
    w: 32, h: 32, ox: 16, oy: 20,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 32, h: 32, ox: 16, oy: 20, angle: dirAngle(d), scene: snapperScene(pose), mats: SNAPPER_MATS, zMax: 10 });
    },
  };
}

// ---- the parts ----
// Salvage gold on steel, like the booster, so a part reads as "take this" on any body.

const GOLD = 0, STEEL = 1, RUBBER = 2, TOOTH = 3;
export const PART_MATS: Mat[] = [];
PART_MATS[GOLD] = { ramp: [17, 18, 18, 28], ink: 17 };
PART_MATS[STEEL] = { ramp: [2, 6, 7, 8], ink: 2 };
PART_MATS[RUBBER] = { ramp: [0, 1, 1, 2], ink: 0 };
PART_MATS[TOOTH] = { ramp: [7, 8, 9, 9], noInk: true };

/** The Grip Treads in a body's frame (anchor at the body's footprint center): two tread units. */
const treadsScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y);
  h.add(sdBox(x, ay - 8.6, z - 2.2, 7.4, 1.9, 2.2, 1.2), RUBBER, x, y, z);
  // the gold guard over each unit
  h.add(sdBox(x, ay - 8.6, z - 4.6, 6.2, 2.3, 0.6, 0.5), GOLD, x, y, z);
};

/** Grip Treads on the Hauler (`part:bigtreads`): the same units, set out past its own wide treads. */
const bigTreadsScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y) - 3.4;
  treadsScene(h, x, Math.abs(ay), z);
};

/** The Plow at the front mount (origin at the mount, +x forward): a curved scoop blade. */
export const plowScene: Scene = (h, x, y, z) => {
  const ay = Math.abs(y);
  // the blade curves back at its ends
  const bx = x - 1.2 + ay * ay * 0.05;
  h.add(sdBox(bx, y, z - 0.5, 0.9, 6.2, 3.2, 0.4), GOLD, bx, y, z);
  // the strut back to the body
  h.add(sdBox(x + 1.6, y, z - 0.6, 1.8, 1.4, 0.8, 0.3), STEEL, x, y, z);
};

/** The Jaws at the front mount: two toothed mandibles. */
const jawsScene: Scene = (h, x, y, z) => {
  for (const s of [-1, 1]) {
    h.add(sdCapsule(x, y, z, -1, s * 1.6, 0, 4.2, s * 2.6, 0, 1.3), GOLD, x, y, z);
    h.add(sdCapsule(x, y, z, 4.2, s * 2.6, 0, 5.4, s * 0.8, 0, 0.9), GOLD, x, y, z);
    // teeth along the inner edge
    h.add(sdEllipsoid(x - 3, y - s * 1.6, z, 0.6, 0.5, 0.6), TOOTH);
    h.add(sdEllipsoid(x - 1, y - s * 1.9, z, 0.6, 0.5, 0.6), TOOTH);
  }
  h.add(sdCyl(x + 1.6, y, z, 1.4, 2.2, 0.3), STEEL, x, y, z);
};

const PART_SCENES = { plow: plowScene, jaws: jawsScene } as const;

function mountedFront(scene: Scene, d: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 8,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 8, angle: dirAngle(d), scene, mats: PART_MATS, zMax: 6, zMin: -4 });
    },
  };
}

function mountedTreads(d: number, big = false) {
  const [w, h, ox, oy] = big ? [40, 40, 20, 26] : [32, 32, 16, 20];
  return {
    w, h, ox, oy,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w, h, ox, oy, angle: dirAngle(d), scene: big ? bigTreadsScene : treadsScene, mats: PART_MATS, zMax: 6 });
    },
  };
}

/** A part lying loose: sculpted on its side at a slight diagonal, with a salvage glint. */
function loose(scene: Scene, zLift: number) {
  return {
    w: 16, h: 16, ox: 8, oy: 12,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      const grid = sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 12, angle: -0.42, scene: (h, x, y, z) => scene(h, x, y, z - zLift), mats: PART_MATS, zMax: 9, zMin: -2 });
      glint(ctx, grid);
    },
  };
}

function glint(ctx: Ctx, grid: ReturnType<typeof sculpt>) {
  let best = -1;
  grid.forEach((p, i) => {
    if (p && p.m === GOLD && !p.ink && p.lvl >= 2 && (best < 0 || (i % 16) + (i >> 4) < (best % 16) + (best >> 4))) best = i;
  });
  if (best >= 0) px(ctx, best % 16, best >> 4, 9);
}

function iconOf(scene: Scene, scale = 1) {
  return {
    w: 16, h: 16, ox: 0, oy: 0,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      sculpt(ctx, c, { w: 16, h: 16, ox: 8, oy: 9, angle: -Math.PI / 4, scene, mats: PART_MATS, zMax: 6, zMin: -4, scale, view: [0.8, 0.6] });
    },
  };
}

/** One tread unit, for the pickup and the icon (the pair is too wide for 16x16). */
const oneTread: Scene = (h, x, y, z) => {
  h.add(sdBox(x, y, z - 2.2, 6.4, 1.9, 2.2, 1.2), RUBBER, x, y, z);
  h.add(sdBox(x, y, z - 4.6, 5.4, 2.3, 0.6, 0.5), GOLD, x, y, z);
};

// ---- post and tower ----
// The pillar's crushed scrap at two more footprints: a 16x16 post and a 48x48 tower, each with an
// 8 px top face (STYLE.md). Each band of scrap a little darker going down, lit top-left.

const BANDS: readonly (readonly [number, number, number])[] = [[1, 3, 4], [1, 5, 3], [0, 24, 25]];

function pile(fw: number, seed: number) {
  const h = fw + 8;
  return {
    w: fw, h, ox: 0, oy: 8,
    draw: (ctx: Ctx, c: HTMLCanvasElement) => {
      // the top face: the lightest, mottled
      for (let y = 1; y <= 8; y++) for (let x = 1; x < fw - 1; x++) px(ctx, x, y, hash(x >> 1, y, seed) > 0.55 ? 4 : 3);
      rect(ctx, 1, 1, fw - 2, 1, 4);
      // the front face in three bands
      const faceH = h - 10, bandH = Math.ceil(faceH / 3);
      for (let y = 9; y < h - 1; y++) {
        const b = BANDS[Math.min(2, Math.floor((y - 9) / bandH))];
        for (let x = 1; x < fw - 1; x++) {
          let col = hash(x >> 1, y >> 1, seed + 3) > 0.6 ? b[2] : b[1];
          if (x === 1) col = b[2];
          if (x === fw - 2) col = b[0];
          if ((y - 9) % bandH === 0) col = b[0];
          px(ctx, x, y, col);
        }
      }
      rect(ctx, 1, 9, fw - 2, 1, 2);
      outline(c, 0);
    },
  };
}

export function registerM3() {
  DIRS.forEach((dn, d) => {
    for (const f of [0, 1]) {
      defSprite(`en:snapper:hunt:${dn}:${f}`, snapper(d, { ...S0, lift: f ? 0.4 : 0 }));
      defSprite(`en:snapper:windup:${dn}:${f}`, snapper(d, { ...S0, pitch: 0.18, lift: -0.6, jaw: f ? 0.8 : 0.4 }));
      defSprite(`en:snapper:snap:${dn}:${f}`, snapper(d, { ...S0, stretch: f ? 2.2 : 1.6, jaw: 1.2, lift: 0.6 }));
      defSprite(`en:snapper:stunned:${dn}:${f}`, snapper(d, { ...S0, roll: f ? 0.25 : -0.25, lift: -0.4 }));
    }
    defSprite(`en:snapper:slide:${dn}`, snapper(d, { ...S0, roll: 0.35, pitch: -0.1 }));
    defSprite(`part:treads:${dn}`, mountedTreads(d));
    defSprite(`part:bigtreads:${dn}`, mountedTreads(d, true));
    for (const k of ['plow', 'jaws'] as const) defSprite(`part:${k}:${dn}`, mountedFront(PART_SCENES[k], d));
  });
  defSprite('pickup:treads', loose(oneTread, 0));
  defSprite('pickup:plow', loose((h, x, y, z) => plowScene(h, x, y, z), 1));
  defSprite('pickup:jaws', loose((h, x, y, z) => jawsScene(h, x, y, z), 1.5));
  defSprite('icon:part:treads', iconOf(oneTread, 1.1));
  defSprite('icon:part:plow', iconOf(plowScene, 1.05));
  defSprite('icon:part:jaws', iconOf(jawsScene, 1.1));
  defSprite('ob:post', pile(16, 41));
  defSprite('ob:tower', pile(48, 43));
}
