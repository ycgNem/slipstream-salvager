// Milestone 7 (PLAN.md 9.4): terrain. Boost strips, oil, jump ramps and crusher plates, for you and
// the enemies where the plan says so.
import { describe, expect, it } from 'vitest';
import type { FloorPatch } from '../src/data/arena';
import { addEnemy, addRammer, createWorld, giveBolted, type InputFrame, type World } from '../src/sim/world';
import { crusherState } from '../src/sim/terrain';
import { IDLE, IN, openArena, tick } from './helpers';

const evs = (w: World, n: number, input: InputFrame = IDLE) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(...tick(w, input).map((e) => e.k));
  return out;
};

/** An open arena with some terrain on its floor. */
function withFloor(floor: FloorPatch[], obstacles: { x: number; y: number; w: number; h: number }[] = []): World {
  const arena = openArena();
  arena.floor = floor;
  for (const o of obstacles) {
    arena.pillars.push(o);
    arena.solids.push(o);
  }
  return createWorld({ sandbox: true, arena });
}

describe('boost strips', () => {
  it('lift you to boostTo while you drive along the arrow', () => {
    const w = withFloor([{ kind: 'boost', rect: { x: 1000, y: 1984, w: 160, h: 32 }, dir: 0 }]);
    Object.assign(w.player, { x: 990, y: 2000, heading: 0, speed: 120 });
    const ev = evs(w, 10, IN(1, 0));
    expect(ev).toContain('boost');
    expect(w.player.speed).toBeGreaterThanOrEqual(w.t.boostTo - 1);
  });

  it('do nothing driving across or against them', () => {
    const w = withFloor([{ kind: 'boost', rect: { x: 1000, y: 1984, w: 160, h: 32 }, dir: 0 }]);
    Object.assign(w.player, { x: 1150, y: 2000, heading: Math.PI, speed: 120 });
    const ev = evs(w, 10, IN(-1, 0));
    expect(ev).not.toContain('boost');
    expect(w.player.speed).toBeLessThan(w.t.boostTo - 50);
  });

  it('speed up a hunting Snapper going their way', () => {
    const w = withFloor([{ kind: 'boost', rect: { x: 1000, y: 1984, w: 320, h: 32 }, dir: 0 }]);
    Object.assign(w.player, { x: 1500, y: 2000, invuln: 99 });
    const s = addEnemy(w, 'snapper', 1010, 2000, 0);
    Object.assign(s, { speed: 100, cd: 99 });
    evs(w, 5);
    expect(s.speed).toBeGreaterThanOrEqual(w.t.boostEnemy);
  });
});

describe('oil', () => {
  const lake: FloorPatch = { kind: 'oil', rect: { x: 900, y: 1800, w: 400, h: 400 } };

  it('takes your grip: you keep your line and nearly all your speed, whatever you steer', () => {
    const w = withFloor([lake]);
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 200 });
    evs(w, 30, IN(0, 1));
    expect(Math.abs(Math.sin(w.player.heading))).toBeLessThan(0.01);
    expect(w.player.speed).toBeGreaterThan(200 * 0.85);
    // and pushing against your motion doesn't brake you
    evs(w, 10, IN(-1, 0));
    expect(w.player.speed).toBeGreaterThan(150);
  });

  it("the Booster's rev still pushes (it's a rocket)", () => {
    const w = withFloor([lake]);
    giveBolted(w, 'booster');
    Object.assign(w.player, { x: 920, y: 2000, heading: 0, speed: 100 });
    w.player.rev = w.t.burnTapTime;
    evs(w, 20, IN(1, 0, true));
    expect(w.player.speed).toBeGreaterThan(150);
  });

  it("a Snapper on oil can't turn", () => {
    const w = withFloor([lake]);
    Object.assign(w.player, { x: 1100, y: 1700, invuln: 99 });
    const s = addEnemy(w, 'snapper', 950, 2000, 0);
    Object.assign(s, { speed: 150, cd: 99 });
    evs(w, 20);
    expect(Math.abs(Math.sin(s.face))).toBeLessThan(0.01);
  });
});

