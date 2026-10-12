// Draws one encounter into the 640x360 buffer: floor and walls (cached per arena), gates, skid
// marks, telegraph lanes, shadows, y-sorted bodies with their parts on their mounts, the cable, the
// claw glow and heading tick, effects and the wave banner. Every sprite is asked for by name
// (STYLE.md).
import { C, PALETTE } from '../data/palette';
import { DIRS } from '../data/dirs';
import { FRONT_DIST, MOUNT_DIST, clawTip, frontMount, rearMount, type MountPos } from '../data/mounts';
import type { ArenaDef, Gate, Rect } from '../data/arena';
import type { PartId } from '../data/parts';
import { hash2 } from '../engine/rng';
import { drawSprite, sprite } from './atlas';
import { makeCanvas, ctx2d } from './art/pixel';
import { crack, dot, floorRing, lane, outline, pline, ring, silhouette } from './pixgeom';
import type { Fx } from './fx';
import { chargeLenOf, laneOf } from '../sim/enemies';
import { crouched, landingPoint, revving } from '../sim/rip';
import { hopProgress, leapSpec, slamRadius } from '../sim/hopper';
import { FLOOR_ANGLE, laneLength, reflectAt } from '../sim/arena';
import { crusherState } from '../sim/terrain';
import { airborne, type Enemy, type World } from '../sim/world';
import { drawText, FONT_H, textWidth } from '../ui/font';

type Ctx = CanvasRenderingContext2D;

const TIER_GLOW: Record<string, [number, number]> = { crawl: [C.crawl, C.crawlHi], cruise: [C.cruise, C.cruiseHi], slip: [C.speed3, C.speed4] };

/** What sprite an obstacle uses, by its footprint; anything else (a long low wall) is wall tiles. */
export function obstacleSprite(r: Rect): string | null {
  if (r.w === 32 && r.h === 32) return 'ob:pillar';
  if (r.w === 16 && r.h === 16) return 'ob:post';
  if (r.w === 48 && r.h === 48) return 'ob:tower';
  return null;
}

let bg: { arena: ArenaDef; c: HTMLCanvasElement } | null = null;

/** The floor, the ring wall and any low walls inside it, drawn once per arena from tiles. */
function background(w: World): HTMLCanvasElement {
  if (bg && bg.arena === w.arena) return bg.c;
  const a = w.arena, T = 16;
  const c = makeCanvas(a.w, a.h);
  const x = ctx2d(c);
  const cols = Math.ceil(a.w / T), rows = Math.ceil(a.h / T);
  const low = a.pillars.filter((r) => !obstacleSprite(r));
  const inLow = (cx: number, cy: number) => low.some((r) => cx * T >= r.x && cx * T < r.x + r.w && cy * T >= r.y && cy * T < r.y + r.h);
  const isWall = (cx: number, cy: number) => cx <= 0 || cy <= 0 || cx >= cols - 1 || cy >= rows - 1 || inLow(cx, cy);
  for (let cy = 0; cy < rows; cy++) {
    // 360 isn't a whole number of tiles: the bottom wall row sits flush with the bottom edge (on its
    // collision, 344-360) and covers the last half-row of floor
    const py = cy === rows - 1 ? a.h - T : cy * T;
    for (let cx = 0; cx < cols; cx++) {
      if (isWall(cx, cy)) {
        const m = (isWall(cx, cy - 1) ? 1 : 0) | (isWall(cx + 1, cy) ? 2 : 0) | (isWall(cx, cy + 1) ? 4 : 0) | (isWall(cx - 1, cy) ? 8 : 0);
        drawSprite(x, sprite(`t:wall:${m}`), cx * T, py);
      } else drawSprite(x, sprite(`t:floor:${Math.floor(hash2(cx, cy, 7) * 4)}`), cx * T, py);
    }
  }
  // terrain that never changes: oil (edged by its neighbors) and ramps
  for (const f of a.floor ?? []) {
    const r = f.rect;
    if (f.kind === 'ramp') drawSprite(x, sprite(`fl:ramp:${'eswn'[f.dir ?? 0]}`), r.x, r.y);
    if (f.kind !== 'oil') continue;
    const isOil = (tx: number, ty: number) => (a.floor ?? []).some((q) => q.kind === 'oil' && tx >= q.rect.x && tx < q.rect.x + q.rect.w && ty >= q.rect.y && ty < q.rect.y + q.rect.h);
    for (let ty = r.y; ty < r.y + r.h; ty += T)
      for (let tx = r.x; tx < r.x + r.w; tx += T) {
        const m = (isOil(tx, ty - T) ? 1 : 0) | (isOil(tx + T, ty) ? 2 : 0) | (isOil(tx, ty + T) ? 4 : 0) | (isOil(tx - T, ty) ? 8 : 0);
        drawSprite(x, sprite(`fl:oil:${m}`), tx, ty);
      }
  }
  bg = { arena: a, c };
  return c;
}

