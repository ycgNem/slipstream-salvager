// The yards' layouts (PLAN.md 4.1, 8.5): one 640x360 screen each, a 16 px wall all round, four
// gates, and the obstacles inside. World coordinates are screen pixels; the sim is flat top-down,
// the 3/4 look is only in the art. Obstacles sit on the 16 px grid: a 32x32 is a pillar, a 16x16 a
// post, a 48x48 a tower, and any other rectangle is a low wall drawn with the wall tiles.

export interface Rect { x: number; y: number; w: number; h: number }

export interface Gate {
  id: 'n' | 's' | 'w' | 'e';
  /** the opening in the wall */
  rect: Rect;
  /** h: in the top/bottom wall, v: in a side wall */
  orient: 'h' | 'v';
  /** where an entering enemy appears, and the way it walks in */
  spawn: { x: number; y: number };
  dir: { x: number; y: number };
}

/**
 * Terrain painted on the floor (PLAN.md 9.4): boost strips and jump ramps point one of four ways
 * (0 east, 1 south, 2 west, 3 north); a crusher plate slams on its own phase (s into its cycle).
 */
export type FloorKind = 'boost' | 'oil' | 'ramp' | 'crusher';
export interface FloorPatch {
  kind: FloorKind;
  rect: Rect;
  dir?: 0 | 1 | 2 | 3;
  phase?: number;
}

export interface ArenaDef {
  id: string;
  w: number;
  h: number;
  wall: number;
  /** solid rectangles: the four walls, then the obstacles */
  solids: Rect[];
  /** every obstacle inside the ring (pillars, posts, towers, low walls) */
  pillars: Rect[];
  gates: Gate[];
  playerStart: { x: number; y: number; heading: number };
  /** terrain on the floor (none in the older yards) */
  floor?: FloorPatch[];
}

const W = 640, H = 360, T = 16;
const box = (cx: number, cy: number, s: number): Rect => ({ x: cx - s / 2, y: cy - s / 2, w: s, h: s });
const pillar = (cx: number, cy: number) => box(cx, cy, 32);
const post = (cx: number, cy: number) => box(cx, cy, 16);

const GATES: Gate[] = [
  { id: 'n', rect: { x: 304, y: 0, w: 32, h: 16 }, orient: 'h', spawn: { x: 320, y: 30 }, dir: { x: 0, y: 1 } },
  { id: 's', rect: { x: 304, y: H - T, w: 32, h: 16 }, orient: 'h', spawn: { x: 320, y: H - 30 }, dir: { x: 0, y: -1 } },
  // the side gates sit on the 16 px wall grid (160-192), so no sliver of wall shows above or below;
  // their spawns stay on the centre line (y 180): at 176 the pillar camper cleared twice as often
  { id: 'w', rect: { x: 0, y: 160, w: 16, h: 32 }, orient: 'v', spawn: { x: 30, y: 180 }, dir: { x: 1, y: 0 } },
  { id: 'e', rect: { x: W - T, y: 160, w: 16, h: 32 }, orient: 'v', spawn: { x: W - 30, y: 180 }, dir: { x: -1, y: 0 } },
];

function arena(id: string, obstacles: Rect[], start = { x: 320, y: 180, heading: 0 }, floor: FloorPatch[] = []): ArenaDef {
  return {
    id,
    floor,
    w: W,
    h: H,
    wall: T,
    solids: [
      { x: 0, y: 0, w: W, h: T },
      { x: 0, y: H - T, w: W, h: T },
      { x: 0, y: 0, w: T, h: H },
      { x: W - T, y: 0, w: T, h: H },
      ...obstacles,
    ],
    pillars: obstacles,
    gates: GATES,
    playerStart: start,
  };
}

/** The Ring: four pillars, lanes to loop round them and long straights between (the slice). */
export const RING = arena('ring', [pillar(192, 120), pillar(448, 120), pillar(192, 240), pillar(448, 240)]);

/** The Kennel: a forest of small posts. Tight lines; the Snappers' ground. */
export const KENNEL = arena('kennel', [
  post(128, 96), post(224, 96), post(416, 96), post(512, 96),
  post(128, 264), post(224, 264), post(416, 264), post(512, 264),
  post(256, 180), post(384, 180),
]);

/** Long Lanes: two long low walls make three straight lanes, open at both ends and joined by a
 * gap in the middle (DECISIONS #79). Booster country. */
export const LANES = arena('lanes', [
  { x: 128, y: 112, w: 160, h: 16 },
  { x: 352, y: 112, w: 160, h: 16 },
  { x: 128, y: 240, w: 160, h: 16 },
  { x: 352, y: 240, w: 160, h: 16 },
]);

