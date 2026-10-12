// The attack (PLAN.md 4.2, 4.4, 8.4): the Rip lunge, the Booster's Burn, the Plow's ram hit, the
// Jaws' latch, aim assist, and what a hit does at each speed tier and on each zone of an enemy.
// Only Slipstream does damage or tears parts off; Cruise shoves and cancels a windup; Crawl
// clanks. Flat mode drops the speed rule (the removal test A/B).
import { wrapAngle } from '../data/dirs';
import { PARTS, type PartId } from '../data/parts';
import type { MountSlot } from '../data/mounts';
import { attackMode, hasBehavior } from './body';
import { cancelBolt, grabPart } from './salvage';
import { toSkid } from './rammer';
import { pushOut } from './arena';
import type { Zone } from './events';
import { airborne, boltedCount, hasAnyPart, KINDS, radiusOf, tierOf, type Enemy, type Tier, type World } from './world';

const deg = (d: number) => (d * Math.PI) / 180;

/** The mount a hit zone strikes on an enemy. */
const ZONE_MOUNT: Record<Zone, MountSlot> = { rear: 'rear', side: 'sides', front: 'front' };

/** Can the player start an attack this tick? */
function ready(w: World): boolean {
  const p = w.player;
  return p.ripCd <= 0 && !p.rip && p.rev === null && p.knock <= 0 && p.stun <= 0 && !p.latch && !p.air && p.recoil <= 0;
}

/** Rip pressed (or a buffered press fires): start the Rip, or start revving the Burn. */
export function tryAttack(w: World): boolean {
  if (!ready(w)) return false;
  const p = w.player;
  if (p.bolt !== null) cancelBolt(w);
  if (attackMode(w) !== 'rip') {
    // a press starts the rev (or the crouch), but nothing happens until it's held past
    // burnTapTime: a tap is a plain Rip (DECISIONS #57)
    p.rev = 0;
    return true;
  }
  startRip(w);
  return true;
}

/** The plain Rip: a committed lunge at the tier you're in now. */
function startRip(w: World) {
  const p = w.player, t = w.t;
  const tier = tierOf(t, p.speed); // locked at the press: the lunge's own boost doesn't count
  aimAssist(w);
  p.speed += t.ripImpulse;
  p.rip = { t: t.ripTime, tier, burn: false, hits: [] };
  p.ripCd = t.ripCooldown;
  p.pass = t.ripTime + t.passThrough;
  w.events.push({ k: 'rip', tier, burn: false });
}

/** Revving (or crouching) for real: held past the tap window, so the lane (or the ring) shows. */
export function revving(w: World): boolean {
  return w.player.rev !== null && w.player.rev >= w.t.burnTapTime;
}

/** Crouched on the Jump Jets, the ring showing where you'll land. */
export function crouched(w: World): boolean {
  return revving(w) && attackMode(w) === 'leap';
}

/**
 * Where you'll come down (the teal ring): from a leap taken now, or from the one you're in. Inside
 * the ring wall (the leap slides along it) and clear of obstacles (you're pushed off them).
 */
export function landingPoint(w: World): { x: number; y: number } {
  const p = w.player, t = w.t, a = w.arena, r = t.playerRadius;
  const d = p.air ? p.speed * Math.max(0, p.air.dur - p.air.t) : Math.max(p.speed, t.leapMin) * t.leapAir;
  const x = Math.max(a.wall + r, Math.min(a.w - a.wall - r, p.x + Math.cos(p.heading) * d));
  const y = Math.max(a.wall + r, Math.min(a.h - a.wall - r, p.y + Math.sin(p.heading) * d));
  return settle(w, x, y);
}

/**
 * Where you come down at (x, y): if that's on a pillar or a low wall, the nearest clear spot along
 * your line (a little further on, or short of it), never sideways round it (DECISIONS #92).
 */
function settle(w: World, x: number, y: number): { x: number; y: number } {
  const p = w.player, a = w.arena, r = w.t.playerRadius;
  const ux = Math.cos(p.heading), uy = Math.sin(p.heading);
  const clear = (q: { x: number; y: number }) => {
    const o = pushOut(a, q.x, q.y, r);
    return Math.hypot(o.x - q.x, o.y - q.y) < 0.5;
  };
  for (let s = 0; s <= 96; s += 1)
    for (const k of [1, -1]) {
      const q = { x: x + ux * s * k, y: y + uy * s * k };
      if (q.x < a.wall + r || q.x > a.w - a.wall - r || q.y < a.wall + r || q.y > a.h - a.wall - r) continue;
      if (clear(q)) return q;
    }
  return pushOut(a, x, y, r);
}

