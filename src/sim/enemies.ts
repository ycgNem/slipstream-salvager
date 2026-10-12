// Everything the enemies share (PLAN.md 4.3, 8.3): each one's brain by kind, movement, walls and
// pillars, crushing loose parts, pushing each other apart (a lunge into another enemy puts both
// into recovery), the telegraph lane, contacts with the player's body (bites and charges, bumps,
// the Plow's ram hits and blocks) and the slipstream a passing charge leaves behind.
import { wrapAngle } from '../data/dirs';
import { along, contacts, floorAt, laneLength, onOil, pushOut } from './arena';
import { hasBehavior } from './body';
import { beginWindup, chargeLength, PUSH_HALF, thinkRammer, toSkid, windingUp } from './rammer';
import { lunging, ramHit, stunEnemy } from './rip';
import { hitPlayer } from './salvage';
import { beginSnap, snapping, thinkSnapper } from './snapper';
import { beginCrouch, crouching, thinkHopper } from './hopper';
import { beginRoll, hasSprings, rollingUp, thinkBouncer } from './bouncer';
import { beginBossWindup, bossChargeLength, thinkCompactor } from './compactor';
import { CHASSIS } from '../data/chassis';
import { airborne, DT, hasAnyPart, KINDS, radiusOf, tierOf, type Enemy, type World } from './world';

const deg = (d: number) => (d * Math.PI) / 180;

/** AI and movement for every enemy, one tick. */
export function updateEnemies(w: World) {
  const t = w.t;
  for (const e of w.enemies) {
    e.t += DT;
    e.cd -= DT;
    const oil = !airborne(e) && onOil(w.arena, e.x, e.y), face0 = e.face;
    let speed: number, dir: number;
    if (e.kind === 'rammer') {
      speed = thinkRammer(w, e);
      dir = e.face;
    } else if (e.kind === 'hopper') ({ speed, dir } = thinkHopper(w, e));
    else if (e.kind === 'bouncer') ({ speed, dir } = thinkBouncer(w, e));
    else if (e.kind === 'compactor') ({ speed, dir } = thinkCompactor(w, e));
    else ({ speed, dir } = thinkSnapper(w, e));
    if (oil && (e.state === 'stalk' || e.state === 'hunt')) {
      // on oil it can't turn (PLAN.md 9.4): it keeps the line it came in on
      e.face = face0;
      dir = face0;
    }
    if (w.arena.floor?.length && !airborne(e)) {
      // a boost strip speeds up a hunting Snapper or a rolling Bouncer going its way
      const b = floorAt(w.arena, e.x, e.y, 'boost');
      if (b && along(b, dir, t.boostConeDeg)) {
        if (e.kind === 'snapper' && e.state === 'hunt') e.speed = speed = Math.max(speed, t.boostEnemy);
        if (e.kind === 'bouncer' && e.state === 'roll') e.speed = speed = Math.max(speed, t.boostRoll);
      }
    }
    e.x += (Math.cos(dir) * speed + e.vx) * DT;
    e.y += (Math.sin(dir) * speed + e.vy) * DT;
    // a skid (or a shove) slides twice as far on oil
    const k = Math.pow(0.5, DT / (oil ? PUSH_HALF * 2 : PUSH_HALF));
    e.vx *= k;
    e.vy *= k;
    // in the air (a Hopper's leap) it sails over everything
    if (airborne(e)) continue;
    // walls and pillars: a lunge into one stops it (a Rammer rebounds into its skid, a Snapper is
    // stunned), unless it's on springs, which bounce it off (a Bouncer's roll every time, faster;
    // a Spring Rammer's charge once); otherwise it slides along
    const rr = radiusOf(w, e);
    const cs = contacts(w.arena, e.x, e.y, rr);
    // The Compactor keeps its head below the HUD band: the top of the yard is a wall to it
    if (e.kind === 'compactor' && e.state !== 'enter' && e.y < t.bossTopY) cs.push({ nx: 0, ny: 1, depth: t.bossTopY - e.y });
    for (const c of cs) {
      e.x += c.nx * c.depth;
      e.y += c.ny * c.depth;
      const into = -(Math.cos(dir) * c.nx + Math.sin(dir) * c.ny);
      if (lunging(e) && into > 0.05 && springy(w, e)) {
        const fx = Math.cos(e.face), fy = Math.sin(e.face), fn = fx * c.nx + fy * c.ny;
        e.face = Math.atan2(fy - 2 * fn * c.ny, fx - 2 * fn * c.nx);
        dir = e.face;
        e.bounces++;
        if (e.kind === 'bouncer') e.speed = Math.min(t.rollMax, e.speed + t.rollGain);
        w.events.push({ k: 'boing', x: e.x - c.nx * rr, y: e.y - c.ny * rr, id: e.id });
        continue;
      }
      if (lunging(e) && into > 0.3) {
        w.events.push({ k: 'slam', id: e.id, x: e.x - c.nx * rr, y: e.y - c.ny * rr });
        if (e.kind === 'rammer') toSkid(w, e, true);
        // The Compactor without its springs stops dead: the big opening
        else stunEnemy(w, e, e.kind === 'compactor' ? t.bossWallStun : 0.8);
      } else if (e.kind === 'snapper' && into > 0.3) e.speed *= 0.6;
    }
  }
  crushLoose(w);
  separate(w);
}