describe('jump ramps', () => {
  const wall = { x: 1100, y: 1900, w: 16, h: 200 };

  it('throw you over a low wall at speed, and the landing is clean', () => {
    const w = withFloor([{ kind: 'ramp', rect: { x: 1040, y: 1984, w: 32, h: 32 }, dir: 0 }], [wall]);
    Object.assign(w.player, { x: 1030, y: 2000, heading: 0, speed: 220 });
    const ev = evs(w, 40, IN(1, 0));
    expect(ev).toContain('leap');
    expect(ev).toContain('touchdown');
    expect(w.player.x).toBeGreaterThan(wall.x + wall.w + w.t.playerRadius);
    expect(w.player.recoil).toBe(0);
  });

  it("don't launch you at a crawl", () => {
    const w = withFloor([{ kind: 'ramp', rect: { x: 1040, y: 1984, w: 32, h: 32 }, dir: 0 }], [wall]);
    Object.assign(w.player, { x: 1030, y: 2000, heading: 0, speed: 60 });
    const ev = evs(w, 30, IN(0.4, 0));
    expect(ev).not.toContain('leap');
    expect(w.player.x).toBeLessThan(wall.x);
  });

  it('with the Jump Jets on, a ramp landing is their hit', () => {
    const w = withFloor([{ kind: 'ramp', rect: { x: 1040, y: 1984, w: 32, h: 32 }, dir: 0 }]);
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1030, y: 2000, heading: 0, speed: 230 });
    const r = addRammer(w, 1030 + 230 * w.t.rampAir + 4, 2000, Math.PI, { booster: false });
    Object.assign(r, { state: 'skid', t: 0, skidFor: 9, cd: 99 });
    const ev = evs(w, 30, IN(1, 0));
    expect(ev).toContain('touchdown');
    expect(ev).toContain('hit');
  });
});

describe('crusher plates', () => {
  const plate: FloorPatch = { kind: 'crusher', rect: { x: 984, y: 1984, w: 32, h: 32 }, phase: 0 };

  it('warn before they slam, on a fixed beat', () => {
    const w = withFloor([plate]);
    const per = Math.round(w.t.crusherPeriod * 60);
    w.tick = per - 10;
    expect(crusherState(w, plate).state).toBe('warn');
    w.tick = per;
    expect(crusherState(w, plate).slam).toBe(true);
    w.tick = per + 60;
    expect(crusherState(w, plate).state).toBe('idle');
  });

  it('hit you if you stand on one when it slams', () => {
    const w = withFloor([plate]);
    Object.assign(w.player, { x: 1000, y: 2000 });
    w.tick = Math.round(w.t.crusherPeriod * 60) - 5;
    const ev = evs(w, 10);
    expect(ev).toContain('press');
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('wreck a Snapper on one, and leave a Rammer at 1', () => {
    const w = withFloor([plate, { ...plate, rect: { x: 1084, y: 1984, w: 32, h: 32 } }]);
    Object.assign(w.player, { x: 1500, y: 2000, invuln: 99 });
    const s = addEnemy(w, 'snapper', 1000, 2000, 0);
    const r = addRammer(w, 1100, 2000, 0);
    for (const e of [s, r]) Object.assign(e, { state: 'stunned', t: 0, skidFor: 9, cd: 99 });
    r.state = 'skid';
    w.tick = Math.round(w.t.crusherPeriod * 60) - 2;
    const ev = evs(w, 4);
    expect(ev).toContain('wreck');
    expect(w.enemies).not.toContain(s);
    expect(r.hp).toBe(w.t.rammerHp - w.t.crusherDamage);
  });

  it("can't touch you in the air", () => {
    const w = withFloor([plate]);
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 10 });
    w.player.air = { t: 0, dur: 1, tier: 'crawl', slam: false };
    w.tick = Math.round(w.t.crusherPeriod * 60) - 2;
    evs(w, 4);
    expect(w.stats.hitsTaken).toBe(0);
  });
});
