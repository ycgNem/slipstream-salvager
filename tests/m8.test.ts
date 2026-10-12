// Milestone 8 (PLAN.md 9.5): The Compactor, a boss you take apart, and the six-yard run. Also the
// guards for the M6 review's sim bugs (a Spring Rammer bounces on every charge; nothing lifts you
// in the air).
import { describe, expect, it } from 'vitest';
import { FOUNDRY } from '../src/data/arena';
import { RUN_LENGTH, YARDS, type YardId } from '../src/data/yards';
import { beginBossWindup, bossChargeLength } from '../src/sim/compactor';
import { beginWindup } from '../src/sim/rammer';
import { finishYard, newRun, yardWorld } from '../src/sim/run';
import { addEnemy, addRammer, createWorld, giveBolted, type Enemy, type InputFrame, type World } from '../src/sim/world';
import { EAST, IDLE, IN, openArena, openWorld, tick } from './helpers';

const evs = (w: World, n: number, input: InputFrame = IDLE) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(...tick(w, input).map((e) => e.k));
  return out;
};

const box = (w = 400, h = 300) => createWorld({ sandbox: true, arena: openArena(w, h, { x: 200, y: 150, heading: 0 }) });

const ALL = ['booster', 'springs', 'plow'] as const;
const boss = (w: World, x: number, y: number, face: number, parts: readonly string[] = ALL): Enemy =>
  addEnemy(w, 'compactor', x, y, face, { parts: parts as never });

describe('The Compactor', () => {
  it('wears all three parts and has its hull', () => {
    const w = openWorld();
    const b = boss(w, 1200, 2000, Math.PI);
    expect(b.parts).toEqual({ rear: 'booster', sides: 'springs', front: 'plow' });
    expect(b.hp).toBe(w.t.compactorHp);
    expect(YARDS.compactor.waves).toHaveLength(1);
  });

  it('with the Booster it winds up a charge, locks it, and runs well past you', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, invuln: 999 });
    const b = boss(w, 1200, 2000, Math.PI);
    b.cd = 0;
    const ev = evs(w, 100);
    expect(ev).toContain('windup');
    expect(ev).toContain('lock');
    expect(ev).toContain('charge');
    expect(b.shove).toBe(false);
    expect(b.chargeLen).toBeGreaterThanOrEqual(w.t.bossChargeMin);
    expect(b.chargeLen).toBeLessThanOrEqual(w.t.bossChargeMax);
    expect(bossChargeLength(w, b)).toBeGreaterThan(0);
  });

  it('a charge into you is a hit', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const b = boss(w, 1150, 2000, Math.PI);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, shove: false, cd: 99 });
    evs(w, 40);
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('on its Springs its charge bounces off walls twice, then a wall stops it dead', () => {
    const w = box();
    Object.assign(w.player, { x: 60, y: 260, invuln: 999 });
    const b = boss(w, 200, 150, 0);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 5000, shove: false, bounces: 0, cd: 99 });
    const ev = evs(w, 240);
    expect(ev.filter((k) => k === 'boing')).toHaveLength(w.t.bossBounces);
    expect(ev).toContain('slam');
    expect(b.state).toBe('stunned');
  });

  it('without its Springs a charge into a wall stuns it, long', () => {
    const w = box();
    Object.assign(w.player, { x: 60, y: 260, invuln: 999 });
    const b = boss(w, 200, 150, 0, ['booster', 'plow']);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 5000, shove: false, cd: 99 });
    const ev = evs(w, 60);
    expect(ev).not.toContain('boing');
    expect(ev).toContain('slam');
    expect(b.state).toBe('stunned');
    expect(b.skidFor).toBe(w.t.bossWallStun);
  });

  it('without its Booster it only shoves, and not far', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, invuln: 999 });
    const b = boss(w, 1120, 2000, Math.PI, ['springs', 'plow']);
    b.cd = 0;
    const ev = evs(w, 60);
    expect(ev).toContain('windup');
    expect(b.shove).toBe(true);
    expect(b.chargeLen).toBe(w.t.bossShoveDist);
  });

  it('its plowed front takes nothing at Slipstream', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 220 });
    const b = boss(w, 1040, 2000, Math.PI);
    b.cd = 99;
    evs(w, 1, IN(1, 0, true));
    evs(w, 4, EAST);
    expect(b.hp).toBe(w.t.compactorHp);
    expect(b.parts.front).toBe('plow');
  });

  it('a joust into its charge tears the plow off', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 220 });
    const b = boss(w, 1080, 2000, Math.PI);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, shove: false, cd: 99 });
    const ev = [...evs(w, 1, IN(1, 0, true)), ...evs(w, 10, EAST)];
    expect(ev).toContain('joust');
    expect(ev).toContain('tear');
    expect(b.parts.front).toBeUndefined();
    expect(w.player.tow?.part).toBe('plow');
    expect(w.stats.hitsTaken).toBe(0);
  });

  it('skidding, a Slipstream hit in its back tears the booster (no damage), and the move is gone', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1080, y: 2000, heading: Math.PI, speed: 220 });
    const b = boss(w, 1040, 2000, Math.PI);
    Object.assign(b, { state: 'skid', t: 0, skidFor: 9, cd: 99 });
    const ev = [...evs(w, 1, IN(-1, 0, true)), ...evs(w, 4, IN(-1, 0))];
    expect(ev).toContain('tear');
    expect(b.parts.rear).toBeUndefined();
    expect(b.hp).toBe(w.t.compactorHp);
    beginBossWindup(w, b, false);
    expect(b.shove).toBe(true);
  });

  it('with all three off its core is open: it leaps like a Hopper, ring and all', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const b = boss(w, 1200, 2000, Math.PI, []);
    b.cd = 0;
    const ev = evs(w, 200);
    expect(ev).toContain('hop');
    expect(ev).toContain('land');
    expect(b.leap || b.state === 'land' || b.state === 'stalk').toBe(true);
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('it ploughs through other enemies: they recoil, it does not', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2300, invuln: 999 });
    const b = boss(w, 1000, 2000, 0);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, shove: false, cd: 99 });
    const r = addRammer(w, 1050, 2000, 0);
    r.cd = 99;
    const ev = evs(w, 10);
    expect(ev).toContain('slam');
    expect(b.state).toBe('charge');
    expect(r.state).toBe('skid');
  });

  it('calls a Snapper in through the farthest gate, if fewer than two others are in the yard', () => {
    const w = createWorld({ sandbox: true, arena: FOUNDRY });
    Object.assign(w.player, { x: 100, y: 180, invuln: 999 });
    const b = boss(w, 320, 180, 0);
    Object.assign(b, { aux: 1 / 60, cd: 99 });
    const ev = evs(w, 2);
    expect(ev).toContain('call');
    expect(w.enemies.filter((e) => e.kind === 'snapper')).toHaveLength(1);
    expect(w.enemies[1].x).toBeGreaterThan(500);
    // two others already: no call
    addEnemy(w, 'snapper', 320, 300);
    b.aux = 1 / 60;
    expect(evs(w, 2)).not.toContain('call');
    expect(w.enemies).toHaveLength(3);
  });
});