/**
 * Let go of Rip while holding it (or touch an enemy while revving): the Booster's Burn lunges at
 * the tier you reached, the Jump Jets leap; a tap is the plain Rip.
 */
export function releaseBurn(w: World) {
  const p = w.player, t = w.t;
  if (p.rev === null) return;
  if (!revving(w)) {
    // a tap: the plain Rip
    p.rev = null;
    startRip(w);
    return;
  }
  if (attackMode(w) === 'leap') {
    startLeap(w);
    return;
  }
  const tier = tierOf(t, p.speed);
  p.rev = null;
  p.rip = { t: t.burnTime, tier, burn: true, hits: [] };
  p.ripCd = t.burnTime + t.burnCooldown;
  p.pass = t.burnTime + t.passThrough;
  w.events.push({ k: 'rip', tier, burn: true });
}

/**
 * The Jump Jets' leap (PLAN.md 9.1): into the air along your heading at your speed (at least
 * leapMin), over everything but the ring wall, untouchable; the tier is the one you leapt at.
 */
function startLeap(w: World) {
  const p = w.player, t = w.t;
  p.rev = null;
  // the landing's tier is the speed you really had: a standing hop makes none (DECISIONS #92)
  const tier = tierOf(t, p.speed);
  p.speed = Math.max(p.speed, t.leapMin);
  p.air = { t: 0, dur: t.leapAir, tier, slam: true };
  p.ripCd = t.leapAir + t.leapCooldown;
  p.brake = false;
  p.slide = false;
  if (p.bolt !== null) cancelBolt(w);
  w.events.push({ k: 'leap', tier });
}

/**
 * The leap, one tick. Coming down is a hit on every enemy within leapSlamR of where you land, at
 * the tier you leapt at and on the zone you land on (land behind a Rammer: its booster comes off).
 * Then the landing sticks you a moment: the Hopper's weakness, inherited.
 */
export function updateAir(w: World, dt: number) {
  const p = w.player, A = p.air, t = w.t;
  if (!A) return;
  A.t += dt;
  if (A.t < A.dur) return;
  p.air = null;
  // come down clear of any pillar or low wall you sailed over
  Object.assign(p, settle(w, p.x, p.y));
  w.events.push({ k: 'touchdown', x: p.x, y: p.y, tier: A.tier });
  if (!A.slam) {
    // off a ramp without the Jump Jets: a clean landing
    p.pass = Math.max(p.pass, 0.15);
    return;
  }
  const under = w.enemies
    .filter((e) => !airborne(e) && Math.hypot(e.x - p.x, e.y - p.y) < t.leapSlamR + radiusOf(w, e))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  for (const e of under) {
    if (!w.enemies.includes(e) || p.latch) continue;
    p.rip = { t: 0.05, tier: A.tier, burn: false, leap: true, hits: [] };
    // the zone is the side you came at it from, not where you came down: going over its front
    // strikes the front (DECISIONS #92)
    hitEnemy(w, e, p.heading + Math.PI);
  }
  p.rip = null;
  // you come down among them: pass through for a moment rather than bumping straight off
  p.pass = Math.max(p.pass, 0.2);
  if (!p.latch) {
    p.speed *= t.leapKeep;
    p.recoil = t.leapRecoil;
  }
}

/** Up to aimAssistDeg toward the nearest enemy in a cone ahead, so 8-way sprites never cost a pass. */
function aimAssist(w: World) {
  const p = w.player, t = w.t;
  let best: Enemy | null = null, bestD = t.aimAssistRange;
  for (const r of w.enemies) {
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d > bestD || airborne(r)) continue;
    const off = Math.abs(wrapAngle(Math.atan2(r.y - p.y, r.x - p.x) - p.heading));
    if (off > deg(t.aimAssistConeDeg)) continue;
    best = r;
    bestD = d;
  }
  if (!best) return;
  const off = wrapAngle(Math.atan2(best.y - p.y, best.x - p.x) - p.heading);
  const lim = deg(t.aimAssistDeg);
  p.heading = wrapAngle(p.heading + Math.max(-lim, Math.min(lim, off)));
}

/** Where the claw is (sim space, flat top-down). */
export function clawPos(w: World): { x: number; y: number } {
  const p = w.player;
  return { x: p.x + Math.cos(p.heading) * w.t.ripReach, y: p.y + Math.sin(p.heading) * w.t.ripReach };
}

