// A search bot: every 0.1 s it tries ~50 short input plans on clones of the world (the sim is pure
// and deterministic) and keeps the best. It sees the enemies future exactly, so it is an upper
// bound on a person dodging; it only taps Rip (no Burn), so it is a lower bound on Booster play.
import { Rng } from '../../src/engine/rng';
import { step } from '../../src/sim/tick';
import { exitInput } from '../../src/sim/bots';
import type { InputFrame, World } from '../../src/sim/world';

export function cloneWorld(w: World): World {
  const p = w.player;
  const c: World = {
    ...w,
    rng: Object.assign(new Rng(1), { s: w.rng.s }),
    player: {
      ...p,
      rip: p.rip ? { ...p.rip, hits: [...p.rip.hits] } : null,
      parts: { ...p.parts },
      latch: p.latch ? { ...p.latch } : null,
      air: p.air ? { ...p.air } : null,
      tow: p.tow ? { ...p.tow } : null,
    },
    enemies: w.enemies.map((e) => ({ ...e, parts: { ...e.parts }, enter: { ...e.enter } })),
    pickups: w.pickups.map((k) => ({ ...k })),
    wave: { ...w.wave, gates: [...w.wave.gates] },
    events: [],
    stats: { ...w.stats, tierTicks: { ...w.stats.tierTicks } },
    exits: [...w.exits],
  };
  return c;
}

const DIRS = 12;
import { hitZone } from '../../src/sim/rip';
import { wrapAngle } from '../../src/data/dirs';
/** what a decent player does with the button: close, fast, lined up, and not into an armored front */
export function autoRip(w: World): boolean {
  const p = w.player;
  if (p.ripCd > 0 || p.rip || p.rev !== null || (!w.flat && p.speed < w.t.slipAt)) return false;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 44) continue;
    if (Math.abs(wrapAngle(Math.atan2(e.y - p.y, e.x - p.x) - p.heading)) > 0.5) continue;
    if (e.state === 'air') continue;
    if (hitZone(w, e) === 'front' && !e.parts.front && !(e.state === 'charge' || e.state === 'snap' || e.state === 'roll')) { if (e.hp > 1) continue; }
    return true;
  }
  return false;
}
export interface MpcOpts { seg1?: number; horizon?: number; every?: number; noRip?: boolean; boltOn?: boolean }

