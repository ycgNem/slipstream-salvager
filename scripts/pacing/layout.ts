// Controlled layout test (from the critic's M6 review, DECISIONS #92): the same waves (a yard's own) in a different arena, the same search bot.
//   npx vite-node scripts/pacing/layout.ts <arena> <wavesFromYard> <seeds> [parts]
import { createWorld, giveBolted } from '../../src/sim/world';
import { step } from '../../src/sim/tick';
import { hmpcBot } from './hmpc';
import * as A from '../../src/data/arena';
import { YARDS } from '../../src/data/yards';
const arena = (A as any)[process.argv[2].toUpperCase()];
const waves = YARDS[process.argv[3] as 'ring'].waves;
const seeds = process.argv[4].split(',').map(Number);
const parts = (process.argv[5] ?? '').split('+').filter(Boolean) as any[];
let tot = { secs: 0, clr: 0, slip: 0, spd: 0, n: 0, clank: 0, boing: 0, scrape: 0, hits: 0 };
for (const seed of seeds) {
  const w = createWorld({ seed, arena, waves: waves.map((x) => ({ ...x, safety: false })) });
  for (const id of parts) giveBolted(w, id);
  const bot = hmpcBot({ lat: 12, dirs: 8 });
  let spd = 0, n = 0;
  for (let i = 0; i < 240 * 60 && !w.result; i++) {
    step(w, bot(w)); spd += w.player.speed; n++;
    for (const e of w.events) { if (e.k === 'clank' && (e as any).wall) tot.clank++; if (e.k === 'boing' && (e as any).id === undefined) tot.boing++; if (e.k === 'scrape') tot.scrape++; }
    w.events.length = 0;
  }
  if (w.result === 'cleared') { tot.clr++; tot.secs += w.stats.ticks / 60; }
  tot.slip += w.stats.tierTicks.slip / w.stats.ticks; tot.spd += spd / n; tot.n++; tot.hits += w.stats.hitsTaken;
}
console.log(`${process.argv[2].padEnd(8)} waves:${process.argv[3]} [${parts.join('+') || 'bare'}] clr ${tot.clr}/${tot.n} avg ${(tot.secs / Math.max(1, tot.clr)).toFixed(0)}s slip% ${(100 * tot.slip / tot.n).toFixed(0)} avgSpeed ${(tot.spd / tot.n).toFixed(0)} wallClanks/run ${(tot.clank / tot.n).toFixed(1)} boings/run ${(tot.boing / tot.n).toFixed(1)} scrapes/run ${(tot.scrape / tot.n).toFixed(0)} hits/run ${(tot.hits / tot.n).toFixed(1)}`);