describe('the six-yard run', () => {
  it('The Heap leads only to The Compactor, and clearing its yard wins the run', () => {
    const r = newRun(5, 'heap');
    expect(r.depth).toBe(RUN_LENGTH - 1);
    expect(r.options).toEqual(['compactor']);
    const w = yardWorld(r);
    w.result = 'exit';
    w.exits = w.exitPlan;
    w.exitChoice = 0;
    finishYard(r, w);
    expect(r.yard).toBe('compactor');
    expect(r.depth).toBe(RUN_LENGTH);
    expect(r.options).toEqual([]);
    const w2 = yardWorld(r);
    for (let i = 0; i < 600 && !w2.enemies.length; i++) tick(w2, IDLE);
    expect(w2.enemies.map((e) => e.kind)).toEqual(['compactor']);
    w2.enemies.length = 0;
    const ev = evs(w2, 2);
    expect(ev).toContain('cleared');
    finishYard(r, w2);
    expect(r.over).toBe('won');
  });
});

describe('the M6 review fixes', () => {
  it('a Spring Rammer bounces on every charge, not just its first', () => {
    const w = box();
    Object.assign(w.player, { x: 100, y: 250, invuln: 999 });
    const r = addRammer(w, 340, 150, 0, { parts: ['booster', 'springs'] });
    // as after a first charge that bounced
    r.bounces = 1;
    beginWindup(w, r, false);
    Object.assign(r, { state: 'charge', t: 0, travelled: 0, chargeLen: 200, cd: 99 });
    expect(evs(w, 10)).toContain('boing');
  });

  it("a passing charge's slipstream doesn't lift you in the air", () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: Math.PI / 2, speed: 150, air: { t: 0, dur: 9, tier: 'cruise', slam: true } });
    const r = addRammer(w, 1000 - 40, 2000 - 22, 0);
    Object.assign(r, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, cd: 99 });
    const ev = evs(w, 20);
    expect(ev).not.toContain('draft');
    expect(w.player.speed).toBeLessThan(w.t.slipAt);
  });

  it('every yard hits a player who parks at the start (Bouncers no longer cancel each other)', () => {
    const safe: string[] = [];
    for (const id of Object.keys(YARDS) as YardId[]) {
      const w = yardWorld(newRun(3, id));
      for (let i = 0; i < 60 * 60 && !w.result; i++) tick(w, IDLE);
      if (w.stats.hitsTaken < 2 && w.result !== 'scrapped') safe.push(`${id}: ${w.stats.hitsTaken} hits in 60 s`);
    }
    expect(safe).toEqual([]);
  });

  it('a Bouncer keeps its distance and rolls from there', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, invuln: 999 });
    const b = addEnemy(w, 'bouncer', 1040, 2000, Math.PI);
    b.cd = 99;
    evs(w, 120);
    expect(Math.hypot(b.x - 1000, b.y - 2000)).toBeGreaterThan(w.t.bouncerKeep - 40);
  });

  it("a Bouncer won't start a roll into another enemy", () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, invuln: 999 });
    const b = addEnemy(w, 'bouncer', 1150, 2000, Math.PI);
    const o = addRammer(w, 1110, 2000, Math.PI / 2);
    o.cd = 99;
    b.cd = 0;
    const ev = evs(w, 2);
    expect(ev).not.toContain('windup');
    expect(b.state).toBe('stalk');
  });

  it('a rev held past revMax launches the Burn on its own', () => {
    const w = openWorld();
    giveBolted(w, 'booster');
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 150 });
    const ev = evs(w, Math.ceil(w.t.revMax * 60) + 3, IN(1, 0, true));
    expect(ev).toContain('rip');
    expect(w.player.rev).toBeNull();
    expect(w.player.rip?.burn || w.player.ripCd > 0).toBe(true);
  });

  it('with Springs, a wall bounce mid-rev fires the Burn along the new line', () => {
    const w = box();
    giveBolted(w, 'booster');
    giveBolted(w, 'springs');
    Object.assign(w.player, { x: 340, y: 150, heading: 0, speed: 200, rev: w.t.burnTapTime + 0.05 });
    const ev = evs(w, 30, IN(1, 0, true));
    expect(ev).toContain('boing');
    expect(ev).toContain('rip');
    expect(ev.indexOf('rip')).toBeGreaterThanOrEqual(ev.indexOf('boing'));
  });

  it('a charge still hits you if your rev only shoved it at Cruise', () => {
    const w = openWorld();
    giveBolted(w, 'booster');
    Object.assign(w.player, { x: 1000, y: 2000, heading: -Math.PI / 2, speed: 130, rev: w.t.burnTapTime + 0.05 });
    // close by its side, so the touch fires the Burn at Cruise: a shove, which used to count as
    // having beaten the charge
    const r = addRammer(w, 975, 2000, 0);
    Object.assign(r, { state: 'charge', t: 0, travelled: 0, chargeLen: 300, cd: 99 });
    evs(w, 30, IN(0, -1, true));
    expect(w.stats.hitsTaken).toBe(1);
  });

  it("a Hopper's ring is under a steady straight line at any speed", () => {
    for (const v of [140, 200, 240]) {
      const w = openWorld();
      Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: v });
      const h = addEnemy(w, 'hopper', 1120, 1880, Math.PI / 2);
      h.cd = 0;
      // hold the line (no steering input changes it) at that speed
      for (let i = 0; i < 120 && !w.stats.hitsTaken; i++) {
        w.player.speed = v;
        tick(w, IN(1, 0));
      }
      expect(w.stats.hitsTaken, `at ${v} px/s`).toBe(1);
    }
  });

  it('coming down on a big block puts you at its edge along your line, never round its side', () => {
    const w = openWorld();
    const block = { x: 1100, y: 1940, w: 96, h: 120 };
    w.arena.pillars.push(block);
    w.arena.solids.push(block);
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1060, y: 2010, heading: 0, speed: 230 });
    w.player.rev = w.t.burnTapTime;
    evs(w, 1, IN(1, 0, false));
    let down = false;
    for (let i = 0; i < 40 && !down; i++) down = tick(w, IDLE).some((e) => e.k === 'touchdown');
    expect(down).toBe(true);
    expect(Math.abs(w.player.y - 2010)).toBeLessThan(1);
    const r = w.t.playerRadius, x = w.player.x;
    expect(x <= block.x - r + 0.5 || x >= block.x + block.w + r - 0.5).toBe(true);
  });
});

