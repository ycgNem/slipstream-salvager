// Milestone 6 (PLAN.md 9.1-9.2): the Hopper and the Jump Jets, the Bouncer and the Springs.
import { describe, expect, it } from 'vitest';
import { addEnemy, addRammer, createWorld, giveBolted, type InputFrame, type World } from '../src/sim/world';
import { attackMode } from '../src/sim/body';
import { crouched, landingPoint } from '../src/sim/rip';
import { EAST, IDLE, IN, openArena, openWorld, tick } from './helpers';

const evs = (w: World, n: number, input: InputFrame | ((w: World) => InputFrame) = IDLE) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(...tick(w, typeof input === 'function' ? input(w) : input).map((e) => e.k));
  return out;
};

/** A small walled box, for things that bounce off walls. */
const box = (w = 400, h = 300, start = { x: 200, y: 150, heading: 0 }) => createWorld({ sandbox: true, arena: openArena(w, h, start) });

describe('the Hopper', () => {
  it('crouches with a ring where you stand, leaps and slams you if you stay in it', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const h = addEnemy(w, 'hopper', 1150, 2000, Math.PI);
    h.cd = 0;
    const ev = evs(w, 120);
    expect(ev).toContain('windup');
    expect(ev).toContain('lock');
    expect(ev).toContain('hop');
    expect(ev).toContain('land');
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('a slam that only just misses you lifts you to Slipstream (the shockwave)', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000 + w.t.hopSlamR + 12, y: 2000, heading: Math.PI / 2, speed: 120 });
    const h = addEnemy(w, 'hopper', 1000, 2000, 0);
    Object.assign(h, { state: 'air', t: w.t.hopAir - 1 / 60, sx: 1000, sy: 1900, tx: 1000, ty: 2000, stomp: false, cd: 99 });
    const ev = evs(w, 2);
    expect(ev).toContain('land');
    expect(ev).toContain('draft');
    expect(w.stats.hitsTaken).toBe(0);
    expect(w.player.speed).toBeGreaterThanOrEqual(w.t.slipAt);
  });

  it('driving out of the ring once it locks dodges the slam', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const h = addEnemy(w, 'hopper', 1150, 2000, Math.PI);
    h.cd = 0;
    let locked = false;
    for (let i = 0; i < 120; i++) {
      const ev = tick(w, locked ? IN(0, 1) : IDLE);
      if (ev.some((e) => e.k === 'lock')) locked = true;
    }
    expect(locked).toBe(true);
    expect(w.stats.hitsTaken).toBe(0);
  });

  it('in the air it touches nothing and a Rip passes under it', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 220 });
    const h = addEnemy(w, 'hopper', 1030, 2000, Math.PI);
    Object.assign(h, { state: 'air', t: 0, sx: 1030, sy: 2000, tx: 1030, ty: 1900, stomp: false, cd: 99 });
    const ev = [...evs(w, 1, IN(1, 0, true)), ...evs(w, 6, EAST)];
    expect(ev).not.toContain('hit');
    expect(ev).not.toContain('tear');
    expect(ev).not.toContain('bump');
  });

  it('stuck after landing, a Slipstream hit in its back tears its jets off', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1060, y: 2000, heading: Math.PI, speed: 220 });
    const h = addEnemy(w, 'hopper', 1030, 2000, Math.PI);
    Object.assign(h, { state: 'land', t: 0, skidFor: 9, cd: 99 });
    const ev = [...evs(w, 1, IN(-1, 0, true)), ...evs(w, 4, IN(-1, 0))];
    expect(ev).toContain('tear');
    expect(h.parts.rear).toBeUndefined();
    expect(w.player.tow?.part).toBe('jets');
    expect(h.hp).toBe(w.t.hopperHp);
  });

  it('a Cruise hit cancels its crouch', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 150 });
    const h = addEnemy(w, 'hopper', 1030, 2000, Math.PI);
    Object.assign(h, { state: 'windup', t: 0, windup: 0.6, lock: 0.25, cd: 99 });
    const ev = [...evs(w, 1, IN(1, 0, true)), ...evs(w, 4, EAST)];
    expect(ev).toContain('cancel');
    expect(h.state).toBe('stalk');
  });

  it('too close to leap, it stomps where it stands', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const h = addEnemy(w, 'hopper', 1030, 2000, Math.PI);
    h.cd = 0;
    evs(w, 2);
    expect(h.state).toBe('windup');
    expect(h.stomp).toBe(true);
    expect(Math.hypot(h.tx - h.x, h.ty - h.y)).toBe(0);
    evs(w, 60);
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('stripped of its jets it never leaps', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, invuln: 99 });
    const h = addEnemy(w, 'hopper', 1150, 2000, Math.PI, { parts: [] });
    h.cd = 0;
    let leaps = 0;
    for (let i = 0; i < 600; i++) {
      tick(w, IDLE);
      if (h.state === 'windup' && !h.stomp) leaps++;
    }
    expect(leaps).toBe(0);
  });

  it('leaps over a pillar that is between you', () => {
    const arena = openArena();
    arena.pillars.push({ x: 1060, y: 1984, w: 32, h: 32 });
    arena.solids.push(arena.pillars[0]);
    const w = createWorld({ sandbox: true, arena });
    Object.assign(w.player, { x: 1000, y: 2000 });
    const h = addEnemy(w, 'hopper', 1160, 2000, Math.PI);
    h.cd = 0;
    evs(w, 90);
    expect(h.x).toBeLessThan(1060);
  });
});