/** Terrain that moves: boost strips scroll their chevrons, crusher plates warn and slam. */
function drawTerrain(ctx: Ctx, w: World, time: number) {
  for (const f of w.arena.floor ?? []) {
    const r = f.rect;
    if (f.kind === 'boost') {
      const name = `fl:boost:${'eswn'[f.dir ?? 0]}:${Math.floor(time * 12) % 3}`;
      for (let ty = r.y; ty < r.y + r.h; ty += 16) for (let tx = r.x; tx < r.x + r.w; tx += 16) drawSprite(ctx, sprite(name), tx, ty);
    } else if (f.kind === 'crusher') {
      const s = crusherState(w, f).state;
      // the warning flashes; the head stays down a moment after the slam
      drawSprite(ctx, sprite(`fl:crusher:${s === 'warn' && Math.floor(time * 10) % 2 === 0 ? 'idle' : s}`), r.x, r.y);
    }
  }
}

/** Forget the cached background (after the art changes). */
export function resetBackground() {
  bg = null;
}

function gateState(w: World, g: Gate, time: number): 'closed' | 'open' | 'warn' {
  if (w.exits.some((e) => e.gate === g.id)) return 'open';
  if (w.wave.phase === 'warn' && w.wave.gates.some((x) => x.id === g.id)) return Math.floor(time * 7) % 2 ? 'warn' : 'closed';
  if (w.enemies.some((r) => r.state === 'enter' && Math.hypot(r.x - g.spawn.x, r.y - g.spawn.y) < 40)) return 'open';
  return 'closed';
}