describe('the M8 review fixes (DECISIONS #97)', () => {
  it("can't be wrecked while it wears a part: its yard is under the safety net", () => {
    const w = yardWorld(newRun(2, 'compactor'));
    for (let i = 0; i < 600 && !w.enemies.length; i++) tick(w, IDLE);
    const b = w.enemies[0];
    expect(b.safety).toBe(true);
    // as if it had been worn down: its side hits can't finish it while its springs are on
    Object.assign(w.player, { x: b.x + 40, y: b.y, heading: Math.PI, speed: 220, invuln: 999 });
    b.hp = 1;
    Object.assign(b, { state: 'stunned', t: 0, skidFor: 9, cd: 99, face: -Math.PI / 2, parts: { sides: 'springs' } });
    tick(w, IN(-1, 0, true));
    evs(w, 4, IN(-1, 0));
    expect(w.enemies.includes(b)).toBe(true);
  });

  it('wrecking it takes the Snappers it called down with it, and the yard clears', () => {
    const r = newRun(2, 'compactor');
    const w = yardWorld(r);
    for (let i = 0; i < 600 && !w.enemies.length; i++) tick(w, IDLE);
    const b = w.enemies[0];
    addEnemy(w, 'snapper', 100, 100);
    addEnemy(w, 'snapper', 500, 300);
    Object.assign(b, { parts: {}, safety: false, hp: 1, state: 'stunned', t: 0, skidFor: 9, cd: 99 });
    Object.assign(w.player, { x: b.x - Math.cos(b.face) * 45, y: b.y - Math.sin(b.face) * 45, heading: b.face, speed: 220, invuln: 999 });
    const ev = [...evs(w, 1, IN(Math.cos(b.face), Math.sin(b.face), true)), ...evs(w, 6, IN(Math.cos(b.face), Math.sin(b.face)))];
    expect(ev.filter((k) => k === 'wreck').length).toBe(3);
    expect(w.enemies).toHaveLength(0);
    evs(w, 2);
    expect(w.result).toBe('cleared');
  });

  it('core open and stuck after a landing, every side is its back', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1040, y: 2000, heading: Math.PI, speed: 220 });
    const b = boss(w, 1000, 2000, Math.PI, []);
    Object.assign(b, { state: 'land', t: 0, skidFor: 9, cd: 99 });
    // you hit its front; it counts as its back
    evs(w, 1, IN(-1, 0, true));
    evs(w, 4, IN(-1, 0));
    expect(b.hp).toBe(w.t.compactorHp - w.t.rearDamage);
  });

  it('on its Springs its shove bounces off a wall once', () => {
    const w = box();
    Object.assign(w.player, { x: 60, y: 260, invuln: 999 });
    const b = boss(w, 330, 150, 0, ['springs', 'plow']);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, shove: true, bounces: 0, cd: 99 });
    expect(evs(w, 30).filter((k) => k === 'boing')).toHaveLength(1);
  });

  it('a crusher plate only presses what is slow: at Cruise you are over it', () => {
    const plate = (speed: number) => {
      const w = createWorld({ sandbox: true, arena: { ...openArena(), floor: [{ kind: 'crusher', rect: { x: 984, y: 1984, w: 32, h: 32 }, phase: 0 }] } });
      Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed });
      w.tick = Math.round(w.t.crusherPeriod * 60) - 1;
      tick(w, IN(0, 0));
      return w.stats.hitsTaken;
    };
    expect(plate(40)).toBe(1);
    expect(plate(150)).toBe(0);
  });

  it('a charge through a Snapper is one slam, not one a tick', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2400, invuln: 999 });
    const b = boss(w, 1000, 2000, 0);
    Object.assign(b, { state: 'charge', t: 0, travelled: 0, chargeLen: 400, shove: false, cd: 99 });
    const s = addEnemy(w, 'snapper', 1040, 2000);
    s.cd = 99;
    expect(evs(w, 20).filter((k) => k === 'slam')).toHaveLength(1);
  });
});