function touches(w: World, r: Enemy): boolean {
  if (airborne(r)) return false;
  const p = w.player, t = w.t, c = clawPos(w), rr = radiusOf(w, r);
  return Math.hypot(c.x - r.x, c.y - r.y) < t.ripRadius + rr || Math.hypot(p.x - r.x, p.y - r.y) < t.playerRadius + rr;
}

/** Revving into an enemy releases the Burn on the spot. */
export function autoRelease(w: World) {
  if (w.player.rev === null || attackMode(w) !== 'burn') return;
  if (w.enemies.some((r) => touches(w, r))) releaseBurn(w);
}

/** Count down the lunge. */
export function updateRip(w: World, dt: number) {
  const p = w.player;
  if (!p.rip) return;
  p.rip.t -= dt;
  if (p.rip.t <= 0) p.rip = null;
}

/** Resolve the claw against every enemy it reaches this tick. */
export function resolveRipHits(w: World) {
  const p = w.player;
  if (!p.rip) return;
  for (const r of [...w.enemies]) {
    if (!p.rip) return;
    if (p.rip.hits.includes(r.id) || !touches(w, r)) continue;
    hitEnemy(w, r);
  }
}

/**
 * The Plow's ram hit: driving your front into an enemy at Cruise or Slipstream is a hit as if you'd
 * Ripped (no button, no cooldown), and you plough on through (PLAN.md 8.4).
 */
export function ramHit(w: World, r: Enemy) {
  const p = w.player, t = w.t;
  const tier = tierOf(t, p.speed);
  p.rip = { t: t.plowTime, tier, burn: false, plow: true, hits: [] };
  p.pass = t.plowTime + t.passThrough;
  // a ram commits like a Rip: the same cooldown before the next ram or Rip
  p.ripCd = t.ripCooldown;
  w.events.push({ k: 'ram', tier, id: r.id });
  hitEnemy(w, r);
}

/** Is the player behind this enemy (within rearArcDeg of straight behind it)? */
export function inRearArc(w: World, r: Enemy): boolean {
  return hitZone(w, r) === 'rear';
}

/**
 * Where the player is striking this enemy from: its armored front (within frontArcDeg of its
 * facing), its back (within rearArcDeg of straight behind), or a side (DECISIONS #55).
 */
export function hitZone(w: World, r: Enemy, from?: number): Zone {
  const p = w.player;
  const off = Math.abs(wrapAngle((from ?? Math.atan2(p.y - r.y, p.x - r.x)) - r.face));
  if (off >= Math.PI - deg(w.t.rearArcDeg)) return 'rear';
  if (off <= deg(w.t.frontArcDeg)) return 'front';
  return 'side';
}

/**
 * Mid-lunge (a Rammer's charge or shove, a Snapper's snap, a Bouncer's roll while it's still fast):
 * touching it is a hit, and it's the moment a joust can stop it.
 */
export function lunging(r: Enemy): boolean {
  return r.state === 'charge' || r.state === 'snap' || (r.state === 'roll' && r.speed > 80);
}

/** Stunned on its back foot: the joust's payoff, by kind. */
export function stunEnemy(w: World, r: Enemy, dur: number) {
  if (r.kind === 'rammer') toSkid(w, r, true, dur);
  else {
    r.state = 'stunned';
    r.t = 0;
    r.skidFor = dur;
    r.speed = 0;
  }
}

