// The Hopper (PLAN.md 9.1): a squat scrap frog with jump jets on its back. It stalks slowly, then
// crouches with a red ring painted where it will land (leading you like the Rammer's lane), leaps
// over everything (in the air it can't be hit and touches nothing), slams down in the ring and is
// stuck there a moment: the opening, back to you. Too close to leap, it stomps where it stands.
// Stripped of its jets it can't leap, only waddle and stomp. The leap itself (crouch, flight,
// slam, stuck) is shared with The Compactor once its core is open (compactor.ts).
import { clamp } from '../engine/rng';
import { dirAngle, dirOf } from '../data/dirs';
import { pushOut } from './arena';
import { ahead, pathGoal, PUSH_HALF, turnToward } from './rammer';
import { hitPlayer } from './salvage';
import { airborne, DT, radiusOf, type Enemy, type World } from './world';

export function hasJets(e: Enemy): boolean {
  return e.parts.rear === 'jets';
}

/** How many Hoppers are crouching (at most maxCrouch at once). */
export function crouching(w: World): number {
  return w.enemies.filter((e) => e.kind === 'hopper' && e.state === 'windup').length;
}

/** A leap's numbers: a Hopper's leap or stomp, or The Compactor's leap once its core is open. */
export function leapSpec(w: World, e: Enemy): { windup: number; lock: number; air: number; slamR: number; stuck: number; max: number; height: number } {
  const t = w.t;
  if (e.kind === 'compactor') return { windup: t.bossLeapWindup, lock: t.bossLeapLock, air: t.bossLeapAir, slamR: t.bossSlamR, stuck: t.bossStuck, max: t.bossLeapMax, height: t.bossLeapHeight };
  if (e.stomp) return { windup: t.stompWindup, lock: t.stompWindup, air: t.stompAir, slamR: t.stompR, stuck: t.stompStuck, max: 0, height: Math.round(t.hopHeight * 0.35) };
  return { windup: t.hopWindup, lock: t.hopLock, air: t.hopAir, slamR: t.hopSlamR, stuck: t.hopStuck, max: t.hopMax, height: t.hopHeight };
}

/** The radius of the ring this crouch will slam. */
export function slamRadius(w: World, e: Enemy): number {
  return leapSpec(w, e).slamR;
}

/** Crouch: the leap at you (the ring tracks, then locks), or the stomp where it stands (locked at once). */
export function beginCrouch(w: World, e: Enemy, stomp: boolean) {
  e.state = 'windup';
  e.t = 0;
  e.leap = true;
  e.stomp = stomp;
  e.locked = stomp;
  const s = leapSpec(w, e);
  e.windup = s.windup;
  e.lock = s.lock;
  e.tx = e.x;
  e.ty = e.y;
  if (!stomp) aimLanding(w, e);
  w.events.push({ k: 'windup', id: e.id, near: stomp, shove: false });
  if (stomp) w.events.push({ k: 'lock', id: e.id });
}

/**
 * Where it will land: leadFrac of the way to where you'll be when it comes down (the Rammer's
 * lead, reading your line or your curve), within its reach, inside the walls, off any obstacle.
 */
function aimLanding(w: World, e: Enemy) {
  const p = w.player, t = w.t, a = w.arena, r = radiusOf(w, e), s = leapSpec(w, e);
  const T = Math.max(0, e.windup - e.t) + s.air;
  const ah = ahead(w, T);
  let x = p.x + (ah.x - p.x) * t.leapLead, y = p.y + (ah.y - p.y) * t.leapLead;
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d > s.max) {
    x = e.x + (dx / d) * s.max;
    y = e.y + (dy / d) * s.max;
  }
  x = clamp(x, a.wall + r + 1, a.w - a.wall - r - 1);
  y = clamp(y, e.kind === 'compactor' ? t.bossTopY : a.wall + r + 1, a.h - a.wall - r - 1);
  const o = pushOut(a, x, y, r);
  e.tx = o.x;
  e.ty = o.y;
}