describe('the Jump Jets', () => {
  it('replace what holding Rip does: hold to crouch (speed held, ring ahead), let go to leap', () => {
    const w = openWorld();
    giveBolted(w, 'jets');
    expect(attackMode(w)).toBe('leap');
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 200 });
    evs(w, 20, IN(1, 0, true));
    expect(crouched(w)).toBe(true);
    expect(w.player.speed).toBeGreaterThan(195);
    expect(landingPoint(w).x).toBeGreaterThan(1000 + 200 * w.t.leapAir);
    const ev = evs(w, 1, IN(1, 0, false));
    expect(ev).toContain('leap');
    expect(w.player.air).not.toBeNull();
  });

  it('a tap is still a plain Rip', () => {
    const w = openWorld();
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 200 });
    const ev = [...evs(w, 2, IN(1, 0, true)), ...evs(w, 2, EAST)];
    expect(ev).toContain('rip');
    expect(ev).not.toContain('leap');
  });

  it('in the air a charge passes under you', () => {
    const w = openWorld();
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1000, y: 2000, heading: -Math.PI / 2, speed: 150 });
    const r = addRammer(w, 1080, 2000, Math.PI);
    Object.assign(r, { state: 'charge', t: 0, travelled: 0, chargeLen: 300, cd: 99 });
    w.player.air = { t: 0, dur: w.t.leapAir, tier: 'cruise' };
    evs(w, 20);
    expect(w.stats.hitsTaken).toBe(0);
  });

  it('land behind a Rammer at Slipstream and its booster comes off', () => {
    const w = openWorld();
    giveBolted(w, 'jets');
    const v = 230, d = v * w.t.leapAir;
    Object.assign(w.player, { x: 1112 - d, y: 2000, heading: 0, speed: v });
    const r = addRammer(w, 1100, 2000, Math.PI);
    Object.assign(r, { state: 'skid', t: 0, skidFor: 9, cd: 99 });
    w.player.rev = w.t.burnTapTime;
    const ev = [...evs(w, 1, IN(1, 0, false)), ...evs(w, 30)];
    expect(ev).toContain('touchdown');
    expect(ev).toContain('tear');
    expect(r.parts.rear).toBeUndefined();
    expect(w.player.tow?.part).toBe('booster');
  });

  it('the landing sticks you: no control for a moment, and 15% of your speed gone', () => {
    const w = openWorld();
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 220 });
    w.player.rev = w.t.burnTapTime;
    tick(w, IN(1, 0, false));
    const ev: string[] = [];
    while (w.player.air) ev.push(...tick(w, IDLE).map((e) => e.k));
    expect(ev).toContain('touchdown');
    expect(w.player.recoil).toBeGreaterThan(0);
    expect(w.player.speed).toBeCloseTo(220 * w.t.leapKeep, 0);
  });

  it('you sail over pillars and come down clear of them', () => {
    const arena = openArena();
    arena.pillars.push({ x: 1040, y: 1984, w: 32, h: 32 });
    arena.solids.push(arena.pillars[0]);
    const w = createWorld({ sandbox: true, arena });
    giveBolted(w, 'jets');
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 230 });
    w.player.rev = w.t.burnTapTime;
    tick(w, IN(1, 0, false));
    while (w.player.air) tick(w, IDLE);
    expect(w.player.x).toBeGreaterThan(1072 + w.t.playerRadius - 1);
  });

  it('do nothing in flat mode (a hold is a plain Rip)', () => {
    const w = openWorld({ flat: true });
    giveBolted(w, 'jets');
    expect(attackMode(w)).toBe('rip');
  });
});

