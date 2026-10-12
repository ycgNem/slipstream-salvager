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
import { crack, dot, lane, outline, pline, ring, silhouette } from './pixgeom';
import type { Fx } from './fx';
import { laneOf } from '../sim/enemies';
import { revving } from '../sim/rip';
import { laneLength } from '../sim/arena';
import type { Enemy, World } from '../sim/world';
import { drawText, textWidth } from '../ui/font';

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
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      if (isWall(cx, cy)) {
        const m = (isWall(cx, cy - 1) ? 1 : 0) | (isWall(cx + 1, cy) ? 2 : 0) | (isWall(cx, cy + 1) ? 4 : 0) | (isWall(cx - 1, cy) ? 8 : 0);
        drawSprite(x, sprite(`t:wall:${m}`), cx * T, cy * T);
      } else drawSprite(x, sprite(`t:floor:${Math.floor(hash2(cx, cy, 7) * 4)}`), cx * T, cy * T);
    }
  bg = { arena: a, c };
  return c;
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
    case 'booster': return r.state === 'skid' || r.state === 'charge' || (r.state === 'windup' && r.locked);
    case 'plow': return r.state === 'charge';
    case 'treads': return r.state === 'slide' || r.state === 'stunned';
    case 'jaws': return r.state === 'windup' || r.state === 'stunned';
  }
}

export interface DrawOpts {
  time: number;
  shake: boolean;
}

export function drawWorld(ctx: Ctx, w: World, fx: Fx, o: DrawOpts) {
  const off = fx.shakeOffset(o.shake);
  ctx.save();
  ctx.translate(off.x, off.y);
  ctx.drawImage(background(w), 0, 0);

  for (const g of w.arena.gates) drawSprite(ctx, sprite(`ob:gate:${g.orient}:${gateState(w, g, o.time)}`), g.rect.x, g.rect.y);
  fx.drawMarks(ctx);

  // telegraphs: under bodies, over the floor
  for (const r of w.enemies) {
    if (r.state !== 'windup') continue;
    const l = laneOf(w, r);
    const rr = l.width / 2;
    const sx = r.x + Math.cos(l.angle) * rr, sy = r.y + Math.sin(l.angle) * rr;
    if (r.locked) {
      const hot = Math.floor(o.time * 12) % 2 === 0;
      lane(ctx, sx, sy, l.angle, l.len, l.width, hot ? C.danger3 : C.danger2, C.danger1, { density: 2 });
    } else lane(ctx, sx, sy, l.angle, l.len, l.width, C.danger1, C.danger0, { dash: 4, phase: Math.floor(o.time * 30), density: 4 });
  }
  const p = w.player;
  if (revving(w)) {
    const len = laneLength(w.arena, p.x, p.y, p.heading, 420, w.t.playerRadius);
    lane(ctx, p.x, p.y, p.heading, len, w.t.playerRadius * 2, C.speed2, C.speed0, { dash: 3, phase: -Math.floor(o.time * 40), density: 3 });
  }

  // shadows
  for (const r of w.enemies) drawSprite(ctx, sprite(r.kind === 'rammer' ? 'fx:shadow:l' : 'fx:shadow:m'), Math.round(r.x), Math.round(r.y) + 1);
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
  for (const r of w.enemies) items.push({ y: r.y, draw: () => drawEnemy(ctx, r, fx, o.time) });
  items.push({ y: p.y, draw: () => drawPlayer(ctx, w, fx, o.time) });
  if (p.tow) {
    const tw = p.tow;
    items.push({ y: tw.y, draw: () => {
      drawSprite(ctx, sprite(`pickup:${tw.part}`), Math.round(tw.x), Math.round(tw.y) + 4);
      if (tw.cracked) crack(ctx, Math.round(tw.x), Math.round(tw.y) - 1);
    } });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // stun stars
  for (const r of w.enemies)
    if ((r.state === 'skid' && r.slammed) || r.state === 'stunned') drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(r.x), Math.round(r.y) - (r.kind === 'rammer' ? 22 : 16));
  if (p.stun > 0) drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(p.x), Math.round(p.y) - 18);

  fx.draw(ctx);
  ctx.restore();
  drawBanner(ctx, fx);
}

/** Draw a mounted part (with an optional gold glint and crack) at a mount position. */
function drawMounted(ctx: Ctx, name: string, x: number, y: number, m: MountPos, glint: boolean, cracked: boolean) {
  const s = sprite(name);
  if (glint) outline(ctx, s, name, x + m.dx, y + m.dy, C.gold3);
  drawSprite(ctx, s, x + m.dx, y + m.dy);
  if (cracked) crack(ctx, x + m.dx, y + m.dy);
}