function dirOfFace(a: number): number {
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

/** An enemy's body sprite name this frame. */
export function enemySprite(r: Enemy, time: number): string {
  const d = DIRS[dirOfFace(r.face)];
  if (r.kind === 'compactor') {
    const f = Math.floor(time * (r.state === 'charge' ? 12 : r.state === 'windup' ? 12 : 4)) % 2;
    switch (r.state) {
      case 'windup': return r.leap ? `bo:compactor:crouch:${d}:${f}` : `bo:compactor:windup:${d}:${f}`;
      case 'charge': return `bo:compactor:charge:${d}:${f}`;
      case 'skid': return `bo:compactor:skid:${d}`;
      case 'stunned': return `bo:compactor:stunned:${d}:${f}`;
      case 'air': return `bo:compactor:air:${d}`;
      case 'land': return `bo:compactor:land:${d}`;
      default: return `bo:compactor:stalk:${d}:${r.speed > 5 ? f : 0}`;
    }
  }
  if (r.kind === 'hopper') {
    switch (r.state) {
      case 'windup': return `en:hopper:crouch:${d}:${Math.floor(time * 12) % 2}`;
      case 'air': return `en:hopper:air:${d}`;
      case 'land': case 'stunned': return `en:hopper:land:${d}`;
      default: return `en:hopper:stalk:${d}:${Math.floor(time * 6) % 2}`;
    }
  }
  if (r.kind === 'bouncer') {
    switch (r.state) {
      case 'windup': return `en:bouncer:windup:${d}:${Math.floor(time * 12) % 2}`;
      case 'roll': return `en:bouncer:roll:${d}:${Math.floor(time * Math.max(4, r.speed / 12)) % 2}`;
      case 'stunned': return `en:bouncer:stunned:${d}:${Math.floor(time * 4) % 2}`;
      default: return `en:bouncer:idle:${d}:${Math.floor(time * 3) % 2}`;
    }
  }
  if (r.kind === 'snapper') {
    const f = Math.floor(time * (r.state === 'snap' ? 16 : 8)) % 2;
    switch (r.state) {
      case 'windup': return `en:snapper:windup:${d}:${f}`;
      case 'snap': return `en:snapper:snap:${d}:${f}`;
      case 'slide': return `en:snapper:slide:${d}`;
      case 'stunned': return `en:snapper:stunned:${d}:${Math.floor(time * 4) % 2}`;
      default: return `en:snapper:hunt:${d}:${r.speed > 5 ? f : 0}`;
    }
  }
  const f = Math.floor(time * (r.state === 'charge' ? 14 : 6)) % 2;
  switch (r.state) {
    case 'windup': return `en:rammer:windup:${d}:${f}`;
    case 'charge': return `en:rammer:charge:${d}:${f}`;
    case 'skid': return r.slammed && r.t > 0.12 ? `en:rammer:stunned:${d}:${Math.floor(time * 4) % 2}` : `en:rammer:skid:${d}`;
    default: return `en:rammer:stalk:${d}:${f}`;
  }
}

/**
 * Is this part of this enemy open to a tear right now? Then it glints gold (DECISIONS #60): a
 * Rammer's booster when its back is open, the plow while it charges (joust it), a Snapper's treads
 * while it slides broadside, its jaws while it winds up to snap.
 */
function tearable(r: Enemy, part: PartId): boolean {
  switch (part) {
    case 'booster': return r.state === 'skid' || r.state === 'stunned' || r.state === 'charge' || (r.state === 'windup' && r.locked);
    case 'plow': return r.state === 'charge';
    case 'treads': return r.state === 'slide' || r.state === 'stunned';
    case 'jaws': return r.state === 'windup' || r.state === 'stunned';
    case 'jets': return r.state === 'land' || r.state === 'stunned';
    case 'springs': return r.kind === 'bouncer' ? r.state === 'roll' || r.state === 'stunned' : r.state === 'charge' || r.state === 'skid' || r.state === 'stunned';
  }
}

/** How high an enemy is drawn off the floor (a Hopper's leap): an arc over the flight. */
function liftOf(w: World, r: Enemy): number {
  if (!airborne(r)) return 0;
  return Math.round(Math.sin(Math.PI * hopProgress(w, r)) * leapSpec(w, r).height);
}

/** How high you're drawn off the floor on a Jump Jets leap. */
function playerLift(w: World): number {
  const A = w.player.air;
  return A ? Math.round(Math.sin(Math.PI * Math.min(1, A.t / A.dur)) * w.t.leapHeight) : 0;
}

const SHADOW: Record<Enemy['kind'], string> = { rammer: 'fx:shadow:l', hopper: 'fx:shadow:l', snapper: 'fx:shadow:m', bouncer: 'fx:shadow:m', compactor: 'fx:shadow:xl' };
/** where the stun stars sit above each kind's anchor */
const STARS_Y: Record<Enemy['kind'], number> = { rammer: 22, hopper: 20, snapper: 16, bouncer: 20, compactor: 42 };

export interface DrawOpts {
  time: number;
  shake: boolean;
  /** drawn on the floor, under every body, pickup and text (the exit signs) */
  floor?: () => void;
}

export function drawWorld(ctx: Ctx, w: World, fx: Fx, o: DrawOpts) {
  const off = fx.shakeOffset(o.shake);
  ctx.save();
  ctx.translate(off.x, off.y);
  ctx.drawImage(background(w), 0, 0);

  for (const g of w.arena.gates) drawSprite(ctx, sprite(`ob:gate:${g.orient}:${gateState(w, g, o.time)}`), g.rect.x, g.rect.y);
  if (w.arena.floor?.length) drawTerrain(ctx, w, o.time);
  fx.drawMarks(ctx);
  o.floor?.();

  // telegraphs: under bodies, over the floor
  for (const r of w.enemies) {
    const hot = Math.floor(o.time * 12) % 2 === 0;
    if (r.leap || r.state === 'air') {
      // where it will land (a Hopper, or The Compactor with its core open): a ring, dashed while it
      // tracks you, solid and flashing once locked and all through the flight
      if (r.state !== 'windup' && r.state !== 'air') continue;
      const R = slamRadius(w, r);
      if (r.locked || r.state === 'air') floorRing(ctx, r.tx, r.ty, R, hot ? C.danger3 : C.danger2, C.danger1, { density: 4 });
      else floorRing(ctx, r.tx, r.ty, R, C.danger1, C.danger0, { dash: 4, phase: Math.floor(o.time * 30) });
      continue;
    }
    if (r.state !== 'windup') continue;
    const l = laneOf(w, r);
    const rr = l.width / 2;
    const sx = r.x + Math.cos(l.angle) * rr, sy = r.y + Math.sin(l.angle) * rr;
    const draw = (x0: number, y0: number, a: number, len: number) => {
      if (r.locked) lane(ctx, x0, y0, a, len, l.width, hot ? C.danger3 : C.danger2, C.danger1, { density: 2 });
      else lane(ctx, x0, y0, a, len, l.width, C.danger1, C.danger0, { dash: 4, phase: Math.floor(o.time * 30), density: 4 });
    };
    draw(sx, sy, l.angle, l.len);
    // on springs the lunge bounces off the wall it meets: the first bounce's stub shows where it
    // comes back (a Bouncer's roll; a Spring Rammer's charge, for the rest of its length), dim and
    // dashed so a near head-on bounce doesn't tangle with the lane. The Compactor's bounces are
    // most of its charge: both are drawn, and once locked they're drawn like the lane itself
    const boss = r.kind === 'compactor', top = w.t.bossTopY;
    let rest = r.kind === 'bouncer' ? w.t.rollStub : r.kind !== 'snapper' && (!r.shove || boss) ? chargeLenOf(w, r) - l.len : 0;
    let ex = r.x + Math.cos(l.angle) * l.len, ey = r.y + Math.sin(l.angle) * l.len, a1 = l.angle;
    for (let b = 0; r.parts.sides === 'springs' && b < (boss ? (r.shove ? 1 : w.t.bossBounces) : 1) && rest > 8; b++) {
      const a2 = boss && ey <= top + 0.5 ? -a1 : reflectAt(w.arena, ex, ey, a1, rr);
      let len2 = Math.min(rest, laneLength(w.arena, ex, ey, a2, rest, rr));
      if (boss && Math.sin(a2) < -0.01) len2 = Math.min(len2, Math.max(0, (ey - top) / -Math.sin(a2)));
      if (boss && r.locked) lane(ctx, ex, ey, a2, len2, l.width, hot ? C.danger3 : C.danger2, C.danger1, { density: 2 });
      else lane(ctx, ex, ey, a2, len2, l.width, r.locked ? C.danger2 : C.danger1, C.danger0, { dash: 3, phase: Math.floor(o.time * 30), density: 8 });
      ex += Math.cos(a2) * len2;
      ey += Math.sin(a2) * len2;
      rest -= len2;
      a1 = a2;
    }
  }
  const p = w.player;
  if (crouched(w)) {
    // crouched on the Jump Jets: where you'll come down
    const L = landingPoint(w);
    floorRing(ctx, L.x, L.y, w.t.leapSlamR, C.speed2, C.speed0, { dash: 3, phase: -Math.floor(o.time * 40), density: 6 });
  } else if (revving(w)) {
    const len = laneLength(w.arena, p.x, p.y, p.heading, 420, w.t.playerRadius);
    lane(ctx, p.x, p.y, p.heading, len, w.t.playerRadius * 2, C.speed2, C.speed0, { dash: 3, phase: -Math.floor(o.time * 40), density: 3 });
  }
  if (p.air) {
    // in the air: where you'll land
    const L = landingPoint(w);
    floorRing(ctx, L.x, L.y, w.t.leapSlamR, C.speed1, C.speed0, { dash: 2 });
  }

  // shadows
  for (const r of w.enemies) drawSprite(ctx, sprite(SHADOW[r.kind]), Math.round(r.x), Math.round(r.y) + 1);
  for (const k of w.pickups) drawSprite(ctx, sprite('fx:shadow:s'), Math.round(k.x), Math.round(k.y) + 1);
  drawSprite(ctx, sprite('fx:shadow:m'), Math.round(p.x), Math.round(p.y) + 1);

  // y-sorted bodies
  const items: { y: number; draw: () => void }[] = [];
  for (const pr of w.arena.pillars) {
    const name = obstacleSprite(pr);
    if (name) items.push({ y: pr.y + pr.h, draw: () => drawSprite(ctx, sprite(name), pr.x, pr.y) });
  }
  for (const k of w.pickups) {
    const bob = Math.floor(o.time * 3 + k.id) % 2;
    items.push({ y: k.y, draw: () => {
      drawSprite(ctx, sprite(`pickup:${k.part}`), Math.round(k.x), Math.round(k.y) - bob);
      if (k.cracked) crack(ctx, Math.round(k.x), Math.round(k.y) - bob - 5);
    } });
  }
  // airborne bodies are drawn over everything on the ground
  for (const r of w.enemies) items.push({ y: airborne(r) ? 1e4 + r.y : r.y, draw: () => drawEnemy(ctx, r, fx, o.time, liftOf(w, r)) });
  items.push({ y: p.air ? 1e4 + p.y : p.y, draw: () => drawPlayer(ctx, w, fx, o.time) });
  if (p.tow) {
    const tw = p.tow;
    items.push({ y: tw.y, draw: () => {
      drawSprite(ctx, sprite(`pickup:${tw.part}`), Math.round(tw.x), Math.round(tw.y) + 4);
      if (tw.cracked) crack(ctx, Math.round(tw.x), Math.round(tw.y) - 1);
    } });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // a crusher plate's warning, over the bodies standing on it: a steady red border
  for (const f of w.arena.floor ?? []) {
    if (f.kind !== 'crusher' || crusherState(w, f).state !== 'warn') continue;
    const r = f.rect;
    ctx.fillStyle = PALETTE[C.danger3];
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  }

  // stun stars
  for (const r of w.enemies)
    if ((r.state === 'skid' && r.slammed) || r.state === 'stunned') drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(r.x), Math.round(r.y) - STARS_Y[r.kind]);
  if (p.stun > 0) drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(p.x), Math.round(p.y) - 18);

  fx.draw(ctx);
  ctx.restore();
  drawBanner(ctx, fx);
}

