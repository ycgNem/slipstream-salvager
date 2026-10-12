// Terrain (PLAN.md 9.4): what the floor does to the bodies on it. Boost strips lift whatever drives
// along them to speed, oil takes the grip away (body.ts, enemies.ts), ramps throw you into the air,
// and crusher plates slam on their own beat and hit whatever stands on them. Pure: the plates' beat
// comes from the tick count, so it's deterministic.
import type { FloorPatch } from '../data/arena';
import { along, floorAt } from './arena';
import { hasBehavior } from './body';
import { dealDamage } from './rip';
import { hitPlayer } from './salvage';
import { airborne, tierOf, type World } from './world';

/** Where a crusher plate is in its beat ('warn': flashing, about to slam; 'down': just slammed),
 * and whether it slams this tick. */
export function crusherState(w: World, f: FloorPatch): { state: 'idle' | 'warn' | 'down'; slam: boolean } {
  const t = w.t, per = Math.round(t.crusherPeriod * 60);
  const k = (((w.tick + Math.round((f.phase ?? 0) * 60)) % per) + per) % per;
  const state = k < Math.round(t.crusherDown * 60) ? 'down' : k >= per - Math.round(t.crusherWarn * 60) ? 'warn' : 'idle';
  return { state, slam: k === 0 };
}

/** You, after moving: a boost strip lifts you while you drive along it; a ramp throws you into the air. */
export function playerTerrain(w: World) {
  const p = w.player, t = w.t, a = w.arena;
  if (!a.floor?.length) return;
  if (p.air || p.latch) {
    p.boosted = false;
    return;
  }
  const b = floorAt(a, p.x, p.y, 'boost');
  const boosting = !!b && along(b, p.heading, t.boostConeDeg);
  if (boosting && p.speed < t.boostTo) p.speed = t.boostTo;
  if (boosting && !p.boosted) w.events.push({ k: 'boost', x: p.x, y: p.y });
  p.boosted = boosting;
  const r = floorAt(a, p.x, p.y, 'ramp');
  if (r && p.speed >= t.cruiseAt && p.knock <= 0 && p.stun <= 0 && along(r, p.heading, t.rampConeDeg)) {
    // a clean jump: over everything, untouchable, and down without a hit unless the Jump Jets
    // are on (then the landing is theirs)
    const tier = tierOf(t, p.speed);
    p.air = { t: 0, dur: t.rampAir, tier, slam: hasBehavior(w, 'attack', 'leap') };
    p.rev = null;
    p.brake = false;
    p.slide = false;
    w.events.push({ k: 'leap', tier, ramp: true });
  }
}

/** The plates: each slams on its beat and hits whatever stands on it (airborne bodies are safe). */
export function updateCrushers(w: World) {
  const t = w.t, p = w.player;
  for (const f of w.arena.floor ?? []) {
    if (f.kind !== 'crusher' || !crusherState(w, f).slam) continue;
    const r = f.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const on = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    w.events.push({ k: 'press', x: cx, y: cy });
    if (!p.air && !w.result && on(p.x, p.y)) {
      // thrown off the plate, away from its middle (or back the way you came, dead centre)
      const away = Math.hypot(p.x - cx, p.y - cy) > 2 ? Math.atan2(p.y - cy, p.x - cx) : p.heading + Math.PI;
      hitPlayer(w, away);
    }
    for (const e of [...w.enemies]) {
      if (!w.enemies.includes(e) || airborne(e) || !on(e.x, e.y)) continue;
      w.events.push({ k: 'pressed', id: e.id });
      dealDamage(w, e, t.crusherDamage, 'side', e.x, e.y);
    }
    for (const k of [...w.pickups]) {
      if (!on(k.x, k.y)) continue;
      w.pickups.splice(w.pickups.indexOf(k), 1);
      w.stats.partsShattered++;
      w.events.push({ k: 'crush', part: k.part, x: k.x, y: k.y });
    }
  }
}
