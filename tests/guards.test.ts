// The removal-test guards (PLAN.md section 2): scripted players on 8 seeds. Standing still must
// lose, brawling and waiting-to-counter must do worse than hit-and-run, and the Booster must flip
// which route is best. If one of these fails, the identity is slipping, not just a number.
import { describe, expect, it } from 'vitest';
import { createWorld, type World } from '../src/sim/world';
import { step } from '../src/sim/tick';
import { brawlerBot, hitAndRunBot, lanerBot, looperBot, matadorBot, turretBot, type Bot } from '../src/sim/bots';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Play wave 1 for up to `secs`. */
function wave1(bot: Bot, seed: number, secs = 90): World {
  const w = createWorld({ seed });
  for (let i = 0; i < secs * 60 && !w.result && w.wave.index < 1; i++) {
    step(w, bot(w));
    w.events.length = 0;
  }
  return w;
}

function totals(mk: () => Bot) {
  const ws = SEEDS.map((s) => wave1(mk(), s));
  const sum = (f: (w: World) => number) => ws.reduce((a, w) => a + f(w), 0);
  return {
    dealt: sum((w) => w.stats.damageDealt),
    taken: sum((w) => w.stats.hitsTaken),
    perHit: sum((w) => w.stats.damageDealt) / Math.max(1, sum((w) => w.stats.hitsTaken)),
    cleared: ws.filter((w) => w.wave.index >= 1).length,
    scrapped: ws.filter((w) => w.result === 'scrapped').length,
  };
}

describe('removal-test guards', () => {
  const run = totals(hitAndRunBot);

  it('standing still and mashing the attack deals zero damage and loses', () => {
    const t = totals(turretBot);
    expect(t.dealt).toBe(0);
    expect(t.scrapped).toBe(SEEDS.length);
  });

  it('brawling at medium speed does worse than hit-and-run', () => {
    const t = totals(brawlerBot);
    expect(t.dealt).toBe(0); // Cruise never damages
    expect(t.perHit).toBeLessThan(run.perHit);
  });

  it('waiting for a charge and countering does worse than hit-and-run', () => {
    expect(totals(matadorBot).perHit).toBeLessThan(run.perHit);
  });

  it('hit-and-run clears wave 1 on most seeds, taking at most one hit on average', () => {
    // 6 of 8: the bot is a simple script that sometimes fails to get behind the wave 1 Rammer in
    // time (DECISIONS #34); a person does better
    expect(run.cleared).toBeGreaterThanOrEqual(6);
    expect(run.taken / SEEDS.length).toBeLessThanOrEqual(1);
    expect(run.scrapped).toBe(0);
  });
});

describe('the Booster changes how you play (route flip)', () => {
  /** share of 40 s spent at Slipstream driving a route */
  function slipShare(bot: Bot, booster: boolean) {
    const w = createWorld({ seed: 1, sandbox: true });
    if (booster) w.player.part = 'booster';
    for (let i = 0; i < 2400; i++) {
      step(w, bot(w));
      w.events.length = 0;
    }
    return w.stats.tierTicks.slip / 2400;
  }
  const base = { loop: slipShare(looperBot(), false), lane: slipShare(lanerBot(), false) };
  const boost = { loop: slipShare(looperBot(), true), lane: slipShare(lanerBot(), true) };

  it('on the base body, tight pillar loops beat long lanes', () => {
    expect(base.loop).toBeGreaterThan(base.lane + 0.15);
  });

  it('with the Booster, long lanes beat tight loops', () => {
    expect(boost.lane).toBeGreaterThan(boost.loop);
    expect(boost.loop).toBeLessThan(base.loop - 0.15);
    expect(boost.lane).toBeGreaterThanOrEqual(base.lane);
  });
});