/** Draw a mounted part (with an optional glint and crack) at a mount position. The glint is white:
 * gold on gold (a Snapper's treads and jaws) didn't show at 1x. */
function drawMounted(ctx: Ctx, name: string, x: number, y: number, m: MountPos, glint: boolean, cracked: boolean) {
  const s = sprite(name);
  if (glint) outline(ctx, s, name, x + m.dx, y + m.dy, C.white);
  drawSprite(ctx, s, x + m.dx, y + m.dy);
  if (cracked) crack(ctx, x + m.dx, y + m.dy);
}

function drawEnemy(ctx: Ctx, r: Enemy, fx: Fx, time: number, lift = 0) {
  const d = dirOfFace(r.face), dn = DIRS[d];
  const shake = r.state === 'windup' ? (Math.floor(time * 30) % 2 ? 1 : -1) * (r.locked || r.leap ? 1 : 0) : 0;
  const x = Math.round(r.x) + shake, y = Math.round(r.y) - lift;
  const name = enemySprite(r, time);
  const blink = Math.floor(time * 10) % 2 === 0;
  // The Compactor wears its parts at 2x (`bo:part:*`), bolted higher up its hull; they drop with
  // its body when it hunkers down (winding up, charging, stunned)
  const boss = r.kind === 'compactor', pre = boss ? 'bo:part' : 'part';
  const mountLift = boss ? (r.state === 'windup' ? 5 : r.state === 'charge' ? 6 : r.state === 'stunned' ? 4 : 7) : 3;
  const rm = rearMount(d, MOUNT_DIST[r.kind], mountLift);
  // the Snapper's head lunges 3 px out on a snap and dips 1 px in its windup and when stunned,
  // and the jaws stay on it
  const fm = r.kind !== 'snapper'
    ? frontMount(d, FRONT_DIST[r.kind], mountLift)
    : frontMount(d, FRONT_DIST.snapper + (r.state === 'snap' ? 3 : 0), r.state === 'windup' || r.state === 'stunned' ? 2 : 3);
  const rear = () => {
    const part = r.parts.rear;
    if (!part) return;
    // the flame shares the booster's anchor and goes under it (it starts at the nozzle); the jets
    // fire on take-off and in the air
    if ((part === 'booster' && r.state === 'charge') || (part === 'jets' && (r.state === 'air' || (r.state === 'windup' && r.locked)))) drawSprite(ctx, sprite(`${boss ? 'bo' : 'fx'}:plume:${dn}:${Math.floor(time * 20) % 2}`), x + rm.dx, y + rm.dy);
    drawMounted(ctx, `${pre}:${part}:${dn}`, x, y, rm, tearable(r, part) && blink, false);
  };
  const front = () => {
    const part = r.parts.front;
    if (part) drawMounted(ctx, `${pre}:${part}:${dn}`, x, y, fm, tearable(r, part) && blink, false);
  };
  // the treads go under the body, sticking out either side
  // a Rammer's hull is wider: its springs are the wide pair
  const sideName = r.parts.sides === 'springs' && r.kind === 'rammer' ? `part:bigsprings:${dn}` : `${pre}:${r.parts.sides}:${dn}`;
  if (r.parts.sides) drawMounted(ctx, sideName, x, y, { dx: 0, dy: 0, behind: true }, tearable(r, r.parts.sides) && blink, false);
  if (rm.behind) rear();
  if (fm.behind) front();
  const s = sprite(name);
  if (fx.flash.has(r.id)) ctx.drawImage(silhouette(s, name, C.white), x - s.ox, y - s.oy);
  else drawSprite(ctx, s, x, y);
  if (!rm.behind) rear();
  if (!fm.behind) front();
  if (r.parts.sides) nearTrack(ctx, sideName, x, y, dn);
}

