import { newRun, yardWorld } from '../../src/sim/run';
import { step } from '../../src/sim/tick';
import { hmpcBot } from './hmpc';

const run = newRun(2, 'hurdles');
const w = yardWorld(run);
const bot = hmpcBot({ lat: 12, dirs: 8 });
for (let i = 0; i < 120 * 60 && !w.result; i++) {
  const inp = bot(w);
  step(w, inp);
  const ks = w.events.map((e) => e.k).filter((k) => !['tier'].includes(k));
  w.events.length = 0;
  if (i % 120 === 0 || ks.some((k) => ['leap','touchdown','tear','bolted','hurt','knock'].includes(k))) {
    const p = w.player;
    console.log((i / 60).toFixed(2), `p(${p.x.toFixed(0)},${p.y.toFixed(0)}) v${p.speed.toFixed(0)} in(${inp.x.toFixed(1)},${inp.y.toFixed(1)}${inp.rip ? ' R' : ''}) knock${p.knock.toFixed(2)} stun${p.stun.toFixed(2)} rec${p.recoil.toFixed(2)} air${p.air ? 1 : 0} rev${p.rev}`, w.enemies.map((e) => `${e.kind[0]}${e.id}:${e.state}(${e.x.toFixed(0)},${e.y.toFixed(0)})`).join(' '), ks.join(','));
  }
}
