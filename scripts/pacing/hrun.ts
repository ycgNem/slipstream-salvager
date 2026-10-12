// Pacing with the critic's search bot (M3 review, DECISIONS #79): plays yards headless and prints
// clear times, hits, tears and time at Slipstream per seed. The bot is a skill ceiling, not a
// person (a decent player takes about 3-4x its fighting time).
//   npx vite-node scripts/pacing/hrun.ts <yards> <seeds> [parts|-] [tuning-json] [norip]
//   e.g. npx vite-node scripts/pacing/hrun.ts ring,kennel 1,2,3,4 treads+plow '{"chargeOver":100}'
// LAT (reaction delay in ticks, default 12) and DIRS (8: keyboard) shape the bot; ORACLE=1 uses the
// no-delay version.
import { newRun, yardWorld } from '../../src/sim/run';
import { step } from '../../src/sim/tick';
import { giveBolted } from '../../src/sim/world';
import { mpcBot } from './mpc';
import { hmpcBot } from './hmpc';
import type { YardId } from '../../src/data/yards';
import type { PartId } from '../../src/data/parts';

const yards = (process.argv[2] ?? 'ring').split(',') as YardId[];
const seeds = (process.argv[3] ?? '1,2,3,4').split(',').map(Number);
const parts = (process.argv[4] && process.argv[4] !== '-' ? process.argv[4].split('+') : []) as PartId[];
const tune = process.argv[5] ? JSON.parse(process.argv[5]) : {};
const noRip = process.argv[6] === 'norip';
for (const yard of yards) {
  const res: string[] = [];
  const tot = { secs: 0, clr: 0, hits: 0, n: 0 };
  for (const seed of seeds) {
    const run = newRun(seed, yard);
    const w = yardWorld(run, { tuning: tune });
    for (const id of parts) giveBolted(w, id);
    const lat = +(process.env.LAT ?? 12), dirs = +(process.env.DIRS ?? 8);
    const bot = process.env.ORACLE ? mpcBot({ noRip }) : hmpcBot({ lat, dirs });
    const waveT: number[] = []; let lw = 0, ws = 0;
    const zones: Record<string, number> = {};
    const ev: Record<string, number> = {};
    for (let i = 0; i < 300 * 60 && !w.result && w.wave.phase !== 'exit'; i++) {
      step(w, bot(w));
      for (const e of w.events) {
        if (e.k === 'hit') zones[e.zone + (e.clang ? 'C' : '')] = (zones[e.zone + (e.clang ? 'C' : '')] ?? 0) + 1;
        if (['ram', 'block', 'latch', 'slide', 'joust', 'draft', 'knock', 'hurt', 'shatter', 'charge', 'snap', 'rip'].includes(e.k)) ev[e.k] = (ev[e.k] ?? 0) + 1;
      }
      w.events.length = 0;
      if (w.wave.index !== lw) { waveT.push((w.stats.ticks - ws) / 60); ws = w.stats.ticks; lw = w.wave.index; }
    }
    const clr = w.wave.phase === 'exit' || w.result === 'cleared';
    if (clr) waveT.push((w.stats.ticks - ws) / 60);
    tot.n++; tot.hits += w.stats.hitsTaken; if (clr) { tot.clr++; tot.secs += w.stats.ticks / 60; }
    res.push(`s${seed}:${clr ? 'CLR' : (w.result ?? 'timeout') + '@w' + (w.wave.index + 1)} ${(w.stats.ticks / 60).toFixed(0)}s waves[${waveT.map((x) => x.toFixed(0)).join(',')}] hits${w.stats.hitsTaken} hull${w.player.hull} tears${w.stats.tears} slip%${((100 * w.stats.tierTicks.slip) / w.stats.ticks).toFixed(0)} zones${JSON.stringify(zones)} ev${JSON.stringify(ev)} parts:${Object.values(w.player.parts).map((b) => b!.id).join('+') || '-'}`);
  }
  console.log(`${yard} [${parts.join('+') || 'bare'}]${noRip ? ' NORIP' : ''} ${process.argv[5] ?? ''} cleared ${tot.clr}/${tot.n} avg ${(tot.secs / Math.max(1, tot.clr)).toFixed(0)}s hits/run ${(tot.hits / tot.n).toFixed(1)}`);
  for (const r of res) console.log('   ' + r);
}