/** Side parts sit under the body, but except facing straight up or down the near track is in
 * front of it: draw the rows below the anchor again, over the body. */
function nearTrack(ctx: Ctx, name: string, x: number, y: number, dn: string) {
  if (dn === 'n' || dn === 's') return;
  const s = sprite(name);
  const top = s.oy + 1;
  if (top >= s.h) return;
  ctx.drawImage(s.img, s.x, s.y + top, s.w, s.h - top, x - s.ox, y + 1, s.w, s.h - top);
}

function drawPlayer(ctx: Ctx, w: World, fx: Fx, time: number) {
  const p = w.player;
  const d = p.face, dn = DIRS[d];
  const x = Math.round(p.x), y = Math.round(p.y) - playerLift(w);
  // afterimages at Slipstream: teal silhouettes, thinning out
  for (const a of fx.after) {
    const s = sprite(a.name);
    // ghosts, not a smear: checker-dithered, thinning as they age
    const young = a.age < 0.08;
    ctx.drawImage(silhouette(s, a.name, young ? C.speed3 : C.speed1, young ? 1 : 2), Math.round(a.x) - s.ox, Math.round(a.y) - s.oy);
  }
  // the tow cable, drawn as pixel geometry from the rear mount
  const m = rearMount(d, MOUNT_DIST[w.chassis]);
  const fm = frontMount(d, FRONT_DIST[w.chassis]);
  if (p.tow) pline(ctx, x + m.dx, y + m.dy + 3, Math.round(p.tow.x), Math.round(p.tow.y) + 2, C.gold0);

  if (p.invuln > 0 && p.knock <= 0 && Math.floor(time * 20) % 2 === 0) return;
  const name = playerSprite(w, time);
  const rearPart = p.parts.rear, frontPart = p.parts.front, sides = p.parts.sides;
  const thrust = (rearPart?.id === 'booster' && (revving(w) || p.rip?.burn || p.speed > 60)) || (rearPart?.id === 'jets' && (crouched(w) || !!p.air));
  const rear = () => {
    if (!rearPart) return;
    if (thrust) drawSprite(ctx, sprite(`fx:plume:${dn}:${Math.floor(time * 24) % 2}`), x + m.dx, y + m.dy);
    drawMounted(ctx, `part:${rearPart.id}:${dn}`, x, y, m, false, rearPart.cracked);
  };
  const front = () => {
    if (frontPart) drawMounted(ctx, `part:${frontPart.id}:${dn}`, x, y, fm, false, frontPart.cracked);
  };
  if (sides) drawMounted(ctx, `part:${sides.id}:${dn}`, x, y, { dx: 0, dy: 0, behind: true }, false, false);
  if (m.behind) rear();
  if (fm.behind) front();
  const s = sprite(name);
  if (fx.playerFlash > 0) ctx.drawImage(silhouette(s, name, C.danger3), x - s.ox, y - s.oy);
  else drawSprite(ctx, s, x, y);
  if (!m.behind) rear();
  if (!fm.behind) front();
  if (sides) nearTrack(ctx, `part:${sides.id}:${dn}`, x, y, dn);
  if (sides?.cracked) {
    const [cx, cy] = NEAR_TRACK[dn];
    crack(ctx, x + cx, y + cy);
  }
  // bolting: wrench sparks at the mount the part is going on
  if (p.bolt !== null && Math.floor(time * 20) % 3 === 0) dot(ctx, x + m.dx + Math.round(Math.random() * 4 - 2), y + m.dy - 2, C.gold3);
  // the claw's tier glow and the heading tick (the exact angle the 8-way sprite can't show)
  // with a Plow or Jaws on, the glow sits at the part's front edge, ink-edged so it reads on gold
  const tip = clawTip(p.heading, frontPart ? 15 : 11);
  const [g0, g1] = TIER_GLOW[p.rip ? p.rip.tier : p.tier];
  const tx = x + tip.dx, ty = y + tip.dy;
  const tierNow = p.rip ? p.rip.tier : p.tier;
  const ringR = tierNow === 'slip' ? 2 : tierNow === 'cruise' ? 1 : 0;
  if (frontPart && ringR) ring(ctx, tx, ty, ringR + 1, C.ink);
  if (ringR) ring(ctx, tx, ty, ringR, g0);
  dot(ctx, tx, ty, g1);
  pline(ctx, tx + Math.cos(p.heading) * 2, ty + Math.sin(p.heading) * 2 * 0.6, tx + Math.cos(p.heading) * 4, ty + Math.sin(p.heading) * 4 * 0.6, g1);
  // the slash
  if (fx.slash) drawSprite(ctx, sprite(`fx:slash:${fx.slash.tier}:${DIRS[fx.slash.dir]}:${Math.min(2, Math.floor(fx.slash.t / 0.05))}`), x, y - 3);
}

