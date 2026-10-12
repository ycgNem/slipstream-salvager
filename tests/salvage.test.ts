// Salvage and the Booster (PLAN.md 4.4, DECISIONS #12-#15, #32-#33).
import { describe, expect, it } from 'vitest';
import { addRammer, type World } from '../src/sim/world';
import { hitPlayer } from '../src/sim/salvage';
import { IN, openWorld, tick, until } from './helpers';

/** Player moving east at speed toward a Rammer 34 px ahead facing `face` (0 = away from us). */
function setup(speed: number, face: number, opts: { safety?: boolean } = {}) {
  const w = openWorld();
  Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed });
  const r = addRammer(w, 1034, 2000, face, opts);
  r.cd = 99;
  return { w, r };
}
const rip = (w: World) => tick(w, IN(1, 0, true));

describe('tearing a part off', () => {
  it('a Slipstream hit on its back tears the booster off, does no damage, and the claw keeps it', () => {
    const { w, r } = setup(220, 0);
    const ev = [...rip(w), ...tick(w, IN(1, 0))].map((e) => e.k);
    expect(ev).toContain('tear');
    expect(ev).toContain('grab');
    expect(r.booster).toBe(false);
    expect(r.hp).toBe(w.t.rammerHp);
    expect(w.player.tow?.part).toBe('booster');
  });

  it('a Cruise hit on its back does not tear it off', () => {
    const { w, r } = setup(150, 0);
    rip(w);
    tick(w, IN(1, 0));
    expect(r.booster).toBe(true);
    expect(w.player.tow).toBeNull();
  });

  it('a Slipstream hit on its front damages it instead', () => {
    const { w, r } = setup(220, Math.PI);
    rip(w);
    tick(w, IN(1, 0));
    expect(r.booster).toBe(true);
    expect(r.hp).toBe(w.t.rammerHp - 2);
  });

  it('wrecking a Rammer wrecks its booster', () => {
    const { w, r } = setup(220, Math.PI);
    r.hp = 2;
    const ev = [...rip(w), ...tick(w, IN(1, 0))];
    expect(ev.find((e) => e.k === 'wreck')).toMatchObject({ lost: 'booster' });
    expect(w.pickups.length).toBe(0);
    expect(w.player.tow).toBeNull();
  });

  it("wave 1's Rammer can't be wrecked while it has its booster, and shakes it loose after three hits at 1 HP", () => {
    const { w, r } = setup(220, Math.PI, { safety: true });
    for (let n = 0; n < 5; n++) {
      Object.assign(w.player, { x: r.x - 34, y: r.y, heading: 0, speed: 220, ripCd: 0, prevRip: false, invuln: 99, rip: null, pass: 0 });
      w.hitstop = 0;
      Object.assign(r, { face: Math.PI, state: 'skid' });
      rip(w);
      tick(w, IN(1, 0));
    }
    expect(w.rammers).toContain(r);
    expect(r.hp).toBe(1);
    expect(r.booster).toBe(false);
    expect(w.pickups.length).toBe(1);
  });
});

describe('bolting on', () => {
  function towing() {
    const w = openWorld();
    w.player.tow = { part: 'booster', x: w.player.x - 14, y: w.player.y, vx: 0, vy: 0 };
    return w;
  }

  it('a tap starts a 0.7 s bolt that works while moving', () => {
    const w = towing();
    tick(w, IN(1, 0, false, true));
    expect(w.player.bolt).not.toBeNull();
    const n = until(w, IN(1, 0), (w) => w.player.part === 'booster', 120);
    expect((n + 1) / 60).toBeCloseTo(w.t.boltTime, 1);
    expect(w.player.tow).toBeNull();
    expect(w.player.speed).toBeGreaterThan(100);
  });

  it('a Rip cancels bolting', () => {
    const w = towing();
    tick(w, IN(1, 0, false, true));
    tick(w, IN(1, 0));
    const ev = tick(w, IN(1, 0, true)).map((e) => e.k);
    expect(ev).toContain('bolt-cancel');
    expect(w.player.bolt).toBeNull();
    expect(w.player.part).toBeNull();
  });

  it('a hit cancels bolting and knocks the towed part loose', () => {
    const w = towing();
    tick(w, IN(1, 0, false, true));
    hitPlayer(w, 0);
    expect(w.player.bolt).toBeNull();
    expect(w.player.tow).toBeNull();
    expect(w.pickups.length).toBe(1);
  });
});

describe('parts are armor', () => {
  it('a hit shatters the bolted part before it touches the hull', () => {
    const w = openWorld();
    w.player.part = 'booster';
    hitPlayer(w, 0);
    expect(w.player.part).toBeNull();
    expect(w.player.hull).toBe(w.t.hull);
    w.player.invuln = 0;
    hitPlayer(w, 0);
    expect(w.player.hull).toBe(w.t.hull - 1);
  });
});

describe("the Burn (the Booster turns the Rip into the Rammer's charge)", () => {
  it('from rest, revving reaches Slipstream in about 0.6 s, in a locked line', () => {
    const w = openWorld();
    w.player.part = 'booster';
    const h0 = w.player.heading;
    const n = until(w, IN(0, 1, true), (w) => w.player.speed >= w.t.slipAt, 120);
    expect(n / 60).toBeGreaterThan(0.45);
    expect(n / 60).toBeLessThan(0.7);
    expect(w.player.heading).toBe(h0); // steering down did nothing: the heading is locked
    expect(w.player.rev).not.toBeNull();
  });

  it('releasing burns through at the tier you reached, piercing', () => {
    const w = openWorld();
    w.player.part = 'booster';
    Object.assign(w.player, { x: 1000, y: 2000 });
    until(w, IN(1, 0, true), (w) => w.player.speed >= 250, 120);
    const a = addRammer(w, w.player.x + 40, 2000, Math.PI), b = addRammer(w, w.player.x + 80, 2000, Math.PI);
    a.cd = b.cd = 99;
    const ev = tick(w, IN(1, 0, false));
    expect(ev.find((e) => e.k === 'rip')).toMatchObject({ burn: true, tier: 'slip' });
    for (let i = 0; i < 24; i++) tick(w, IN(1, 0));
    expect(a.hp).toBe(w.t.rammerHp - 2);
    expect(b.hp).toBe(w.t.rammerHp - 2);
  });

  it('revving into a wall stuns you, like a Rammer', () => {
    const w = openWorld();
    w.player.part = 'booster';
    Object.assign(w.player, { x: 150, y: 2000, heading: Math.PI });
    const ev: string[] = [];
    for (let i = 0; i < 90; i++) ev.push(...tick(w, IN(-1, 0, true)).map((e) => e.k));
    expect(ev).toContain('stun');
  });

  it('flat mode keeps the plain Rip with the Booster (the removal test A/B)', () => {
    const w = openWorld({ flat: true });
    w.player.part = 'booster';
    const ev = tick(w, IN(1, 0, true)).map((e) => e.k);
    expect(ev).toContain('rip');
    expect(w.player.rev).toBeNull();
  });
});