/** from: the direction from the enemy toward where the hit comes from (default: where you are). */
function hitEnemy(w: World, r: Enemy, from?: number) {
  const p = w.player, t = w.t, rip = p.rip!;
  rip.hits.push(r.id);
  const hx = (p.x + r.x) / 2, hy = (p.y + r.y) / 2;
  const zone = hitZone(w, r, from);
  // side parts (treads) run along the back too: with nothing on its rear, a back hit tears them,
  // so the efficient kill strips instead of wrecking (DECISIONS #79)
  const mount = zone === 'rear' && !r.parts.rear && r.parts.sides ? 'sides' : ZONE_MOUNT[zone];
  const part = r.parts[mount];
  const joust = lunging(r) && zone === 'front' && Math.abs(wrapAngle(p.heading - r.face - Math.PI)) <= deg(t.joustDeg);

  if (w.flat) {
    // the removal test: speed doesn't matter, and every bolted part is just a bigger number (the
    // front armor stays: where you hit isn't about speed)
    if (part && (PARTS[part].tear === 'zone' || joust)) tear(w, r, mount, hx, hy);
    else if (part === 'plow') clang(w, r, zone, hx, hy);
    else damage(w, r, (zone === 'front' ? t.frontDamage : t.flatDamage) + t.flatPartDamage * boltedCount(p), zone, hx, hy);
    w.hitstop = Math.max(w.hitstop, t.hitstopCruise);
    return;
  }

  switch (rip.tier) {
    case 'crawl': {
      // too slow: a clank, you bounce off and stop
      w.stats.crawlHits++;
      w.events.push({ k: 'clank', x: hx, y: hy, wall: false });
      p.heading = Math.atan2(p.y - r.y, p.x - r.x);
      p.speed = 50;
      p.rip = null;
      p.pass = 0.1;
      w.hitstop = Math.max(w.hitstop, t.hitstopCrawl);
      break;
    }
    case 'cruise': {
      // no damage: a shove that cancels its windup
      w.stats.cruiseHits++;
      const push = (t.cruiseShove * Math.LN2) / 0.08;
      r.vx += Math.cos(p.heading) * push;
      r.vy += Math.sin(p.heading) * push;
      if (r.state === 'windup') {
        r.state = KINDS[r.kind].state;
        r.leap = false;
        r.t = 0;
        r.cd = 0.8;
        w.events.push({ k: 'cancel', id: r.id });
      }
      w.events.push({ k: 'shove', id: r.id, x: hx, y: hy });
      p.speed *= t.cruiseKeep;
      w.hitstop = Math.max(w.hitstop, t.hitstopCruise);
      break;
    }
    case 'slip': {
      w.stats.slipHits++;
      // a part on the struck zone comes off (no damage); the Plow only comes off in a joust
      if (part && (PARTS[part].tear === 'zone' || joust)) {
        tear(w, r, mount, hx, hy);
        if (joust) {
          stunEnemy(w, r, t.joustStun);
          w.stats.jousts++;
          w.events.push({ k: 'joust', id: r.id, x: hx, y: hy });
        }
        w.hitstop = Math.max(w.hitstop, t.hitstopTear);
        // a joust leaves its back open: the Jaws don't whip you back round to its front
        if (!joust) latch(w, r);
        break;
      }
      if (part === 'plow' || (r.kind === 'bouncer' && zone === 'front' && !joust)) {
        // a plowed front takes nothing at all; nor does a Bouncer's round chrome face, unless you
        // joust its roll (DECISIONS #92: head-on was its quickest death)
        clang(w, r, zone, hx, hy);
        break;
      }
      // the joust: a Slipstream Rip into the front of a lunge stops it dead and stuns it, back
      // exposed (DECISIONS #56)
      const dealt = damage(w, r, zone === 'front' ? t.frontDamage : zone === 'rear' ? t.rearDamage : t.slipDamage, zone, hx, hy);
      const alive = w.enemies.includes(r);
      if (joust && alive) {
        stunEnemy(w, r, t.joustStun);
        w.stats.jousts++;
        w.events.push({ k: 'joust', id: r.id, x: hx, y: hy });
        w.hitstop = Math.max(w.hitstop, t.hitstopTear);
      } else {
        // a hit the wave 1 safety net absorbs gets a lighter hit-stop: it shouldn't feel like damage
        w.hitstop = Math.max(w.hitstop, dealt > 2 ? t.hitstopTear : dealt > 1 ? t.hitstopSlip : dealt > 0 ? t.hitstopCruise + 1 : t.hitstopCruise);
      }
      if (alive && !joust) latch(w, r);
      break;
    }
  }
}

/** A plowed front: the hit bounces off with nothing done, loudly. */
function clang(w: World, r: Enemy, zone: Zone, x: number, y: number) {
  w.events.push({ k: 'hit', tier: 'slip', id: r.id, x, y, dmg: 0, zone, clang: true });
  w.hitstop = Math.max(w.hitstop, w.t.hitstopCruise);
}

/**
 * The Jaws: a Slipstream hit bites on, whips you once round the enemy, and flings you back out the
 * way you came, faster (PLAN.md 8.4). Locked for the swing.
 */
