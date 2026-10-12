// The Bouncer (PLAN.md 9.2): a round pinball of a bot in a ring of coil springs. It drifts toward
// you, winds up (a red lane to the first wall, plus the first bounce's stub), then rolls: every
// wall or pillar it meets reflects it and speeds it up (enemies.ts), until it slows to a stop,
// dizzy: the opening. Stripped of its springs, its first wall stops it dead.
import { lineOfSight } from './arena';
import { aimPoint, pathGoal, turnToward } from './rammer';
import { DT, type Enemy, type World } from './world';

const halve = (v: number, half: number) => v * Math.pow(0.5, DT / half);

export function hasSprings(e: Enemy): boolean {
  return e.parts.sides === 'springs';
}

/** How many Bouncers are winding up a roll (at most maxRolls at once). */
export function rollingUp(w: World): number {
  return w.enemies.filter((e) => e.kind === 'bouncer' && e.state === 'windup').length;
}

export function beginRoll(w: World, e: Enemy) {
  const t = w.t;
  e.state = 'windup';
  e.t = 0;
  e.locked = false;
  e.windup = t.rollWindup;
  e.lock = t.rollLock;
  e.shove = false;
  w.events.push({ k: 'windup', id: e.id, near: false, shove: false });
}

/** The roll is over: dizzy for a moment, wherever it stopped. */
function dizzy(w: World, e: Enemy, dur = w.t.dizzyTime) {
  e.state = 'stunned';
  e.t = 0;
  e.skidFor = dur;
}

/** One Bouncer's brain for one tick: sets its facing and returns how fast it moves, and which way. */
export function thinkBouncer(w: World, e: Enemy): { speed: number; dir: number } {
  const p = w.player, t = w.t;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  switch (e.state) {
    case 'enter':
      e.face = Math.atan2(e.enter.y, e.enter.x);
      e.speed = t.bouncerDrift * 2;
      if (e.t >= t.enterTime) {
        e.state = 'stalk';
        e.t = 0;
      }
      return { speed: e.speed, dir: e.face };
    case 'stalk': {
      const goal = pathGoal(w, e, t.bouncerRadius + 6);
      e.face = turnToward(e.face, Math.atan2(goal.y - e.y, goal.x - e.x), t.bouncerTurn * DT);
      e.speed = dist > t.playerRadius + t.bouncerRadius + 10 ? t.bouncerDrift : 0;
      const can = e.cd <= 0 && rollingUp(w) < t.maxRolls && !w.result;
      if (can && dist < t.rollRange && lineOfSight(w.arena, e.x, e.y, p.x, p.y)) beginRoll(w, e);
      return { speed: e.speed, dir: e.face };
    }
    case 'windup':
      e.speed = 0;
      if (e.t < e.windup - e.lock) {
        const a = aimPoint(w, e);
        e.face = turnToward(e.face, Math.atan2(a.y - e.y, a.x - e.x), t.trackTurn * DT);
      } else if (!e.locked) {
        e.locked = true;
        w.events.push({ k: 'lock', id: e.id });
      }
      if (e.t >= e.windup) {
        e.state = 'roll';
        e.t = 0;
        e.travelled = 0;
        e.bounces = 0;
        e.speed = t.rollSpeed;
        w.events.push({ k: 'roll', id: e.id });
      }
      return { speed: 0, dir: e.face };
    case 'roll':
      // it rolls straight on; the bounces happen where it meets a wall (enemies.ts). After its
      // last bounce, or after rollTime, it slows to a stop
      e.travelled += e.speed * DT;
      if (e.bounces >= t.rollBounces || e.t >= t.rollTime) {
        e.speed = halve(e.speed, 0.22);
        if (e.speed < 60) dizzy(w, e);
      }
      return { speed: e.speed, dir: e.face };
    case 'stunned':
      e.speed = halve(e.speed, 0.08);
      if (e.t >= e.skidFor) {
        e.state = 'stalk';
        e.t = 0;
        e.cd = w.rng.range(t.rollCdMin, t.rollCdMax);
      }
      return { speed: e.speed, dir: e.face };
    default:
      e.state = 'stalk';
      return { speed: 0, dir: e.face };
  }
}