/** The Plow Pit: an open bowl round one big tower, four posts out at the corners. */
export const PIT = arena('pit', [box(320, 176, 48), post(112, 80), post(528, 80), post(112, 280), post(528, 280)], { x: 320, y: 268, heading: 0 });

/** Jaw Yard: four blocks in the corners round an open cross. */
export const CROSS = arena('cross', [
  { x: 64, y: 48, w: 112, h: 64 },
  { x: 464, y: 48, w: 112, h: 64 },
  { x: 64, y: 256, w: 112, h: 64 },
  { x: 464, y: 256, w: 112, h: 64 },
]);

/** The Hurdles: two long low walls split the yard into three lanes, each wall broken only by
 * narrow gaps at its ends and its middle. The Hoppers leap them; going round costs you the
 * distance to a gap, so a leap on the Jump Jets is the shortcut (DECISIONS #92). */
const lowWall = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const HURDLES = arena('hurdles', [
  lowWall(200, 56, 16, 92), lowWall(200, 212, 16, 92),
  lowWall(424, 56, 16, 92), lowWall(424, 212, 16, 92),
]);

/** The Pinball: four low walls facing each other across the yard round a pillar bumper in the
 * middle, posts out in the corners: a straight line (a Bouncer's roll, your bank shot on Springs)
 * goes back and forth across it (DECISIONS #92). */
export const PINBALL = arena('pinball', [
  lowWall(144, 128, 16, 104), lowWall(480, 128, 16, 104),
  lowWall(256, 72, 128, 16), lowWall(256, 272, 128, 16),
  pillar(320, 180),
  post(80, 64), post(560, 64), post(80, 296), post(560, 296),
], { x: 320, y: 232, heading: 0 });

const strip = (x: number, y: number, w: number, h: number, dir: 0 | 1 | 2 | 3): FloorPatch => ({ kind: 'boost', rect: { x, y, w, h }, dir });
const ramp = (x: number, y: number, dir: 0 | 1 | 2 | 3): FloorPatch => ({ kind: 'ramp', rect: { x, y, w: 32, h: 32 }, dir });
const crusher = (cx: number, cy: number, phase: number): FloorPatch => ({ kind: 'crusher', rect: box(cx, cy, 32), phase });

/** The Slick: an oil lake in the middle, a racetrack of boost strips round it (clockwise), posts
 * out at the corners. Grip is the whole question. */
export const SLICK = arena(
  'slick',
  [post(96, 72), post(544, 72), post(96, 288), post(544, 288)],
  { x: 320, y: 312, heading: Math.PI },
  [
    { kind: 'oil', rect: { x: 208, y: 128, w: 224, h: 112 } },
    strip(176, 80, 288, 16, 0), strip(480, 112, 16, 144, 1), strip(176, 272, 288, 16, 2), strip(144, 112, 16, 144, 3),
  ],
);

/** The Jumps: two low walls across the yard, a ramp in front of each from both sides, so a fast
 * line goes over them and a slow one goes round. */
export const JUMPS = arena(
  'jumps',
  [{ x: 224, y: 96, w: 16, h: 176 }, { x: 400, y: 96, w: 16, h: 176 }],
  { x: 320, y: 184, heading: 0 },
  [ramp(192, 168, 0), ramp(240, 168, 2), ramp(368, 168, 0), ramp(416, 168, 2)],
);

/** The Press: six crusher plates in a grid, each slamming on its own beat, posts at the corners.
 * Bait them onto the plates. */
export const PRESS = arena(
  'press',
  [post(96, 80), post(544, 80), post(96, 280), post(544, 280)],
  { x: 320, y: 184, heading: 0 },
  [crusher(192, 128, 0), crusher(320, 128, 1.0), crusher(448, 128, 2.0), crusher(192, 240, 1.5), crusher(320, 240, 0.5), crusher(448, 240, 2.5)],
);

/** The Compactor's yard: an open floor round two pillars (to bounce it off, to hide behind), with a
 * crusher plate in each corner. The plates hit it too. */
export const FOUNDRY = arena(
  'foundry',
  [pillar(224, 180), pillar(416, 180)],
  { x: 320, y: 184, heading: 0 },
  [crusher(96, 80, 0), crusher(544, 80, 1.5), crusher(96, 280, 0.75), crusher(544, 280, 2.25)],
);

/** The Heap: a broken ring of scrap piles, pillars and posts, round the middle. */
export const HEAP = arena('heap', [
  pillar(192, 120), pillar(448, 120), pillar(192, 240), pillar(448, 240),
  post(320, 96), post(320, 264), post(128, 180), post(512, 180),
]);
