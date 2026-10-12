// Milestone 9 (PLAN.md 9.6): the chassis. Each is its own movement model, so these check lines,
// not numbers: the Skiff holds a full-lock turn at Slipstream, the Hauler's bump is a shove.
import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../src/data/chassis';
import { dailySeed, isUnlocked, unlockText, type Career } from '../src/data/unlocks';
import { RUN_LENGTH } from '../src/data/yards';
import { playerStats } from '../src/sim/body';
import { beginWindup } from '../src/sim/rammer';
import { finishYard, newRun, yardWorld } from '../src/sim/run';
import { addRammer, giveBolted, type World } from '../src/sim/world';
import { IN, openWorld, tick } from './helpers';

/** Hold a full-lock turn (steer 90 degrees off your heading) at top speed for n ticks; the lowest speed after the first second. */
function fullLock(w: World, n = 180): number {
  Object.assign(w.player, { x: 2000, y: 2000, heading: 0, speed: playerStats(w).topSpeed });
  let low = Infinity;
  for (let i = 0; i < n; i++) {
    const h = w.player.heading + Math.PI / 2;
    tick(w, IN(Math.cos(h), Math.sin(h)));
    if (i > 60) low = Math.min(low, w.player.speed);
  }
  return low;
}

describe('the chassis', () => {
  it('a chassis is its tuning: the Skiff has 3 hull, the Hauler 7, and the run carries it', () => {
    expect(openWorld({ chassis: 'skiff' }).player.hull).toBe(3);
    expect(openWorld({ chassis: 'hauler' }).player.hull).toBe(7);
    expect(openWorld().player.hull).toBe(5);
    const r = newRun(4, 'ring', { chassis: 'hauler' });
    const w = yardWorld(r);
    expect(w.chassis).toBe('hauler');
    w.result = 'exit';
    w.exits = w.exitPlan;
    w.exitChoice = 0;
    finishYard(r, w);
    expect(yardWorld(r).chassis).toBe('hauler');
  });

  it('the Skiff holds Slipstream through a full-lock turn; the Scrapper and the Hauler drop out', () => {
    const skiff = fullLock(openWorld({ chassis: 'skiff' }));
    const scrapper = fullLock(openWorld());
    const hauler = fullLock(openWorld({ chassis: 'hauler' }));
    expect(skiff).toBeGreaterThanOrEqual(openWorld().t.slipAt);
    expect(scrapper).toBeLessThan(openWorld().t.slipAt);
    expect(hauler).toBeLessThan(openWorld().t.slipAt);
  });

  it('the Skiff coasts much further and brakes much later', () => {
    const coast = (c: 'skiff' | 'scrapper') => {
      const w = openWorld({ chassis: c });
      Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 200 });
      for (let i = 0; i < 60; i++) tick(w, IN(0, 0));
      return w.player.x - 1000;
    };
    expect(coast('skiff')).toBeGreaterThan(coast('scrapper') * 1.8);
  });

  it("every part weighs the Skiff down; not the others", () => {
    const w = openWorld({ chassis: 'skiff' });
    const bare = playerStats(w).topSpeed;
    giveBolted(w, 'treads');
    giveBolted(w, 'plow');
    const t = w.t;
    // the Plow changes acceleration, not top speed: here it's only weight
    expect(playerStats(w).topSpeed).toBeCloseTo(bare * t.treadsTopMul * 0.94 * 0.94, 3);
    const s = openWorld();
    const sb = playerStats(s).topSpeed;
    giveBolted(s, 'plow');
    expect(playerStats(s).topSpeed).toBeCloseTo(sb, 3);
  });

  it("the Hauler's bump is a shove: it cancels a windup at a crawl, and you plough on", () => {
    const w = openWorld({ chassis: 'hauler' });
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 90 });
    const r = addRammer(w, 1030, 2000, Math.PI);
    beginWindup(w, r, false);
    r.cd = 99;
    const ev: string[] = [];
    for (let i = 0; i < 10; i++) ev.push(...tick(w, IN(1, 0)).map((e) => e.k));
    expect(ev).toContain('cancel');
    expect(ev).toContain('shove');
    expect(ev).not.toContain('bump');
    expect(r.state).toBe('stalk');
    expect(Math.cos(w.player.heading)).toBeGreaterThan(0.9);
    expect(w.stats.hitsTaken).toBe(0);
  });

  it("the Scrapper's bump bounces you off and starts its quick windup", () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 90 });
    const r = addRammer(w, 1030, 2000, Math.PI);
    r.cd = 99;
    const ev: string[] = [];
    for (let i = 0; i < 10; i++) ev.push(...tick(w, IN(1, 0)).map((e) => e.k));
    expect(ev).toContain('bump');
    expect(ev).toContain('windup');
    expect(CHASSIS.scrapper.bump).toBe('bounce');
  });
});

describe('the Garage: unlocks and modifiers', () => {
  const none: Career = { tears: 0, jousts: 0, bestYards: 0, wins: 0 };
  it('unlock by playing: 20 tears for the Skiff, 10 jousts for the Hauler, The Heap and a win for the modifiers', () => {
    expect(isUnlocked('scrapper', none)).toBe(true);
    for (const id of ['skiff', 'hauler', 'bare', 'rush'] as const) expect(isUnlocked(id, none)).toBe(false);
    expect(isUnlocked('skiff', { ...none, tears: 20 })).toBe(true);
    expect(isUnlocked('hauler', { ...none, jousts: 10 })).toBe(true);
    expect(isUnlocked('bare', { ...none, bestYards: RUN_LENGTH - 1 })).toBe(true);
    expect(isUnlocked('rush', { ...none, wins: 1 })).toBe(true);
    expect(unlockText('skiff', { ...none, tears: 12 })).toBe('TEAR 20 PARTS OFF  12/20');
    expect(unlockText('rush', none)).toBe('WIN A RUN');
  });

  it("Bare Bones: your parts don't carry to the next yard; your hull does", () => {
    const r = newRun(6, 'ring', { mods: ['bare'] });
    const w = yardWorld(r);
    giveBolted(w, 'booster');
    w.player.hull = 3;
    w.result = 'exit';
    w.exits = w.exitPlan;
    w.exitChoice = 0;
    finishYard(r, w);
    const w2 = yardWorld(r);
    expect(w2.player.parts).toEqual({});
    expect(w2.player.hull).toBe(3);
  });

  it('No Breather: the next wave comes in as soon as one is cleared', () => {
    expect(yardWorld(newRun(6, 'ring', { mods: ['rush'] })).t.breather).toBe(0);
    expect(yardWorld(newRun(6, 'ring')).t.breather).toBeGreaterThan(0);
  });

  it('the daily seed is the same all day and different the next', () => {
    expect(dailySeed('2026-10-12')).toBe(dailySeed('2026-10-12'));
    expect(dailySeed('2026-10-12')).not.toBe(dailySeed('2026-10-13'));
    // the same seed is the same run: the same choices at every exit
    const a = newRun(dailySeed('2026-10-12')), b = newRun(dailySeed('2026-10-12'));
    expect(a.options).toEqual(b.options);
  });
});

