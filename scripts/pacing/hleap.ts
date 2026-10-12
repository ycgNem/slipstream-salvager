// (From the critic's M6 review, DECISIONS #92.) The critic's hmpc search bot (same latency, same value), plus leap plans: hold Rip h ticks in a
// direction, then let go. Measures what the Jump Jets add on top of the same player.
//   npx vite-node scripts/pacing/hleap.ts <yards> <seeds> [parts] [noleap]
import { newRun, yardWorld } from '../../src/sim/run';
import { step } from '../../src/sim/tick';
import { giveBolted, type InputFrame, type World } from '../../src/sim/world';
import { exitInput } from '../../src/sim/bots';
import { cloneWorld, autoRip } from './mpc';
import type { YardId } from '../../src/data/yards';

function value(w0: World, w: World): number {
  const s0 = w0.stats, s = w.stats, p = w.player;
  let v = 0;
  v += 12 * (s.damageDealt - s0.damageDealt) + 20 * (s.tears - s0.tears) + 25 * (s.wrecks - s0.wrecks);
  v -= 60 * (s.hitsTaken - s0.hitsTaken) + 200 * (w.result === 'scrapped' ? 1 : 0);
  v += 0.03 * Math.min(p.speed, 230) + (p.tow ? 6 : 0) + 10 * Object.keys(p.parts).length;
  const a = w.arena, m = Math.min(p.x - a.wall, a.w - a.wall - p.x, p.y - a.wall, a.h - a.wall - p.y);
  if (m < 30) v -= (30 - m) * 0.08;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.state === 'skid' || e.state === 'stunned' || e.state === 'slide' || e.state === 'land') {
      const off = Math.abs(((Math.atan2(p.y - e.y, p.x - e.x) - e.face + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      v += 8 * (off > 1.05 ? 1 : 0.3) * Math.max(0, 1 - d / 220) * (p.speed >= w.t.slipAt ? 1 : 0.5);
    } else if ((e.state === 'stalk' || e.state === 'hunt') && d < 50) v -= 2;
  }
  if (!p.tow) for (const k of w.pickups) v += 3 * Math.max(0, 1 - Math.hypot(k.x - p.x, k.y - p.y) / 200);
  return v;
}

export function bot(o: { lat?: number; leap?: boolean } = {}) {
  const lat = o.lat ?? 12, DIRS = 8, every = 6, H = 84, seg1 = 9;
  type S = { x: number; y: number; r?: boolean };
  const queue: S[] = Array.from({ length: lat }, () => ({ x: 0, y: 0 }));
  let tick = 0;
  return (w: World): InputFrame => {
    const out = exitInput(w, 0);
    if (out) return out;
    const p = w.player;
    const pendingLeap = queue.some((s) => s.r !== undefined);
    if (tick++ % every === 0 && !pendingLeap && !p.air) {
      const target = (c: World) => {
        let best = null as null | { x: number; y: number }, bd = 1e9;
        for (const e of c.enemies) { const d = Math.hypot(e.x - c.player.x, e.y - c.player.y); if (d < bd) { bd = d; best = { x: e.x - Math.cos(e.face) * 26, y: e.y - Math.sin(e.face) * 26 }; } }
        return best ?? { x: c.arena.w / 2, y: c.arena.h / 2 };
      };
      const q = (x: number, y: number) => { if (!x && !y) return { x: 0, y: 0 }; const a = Math.round(Math.atan2(y, x) / ((2 * Math.PI) / DIRS)) * ((2 * Math.PI) / DIRS); return { x: Math.cos(a), y: Math.sin(a) }; };
      let best: { dx: number; dy: number; hold: number } = { dx: 0, dy: 0, hold: 0 }, bv = -1e9;
      const holds = o.leap && p.ripCd < 0.1 ? [0, 9, 14, 20, 28] : [0];
      for (let i = 0; i <= DIRS; i++) {
        const a = (i / DIRS) * Math.PI * 2;
        const dx = i === DIRS ? 0 : Math.cos(a), dy = i === DIRS ? 0 : Math.sin(a);
        for (const hold of holds) for (let cont = 0; cont < (hold ? 1 : 4); cont++) {
          const c = cloneWorld(w);
          for (let k = 0; k < queue.length + H && !c.result; k++) {
            let s: S, rip: boolean;
            if (k < queue.length) { s = queue[k]; rip = s.r ?? autoRip(c); }
            else {
              const kk = k - queue.length;
              s = { x: dx, y: dy };
              if (kk >= seg1 && !hold) {
                if (cont === 1) { const t = target(c); s = q(t.x - c.player.x, t.y - c.player.y); }
                else if (cont >= 2 && (dx || dy)) { const h = Math.atan2(dy, dx) + (cont === 2 ? 1 : -1) * ((2 * Math.PI) / DIRS); s = { x: Math.cos(h), y: Math.sin(h) }; }
              }
              rip = hold ? kk < hold : autoRip(c);
            }
            step(c, { x: s.x, y: s.y, rip, bolt: false });
            c.events.length = 0;
          }
          const v = value(w, c);
          if (v > bv) { bv = v; best = { dx, dy, hold }; }
        }
      }
      if (best.hold) { for (let k = 0; k < best.hold; k++) queue.push({ x: best.dx, y: best.dy, r: true }); queue.push({ x: best.dx, y: best.dy, r: false }); }
      else for (let k = 0; k < every; k++) queue.push({ x: best.dx, y: best.dy });
    }
    const s = queue.shift() ?? { x: 0, y: 0 };
    const boltNow = !!p.tow && p.bolt === null && !w.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 110 && !(e.state === 'skid' || e.state === 'stunned'));
    const rip = s.r ?? autoRip(w);
    return { x: s.x, y: s.y, rip, bolt: boltNow && !rip && s.r === undefined };
  };
}