function drawEnemy(ctx: Ctx, r: Enemy, fx: Fx, time: number) {
  const d = dirOfFace(r.face), dn = DIRS[d];
  const shake = r.state === 'windup' ? (Math.floor(time * 30) % 2 ? 1 : -1) * (r.locked ? 1 : 0) : 0;
  const x = Math.round(r.x) + shake, y = Math.round(r.y);
  const name = enemySprite(r, time);
  const blink = Math.floor(time * 10) % 2 === 0;
  const rm = rearMount(d, r.kind === 'rammer' ? MOUNT_DIST.rammer : MOUNT_DIST.snapper);
  // the Snapper's head lunges 3 px out on a snap and dips 1 px in its windup and when stunned,
  // and the jaws stay on it
  const fm = r.kind === 'rammer'
    ? frontMount(d, FRONT_DIST.rammer)
    : frontMount(d, FRONT_DIST.snapper + (r.state === 'snap' ? 3 : 0), r.state === 'windup' || r.state === 'stunned' ? 2 : 3);
  const rear = () => {
    const part = r.parts.rear;
    if (!part) return;
    // the flame shares the booster's anchor and goes under it (it starts at the nozzle)
    if (part === 'booster' && r.state === 'charge') drawSprite(ctx, sprite(`fx:plume:${dn}:${Math.floor(time * 20) % 2}`), x + rm.dx, y + rm.dy);
    drawMounted(ctx, `part:${part}:${dn}`, x, y, rm, tearable(r, part) && blink, false);
  };
  const front = () => {
    const part = r.parts.front;
    if (part) drawMounted(ctx, `part:${part}:${dn}`, x, y, fm, tearable(r, part) && blink, false);
  };
  // the treads go under the body, sticking out either side
  if (r.parts.sides) drawMounted(ctx, `part:${r.parts.sides}:${dn}`, x, y, { dx: 0, dy: 0, behind: true }, tearable(r, r.parts.sides) && blink, false);
  if (rm.behind) rear();
  if (fm.behind) front();
  const s = sprite(name);
  if (fx.flash.has(r.id)) ctx.drawImage(silhouette(s, name, C.white), x - s.ox, y - s.oy);
  else drawSprite(ctx, s, x, y);
  if (!rm.behind) rear();
  if (!fm.behind) front();
}

function drawPlayer(ctx: Ctx, w: World, fx: Fx, time: number) {
  const p = w.player;
  const d = p.face, dn = DIRS[d];
  const x = Math.round(p.x), y = Math.round(p.y);
  // afterimages at Slipstream: teal silhouettes, thinning out
  for (const a of fx.after) {
    const s = sprite(a.name);
    // ghosts, not a smear: checker-dithered, thinning as they age
    const young = a.age < 0.08;
    ctx.drawImage(silhouette(s, a.name, young ? C.speed3 : C.speed1, young ? 1 : 2), Math.round(a.x) - s.ox, Math.round(a.y) - s.oy);
  }
  // the tow cable, drawn as pixel geometry from the rear mount
  const m = rearMount(d, MOUNT_DIST.scrapper);
  const fm = frontMount(d, FRONT_DIST.scrapper);
  if (p.tow) pline(ctx, x + m.dx, y + m.dy + 3, Math.round(p.tow.x), Math.round(p.tow.y) + 2, C.gold0);

  if (p.invuln > 0 && p.knock <= 0 && Math.floor(time * 20) % 2 === 0) return;
  const name = playerSprite(w, time);
  const rearPart = p.parts.rear, frontPart = p.parts.front, sides = p.parts.sides;
  const thrust = rearPart?.id === 'booster' && (revving(w) || p.rip?.burn || p.speed > 60);
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
  if (sides?.cracked) crack(ctx, x + 7, y - 2);
  // bolting: wrench sparks at the mount the part is going on
  if (p.bolt !== null && Math.floor(time * 20) % 3 === 0) dot(ctx, x + m.dx + Math.round(Math.random() * 4 - 2), y + m.dy - 2, C.gold3);
  // the claw's tier glow and the heading tick (the exact angle the 8-way sprite can't show)
  const tip = clawTip(p.heading);
  const [g0, g1] = TIER_GLOW[p.rip ? p.rip.tier : p.tier];
  const tx = x + tip.dx, ty = y + tip.dy;
  const tierNow = p.rip ? p.rip.tier : p.tier;
  if (tierNow === 'slip') ring(ctx, tx, ty, 2, g0);
  else if (tierNow === 'cruise') ring(ctx, tx, ty, 1, g0);
  dot(ctx, tx, ty, g1);
  pline(ctx, tx + Math.cos(p.heading) * 2, ty + Math.sin(p.heading) * 2 * 0.6, tx + Math.cos(p.heading) * 4, ty + Math.sin(p.heading) * 4 * 0.6, g1);
  // the slash
  if (fx.slash) drawSprite(ctx, sprite(`fx:slash:${fx.slash.tier}:${DIRS[fx.slash.dir]}:${Math.min(2, Math.floor(fx.slash.t / 0.05))}`), x, y - 3);
}

/** The Scrapper's sprite name this frame. */
export function playerSprite(w: World, time: number): string {
  const p = w.player, dn = DIRS[p.face];
  if (p.knock > 0 || p.stun > 0) return `pl:scrapper:hurt:${dn}`;
  if (p.rip || p.latch) return `pl:scrapper:rip:${dn}:${Math.floor(time * 20) % 2}`;
  // treads advance with distance travelled, not time
  const f = Math.floor((p.x + p.y) / 3) % 2 === 0 ? 0 : 1;
  return `pl:scrapper:drive:${dn}:${p.speed > 2 ? f : 0}`;
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
  if (b.sub) drawText(ctx, b.sub, 320 - Math.floor(textWidth(b.sub) / 2) + slide, y + 9 * sc + 2, PALETTE[C.mist], 1);
}