describe('the Bouncer', () => {
  it('rolls, bounces off a wall faster, and ends dizzy', () => {
    const w = box();
    Object.assign(w.player, { x: 300, y: 150, invuln: 999 });
    const b = addEnemy(w, 'bouncer', 120, 150, 0);
    b.cd = 0;
    let bounced = 0, top = 0;
    const states = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const ev = tick(w, IDLE);
      bounced += ev.filter((e) => e.k === 'boing').length;
      top = Math.max(top, b.speed);
      states.add(b.state);
    }
    expect(states).toContain('roll');
    expect(bounced).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(w.t.rollSpeed);
    expect(states).toContain('stunned');
  });

  it('a rolling Bouncer is a lunge: it hits you', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000 });
    const b = addEnemy(w, 'bouncer', 1060, 2000, Math.PI);
    Object.assign(b, { state: 'roll', t: 0, speed: 230, cd: 99 });
    evs(w, 20);
    expect(w.stats.hitsTaken).toBe(1);
  });

  it('a Slipstream hit on its side tears its springs; stripped, a wall stops it dead', () => {
    const w = openWorld();
    Object.assign(w.player, { x: 1000, y: 2000, heading: 0, speed: 220 });
    const b = addEnemy(w, 'bouncer', 1030, 2000, -Math.PI / 2);
    Object.assign(b, { state: 'stunned', t: 0, skidFor: 9, cd: 99 });
    const ev = [...evs(w, 1, IN(1, 0, true)), ...evs(w, 4, EAST)];
    expect(ev).toContain('tear');
    expect(b.parts.sides).toBeUndefined();
    expect(w.player.tow?.part).toBe('springs');
    const w2 = box();
    Object.assign(w2.player, { x: 100, y: 250, invuln: 999 });
    const s = addEnemy(w2, 'bouncer', 340, 150, 0, { parts: [] });
    Object.assign(s, { state: 'roll', t: 0, speed: 230, cd: 99 });
    const ev2 = evs(w2, 30);
    expect(ev2).toContain('slam');
    expect(ev2).not.toContain('boing');
    expect(s.state).toBe('stunned');
  });
});

describe('the Springs', () => {
  it('a head-on wall hit bounces you off at speed instead of clanking', () => {
    const w = box();
    giveBolted(w, 'springs');
    Object.assign(w.player, { x: 340, y: 150, heading: 0, speed: 230 });
    const ev: string[] = [];
    for (let i = 0; i < 30 && !ev.includes('boing'); i++) ev.push(...evs(w, 1, EAST));
    expect(ev).toContain('boing');
    expect(ev).not.toContain('clank');
    expect(w.player.speed).toBeGreaterThanOrEqual(230);
    expect(Math.cos(w.player.heading)).toBeLessThan(-0.95);
  });

  it('without them it is a clank and most of your speed is gone', () => {
    const w = box();
    Object.assign(w.player, { x: 340, y: 150, heading: 0, speed: 230 });
    const ev = evs(w, 12, EAST);
    expect(ev).toContain('clank');
    expect(w.player.speed).toBeLessThan(w.t.cruiseAt);
  });

  it('a Burn into a wall bounces and keeps going (no wall stun)', () => {
    const w = box();
    giveBolted(w, 'booster');
    giveBolted(w, 'springs');
    Object.assign(w.player, { x: 340, y: 150, heading: 0, speed: 200 });
    w.player.rev = 0.3;
    const ev = [...evs(w, 1, IN(1, 0, false)), ...evs(w, 20, EAST)];
    expect(ev).toContain('boing');
    expect(ev).not.toContain('stun');
    expect(w.player.stun).toBe(0);
  });

  it('the route: pushing on into the walls holds Slipstream with Springs, and not without', () => {
    const pinball = (springs: boolean) => {
      const w = box(420, 200, { x: 210, y: 100, heading: 0 });
      if (springs) giveBolted(w, 'springs');
      for (let i = 0; i < 1200; i++) tick(w, IN(Math.cos(w.player.heading) >= 0 ? 1 : -1, 0));
      const tt = w.stats.tierTicks;
      return tt.slip / (tt.slip + tt.cruise + tt.crawl);
    };
    const withS = pinball(true), without = pinball(false);
    expect(withS).toBeGreaterThan(0.6);
    expect(withS).toBeGreaterThan(without + 0.3);
  });
});

describe('the Spring Rammer', () => {
  it('its charge bounces off the first wall and carries on', () => {
    const w = box();
    Object.assign(w.player, { x: 100, y: 250, invuln: 999 });
    const r = addRammer(w, 340, 150, 0, { parts: ['booster', 'springs'] });
    Object.assign(r, { state: 'charge', t: 0, travelled: 0, chargeLen: 200, cd: 99 });
    const ev = evs(w, 10);
    expect(ev).toContain('boing');
    expect(r.state).toBe('charge');
    expect(Math.cos(r.face)).toBeLessThan(-0.9);
  });
});
