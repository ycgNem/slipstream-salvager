// The Rammer (PLAN.md 4.3, DECISIONS #30): a slow but fast-turning stalker with a telegraphed lane
// charge. It leads your movement by half, locks the lane before it goes, skids helplessly
// afterwards (the opening), rebounds off walls and pillars, and once stripped of its booster only
// does a short shove. At most maxWindups wind up at once.
import { dirAngle, dirOf, wrapAngle } from '../data/dirs';
import { contacts, laneLength, lineOfSight } from './arena';
import { hitPlayer } from './salvage';
import { DT, type Rammer, type World } from './world';

const PUSH_HALF = 0.08;

function turnToward(a: number, target: number, maxStep: number): number {
  const d = wrapAngle(target - a);
  return wrapAngle(a + Math.max(-maxStep, Math.min(maxStep, d)));
}

export function windingUp(w: World): number {
  return w.rammers.filter((r) => r.state === 'windup').length;
}

/** Start a windup: near ones are quick, far ones slow, a stripped Rammer only shoves. */
export function beginWindup(w: World, r: Rammer, near: boolean) {
  const t = w.t;
  r.shove = !r.booster;
  r.state = 'windup';
  r.t = 0;
  r.locked = false;
  r.windup = r.shove ? t.shoveWindup : near ? t.windupNear : t.windupFar;
  r.lock = r.shove ? t.shoveLock : near ? t.lockNear : t.lockFar;
  w.events.push({ k: 'windup', id: r.id, near, shove: r.shove });
}

/** The point it aims at: where you'll be, led by leadFrac of your velocity over the time to impact. */
export function aimPoint(w: World, r: Rammer): { x: number; y: number } {
  const p = w.player, t = w.t;
  const dist = Math.hypot(p.x - r.x, p.y - r.y);
  const speed = r.shove ? t.shoveSpeed : t.chargeSpeed;
  const T = Math.max(0, r.windup - r.t) + dist / speed;
  const vx = Math.cos(p.heading) * p.speed, vy = Math.sin(p.heading) * p.speed;
  return { x: p.x + vx * T * t.leadFrac, y: p.y + vy * T * t.leadFrac };
}

function toSkid(w: World, r: Rammer, slammed: boolean) {
  const t = w.t;
  r.state = 'skid';
  r.t = 0;
  r.slammed = slammed;
  // its facing snaps to its sprite's direction, so the rear you see is the rear the game uses
  r.face = dirAngle(dirOf(r.face));
  const fx = Math.cos(r.face), fy = Math.sin(r.face);
  if (slammed) {
    const v = (t.reboundDist * Math.LN2) / PUSH_HALF;
    r.vx = -fx * v;
    r.vy = -fy * v;
  } else {
    const v = (r.shove ? t.shoveSpeed : t.chargeSpeed) * 0.3;
    r.vx = fx * v;
    r.vy = fy * v;
  }
}

/**
 * Where a stalking Rammer walks: straight at you if it can see you, otherwise round the pillar in
 * the way, via the corner (pushed out a little) that makes the shorter trip.
 */