const yards = (process.argv[2] ?? 'ring').split(',') as YardId[];
const seeds = (process.argv[3] ?? '1,2,3,4').split(',').map(Number);
const parts = (process.argv[4] && process.argv[4] !== '-' ? process.argv[4].split('+') : []) as any[];
const leap = process.argv[5] !== 'noleap';
for (const yard of yards) {
  const res: string[] = []; let clr = 0, secs = 0, hits = 0;
  for (const seed of seeds) {
    const w = yardWorld(newRun(seed, yard));
    for (const id of parts) giveBolted(w, id);
    const b = bot({ leap });
    const ev: Record<string, number> = {}; const zones: Record<string, number> = {};
    for (let i = 0; i < 300 * 60 && !w.result && w.wave.phase !== 'exit'; i++) {
      step(w, b(w));
      for (const e of w.events) {
        if (['leap', 'touchdown', 'draft', 'rip', 'tear', 'knock', 'hurt', 'boing', 'land'].includes(e.k)) ev[e.k] = (ev[e.k] ?? 0) + 1;
        if (e.k === 'hit') zones[e.zone] = (zones[e.zone] ?? 0) + 1;
      }
      w.events.length = 0;
    }
    const ok = w.wave.phase === 'exit' || w.result === 'cleared';
    if (ok) { clr++; secs += w.stats.ticks / 60; }
    hits += w.stats.hitsTaken;
    res.push(`s${seed}:${ok ? 'CLR' : (w.result ?? 'timeout') + '@w' + (w.wave.index + 1)} ${(w.stats.ticks / 60).toFixed(0)}s hits${w.stats.hitsTaken} tears${w.stats.tears} slip%${((100 * w.stats.tierTicks.slip) / w.stats.ticks).toFixed(0)} zones${JSON.stringify(zones)} ev${JSON.stringify(ev)} parts:${Object.values(w.player.parts).map((b) => b!.id).join('+') || '-'}`);
  }
  console.log(`${yard} [${parts.join('+') || 'bare'}]${leap ? ' LEAP' : ''} cleared ${clr}/${seeds.length} avg ${(secs / Math.max(1, clr)).toFixed(0)}s hits/run ${(hits / seeds.length).toFixed(1)}`);
  for (const r of res) console.log('   ' + r);
}