/** It comes down: anyone in the ring takes a hit, loose parts there are crushed, other enemies are shoved out. */
function land(w: World, e: Enemy) {
  const p = w.player, t = w.t, s = leapSpec(w, e), R = s.slamR;
  e.state = 'land';
  e.t = 0;
  e.skidFor = s.stuck;
  e.x = e.tx;
  e.y = e.ty;
  // stuck, its facing snaps to its sprite's direction, so the back you see is the back the game uses
  e.face = dirAngle(dirOf(e.face));
  w.events.push({ k: 'land', id: e.id, x: e.x, y: e.y, r: R });
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (!p.air && !w.result && d < R + 2) hitPlayer(w, Math.atan2(p.y - e.y, p.x - e.x), 1.1);
  else if (!p.air && !w.result && d < R + 2 + t.shockBand && p.invuln <= 0 && p.knock <= 0 && p.stun <= 0) {
    // the shockwave: a slam that only just misses you lifts you to Slipstream, like a charge's
    // slipstream, so a tight dodge sets up the counter-pass while it's stuck
    p.speed = Math.min(t.burnMax, Math.max(p.speed + 15, t.slipAt + t.draftBoost));
    w.events.push({ k: 'draft', id: e.id, x: p.x, y: p.y });
  }
  for (const k of [...w.pickups]) {
    if (Math.hypot(k.x - e.x, k.y - e.y) >= R) continue;
    w.pickups.splice(w.pickups.indexOf(k), 1);
    w.stats.partsShattered++;
    w.events.push({ k: 'crush', part: k.part, x: k.x, y: k.y });
  }
  for (const o of w.enemies) {
    if (o === e || airborne(o)) continue;
    const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 0.01;
    if (d > R + radiusOf(w, o)) continue;
    const v = (24 * Math.LN2) / PUSH_HALF;
    o.vx += (dx / d) * v;
    o.vy += (dy / d) * v;
  }
}

/**
 * A leap in progress, one tick: the crouch (the ring tracks you, then locks), the flight (a
 * straight line to the ring; the arc is only drawn, and nothing touches it on the way), the slam
 * and the stuck. Returns null outside a leap. After the stuck it goes back to stalking, with
 * `cd` seconds before it may leap again.
 */
export function stepLeap(w: World, e: Enemy, cd: () => number): { speed: number; dir: number } | null {
  const t = w.t;
  switch (e.state) {
    case 'windup':
      if (!e.leap) return null;
      if (!e.stomp) {
        if (e.t < e.windup - e.lock) {
          aimLanding(w, e);
          e.face = turnToward(e.face, Math.atan2(e.ty - e.y, e.tx - e.x), t.trackTurn * DT);
        } else if (!e.locked) {
          e.locked = true;
          w.events.push({ k: 'lock', id: e.id });
        }
      }
      if (e.t >= e.windup) {
        e.state = 'air';
        e.t = 0;
        e.sx = e.x;
        e.sy = e.y;
        e.vx = 0;
        e.vy = 0;
        w.events.push({ k: 'hop', id: e.id });
      }
      return { speed: 0, dir: e.face };
    case 'air': {
      const f = hopProgress(w, e);
      e.x = e.sx + (e.tx - e.sx) * f;
      e.y = e.sy + (e.ty - e.sy) * f;
      e.vx = 0;
      e.vy = 0;
      if (f >= 1) land(w, e);
      return { speed: 0, dir: e.face };
    }
    case 'land':
      if (e.t >= e.skidFor) {
        e.state = 'stalk';
        e.t = 0;
        e.leap = false;
        e.cd = cd();
      }
      return { speed: 0, dir: e.face };
    default:
      return null;
  }
}

/** One Hopper's brain for one tick: sets its facing and returns how fast it moves, and which way. */
export function thinkHopper(w: World, e: Enemy): { speed: number; dir: number } {
  const p = w.player, t = w.t;
  const jets = hasJets(e);
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  const leap = stepLeap(w, e, () => w.rng.range(t.hopCdMin, t.hopCdMax));
  if (leap) return leap;
  switch (e.state) {
    case 'enter':
      e.face = Math.atan2(e.enter.y, e.enter.x);
      if (e.t >= t.enterTime) {
        e.state = 'stalk';
        e.t = 0;
      }
      return { speed: t.hopperSpeed * 1.5, dir: e.face };
    case 'stalk': {
      const goal = pathGoal(w, e, t.hopperRadius + 6);
      e.face = turnToward(e.face, Math.atan2(goal.y - e.y, goal.x - e.x), t.hopperTurn * DT);
      const can = e.cd <= 0 && crouching(w) < t.maxCrouch && !w.result;
      if (can && dist < t.hopMin) beginCrouch(w, e, true);
      else if (can && jets && dist <= t.hopMax) beginCrouch(w, e, false);
      const sp = jets ? t.hopperSpeed : t.hopperStrippedSpeed;
      return { speed: e.state === 'stalk' && dist > t.playerRadius + t.hopperRadius + 6 ? sp : 0, dir: e.face };
    }
    case 'stunned':
      if (e.t >= e.skidFor) {
        e.state = 'stalk';
        e.t = 0;
        e.cd = w.rng.range(t.hopCdMin, t.hopCdMax);
      }
      return { speed: 0, dir: e.face };
    default:
      // a crouch knocked out of its leap (a Cruise hit cancels it to stalking) lands here too
      e.state = 'stalk';
      e.leap = false;
      return { speed: 0, dir: e.face };
  }
}

/** How far through its leap an airborne body is (0..1), for the arc the renderer draws. */
export function hopProgress(w: World, e: Enemy): number {
  return e.state === 'air' ? Math.min(1, e.t / leapSpec(w, e).air) : 0;
}