/**
 * Does this lunge bounce off walls? A Bouncer's roll on its springs; a Spring Rammer's charge, once;
 * The Compactor's charge, bossBounces times.
 */
function springy(w: World, e: Enemy): boolean {
  if (!hasSprings(e)) return false;
  if (e.kind === 'bouncer') return true;
  if (e.state !== 'charge') return false;
  // The Compactor's Springs bounce its shove too, once (DECISIONS #97)
  if (e.shove) return e.kind === 'compactor' && e.bounces < 1;
  return e.kind === 'rammer' ? e.bounces < 1 : e.kind === 'compactor' && e.bounces < w.t.bossBounces;
}

/** A lunge runs over loose parts and crushes them (DECISIONS #58). */
function crushLoose(w: World) {
  const t = w.t;
  for (const e of w.enemies) {
    if (!lunging(e)) continue;
    for (const k of [...w.pickups]) {
      if (k.age < 0.3 || Math.hypot(k.x - e.x, k.y - e.y) > radiusOf(w, e) + t.pickupRadius) continue;
      w.pickups.splice(w.pickups.indexOf(k), 1);
      w.stats.partsShattered++;
      w.events.push({ k: 'crush', part: k.part, x: k.x, y: k.y });
    }
  }
}

/** Enemies against each other: pushed apart; a lunge into another puts both into recovery. */
function separate(w: World) {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (airborne(a) || airborne(b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = radiusOf(w, a) + radiusOf(w, b);
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d, o = (min - d) / 2;
      a.x -= nx * o; a.y -= ny * o;
      b.x += nx * o; b.y += ny * o;
      for (const e of [a, b]) Object.assign(e, pushOut(w.arena, e.x, e.y, radiusOf(w, e)));
      if (lunging(a) || lunging(b)) {
        // The Compactor ploughs on through (only the other one recoils), and a body already knocked
        // back doesn't recoil again: one slam per collision, not one a tick
        const hit = [a, b].filter((e) => e.kind !== 'compactor' && e.state !== 'skid' && e.state !== 'stunned');
        if (hit.length) w.events.push({ k: 'slam', id: a.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        for (const e of hit) recoil(w, e, lunging(e));
      }
    }
}

/** Knocked off its stride by a collision: a Rammer into its skid, a Snapper stunned. */
function recoil(w: World, e: Enemy, slammed: boolean) {
  if (e.kind === 'rammer') toSkid(w, e, slammed);
  else stunEnemy(w, e, slammed ? 0.8 : 0.5);
}

/** The lane a winding-up enemy will lunge along: its angle, how far it runs, and how wide. */
export function laneOf(w: World, r: Enemy): { angle: number; len: number; width: number } {
  const t = w.t, rr = radiusOf(w, r);
  // a Bouncer's roll runs to the first wall (and bounces on: the renderer adds the stub)
  const max = r.kind === 'bouncer' ? 640 : r.kind === 'snapper' ? t.snapDist : chargeLenOf(w, r);
  let len = laneLength(w.arena, r.x, r.y, r.face, max, rr);
  // The Compactor's lane stops at its top limit, where its charge does
  if (r.kind === 'compactor' && Math.sin(r.face) < -0.01) len = Math.min(len, Math.max(0, (r.y - t.bossTopY) / -Math.sin(r.face)));
  return { angle: r.face, len, width: rr * 2 };
}

/** How far a Rammer's (or The Compactor's) charge or shove runs: fixed once its lane locks. */
export function chargeLenOf(w: World, r: Enemy): number {
  const t = w.t, boss = r.kind === 'compactor';
  if (r.shove) return boss ? t.bossShoveDist : t.shoveDist;
  return r.locked ? r.chargeLen : boss ? bossChargeLength(w, r) : chargeLength(w, r);
}

/** Is this enemy in front of the player, within the Plow's cone? */
function inPlowCone(w: World, e: Enemy): boolean {
  const p = w.player;
  return Math.abs(wrapAngle(Math.atan2(e.y - p.y, e.x - p.x) - p.heading)) <= deg(w.t.plowConeDeg);
}

/**
 * The player's body against the enemies outside a rip. A lunge hits you (unless your current rip
 * already went through it, or it meets your Plow, which blocks it); a Plow at speed rams; anything
 * else is a bump that bounces you off and starts its quick windup, so lingering is dangerous.
 */
export function resolveContacts(w: World) {
  const p = w.player, t = w.t;
  // in the air on the Jump Jets nothing touches you
  if (p.air) return;
  const plow = hasBehavior(w, 'contact', 'plow');
  for (const r of [...w.enemies]) {
    if (!w.enemies.includes(r) || airborne(r)) continue;
    const rr = radiusOf(w, r);
    const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 0.01, min = t.playerRadius + rr;
    if (d >= min) continue;
    if (lunging(r)) {
      // the Jaws' swing can't be steered out of, so another lunge can catch you mid-swing; only the
      // one you're biting can't (DECISIONS #79). A lunge your rip went through at Slipstream can't
      // hit you; one you only shoved or clanked off still can (DECISIONS #92)
      if ((p.rip?.hits.includes(r.id) && p.rip.tier === 'slip') || p.latch?.id === r.id) continue;
      if (plow && inPlowCone(w, r) && p.knock <= 0 && p.stun <= 0) {
        // the Plow takes the charge on its face: the charger is stopped and stunned, you're
        // knocked back with nothing lost (PLAN.md 8.4)
        stunEnemy(w, r, t.joustStun);
        p.heading = Math.atan2(dy, dx);
        p.speed = t.knockSpeed * 0.6;
        p.knock = t.knockTime * 0.5;
        p.rev = null;
        p.rip = null;
        w.events.push({ k: 'block', id: r.id, x: (p.x + r.x) / 2, y: (p.y + r.y) / 2 });
        w.hitstop = Math.max(w.hitstop, t.hitstopSlip);
        continue;
      }
      if (p.invuln <= 0) hitPlayer(w, r.face, r.parts.front === 'jaws' ? t.jawFling : r.kind === 'bouncer' ? 1.2 : 1);
      continue;
    }
    if (p.pass > 0 || p.latch) continue;
    if (plow && !p.rip && p.ripCd <= 0 && p.knock <= 0 && p.stun <= 0 && tierOf(t, p.speed) !== 'crawl' && inPlowCone(w, r)) {
      ramHit(w, r);
      continue;
    }
    const nx = dx / d, ny = dy / d;
    // push the player clear, but never into a solid: if a wall or pillar is in the way, the
    // enemy gives instead
    const to = pushOut(w.arena, r.x + nx * min, r.y + ny * min, t.playerRadius);
    p.x = to.x;
    p.y = to.y;
    const gap = min - Math.hypot(p.x - r.x, p.y - r.y);
    if (gap > 0) {
      const back = pushOut(w.arena, r.x - nx * gap, r.y - ny * gap, rr);
      r.x = back.x;
      r.y = back.y;
    }
    let vx = Math.cos(p.heading) * p.speed, vy = Math.sin(p.heading) * p.speed;
    const vn = vx * nx + vy * ny;
    if (vn < 0 && CHASSIS[w.chassis].bump === 'shove' && !w.result) {
      // the Hauler: a bump is a shove, the Cruise hit's interrupt at any speed (PLAN.md 9.6). It's
      // pushed away and its windup is cancelled; you plough on, a little slower
      const push = (t.cruiseShove * Math.LN2) / 0.08;
      r.vx -= nx * push;
      r.vy -= ny * push;
      if (r.state === 'windup') {
        r.state = KINDS[r.kind].state;
        r.leap = false;
        r.t = 0;
        r.cd = 0.8;
        w.events.push({ k: 'cancel', id: r.id });
      }
      p.speed *= t.cruiseKeep;
      w.events.push({ k: 'shove', id: r.id, x: r.x + nx * rr, y: r.y + ny * rr });
      continue;
    }
    if (vn < 0) {
      vx -= 2 * vn * nx;
      vy -= 2 * vn * ny;
      p.heading = Math.atan2(vy, vx);
      // on Springs you bounce off at full speed (PLAN.md 9.2); otherwise a bump costs most of it
      const springs = hasBehavior(w, 'wall', 'bounce');
      p.speed *= springs ? t.springKeep : t.bumpKeep;
      w.events.push({ k: 'bump', id: r.id, x: r.x + nx * rr, y: r.y + ny * rr });
      if (springs) w.events.push({ k: 'boing', x: r.x + nx * rr, y: r.y + ny * rr });
      if (w.result) continue;
      if (r.kind === 'rammer' && r.state === 'stalk' && windingUp(w) < t.maxWindups) beginWindup(w, r, true);
      if (r.kind === 'compactor' && r.state === 'stalk' && hasAnyPart(r)) beginBossWindup(w, r, true);
      if (r.kind === 'snapper' && r.state === 'hunt' && r.cd <= 0 && snapping(w) < t.maxSnaps) beginSnap(w, r);
      if (r.kind === 'bouncer' && r.state === 'stalk' && r.cd <= 0 && rollingUp(w) < t.maxRolls) beginRoll(w, r);
      // a Hopper you bump stomps where it stands
      if (r.kind === 'hopper' && r.state === 'stalk' && crouching(w) < t.maxCrouch) beginCrouch(w, r, true);
    }
  }
}

/**
 * The slipstream: a charge that passes close by without hitting you drags you along in its wake,
 * lifting you to Slipstream, so a tight dodge sets up the counter-pass (DECISIONS #61).
 */
export function checkDrafts(w: World) {
  const p = w.player, t = w.t;
  if (p.air || p.invuln > 0 || p.knock > 0 || p.stun > 0 || w.result) return;
  for (const r of w.enemies) {
    if ((r.kind !== 'rammer' && r.kind !== 'compactor') || r.state !== 'charge' || r.shove || r.drafted) continue;
    const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy);
    const touch = t.playerRadius + radiusOf(w, r);
    // it has gone past you (you're beside or behind its nose), close but not touching
    if (d <= touch || d > touch + t.draftGap || dx * Math.cos(r.face) + dy * Math.sin(r.face) > 4) continue;
    r.drafted = true;
    p.speed = Math.min(t.burnMax, Math.max(p.speed + 15, t.slipAt + t.draftBoost));
    w.events.push({ k: 'draft', id: r.id, x: p.x, y: p.y });
  }
}
