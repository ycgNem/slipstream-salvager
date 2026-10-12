// A person-ish search bot: like mpc.ts, but it has a reaction delay (what it decides now starts
// `lat` ticks later; the inputs already committed play out first), it steers with 8 directions
// (keys) or 12 (stick), and it presses Rip by a plain rule (close, fast, lined up, not an armored
// front), never by looking ahead.
import { step } from '../../src/sim/tick';
import { exitInput } from '../../src/sim/bots';
import type { InputFrame, World } from '../../src/sim/world';
import { cloneWorld, autoRip } from './mpc';

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
    if (e.state === 'skid' || e.state === 'stunned' || e.state === 'slide') {
      const off = Math.abs(((Math.atan2(p.y - e.y, p.x - e.x) - e.face + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      v += 8 * (off > 1.05 ? 1 : 0.3) * Math.max(0, 1 - d / 220) * (p.speed >= w.t.slipAt ? 1 : 0.5);
    } else if ((e.state === 'stalk' || e.state === 'hunt') && d < 50) v -= 2;
  }
  if (!p.tow) for (const k of w.pickups) v += 3 * Math.max(0, 1 - Math.hypot(k.x - p.x, k.y - p.y) / 200);
  return v;
}

export function hmpcBot(o: { lat?: number; dirs?: number; every?: number; H?: number } = {}) {
  const lat = o.lat ?? 12, DIRS = o.dirs ?? 8, every = o.every ?? 6, H = o.H ?? 84, seg1 = 9;
  const queue: { x: number; y: number }[] = Array.from({ length: lat }, () => ({ x: 0, y: 0 }));
  let tick = 0;
  return (w: World): InputFrame => {
    const out = exitInput(w, 0);
    if (out) return out;
    const p = w.player;
    if (tick++ % every === 0) {
      const target = (c: World) => {
        let best = null as null | { x: number; y: number }, bd = 1e9;
        for (const e of c.enemies) {
          const d = Math.hypot(e.x - c.player.x, e.y - c.player.y);
          if (d < bd) { bd = d; best = { x: e.x - Math.cos(e.face) * 26, y: e.y - Math.sin(e.face) * 26 }; }
        }
        return best ?? { x: c.arena.w / 2, y: c.arena.h / 2 };
      };
      const q = (x: number, y: number) => {
        if (!x && !y) return { x: 0, y: 0 };
        const a = Math.round(Math.atan2(y, x) / ((2 * Math.PI) / DIRS)) * ((2 * Math.PI) / DIRS);
        return { x: Math.cos(a), y: Math.sin(a) };
      };
      let best = { dx: 0, dy: 0 }, bv = -1e9;
      for (let i = 0; i <= DIRS; i++) {
        const a = (i / DIRS) * Math.PI * 2;
        const dx = i === DIRS ? 0 : Math.cos(a), dy = i === DIRS ? 0 : Math.sin(a);
        for (let cont = 0; cont < 4; cont++) {
          const c = cloneWorld(w);
          for (let k = 0; k < queue.length + H && !c.result; k++) {
            let s: { x: number; y: number };
            if (k < queue.length) s = queue[k];
            else {
              const kk = k - queue.length;
              s = { x: dx, y: dy };
              if (kk >= seg1) {
                if (cont === 1) { const t = target(c); s = q(t.x - c.player.x, t.y - c.player.y); }
                else if (cont >= 2 && (dx || dy)) { const h = Math.atan2(dy, dx) + (cont === 2 ? 1 : -1) * ((2 * Math.PI) / DIRS); s = { x: Math.cos(h), y: Math.sin(h) }; }
              }
            }
            step(c, { x: s.x, y: s.y, rip: autoRip(c), bolt: false });
            c.events.length = 0;
          }
          const v = value(w, c);
          if (v > bv) { bv = v; best = { dx, dy }; }
        }
      }
      for (let k = 0; k < every; k++) queue.push({ x: best.dx, y: best.dy });
    }
    const s = queue.shift() ?? { x: 0, y: 0 };
    const boltNow = !!p.tow && p.bolt === null && !w.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 110 && !(e.state === 'skid' || e.state === 'stunned'));
    const rip = autoRip(w);
    return { x: s.x, y: s.y, rip, bolt: boltNow && !rip };
  };
}
