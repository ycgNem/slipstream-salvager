// The Compactor (PLAN.md 9.5): the run's last yard, a boss you take apart. Each part it wears is one
// of its moves: the Booster a huge charge, the Springs bounce that charge off walls (enemies.ts),
// the Plow makes its front take nothing (it comes off only in a joust). Tear one off and the move
// is gone. With all three off its core is open and it leaps like a Hopper (hopper.ts stepLeap).
// Every so often it calls a Snapper in, so there are always spares, and always trouble.
import { lineOfSight } from './arena';
import { aimPoint, pathGoal, toSkid, turnToward } from './rammer';
import { beginCrouch, stepLeap } from './hopper';
import { addEnemy, DT, hasAnyPart, type Enemy, type World } from './world';

/** How far a charge locked now runs: past you by bossChargeOver, within bossChargeMin..Max. */
export function bossChargeLength(w: World, e: Enemy): number {
  const t = w.t;
  return Math.max(t.bossChargeMin, Math.min(t.bossChargeMax, Math.hypot(w.player.x - e.x, w.player.y - e.y) + t.bossChargeOver));
}

/** Wind up a charge (with the Booster) or, without it, a shove. */
export function beginBossWindup(w: World, e: Enemy, near: boolean) {
  const t = w.t;
  e.shove = e.parts.rear !== 'booster';
  e.state = 'windup';
  e.t = 0;
  e.leap = false;
  e.locked = false;
  e.chargeLen = 0;
  e.drafted = false;
  e.bounces = 0;
  e.windup = e.shove ? t.bossShoveWindup : near ? t.bossNearWindup : t.bossWindup;
  e.lock = e.shove ? t.bossShoveWindup * 0.4 : near ? t.bossNearLock : t.bossLock;
  w.events.push({ k: 'windup', id: e.id, near, shove: e.shove });
}

/** Every bossCall seconds, if the yard is quiet enough, a Snapper comes in at the farthest gate. */
function callHelp(w: World, e: Enemy) {
  const t = w.t, p = w.player;
  e.aux -= DT;
  if (e.aux > 0 || w.result) return;
  e.aux = t.bossCall;
  if (w.enemies.length - 1 >= t.bossHelpers) return;
  const g = [...w.arena.gates].sort((a, b) => Math.hypot(b.spawn.x - p.x, b.spawn.y - p.y) - Math.hypot(a.spawn.x - p.x, a.spawn.y - p.y))[0];
  const s = addEnemy(w, 'snapper', g.spawn.x, g.spawn.y, Math.atan2(g.dir.y, g.dir.x), { state: 'enter' });
  s.enter = { ...g.dir };
  w.events.push({ k: 'gate', gate: g.id });
  w.events.push({ k: 'enter', id: s.id, gate: g.id });
  w.events.push({ k: 'call', id: e.id });
}

/** The Compactor's brain for one tick: sets its facing and returns how fast it moves, and which way. */
export function thinkCompactor(w: World, e: Enemy): { speed: number; dir: number } {
  const p = w.player, t = w.t;
  callHelp(w, e);
  const leap = stepLeap(w, e, () => w.rng.range(t.bossCdMin, t.bossCdMax));
  if (leap) return leap;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  switch (e.state) {
    case 'enter':
      e.face = Math.atan2(e.enter.y, e.enter.x);
      if (e.t >= t.enterTime) {
        e.state = 'stalk';
        e.t = 0;
      }
      return { speed: t.bossSpeed * 1.5, dir: e.face };
    case 'stalk': {
      const goal = pathGoal(w, e, t.compactorRadius + 6);
      e.face = turnToward(e.face, Math.atan2(goal.y - e.y, goal.x - e.x), t.bossTurn * DT);
      if (e.cd <= 0 && !w.result) {
        const sees = lineOfSight(w.arena, e.x, e.y, p.x, p.y);
        if (!hasAnyPart(e)) {
          // core open: all it has left is the leap
          if (dist <= t.bossLeapMax) beginCrouch(w, e, false);
        } else if (e.parts.rear === 'booster') {
          if (dist < t.bossChargeRange && sees) beginBossWindup(w, e, false);
        } else if (dist < t.bossShoveRange && sees) beginBossWindup(w, e, true);
      }
      return { speed: e.state === 'stalk' && dist > t.playerRadius + t.compactorRadius + 6 ? t.bossSpeed : 0, dir: e.face };
    }
    case 'windup':
      if (e.t < e.windup - e.lock) {
        // it tracks you, slower than a Rammer: it's heavy
        const a = aimPoint(w, e);
        e.face = turnToward(e.face, Math.atan2(a.y - e.y, a.x - e.x), t.trackTurn * 0.5 * DT);
      } else if (!e.locked) {
        e.locked = true;
        e.chargeLen = e.shove ? t.bossShoveDist : bossChargeLength(w, e);
        w.events.push({ k: 'lock', id: e.id });
      }
      if (e.t >= e.windup) {
        e.state = 'charge';
        e.t = 0;
        e.travelled = 0;
        w.events.push({ k: 'charge', id: e.id, shove: e.shove });
      }
      return { speed: 0, dir: e.face };
    case 'charge': {
      const sp = e.shove ? t.bossShoveSpeed : t.bossChargeSpeed;
      if (!e.chargeLen) e.chargeLen = e.shove ? t.bossShoveDist : bossChargeLength(w, e);
      e.travelled += sp * DT;
      if (e.travelled >= e.chargeLen) toSkid(w, e, false, t.bossSkid);
      return { speed: sp, dir: e.face };
    }
    case 'skid':
    case 'stunned':
      if (e.t >= e.skidFor) {
        e.state = 'stalk';
        e.t = 0;
        e.cd = w.rng.range(t.bossCdMin, t.bossCdMax);
      }
      return { speed: 0, dir: e.face };
    default:
      e.state = 'stalk';
      e.leap = false;
      return { speed: 0, dir: e.face };
  }
}