function value(w0: World, w: World): number {
  const s0 = w0.stats, s = w.stats, p = w.player;
  let v = 0;
  v += 12 * (s.damageDealt - s0.damageDealt);
  v += 20 * (s.tears - s0.tears);
  v += 25 * (s.wrecks - s0.wrecks);
  v -= 60 * (s.hitsTaken - s0.hitsTaken);
  v -= 200 * (w.result === 'scrapped' ? 1 : 0);
  v += 0.03 * Math.min(p.speed, 230);
  v += p.tow ? 6 : 0;
  v += 10 * Object.keys(p.parts).length;
  const a = w.arena, m = Math.min(p.x - a.wall, a.w - a.wall - p.x, p.y - a.wall, a.h - a.wall - p.y);
  if (m < 30) v -= (30 - m) * 0.08;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const open = e.state === 'skid' || e.state === 'stunned' || e.state === 'slide' || e.state === 'land';
    if (open) {
      // a back or flank you can reach at speed is worth most
      const off = Math.abs(((Math.atan2(p.y - e.y, p.x - e.x) - e.face + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      const good = off > 1.05 ? 1 : 0.3;
      v += 8 * good * Math.max(0, 1 - d / 220) * (p.speed >= w.t.slipAt ? 1 : 0.5);
    }
    else if ((e.state === 'stalk' || e.state === 'hunt') && d < 50) v -= 2;
  }
  if (!p.tow) for (const k of w.pickups) v += 3 * Math.max(0, 1 - Math.hypot(k.x - p.x, k.y - p.y) / 200);
  return v;
}

export function mpcBot(o: MpcOpts = {}) {
  const seg1 = o.seg1 ?? 9, H = o.horizon ?? 84, every = o.every ?? 6;
  let plan: { dx: number; dy: number; rip: boolean; cont: number } | null = null;
  let left = 0;
  return (w: World): InputFrame => {
    const out = exitInput(w, 0);
    if (out) return out;
    const p = w.player;
    const boltNow = (o.boltOn ?? true) && !!p.tow && p.bolt === null && !w.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 110 && !(e.state === 'skid' || e.state === 'stunned'));
    if (left > 0 && plan) {
      left--;
      if (!o.noRip && autoRip(w)) return { x: plan.dx, y: plan.dy, rip: true, bolt: false };
      if (!o.noRip && p.ripCd <= 0 && !p.rip && p.rev === null && w.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 75)) {
        const score = (rip: boolean) => {
          const c = cloneWorld(w);
          for (let k = 0; k < 24 && !c.result; k++) { step(c, { x: plan!.dx, y: plan!.dy, rip: rip && k < 2, bolt: false }); c.events.length = 0; }
          return 12 * (c.stats.damageDealt - w.stats.damageDealt) + 20 * (c.stats.tears - w.stats.tears) - 60 * (c.stats.hitsTaken - w.stats.hitsTaken);
        };
        const a = score(true), b = score(false);
        if (a > b && a > 0) return { x: plan.dx, y: plan.dy, rip: true, bolt: false };
      }
      return { x: plan.dx, y: plan.dy, rip: false, bolt: boltNow };
    }
    const near = w.enemies.length ? Math.min(...w.enemies.map((e) => Math.hypot(e.x - p.x, e.y - p.y))) : 999;
    const target = (c: World) => {
      let best = null as null | { x: number; y: number }, bd = 1e9;
      for (const e of c.enemies) {
        const d = Math.hypot(e.x - c.player.x, e.y - c.player.y);
        if (d < bd) { bd = d; best = { x: e.x - Math.cos(e.face) * 26, y: e.y - Math.sin(e.face) * 26 }; }
      }
      return best ?? { x: c.arena.w / 2, y: c.arena.h / 2 };
    };
    const cands: { dx: number; dy: number; rip: boolean; cont: number }[] = [];
    const ripOk = !o.noRip && p.ripCd <= 0 && !p.rip && near < 110;
    for (let i = 0; i <= DIRS; i++) {
      const a = (i / DIRS) * Math.PI * 2;
      const dx = i === DIRS ? 0 : Math.cos(a), dy = i === DIRS ? 0 : Math.sin(a);
      for (let cont = 0; cont < 4; cont++) {
        cands.push({ dx, dy, rip: false, cont });
        if (ripOk && cont < 2) cands.push({ dx, dy, rip: true, cont });
      }
    }
    let best = cands[0], bv = -1e9;
    for (const cd of cands) {
      const c = cloneWorld(w);
      for (let k = 0; k < H && !c.result; k++) {
        let x = cd.dx, y = cd.dy;
        if (k >= seg1) {
          if (cd.cont === 1) { const t = target(c); const dx = t.x - c.player.x, dy = t.y - c.player.y, d = Math.hypot(dx, dy) || 1; x = dx / d; y = dy / d; }
          else if (cd.cont === 2 || cd.cont === 3) { const r = cd.cont === 2 ? 0.8 : -0.8; const h = Math.atan2(cd.dy, cd.dx) + r; x = cd.dx || cd.dy ? Math.cos(h) : 0; y = cd.dx || cd.dy ? Math.sin(h) : 0; }
        }
        step(c, { x, y, rip: (cd.rip && k < 2) || autoRip(c), bolt: false });
        c.events.length = 0;
      }
      const v = value(w, c);
      if (v > bv) { bv = v; best = cd; }
    }
    plan = best;
    left = every - 1;
    return { x: best.dx, y: best.dy, rip: best.rip, bolt: boltNow && !best.rip };
  };
}