function stalkGoal(w: World, r: Rammer): { x: number; y: number } {
  const p = w.player;
  if (lineOfSight(w.arena, r.x, r.y, p.x, p.y)) return p;
  const m = w.t.rammerRadius + 6;
  let best = { x: p.x, y: p.y }, bd = Infinity;
  for (const pr of w.arena.pillars)
    for (const [cx, cy] of [[pr.x - m, pr.y - m], [pr.x + pr.w + m, pr.y - m], [pr.x - m, pr.y + pr.h + m], [pr.x + pr.w + m, pr.y + pr.h + m]]) {
      if (Math.hypot(cx - r.x, cy - r.y) < 4 || !lineOfSight(w.arena, r.x, r.y, cx, cy)) continue;
      const d = Math.hypot(cx - r.x, cy - r.y) + Math.hypot(p.x - cx, p.y - cy);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
  return best;
}

/** AI and movement for every Rammer, one tick. */
export function updateRammers(w: World) {
  const p = w.player, t = w.t;
  for (const r of w.rammers) {
    r.t += DT;
    r.cd -= DT;
    const dx = p.x - r.x, dy = p.y - r.y, dist = Math.hypot(dx, dy);
    let move = 0;
    switch (r.state) {
      case 'enter':
        r.face = Math.atan2(r.enter.y, r.enter.x);
        move = t.stalkSpeed * 1.5;
        if (r.t >= t.enterTime) { r.state = 'stalk'; r.t = 0; }
        break;
      case 'stalk': {
        const goal = stalkGoal(w, r);
        r.face = turnToward(r.face, Math.atan2(goal.y - r.y, goal.x - r.x), t.stalkTurn * DT);
        if (dist > t.playerRadius + t.rammerRadius + 6) move = r.booster ? t.stalkSpeed : t.strippedSpeed;
        const can = r.cd <= 0 && windingUp(w) < t.maxWindups && !w.result;
        const range = r.booster ? t.chargeRange : t.shoveRange;
        if (can && dist < range && lineOfSight(w.arena, r.x, r.y, p.x, p.y)) beginWindup(w, r, dist <= t.nearDist);
        break;
      }
      case 'windup':
        if (r.t < r.windup - r.lock) {
          const a = aimPoint(w, r);
          r.face = turnToward(r.face, Math.atan2(a.y - r.y, a.x - r.x), t.trackTurn * DT);
        } else if (!r.locked) {
          r.locked = true;
          w.events.push({ k: 'lock', id: r.id });
        }
        if (r.t >= r.windup) {
          r.state = 'charge';
          r.t = 0;
          r.travelled = 0;
          w.events.push({ k: 'charge', id: r.id, shove: r.shove });
        }
        break;
      case 'charge': {
        const sp = r.shove ? t.shoveSpeed : t.chargeSpeed;
        move = sp;
        r.travelled += sp * DT;
        if (r.travelled >= (r.shove ? t.shoveDist : t.chargeDist)) toSkid(w, r, false);
        break;
      }
      case 'skid':
        if (r.t >= t.skidTime) {
          r.state = 'stalk';
          r.t = 0;
          r.cd = w.rng.range(t.chargeCdMin, t.chargeCdMax);
        }
        break;
    }
    r.x += (Math.cos(r.face) * move + r.vx) * DT;
    r.y += (Math.sin(r.face) * move + r.vy) * DT;
    const k = Math.pow(0.5, DT / PUSH_HALF);
    r.vx *= k;
    r.vy *= k;
    // walls and pillars
    for (const c of contacts(w.arena, r.x, r.y, t.rammerRadius)) {
      r.x += c.nx * c.depth;
      r.y += c.ny * c.depth;
      const into = -(Math.cos(r.face) * c.nx + Math.sin(r.face) * c.ny);
      if (r.state === 'charge' && into > 0.3) {
        w.events.push({ k: 'slam', id: r.id, x: r.x - c.nx * t.rammerRadius, y: r.y - c.ny * t.rammerRadius });
        toSkid(w, r, true);
      }
    }
  }
  // Rammers against each other: pushed apart; a charge into another puts both into recovery
  for (let i = 0; i < w.rammers.length; i++)
    for (let j = i + 1; j < w.rammers.length; j++) {
      const a = w.rammers[i], b = w.rammers[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = t.rammerRadius * 2;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d, o = (min - d) / 2;
      a.x -= nx * o; a.y -= ny * o;
      b.x += nx * o; b.y += ny * o;
      if (a.state === 'charge' || b.state === 'charge') {
        w.events.push({ k: 'slam', id: a.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        toSkid(w, a, a.state === 'charge');
        toSkid(w, b, b.state === 'charge');
      }
    }
}

/** The lane a winding-up Rammer will charge along: its angle and how far it runs. */
export function laneOf(w: World, r: Rammer): { angle: number; len: number; width: number } {
  const t = w.t;
  const max = r.shove ? t.shoveDist : t.chargeDist;
  return { angle: r.face, len: laneLength(w.arena, r.x, r.y, r.face, max, t.rammerRadius), width: t.rammerRadius * 2 };
}

/**
 * The player's body against the Rammers outside a rip. A charge hits you (unless your current rip
 * already went through that Rammer); anything else is a bump that bounces you off and starts its
 * quick windup, so lingering is dangerous.
 */
export function resolveContacts(w: World) {
  const p = w.player, t = w.t;
  for (const r of w.rammers) {
    const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 0.01, min = t.playerRadius + t.rammerRadius;
    if (d >= min) continue;
    if (r.state === 'charge') {
      if (p.rip?.hits.includes(r.id)) continue;
      if (p.invuln <= 0) hitPlayer(w, r.face);
      continue;
    }
    if (p.pass > 0) continue;
    const nx = dx / d, ny = dy / d;
    p.x = r.x + nx * min;
    p.y = r.y + ny * min;
    let vx = Math.cos(p.heading) * p.speed, vy = Math.sin(p.heading) * p.speed;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      vx -= 2 * vn * nx;
      vy -= 2 * vn * ny;
      p.heading = Math.atan2(vy, vx);
      p.speed *= t.bumpKeep;
      w.events.push({ k: 'bump', id: r.id, x: r.x + nx * t.rammerRadius, y: r.y + ny * t.rammerRadius });
      if (r.state === 'stalk' && windingUp(w) < t.maxWindups && !w.result) beginWindup(w, r, true);
    }
  }
}