/** Where the near tread guard sits, by facing (anchor-relative), for its crack. */
const NEAR_TRACK: Record<string, [number, number]> = { e: [0, 4], w: [0, 4], se: [-8, 2], sw: [8, 2], ne: [6, 2], nw: [-6, 2], s: [-10, -2], n: [-10, -2] };

/** Your body's sprite name this frame (the Scrapper, the Skiff or the Hauler). */
export function playerSprite(w: World, time: number): string {
  const p = w.player, dn = DIRS[p.face], c = w.chassis;
  if (p.knock > 0 || p.stun > 0) return `pl:${c}:hurt:${dn}`;
  if (p.rip || p.latch) return `pl:${c}:rip:${dn}:${Math.floor(time * 20) % 2}`;
  // treads advance with distance travelled, not time
  const f = Math.floor((p.x + p.y) / 3) % 2 === 0 ? 0 : 1;
  return `pl:${c}:drive:${dn}:${p.speed > 2 ? f : 0}`;
}

function drawBanner(ctx: Ctx, fx: Fx) {
  const b = fx.banner;
  if (!b) return;
  const t = b.t, out = b.dur - t;
  const slide = t < 0.15 ? Math.round((0.15 - t) * 400) : out < 0.15 ? -Math.round((0.15 - out) * 400) : 0;
  const sc = 3;
  const tw = textWidth(b.text) * sc;
  const x = 320 - Math.floor(tw / 2) + slide, y = 120;
  ctx.fillStyle = PALETTE[C.ink];
  ctx.fillRect(0, y - 8, 640, 9 * sc + 22);
  drawText(ctx, b.text, x, y, PALETTE[C.white], sc, PALETTE[C.rust0]);
  fx.audit?.(b.text, x, y, tw, FONT_H * sc);
  if (b.sub) {
    const sx = 320 - Math.floor(textWidth(b.sub) / 2) + slide;
    drawText(ctx, b.sub, sx, y + 9 * sc + 2, PALETTE[C.mist], 1);
    fx.audit?.(b.sub, sx, y + 9 * sc + 2, textWidth(b.sub), FONT_H);
  }
}
