// Draws one encounter into the 640x360 buffer: floor and walls (cached), gates, skid marks,
// telegraph lanes, shadows, y-sorted bodies with their parts, the cable, the claw glow and heading
// tick, effects and the wave banner. Every sprite is asked for by name (STYLE.md).
import { C, PALETTE } from '../data/palette';
import { DIRS, dirAngle } from '../data/dirs';
import { MOUNT_DIST, clawTip, rearMount } from '../data/mounts';
import type { Gate } from '../data/arena';
import { hash2 } from '../engine/rng';
import { drawSprite, sprite } from './atlas';
import { makeCanvas, ctx2d } from './art/pixel';
import { dot, lane, pline, ring, silhouette } from './pixgeom';
import type { Fx } from './fx';
import { laneOf } from '../sim/rammer';
import { laneLength } from '../sim/arena';
import type { Rammer, World } from '../sim/world';
import { drawText, textWidth } from '../ui/font';

type Ctx = CanvasRenderingContext2D;

const TIER_GLOW: Record<string, [number, number]> = { crawl: [C.crawl, C.crawlHi], cruise: [C.cruise, C.cruiseHi], slip: [C.speed3, C.speed4] };

let bg: HTMLCanvasElement | null = null;

/** The floor and the ring wall, drawn once from tiles. */
function background(w: World): HTMLCanvasElement {
  if (bg) return bg;
  const a = w.arena, T = 16;
  const c = makeCanvas(a.w, a.h);
  const x = ctx2d(c);
  const cols = Math.ceil(a.w / T), rows = Math.ceil(a.h / T);
  const isWall = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= cols || cy >= rows || cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1;
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      if (isWall(cx, cy)) {
        const m = (isWall(cx, cy - 1) ? 1 : 0) | (isWall(cx + 1, cy) ? 2 : 0) | (isWall(cx, cy + 1) ? 4 : 0) | (isWall(cx - 1, cy) ? 8 : 0);
        drawSprite(x, sprite(`t:wall:${m}`), cx * T, cy * T);
      } else drawSprite(x, sprite(`t:floor:${Math.floor(hash2(cx, cy, 7) * 4)}`), cx * T, cy * T);
    }
  bg = c;
  return c;
}

/** Forget the cached background (after the art changes). */
export function resetBackground() {
  bg = null;
}

function gateState(w: World, g: Gate, time: number): 'closed' | 'open' | 'warn' {
  if (w.wave.phase === 'warn' && w.wave.gates.some((x) => x.id === g.id)) return Math.floor(time * 7) % 2 ? 'warn' : 'closed';
  if (w.rammers.some((r) => r.state === 'enter' && Math.hypot(r.x - g.spawn.x, r.y - g.spawn.y) < 40)) return 'open';
  return 'closed';
}

function rammerSprite(r: Rammer, time: number): string {
  const d = DIRS[dirOfFace(r.face)];
  const f = Math.floor(time * (r.state === 'charge' ? 14 : 6)) % 2;
  switch (r.state) {
    case 'enter': case 'stalk': return `en:rammer:stalk:${d}:${f}`;
    case 'windup': return `en:rammer:windup:${d}:${f}`;
    case 'charge': return `en:rammer:charge:${d}:${f}`;
    case 'skid': return r.slammed && r.t > 0.12 ? `en:rammer:stunned:${d}:${Math.floor(time * 4) % 2}` : `en:rammer:skid:${d}`;
  }
}

