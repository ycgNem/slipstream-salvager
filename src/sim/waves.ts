// The encounter script (PLAN.md 4.5): a banner, a warning at the gates, the enemies come in, the
// fight, a breather, the next wave; clearing the last one ends the yard. No timer escalates
// anything (DECISIONS #22).
import { addEnemy, DT, type World } from './world';

export function updateWaves(w: World) {
  if (w.sandbox || w.result) return;
  const wv = w.wave, t = w.t, p = w.player;
  if (wv.t === 0 && wv.phase === 'banner') w.events.push({ k: 'wave', n: wv.index + 1 });
  wv.t += DT;
  const def = w.waves[wv.index];
  switch (wv.phase) {
    case 'banner':
      if (wv.t >= t.bannerTime) {
        // the gates farthest from the player
        const n = Math.min(def.enemies.length, w.arena.gates.length);
        wv.gates = [...w.arena.gates]
          .sort((a, b) => Math.hypot(b.spawn.x - p.x, b.spawn.y - p.y) - Math.hypot(a.spawn.x - p.x, a.spawn.y - p.y))
          .slice(0, n);
        for (const g of wv.gates) w.events.push({ k: 'gate', gate: g.id });
        wv.phase = 'warn';
        wv.t = 0;
      }
      break;
    case 'warn':
      if (wv.t >= t.gateWarn) {
        // more enemies than gates: the rest come in behind the first, a little further in
        def.enemies.forEach((spec, i) => {
          const g = wv.gates[i % wv.gates.length], row = Math.floor(i / wv.gates.length);
          const x = g.spawn.x + g.dir.x * row * 26 + (row ? g.dir.y * 14 : 0), y = g.spawn.y + g.dir.y * row * 26 + (row ? g.dir.x * 14 : 0);
          const e = addEnemy(w, spec.kind, x, y, Math.atan2(g.dir.y, g.dir.x), { parts: spec.parts, safety: def.safety, state: 'enter' });
          e.enter = { ...g.dir };
          w.events.push({ k: 'enter', id: e.id, gate: g.id });
        });
        wv.phase = 'fight';
        wv.t = 0;
      }
      break;
    case 'fight':
      if (w.enemies.length === 0) {
        if (wv.index >= w.waves.length - 1) {
          wv.phase = 'done';
          w.result = 'cleared';
          w.events.push({ k: 'cleared' });
        } else {
          wv.phase = 'breather';
          wv.t = 0;
        }
      }
      break;
    case 'breather':
      if (wv.t >= t.breather) {
        wv.index++;
        wv.phase = 'banner';
        wv.t = 0;
      }
      break;
  }
}