function latch(w: World, r: Enemy) {
  const p = w.player;
  // a leap's landing doesn't bite: the Jaws don't cancel the landing's stick (DECISIONS #92)
  if (w.flat || !hasBehavior(w, 'onHit', 'latch') || p.latch || p.rip?.leap) return;
  const a0 = Math.atan2(p.y - r.y, p.x - r.x);
  const cross = Math.cos(p.heading) * (r.y - p.y) - Math.sin(p.heading) * (r.x - p.x);
  p.latch = { id: r.id, t: 0, cx: r.x, cy: r.y, r: Math.max(Math.hypot(p.x - r.x, p.y - r.y), radiusOf(w, r) + w.t.playerRadius), a0, dir: cross >= 0 ? 1 : -1 };
  p.rip = null;
  p.pass = w.t.latchTime + w.t.passThrough;
  w.events.push({ k: 'latch', id: r.id });
}

/** A tearing hit does no damage: everything goes into the part, which the claw keeps hold of. */
function tear(w: World, r: Enemy, mount: MountSlot, x: number, y: number) {
  const part = r.parts[mount]!;
  delete r.parts[mount];
  w.stats.tears++;
  w.events.push({ k: 'tear', id: r.id, part, x, y });
  grabPart(w, part, r.x, r.y);
}

/** Drop a part off an enemy onto the floor (the safety net's way out). */
function shakeLoose(w: World, r: Enemy, part: PartId, mount: MountSlot) {
  delete r.parts[mount];
  w.pickups.push({ id: w.nextId++, part, x: r.x - Math.cos(r.face) * 14, y: r.y - Math.sin(r.face) * 14, vx: -Math.cos(r.face) * 70, vy: -Math.sin(r.face) * 70, age: 0, cracked: false });
  w.events.push({ k: 'drop', part, x: r.x, y: r.y });
}

/** Damage from the yard itself (a crusher plate): the same rules as a hit's damage. */
export function dealDamage(w: World, r: Enemy, n: number, zone: Zone, x: number, y: number): number {
  return damage(w, r, n, zone, x, y);
}

/** Returns the damage actually dealt (0 when the wave 1 safety net holds). */
function damage(w: World, r: Enemy, n: number, zone: Zone, x: number, y: number): number {
  const tier: Tier = 'slip';
  if (r.safety && hasAnyPart(r) && r.hp <= 1) {
    // the wave 1 safety net's own way out: hit it hard enough times and its part shakes loose
    // onto the floor (DECISIONS #33), so nobody is stuck in wave 1
    r.shaken++;
    w.events.push({ k: 'hit', tier, id: r.id, x, y, dmg: 0, zone });
    if (r.shaken >= 2) {
      const mount = (['rear', 'sides', 'front'] as MountSlot[]).find((m) => r.parts[m])!;
      shakeLoose(w, r, r.parts[mount]!, mount);
    }
    return 0;
  }
  const before = r.hp;
  r.hp = r.safety && hasAnyPart(r) ? Math.max(1, r.hp - n) : r.hp - n;
  const dealt = before - r.hp;
  w.stats.damageDealt += dealt;
  w.events.push({ k: 'hit', tier, id: r.id, x, y, dmg: dealt, zone });
  if (r.hp <= 0) {
    w.enemies.splice(w.enemies.indexOf(r), 1);
    w.stats.wrecks++;
    const lost = Object.values(r.parts) as PartId[];
    w.events.push({ k: 'wreck', id: r.id, kind: r.kind, x: r.x, y: r.y, lost });
  }
  return dealt;
}

/** The Jaws' swing, one tick: round the enemy once, then out the way you came. */
export function updateLatch(w: World, dt: number) {
  const p = w.player, L = p.latch, t = w.t;
  if (!L) return;
  const e = w.enemies.find((q) => q.id === L.id);
  if (e) {
    L.cx = e.x;
    L.cy = e.y;
  }
  L.t += dt;
  const f = Math.min(1, L.t / t.latchTime);
  const a = L.a0 + L.dir * Math.PI * 2 * f;
  if (f < 1) {
    p.x = L.cx + Math.cos(a) * L.r;
    p.y = L.cy + Math.sin(a) * L.r;
    p.heading = wrapAngle(a + (L.dir * Math.PI) / 2);
    return;
  }
  // flung out from where you bit, the way you came
  p.x = L.cx + Math.cos(L.a0) * (L.r + 2);
  p.y = L.cy + Math.sin(L.a0) * (L.r + 2);
  p.heading = L.a0;
  p.speed = Math.min(t.burnMax, p.speed + t.slingBoost);
  p.latch = null;
  w.events.push({ k: 'sling' });
}
