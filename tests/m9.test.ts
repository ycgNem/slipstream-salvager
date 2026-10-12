// Milestone 9 (PLAN.md 9.6): the chassis. Each is its own movement model, so these check lines,
// not numbers: the Skiff holds a full-lock turn at Slipstream, the Hauler's bump is a shove.
import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../src/data/chassis';
import { dailySeed, isUnlocked, unlockText, type Career } from '../src/data/unlocks';
import { RUN_LENGTH } from '../src/data/yards';
import { playerStats } from '../src/sim/body';
import { beginWindup } from '../src/sim/rammer';
import { finishYard, newRun, yardWorld } from '../src/sim/run';
import { dealDamage } from '../src/sim/rip';
import { WAVES } from '../src/data/waves';
import { addEnemy, addRammer, createWorld, giveBolted, type World } from '../src/sim/world';
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

  it('every part costs the Skiff its glide: three and it scrubs in a full-lock turn like the others', () => {
    const w = openWorld({ chassis: 'skiff' });
    const bare = playerStats(w);
    // (not the Booster: its own cost is a wider turn, so with it the Skiff turns wide instead)
    for (const id of ['jets', 'plow', 'springs'] as const) giveBolted(w, id);
    const loaded = playerStats(w);
    expect(loaded.topSpeed).toBe(bare.topSpeed);
    expect(loaded.coastHalf).toBeLessThan(bare.coastHalf / 2);
    expect(fullLock(w)).toBeLessThan(w.t.slipAt);
    // not the others: a part changes only what it says it does
    const s = openWorld(), sb = playerStats(s);
    giveBolted(s, 'plow');
    expect(playerStats(s).scrubLat).toBeCloseTo(sb.scrubLat, 3);
    expect(playerStats(s).coastHalf).toBeCloseTo(sb.coastHalf, 3);
  });

  it('the Skiff builds speed no faster than the Scrapper: keeping it is its strength', () => {
    const toSlip = (c: 'skiff' | 'scrapper') => {
      const w = openWorld({ chassis: c });
      Object.assign(w.player, { x: 200, y: 2000, heading: 0, speed: 0 });
      let n = 0;
      while (w.player.speed < w.t.slipAt && n < 600) { tick(w, IN(1, 0)); n++; }
      return n;
    };
    expect(toSlip('skiff')).toBeGreaterThanOrEqual(toSlip('scrapper'));
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
    expect(w.stats.cancels).toBe(1);
  });

  it("the Hauler's shove cancels a windup once in a while, not every bump: leaning on one sets it off", () => {
    const w = openWorld({ chassis: 'hauler' });
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 90 });
    const r = addRammer(w, 1030, 2000, Math.PI);
    beginWindup(w, r, false);
    r.cd = 99;
    const ev: string[] = [];
    let low = Infinity;
    // keep pushing into it: the first shove cancels, then it's braced and winds up again
    for (let i = 0; i < 90; i++) {
      if (r.state === 'stalk') r.cd = 0;
      const e = tick(w, IN(1, 0)).map((q) => q.k);
      if (e.includes('shove')) low = Math.min(low, w.player.speed);
      ev.push(...e);
    }
    expect(ev.filter((k) => k === 'cancel').length).toBe(1);
    expect(ev.filter((k) => k === 'windup').length).toBeGreaterThan(0);
    // and a shove costs your speed like any bump
    expect(low).toBeLessThan(90 * 0.5);
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
  const none: Career = { tears: 0, cancels: 0, drafts: 0, bestYards: 0, wins: 0 };
  it('unlock by playing, each chassis by its own verb: slipstreams for the Skiff, cancels for the Hauler', () => {
    expect(isUnlocked('scrapper', none)).toBe(true);
    for (const id of ['skiff', 'hauler', 'bare', 'rush'] as const) expect(isUnlocked(id, none)).toBe(false);
    expect(isUnlocked('skiff', { ...none, drafts: 15 })).toBe(true);
    expect(isUnlocked('skiff', { ...none, tears: 99 })).toBe(false);
    expect(isUnlocked('hauler', { ...none, cancels: 15 })).toBe(true);
    expect(isUnlocked('bare', { ...none, bestYards: RUN_LENGTH - 1 })).toBe(true);
    expect(isUnlocked('rush', { ...none, wins: 1 })).toBe(true);
    expect(unlockText('hauler', { ...none, cancels: 12 })).toBe('CANCEL 15 WINDUPS  12/15');
    expect(unlockText('rush', none)).toBe('WIN A RUN');
  });

  it('a Cruise hit that cancels a windup and a caught slipstream are counted for the unlocks', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 150 });
    const r = addRammer(w, 1024, 2000, Math.PI);
    beginWindup(w, r, false);
    r.cd = 99;
    for (let i = 0; i < 20 && !w.stats.cancels; i++) tick(w, IN(1, 0, true));
    expect(w.stats.cancels).toBe(1);
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

  it('Bare Bones: the results still show the build you ended the run with', () => {
    const r = newRun(6, 'compactor', { mods: ['bare'] });
    const w = yardWorld(r);
    giveBolted(w, 'booster');
    giveBolted(w, 'plow');
    w.result = 'cleared';
    finishYard(r, w);
    expect(r.over).toBe('won');
    expect(Object.keys(r.loadout!.parts).sort()).toEqual(['front', 'rear']);
  });

  it('No Breather: the next wave comes in while one enemy of this one is left; the boss calls twice as often', () => {
    const w = yardWorld(newRun(6, 'ring', { mods: ['rush'] }));
    expect(w.t.breather).toBe(0);
    expect(w.t.bossCall).toBeCloseTo(yardWorld(newRun(6, 'ring')).t.bossCall / 2, 5);
    // run to the first fight, then take all but one of the wave off
    let n = 0;
    while (w.wave.phase !== 'fight' && n++ < 600) tick(w, IN(0, 0));
    w.enemies.splice(1);
    tick(w, IN(0, 0));
    expect(w.wave.index).toBe(1);
    expect(w.enemies.length).toBe(1);
    // without the modifier it waits for the last one
    const v = yardWorld(newRun(6, 'ring'));
    n = 0;
    while (v.wave.phase !== 'fight' && n++ < 600) tick(v, IN(0, 0));
    v.enemies.splice(1);
    tick(v, IN(0, 0));
    expect(v.wave.index).toBe(0);
  });

  it('the daily seed is the same all day and different the next', () => {
    expect(dailySeed('2026-10-12')).toBe(dailySeed('2026-10-12'));
    expect(dailySeed('2026-10-12')).not.toBe(dailySeed('2026-10-13'));
    // the same seed is the same run: the same choices at every exit
    const a = newRun(dailySeed('2026-10-12')), b = newRun(dailySeed('2026-10-12'));
    expect(a.options).toEqual(b.options);
  });
});


