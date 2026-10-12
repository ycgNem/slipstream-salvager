// Scripted players for the removal-test guards (PLAN.md section 2). Each bot turns the world into
// an input frame every tick. They aren't meant to be good players, only typical of a strategy:
// standing still, brawling at medium speed, waiting and countering, hit-and-run, and two routes
// (tight pillar loops vs long straight lanes) for the Booster's route-flip check.
import { wrapAngle } from '../data/dirs';
import { laneOf } from './rammer';
import { lineOfSight } from './arena';
import type { InputFrame, Rammer, World } from './world';

export type Bot = (w: World) => InputFrame;

const toward = (w: World, x: number, y: number, m = 1): { x: number; y: number } => {
  const dx = x - w.player.x, dy = y - w.player.y, d = Math.hypot(dx, dy) || 1;
  return { x: (dx / d) * m, y: (dy / d) * m };
};

function nearest(w: World): Rammer | null {
  let best: Rammer | null = null, bd = Infinity;
  for (const r of w.rammers) {
    const d = Math.hypot(r.x - w.player.x, r.y - w.player.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

/** Is the player in a winding-up Rammer's lane? Returns the dodge direction, or null. */
function dodge(w: World, margin = 10): { x: number; y: number } | null {
  const p = w.player;
  for (const r of w.rammers) {
    if (r.state !== 'windup' && r.state !== 'charge') continue;
    const l = laneOf(w, r);
    const cx = Math.cos(l.angle), cy = Math.sin(l.angle);
    const rx = p.x - r.x, ry = p.y - r.y;
    const u = rx * cx + ry * cy, v = rx * -cy + ry * cx;
    if (u < -10 || u > l.len + 20) continue;
    if (Math.abs(v) > l.width / 2 + w.t.playerRadius + margin) continue;
    const side = v >= 0 ? 1 : -1;
    return { x: -cy * side, y: cx * side };
  }
  return null;
}

/** Never moves; mashes the attack. Must deal zero damage and lose. */
export function turretBot(): Bot {
  let i = 0;
  return () => ({ x: 0, y: 0, rip: i++ % 12 === 0, bolt: false });
}

/** Stays on top of the nearest Rammer at medium speed and taps the attack whenever it's close. */
export function brawlerBot(): Bot {
  return (w) => {
    const r = nearest(w);
    if (!r) return { x: 0, y: 0, rip: false, bolt: false };
    const d = Math.hypot(r.x - w.player.x, r.y - w.player.y);
    const s = toward(w, r.x, r.y, 0.68); // a partial tilt holds you at Cruise
    return { ...s, rip: d < 40, bolt: false };
  };
}

/** Waits at a distance for a charge, sidesteps it, then drives in and attacks while it skids. */
export function matadorBot(): Bot {
  return (w) => {
    const p = w.player;
    const r = nearest(w);
    if (!r) return { x: 0, y: 0, rip: false, bolt: false };
    const dg = dodge(w, 6);
    if (dg) return { ...dg, rip: false, bolt: false };
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (r.state === 'skid') return { ...toward(w, r.x, r.y), rip: d < 45, bolt: !!p.tow };
    // otherwise hold position about 120 px away
    if (d < 100) return { ...toward(w, p.x * 2 - r.x, p.y * 2 - r.y), rip: false, bolt: !!p.tow };
    return { x: 0, y: 0, rip: false, bolt: !!p.tow };
  };
}

/** Is a point open floor (inside the walls, clear of pillars by a margin)? */
function open(w: World, x: number, y: number, m = 24): boolean {
  const a = w.arena;
  if (x < a.wall + m || y < a.wall + m || x > a.w - a.wall - m || y > a.h - a.wall - m) return false;
  return !a.pillars.some((p) => x > p.x - m && x < p.x + p.w + m && y > p.y - m && y < p.y + p.h + m);
}

/**
 * Hit-and-run: always moving. Retreats to a run-up point well away from the target, turns, and
 * attacks in a straight line, ripping when fast, close and lined up (from behind when the target
 * still has its booster and is committed); dodges lanes; bolts on what it tears off when clear.
 */
export function hitAndRunBot(): Bot {
  let mode: 'retreat' | 'attack' = 'retreat';
  let goal: { x: number; y: number } | null = null;
  let passT = 0;
  return (w) => {
    const p = w.player, t = w.t;
    if (passT > 0) {
      passT--;
      return { x: Math.cos(p.heading), y: Math.sin(p.heading), rip: false, bolt: false };
    }
    const dg = dodge(w);
    if (dg) return { ...dg, rip: false, bolt: false };
    const r = nearest(w);
    const center = { x: w.arena.w / 2, y: w.arena.h / 2 };
    if (!r) return { ...toward(w, center.x + Math.cos(w.tick / 40) * 120, center.y + Math.sin(w.tick / 40) * 90), rip: false, bolt: !!p.tow && w.tick % 20 === 0 };
    const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy);
    const committed = r.state === 'skid' || r.state === 'charge' || (r.state === 'windup' && r.locked);
    const bolt = !!p.tow && p.bolt === null && (d > 90 || r.state === 'skid') && w.tick % 10 === 0;
    // a Rammer that just charged past is skidding with its back to us: punish it now, no run-up
    if (mode === 'retreat' && r.state === 'skid' && r.t < 0.5 && d < 230 && lineOfSight(w.arena, p.x, p.y, r.x, r.y)) {
      mode = 'attack';
      goal = null;
    }
    // under the wave 1 safety net only a tear helps: wait for it to commit, then go for its back
    if (mode === 'attack' && r.booster && r.safety && r.hp <= 1 && !committed && d < 140) {
      mode = 'retreat';
      goal = null;
    }
    if (mode === 'attack') {
      let tx = r.x, ty = r.y;
      if (r.booster && committed) {
        tx = r.x - Math.cos(r.face) * 20;
        ty = r.y - Math.sin(r.face) * 20;
      }
      const off = Math.abs(wrapAngle(Math.atan2(ty - p.y, tx - p.x) - p.heading));
      if (p.speed >= t.slipAt && d < 46 && off < 0.6) {
        passT = 16;
        mode = 'retreat';
        goal = null;
        return { x: Math.cos(p.heading), y: Math.sin(p.heading), rip: true, bolt: false };
      }
      // too close without the speed, badly lined up, or a pillar in the way: run up again
      if ((d < 70 && p.speed < t.slipAt) || off > 1.3 || !lineOfSight(w.arena, p.x, p.y, r.x, r.y)) {
        mode = 'retreat';
        goal = null;
      } else return { ...toward(w, tx, ty), rip: false, bolt };
    }
    // retreat: pick an open run-up point ~170 px from the target, away from us
    if (!goal || Math.hypot(goal.x - p.x, goal.y - p.y) < 30) {
      if (goal && Math.hypot(goal.x - p.x, goal.y - p.y) < 30 && d > 120 && lineOfSight(w.arena, p.x, p.y, r.x, r.y)) {
        mode = 'attack';
        goal = null;
        return { ...toward(w, r.x, r.y), rip: false, bolt };
      }
      const base = Math.atan2(p.y - r.y, p.x - r.x);
      for (let k = 0; k < 16; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.4;
        const gx = r.x + Math.cos(a) * 170, gy = r.y + Math.sin(a) * 170;
        if (open(w, gx, gy) && lineOfSight(w.arena, gx, gy, r.x, r.y)) { goal = { x: gx, y: gy }; break; }
      }
      goal ??= { ...center };
    }
    return { ...toward(w, goal.x, goal.y), rip: false, bolt };
  };
}

/** Loops tightly around one pillar (the base Scrapper's natural route). */
export function looperBot(radius = 44): Bot {
  return (w) => {
    const p = w.player, pr = w.arena.pillars[0];
    const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
    // aim a little ahead on the circle (pure pursuit)
    const ahead = Math.atan2(p.y - cy, p.x - cx) + 0.55;
    return { ...toward(w, cx + Math.cos(ahead) * radius, cy + Math.sin(ahead) * radius), rip: false, bolt: false };
  };
}

/**
 * Drives the long middle corridor end to end, braking and pivoting at each end. With the Booster
 * it revs a Burn down each straight and releases it before the wall.
 */
export function lanerBot(): Bot {
  let dir = 1;
  return (w) => {
    const p = w.player, a = w.arena;
    const y = a.h / 2;
    const end = dir > 0 ? a.w - a.wall - 40 : a.wall + 40;
    if ((dir > 0 && p.x > end) || (dir < 0 && p.x < end)) dir = -dir;
    const s = { x: dir, y: (y - p.y) / 40 };
    const m = Math.hypot(s.x, s.y);
    const burning = p.part === 'booster' && !w.flat;
    // rev while lined up and well short of the end; release ~90 px before it
    const toEnd = Math.abs((dir > 0 ? a.w - a.wall - 40 : a.wall + 40) - p.x);
    const aligned = Math.cos(p.heading) * dir > 0.97;
    const rip = burning && aligned && toEnd > 170 && p.ripCd <= 0;
    return { x: s.x / m, y: s.y / m, rip, bolt: false };
  };
}