function dirOfFace(a: number): number {
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
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
  for (const r of w.rammers) {
    if (r.state !== 'windup') continue;
    const l = laneOf(w, r);
    const sx = r.x + Math.cos(l.angle) * w.t.rammerRadius, sy = r.y + Math.sin(l.angle) * w.t.rammerRadius;
    if (r.locked) {
      const hot = Math.floor(o.time * 12) % 2 === 0;
      lane(ctx, sx, sy, l.angle, l.len, l.width, hot ? C.danger3 : C.danger2, C.danger1, { density: 2 });
    } else lane(ctx, sx, sy, l.angle, l.len, l.width, C.danger1, C.danger0, { dash: 4, phase: Math.floor(o.time * 30), density: 4 });
  }
  const p = w.player;
  if (p.rev !== null) {
    const len = laneLength(w.arena, p.x, p.y, p.heading, 420, w.t.playerRadius);
    lane(ctx, p.x, p.y, p.heading, len, w.t.playerRadius * 2, C.speed2, C.speed0, { dash: 3, phase: -Math.floor(o.time * 40), density: 3 });
  }

  // shadows
  for (const r of w.rammers) drawSprite(ctx, sprite('fx:shadow:l'), Math.round(r.x), Math.round(r.y) + 1);
  for (const k of w.pickups) drawSprite(ctx, sprite('fx:shadow:s'), Math.round(k.x), Math.round(k.y) + 1);
  drawSprite(ctx, sprite('fx:shadow:m'), Math.round(p.x), Math.round(p.y) + 1);

  // y-sorted bodies
  const items: { y: number; draw: () => void }[] = [];
  for (const pr of w.arena.pillars) items.push({ y: pr.y + pr.h, draw: () => drawSprite(ctx, sprite('ob:pillar'), pr.x, pr.y) });
  for (const k of w.pickups) {
    const bob = Math.floor(o.time * 3 + k.id) % 2;
    items.push({ y: k.y, draw: () => drawSprite(ctx, sprite('pickup:booster'), Math.round(k.x), Math.round(k.y) - bob) });
  }
  for (const r of w.rammers) items.push({ y: r.y, draw: () => drawRammer(ctx, r, fx, o.time) });
  items.push({ y: p.y, draw: () => drawPlayer(ctx, w, fx, o.time) });
  if (p.tow) {
    const tw = p.tow;
    items.push({ y: tw.y, draw: () => drawSprite(ctx, sprite('pickup:booster'), Math.round(tw.x), Math.round(tw.y) + 4) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // stun stars
  for (const r of w.rammers)
    if (r.state === 'skid' && r.slammed) drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(r.x), Math.round(r.y) - 22);
  if (p.stun > 0) drawSprite(ctx, sprite(`fx:stars:${Math.floor(o.time * 10) % 4}`), Math.round(p.x), Math.round(p.y) - 18);

  fx.draw(ctx);
  ctx.restore();
  drawBanner(ctx, fx);
}

function drawRammer(ctx: Ctx, r: Rammer, fx: Fx, time: number) {
  const d = dirOfFace(r.face);
  const shake = r.state === 'windup' ? (Math.floor(time * 30) % 2 ? 1 : -1) * (r.locked ? 1 : 0) : 0;
  const x = Math.round(r.x) + shake, y = Math.round(r.y);
  const name = rammerSprite(r, time);
  const m = rearMount(d, MOUNT_DIST.rammer);
  const part = () => {
    if (!r.booster) return;
    drawSprite(ctx, sprite(`part:booster:${DIRS[d]}`), x + m.dx, y + m.dy);
    if (r.state === 'charge') drawSprite(ctx, sprite(`fx:plume:${DIRS[d]}:${Math.floor(time * 20) % 2}`), x + m.dx + Math.round(-Math.cos(dirAngle(d)) * 6), y + m.dy + Math.round(-Math.sin(dirAngle(d)) * 4));
  };
  if (m.behind) part();
  const s = sprite(name);
  if (fx.flash.has(r.id)) ctx.drawImage(silhouette(s, name, C.white), x - s.ox, y - s.oy);
  else drawSprite(ctx, s, x, y);
  if (!m.behind) part();
}

function drawPlayer(ctx: Ctx, w: World, fx: Fx, time: number) {
  const p = w.player;
  const d = p.face, dn = DIRS[d];
  const x = Math.round(p.x), y = Math.round(p.y);
  // afterimages at Slipstream: teal silhouettes, thinning out
  for (const a of fx.after) {
    const s = sprite(a.name);
    const k = a.age < 0.06 ? 0 : a.age < 0.12 ? 1 : 2;
    ctx.drawImage(silhouette(s, a.name, k === 0 ? C.speed3 : k === 1 ? C.speed2 : C.speed1, k), Math.round(a.x) - s.ox, Math.round(a.y) - s.oy);
  }
  // the tow cable, drawn as pixel geometry from the rear mount
  const m = rearMount(d, MOUNT_DIST.scrapper);
  if (p.tow) pline(ctx, x + m.dx, y + m.dy + 3, Math.round(p.tow.x), Math.round(p.tow.y) + 2, C.gold0);

  if (p.invuln > 0 && p.knock <= 0 && Math.floor(time * 20) % 2 === 0) return;
  const name = playerSprite(w, time);
  const thrust = p.part === 'booster' && (p.rev !== null || p.rip?.burn || p.speed > 60);
  const part = () => {
    if (p.part !== 'booster') return;
    drawSprite(ctx, sprite(`part:booster:${dn}`), x + m.dx, y + m.dy);
    if (thrust) drawSprite(ctx, sprite(`fx:plume:${dn}:${Math.floor(time * 24) % 2}`), x + m.dx + Math.round(-Math.cos(dirAngle(d)) * 6), y + m.dy + Math.round(-Math.sin(dirAngle(d)) * 4));
  };
  if (m.behind) part();
  const s = sprite(name);
  if (fx.playerFlash > 0) ctx.drawImage(silhouette(s, name, C.danger3), x - s.ox, y - s.oy);
  else drawSprite(ctx, s, x, y);
  if (!m.behind) part();
  // bolting: wrench sparks at the mount
  if (p.bolt !== null && Math.floor(time * 20) % 3 === 0) dot(ctx, x + m.dx + Math.round(Math.random() * 4 - 2), y + m.dy - 2, C.gold3);
  // the claw's tier glow and the heading tick (the exact angle the 8-way sprite can't show)
  const tip = clawTip(p.heading);
  const [g0, g1] = TIER_GLOW[p.rip ? p.rip.tier : p.tier];
  const tx = x + tip.dx, ty = y + tip.dy;
  if (p.tier === 'slip' || p.rip?.tier === 'slip') ring(ctx, tx, ty, 2, g0);
  dot(ctx, tx, ty, g1);
  pline(ctx, tx + Math.cos(p.heading) * 2, ty + Math.sin(p.heading) * 2 * 0.6, tx + Math.cos(p.heading) * 4, ty + Math.sin(p.heading) * 4 * 0.6, g1);
  // the slash
  if (fx.slash) drawSprite(ctx, sprite(`fx:slash:${fx.slash.tier}:${DIRS[fx.slash.dir]}:${Math.min(2, Math.floor(fx.slash.t / 0.05))}`), x, y - 3);
}

/** The Scrapper's sprite name this frame. */
export function playerSprite(w: World, time: number): string {
  const p = w.player, dn = DIRS[p.face];
  if (p.knock > 0 || p.stun > 0) return `pl:scrapper:hurt:${dn}`;
  if (p.rip) return `pl:scrapper:rip:${dn}:${Math.floor(time * 20) % 2}`;
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