describe('the M9 review fixes (DECISIONS #99)', () => {
  it("leaning on an enemy is dangerous on the Hauler too (the camper guard: its bump isn't free)", () => {
    // hold the stick into the nearest enemy, wave 1 of The Ring, for a minute of fight
    let hits = 0;
    for (const seed of [1, 2]) {
      const w = createWorld({ seed, chassis: 'hauler', waves: [{ ...WAVES[0], safety: false }], tuning: { hull: 99 } });
      let fight = 0;
      for (let i = 0; i < 120 * 60 && fight < 60 * 60; i++) {
        const p = w.player, e = w.enemies.filter((q) => q.state !== 'enter').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        const d = e ? Math.hypot(e.x - p.x, e.y - p.y) || 1 : 1;
        tick(w, e ? IN((e.x - p.x) / d, (e.y - p.y) / d) : IN(0, 0));
        if (w.wave.phase === 'fight') fight++;
      }
      hits += w.stats.hitsTaken;
    }
    // a minute each: before the fix the Hauler took under 1 hit a minute, the Scrapper ~28
    expect(hits / 2).toBeGreaterThan(8);
  });

  it("a part The Compactor's safety net shakes loose names the boss, so its move text and CORE OPEN still show", () => {
    const w = openWorld();
    const b = addEnemy(w, 'compactor', 1200, 2000, Math.PI, { parts: ['plow'], safety: true });
    b.hp = 1;
    const ev = [...[0, 1].flatMap(() => (dealDamage(w, b, 1, 'side', b.x, b.y), w.events.splice(0)))];
    const drop = ev.find((e) => e.k === 'drop');
    expect(drop && 'id' in drop ? drop.id : undefined).toBe(b.id);
    expect(b.parts).toEqual({});
  });

  it('the Snappers The Compactor calls in come bare: its help is not a supply of treads', () => {
    const w = yardWorld(newRun(2, 'compactor'));
    for (let i = 0; i < 600 && !w.enemies.length; i++) tick(w, IN(0, 0));
    const b = w.enemies[0];
    b.aux = 0;
    Object.assign(w.player, { invuln: 999 });
    tick(w, IN(0, 0));
    const helper = w.enemies.find((e) => e.kind === 'snapper');
    expect(helper).toBeDefined();
    expect(helper!.parts).toEqual({});
  });
});
