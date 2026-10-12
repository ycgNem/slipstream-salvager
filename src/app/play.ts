// A run on screen (PLAN.md 8.1): runs the current yard's sim from input, turns its events into
// effects and sound, draws the world, the HUD, hints and the exit signs, wipes from yard to yard,
// and shows the pause and run-results overlays.
import { C } from '../data/palette';
import { DEBUG_KEYS, keyLabel, type Input } from '../engine/input';
import type { Audio } from '../engine/audio/audio';
import { Fx } from '../render/fx';
import { drawWorld, playerSprite } from '../render/renderer';
import { giveBolted, hasBooster, maxHpOf, type Bolted, type InputFrame, type World } from '../sim/world';
import { finishYard, newRun, yardWorld, type Run } from '../sim/run';
import { RUN_LENGTH, YARDS, type YardId } from '../data/yards';
import { CHASSIS, type ChassisId } from '../data/chassis';
import { signLayout } from '../ui/signs';
import { PARTS, PART_IDS, type PartId } from '../data/parts';
import { drawSprite, sprite } from '../render/atlas';
import { crack } from '../render/pixgeom';
import { textWidth } from '../ui/font';
import { step } from '../sim/tick';
import { revving } from '../sim/rip';
import type { SimEvent } from '../sim/events';
import { drawHud } from '../ui/hud';
import { Hints } from '../ui/hints';
import type { UI } from '../ui/ui';
import { LIVE, liveOverrides, TuningPanel } from './tuning';
import { loadBest, loadSeenHints, saveBest, saveSeenHints, type Settings } from './settings';

/** seconds the wipe between yards takes */
const WIPE = 0.8;
/** how much of the screen the wipe covers, 0..1, t seconds in */
const wipeCover = (t: number) => (t / WIPE < 0.5 ? (t / WIPE) * 2 : (1 - t / WIPE) * 2);

export interface PlayHost {
  input: Input;
  audio: Audio;
  settings: Settings;
  toTitle(): void;
  openSettings(): void;
}

/** ?yard=kennel (debug builds): start a run in that yard, for testing and the screenshot sweep */
function startYard(): YardId {
  if (!DEBUG_KEYS || typeof location === 'undefined') return 'ring';
  const y = new URLSearchParams(location.search).get('yard');
  return y && y in YARDS ? (y as YardId) : 'ring';
}

/** ?chassis=skiff (debug builds): drive that body */
function startChassis(): ChassisId {
  if (!DEBUG_KEYS || typeof location === 'undefined') return 'scrapper';
  const c = new URLSearchParams(location.search).get('chassis');
  return c && c in CHASSIS ? (c as ChassisId) : 'scrapper';
}

export class Play {
  run: Run;
  world: World;
  /** the wipe between yards: seconds in, and whether the next yard is in yet */
  wipe: { t: number; swapped: boolean } | null = null;
  /** the run's end has been recorded */
  private runDone = false;
  fx = new Fx();
  hints: Hints;
  tuning = new TuningPanel();
  paused = false;
  /** results overlay shows this long after the encounter ends */
  endT = 0;
  /** button presses waiting for the next tick that actually runs */
  private ripLatch = false;
  private boltLatch = false;
  private afterTick = 0;
  time = 0;
  /** freeze the sim (screenshots) */
  frozen = false;
  /** this run counts toward the best record (the screenshot scenes turn it off) */
  record = true;
  /** the run has been counted (on its first tick) */
  private counted = false;
  /** events from the last ticks (e2e inspection) */
  recent: SimEvent[] = [];
  /** a scripted player (src/sim/bots.ts) drives instead of the input, for e2e and the critic */
  autopilot: ((w: World) => InputFrame) | null = null;

  constructor(private host: PlayHost, seed = (Math.random() * 1e9) | 0, start: YardId = startYard(), chassis: ChassisId = startChassis()) {
    this.run = newRun(seed, start, { chassis });
    this.world = yardWorld(this.run, { tuning: liveOverrides(), flat: LIVE.flat });
    for (const id of LIVE.parts) giveBolted(this.world, id);
    this.hints = new Hints(loadSeenHints(), host.settings.hints);
    this.hints.onSeen = saveSeenHints;
  }

  /** The next yard: fold this one into the run and build the next world (mid-wipe). */
  private nextYard() {
    finishYard(this.run, this.world);
    this.world = yardWorld(this.run, { tuning: liveOverrides(), flat: LIVE.flat });
    this.fx.parts.length = 0;
    this.fx.marks.length = 0;
    this.fx.after.length = 0;
    this.fx.flash.clear();
    this.endT = 0;
  }

  /** The run is over (won or scrapped): fold in the last yard and record the best. */
  private endRun() {
    if (this.runDone) return;
    this.runDone = true;
    finishYard(this.run, this.world);
    if (!this.record) return;
    const b = loadBest(), r = this.run;
    const yards = r.over === 'won' ? RUN_LENGTH : r.depth - 1;
    b.bestYards = Math.max(b.bestYards, yards);
    if (r.over === 'won') {
      b.wins++;
      if (!b.bestWinTicks || r.totals.ticks < b.bestWinTicks) b.bestWinTicks = r.totals.ticks;
    }
    saveBest(b);
  }

  get keys() {
    const pad = this.host.input.usingPad;
    return { rip: pad ? 'A' : keyLabel(this.host.input.binds.rip[0]).toUpperCase(), bolt: pad ? 'Y' : keyLabel(this.host.input.binds.bolt[0]).toUpperCase() };
  }

  /** One fixed tick (called by the loop). */
  tick() {
    if (this.paused || this.frozen || this.wipe) return;
    if (!this.counted) {
      // a run counts once it's actually played
      this.counted = true;
      if (this.record) {
        const b = loadBest();
        b.runs++;
        saveBest(b);
      }
    }
    const input = this.host.input;
    const s = input.steer();
    const frame: InputFrame = this.autopilot ? this.autopilot(this.world) : {
      x: s.x,
      y: s.y,
      rip: input.isDown('rip') || this.ripLatch,
      bolt: input.isDown('bolt') || this.boltLatch,
    };
    const advanced = step(this.world, frame);
    if (advanced) {
      this.ripLatch = false;
      this.boltLatch = false;
      this.ticked();
    }
    for (const e of this.world.events) this.handle(e);
    this.recent.push(...this.world.events);
    if (this.recent.length > 200) this.recent.splice(0, this.recent.length - 200);
    this.world.events.length = 0;
  }

  /** Per-tick presentation that follows the sim: trails, dust, skid marks. */
  ticked() {
    this.afterTick++;
    const w = this.world, p = w.player, fx = this.fx;
    const ang = p.heading;
    if (p.tier === 'slip' && !p.air && this.afterTick % 4 === 0) fx.after.push({ name: playerSprite(w, this.time), x: p.x, y: p.y, age: 0 });
    if (p.tier === 'slip' && this.afterTick % 2 === 0) fx.wind(p.x - Math.cos(ang) * 10, p.y - Math.sin(ang) * 10, ang);
    if (p.tier !== 'crawl' && this.afterTick % 3 === 0) fx.puff('dust', p.x - Math.cos(ang) * 8, p.y + 3 - Math.sin(ang) * 6, -Math.cos(ang) * 20, -Math.sin(ang) * 20, 0.35);
    if ((p.brake || p.slide) && p.speed > 30) {
      const nx = -Math.sin(ang) * 4, ny = Math.cos(ang) * 4;
      fx.mark(p.x + nx, p.y + ny + 3);
      fx.mark(p.x - nx, p.y - ny + 3);
    }
    for (const r of w.enemies) {
      if (r.state === 'skid' && Math.hypot(r.vx, r.vy) > 20) {
        fx.mark(r.x + Math.sin(r.face) * 6, r.y - Math.cos(r.face) * 6 + 4);
        fx.mark(r.x - Math.sin(r.face) * 6, r.y + Math.cos(r.face) * 6 + 4);
        if (this.afterTick % 3 === 0) fx.puff('steam', r.x, r.y - 8);
      }
      if (r.state === 'charge' && this.afterTick % 2 === 0) fx.puff('dust', r.x - Math.cos(r.face) * 10, r.y + 4, 0, 0, 0.3);
      if (r.kind === 'rammer' && !hasBooster(r) && this.afterTick % 9 === 0) fx.puff('smoke', r.x, r.y - 10, 0, -10, 0.6);
      if (r.kind === 'snapper' && r.state === 'slide' && r.speed > 30) {
        fx.mark(r.x + Math.sin(r.face) * 4, r.y - Math.cos(r.face) * 4 + 3);
        fx.mark(r.x - Math.sin(r.face) * 4, r.y + Math.cos(r.face) * 4 + 3);
      }
      if (r.kind === 'snapper' && r.state === 'snap' && this.afterTick % 2 === 0) fx.puff('dust', r.x - Math.cos(r.face) * 6, r.y + 3, 0, 0, 0.25);
      // a Hopper stuck after landing steams; a rolling Bouncer kicks up dust
      if (r.kind === 'hopper' && r.state === 'land' && this.afterTick % 4 === 0) fx.puff('steam', r.x, r.y - 8);
      if (r.kind === 'bouncer' && r.state === 'roll' && this.afterTick % 3 === 0) fx.puff('dust', r.x - Math.cos(r.face) * 6, r.y + 3, 0, 0, 0.25);
      // badly damaged: it crackles (faster at 1 HP), so "one more pass" reads without an HP bar
      const maxHp = maxHpOf(this.world, r);
      if (r.hp < maxHp && this.afterTick % (r.hp <= 1 ? 10 : 20) === 0) fx.sparks(r.x + ((this.afterTick * 7) % 11) - 5, r.y - 8, 2, -Math.PI / 2, 1.2, 50);
    }
  }

  /** Sim events → effects, sound and hints. */
  handle(e: SimEvent) {
    const fx = this.fx, a = this.host.audio, p = this.world.player;
    this.hints.event(e);
    switch (e.k) {
      case 'rip':
        fx.slash = { tier: e.tier, dir: p.face, t: 0 };
        a.sfx(e.burn ? 'burn' : `rip_${e.tier}`);
        break;
      case 'rev': a.sfx('rev'); break;
      case 'hit':
        if (e.clang) {
          // a plowed front: nothing gets through
          fx.sparks(e.x, e.y, 8, p.heading + Math.PI, 2.4, 120);
          fx.text(e.x, e.y - 18, 'CLANG! JOUST IT', C.mist);
          fx.addShake(2);
          a.sfx('clank');
          a.sfx('slam', 0.5);
          break;
        }
        if (e.dmg === 0) {
          // the wave 1 safety net held: a dull clank, no flash, and where to hit instead
          fx.sparks(e.x, e.y, 4, p.heading, 1.6, 70);
          fx.text(e.x, e.y - 18, 'HIT ITS BACK!', C.white);
          fx.addShake(1);
          a.sfx('clank');
          break;
        }
        if (e.zone === 'front' && e.dmg < this.world.t.slipDamage) {
          // its armored front: a glancing blow, still worth a point, but it reads as the wrong side
          fx.sparks(e.x, e.y, 7, p.heading + Math.PI, 2.2, 110);
          fx.flash.set(e.id, 0.04);
          fx.text(e.x, e.y - 18, 'GLANCED', C.mist);
          fx.addShake(1);
          a.sfx('hit', 0.7, 0.8);
          a.sfx('clank', 0.5);
          break;
        }
        fx.sparks(e.x, e.y, 12, p.heading, Math.PI, 160);
        fx.dots(e.x, e.y, 6, [C.steel1, C.steel2, C.violet], 110);
        fx.flash.set(e.id, 0.07);
        fx.addShake(2);
        a.sfx('hit');
        break;
      case 'draft':
        for (let i = 0; i < 6; i++) fx.wind(e.x, e.y, p.heading);
        fx.text(e.x, e.y - 18, 'SLIPSTREAM!', C.speed4);
        a.sfx('slipstream');
        break;
      case 'ram': a.sfx('shove', 0.8, 0.8); break;
      case 'block':
        fx.sparks(e.x, e.y, 14, p.heading + Math.PI, 2.6, 150);
        fx.text(e.x, e.y - 20, 'BLOCKED!', C.white);
        fx.addShake(3);
        a.sfx('slam');
        a.sfx('clank', 0.7);
        break;
      case 'latch': a.sfx('bolt_tick', 1, 0.7); a.sfx('hit', 0.6, 1.4); break;
      case 'sling':
        for (let i = 0; i < 5; i++) fx.wind(p.x, p.y, p.heading);
        a.sfx('slipstream', 0.7, 1.2);
        break;
      case 'slide': a.sfx('skid', 0.8, 1.3); break;
      case 'slide-e': a.sfx('skid', 0.5, 1.6); break;
      case 'snap': a.sfx('charge', 0.5, 1.6); break;
      case 'hop': {
        const r = this.world.enemies.find((q) => q.id === e.id);
        if (r) for (let i = 0; i < 4; i++) fx.puff('dust', r.x + (i - 1.5) * 5, r.y + 3, (i - 1.5) * 12, 0, 0.35);
        a.sfx('hop');
        break;
      }
      case 'land':
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          fx.puff('dust', e.x + Math.cos(ang) * e.r * 0.7, e.y + Math.sin(ang) * e.r * 0.7, Math.cos(ang) * 30, Math.sin(ang) * 30, 0.4);
        }
        fx.sparks(e.x, e.y, 6);
        fx.addShake(2);
        a.sfx('land');
        break;
      case 'leap':
        for (let i = 0; i < 4; i++) fx.puff('dust', p.x + (i - 1.5) * 4, p.y + 3, (i - 1.5) * 10, 0, 0.3);
        a.sfx('leap');
        break;
      case 'touchdown':
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          fx.puff('dust', e.x + Math.cos(ang) * 8, e.y + 3 + Math.sin(ang) * 5, Math.cos(ang) * 25, Math.sin(ang) * 15, 0.35);
        }
        fx.addShake(1);
        a.sfx('touchdown', e.tier === 'slip' ? 1 : 0.7);
        break;
      case 'roll': a.sfx('roll'); break;
      case 'boost':
        for (let i = 0; i < 4; i++) fx.wind(e.x, e.y, p.heading);
        a.sfx('slipstream', 0.8, 0.9);
        break;
      case 'press':
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          fx.puff('dust', e.x + Math.cos(ang) * 16, e.y + Math.sin(ang) * 16, Math.cos(ang) * 30, Math.sin(ang) * 30, 0.4);
        }
        fx.addShake(2);
        a.sfx('land', 0.8, 0.8);
        break;
      case 'pressed': break;
      case 'call': {
        // The Compactor calls a Snapper in: a horn, and a word over it
        const b = this.world.enemies.find((q) => q.id === e.id);
        if (b) fx.text(b.x, b.y - 46, 'CALLS FOR HELP', C.mist);
        a.sfx('wave', 0.7, 0.6);
        break;
      }
      case 'boing':
        fx.sparks(e.x, e.y, 4, 0, Math.PI * 2, 70);
        a.sfx('boing', e.id === undefined ? 1 : 0.6);
        break;
      case 'joust':
        fx.sparks(e.x, e.y, 16, 0, Math.PI * 2, 170);
        fx.dots(e.x, e.y, 10, [C.white, C.frost, C.mist], 130);
        fx.text(e.x, e.y - 22, 'JOUST!', C.white);
        fx.addShake(3);
        a.sfx('slam');
        a.sfx('hit', 1, 1.2);
        break;
      case 'shove':
        fx.sparks(e.x, e.y, 5, p.heading, 1.2, 90);
        fx.puff('dust', e.x, e.y);
        fx.addShake(1);
        a.sfx('shove');
        break;
      case 'clank':
        fx.sparks(e.x, e.y, e.wall ? 6 : 3, 0, Math.PI * 2, 80);
        fx.addShake(1);
        a.sfx(e.wall ? 'clank' : 'rip_crawl');
        break;
      case 'scrape': fx.sparks(e.x, e.y, 2, 0, Math.PI * 2, 50); a.sfx('scrape', 0.6); break;
      case 'tear':
        fx.dots(e.x, e.y, 18, [C.gold, C.gold2, C.gold3, C.white], 150, 0.6);
        fx.sparks(e.x, e.y, 8);
        fx.text(e.x, e.y - 18, 'TORN OFF!', C.gold3);
        fx.addShake(3);
        a.sfx('tear');
        break;
      case 'wreck':
        if (e.kind === 'compactor') {
          // the boss comes apart: a bigger burst, smoke and a long shake
          fx.dots(e.x, e.y, 40, [C.steel1, C.steel3, C.violet, C.mist, C.white], 220, 1.0);
          fx.sparks(e.x, e.y, 24, 0, Math.PI * 2, 200);
          for (let i = 0; i < 10; i++) fx.puff('smoke', e.x + ((i % 5) - 2) * 8, e.y - 8, ((i % 5) - 2) * 10, -20, 1.2);
          fx.addShake(8);
        }
        fx.dots(e.x, e.y, 24, [C.steel0, C.steel1, C.steel2, C.violet, C.mist], 160, 0.7);
        fx.sparks(e.x, e.y, 10);
        for (let i = 0; i < 5; i++) fx.puff('smoke', e.x, e.y - 4, 0, -14, 0.8);
        if (e.lost.length) fx.text(e.x, e.y - 20, e.lost.length > 1 ? 'PARTS WRECKED' : 'PART WRECKED', C.lilac);
        fx.addShake(3);
        a.sfx('wreck');
        break;
      case 'windup': a.sfx(e.near || e.shove ? 'windup_near' : 'windup'); break;
      case 'lock': a.sfx('lock'); break;
      case 'charge': a.sfx('charge', e.shove ? 0.6 : 1); break;
      case 'cancel': a.sfx('cancel'); break;
      case 'slam':
        fx.sparks(e.x, e.y, 8);
        fx.puff('dust', e.x, e.y);
        fx.addShake(2);
        a.sfx('slam');
        break;
      case 'bump': fx.sparks(e.x, e.y, 2); a.sfx('bump'); break;
      case 'hurt':
        fx.playerFlash = 0.1;
        fx.sparks(e.x, e.y, 10);
        fx.addShake(3);
        a.sfx('hurt');
        break;
      case 'shatter':
        fx.dots(e.x, e.y, 16, [C.gold0, C.gold, C.mist, C.lilac], 140, 0.6);
        fx.text(e.x, e.y - 18, 'SHATTERED', C.gold2);
        fx.playerFlash = 0.08;
        fx.addShake(3);
        a.sfx('shatter');
        break;
      case 'knock':
        fx.dots(e.x, e.y, 10, [C.gold0, C.gold, C.mist], 120, 0.5);
        fx.text(e.x, e.y - 18, 'KNOCKED LOOSE', C.gold2);
        fx.playerFlash = 0.08;
        fx.addShake(3);
        a.sfx('drop');
        a.sfx('bump');
        break;
      case 'crush':
        fx.dots(e.x, e.y, 14, [C.gold0, C.gold, C.mist, C.lilac], 120, 0.5);
        fx.text(e.x, e.y - 14, 'CRUSHED', C.lilac);
        a.sfx('shatter', 0.7);
        break;
      case 'stun': a.sfx('stun'); fx.addShake(2); break;
      case 'skid': a.sfx('skid'); break;
      case 'tier': if (e.tier === 'slip' && e.prev !== 'slip') a.sfx('slipstream'); break;
      case 'grab': a.sfx('grab'); break;
      case 'pickup': a.sfx('pickup'); break;
      case 'drop': a.sfx('drop'); break;
      case 'bolt-start': a.sfx('bolt_tick'); break;
      case 'bolt-tick': a.sfx('bolt_tick', 1, 1 + e.n * 0.15); break;
      case 'bolted':
        fx.dots(p.x, p.y, 10, [C.gold2, C.gold3, C.white], 80, 0.4);
        fx.text(p.x, p.y - 24, 'BOLTED ON!', C.gold3);
        a.sfx('bolted');
        break;
      case 'bolt-cancel': a.sfx('bolt_cancel'); break;
      case 'wave': {
        const r = this.run, y = YARDS[r.yard], last = e.n === this.world.waves.length;
        if (e.n === 1) fx.showBanner(y.name, r.yard === 'ring' ? 'TEAR OFF A BOOSTER, BOLT IT ON' : r.yard === 'compactor' ? 'THE LAST YARD - TAKE IT APART' : `YARD ${r.depth} OF ${RUN_LENGTH}`, this.world.t.bannerTime + 0.4);
        else fx.showBanner(`WAVE ${e.n}`, last ? 'LAST WAVE' : '', this.world.t.bannerTime);
        a.sfx('wave');
        break;
      }
      case 'gate': a.sfx('gate'); break;
      case 'enter': break;
      case 'yard-clear':
        fx.showBanner('YARD CLEARED', e.patched ? '+1 HULL   DRIVE OUT THROUGH A GATE' : 'DRIVE OUT THROUGH A GATE', 2.4);
        a.sfx('cleared');
        break;
      case 'exit': a.sfx('wave', 0.8, 1.2); break;
      case 'cleared': a.sfx('cleared'); this.recordClear(); break;
      case 'scrapped': a.sfx('scrapped'); break;
    }
  }

  private recordClear() {
    if (!this.record) return;
    const b = loadBest(), w = this.world;
    b.clears++;
    if (!b.bestTicks || w.stats.ticks < b.bestTicks) b.bestTicks = w.stats.ticks;
    b.bestHull = Math.max(b.bestHull, w.player.hull);
    saveBest(b);
  }

  /** Per frame: pause, the tuning panel, effects, hints and the engine sound. */
  update(dt: number) {
    const input = this.host.input;
    if (input.wasPressed('rip')) this.ripLatch = true;
    if (input.wasPressed('bolt')) this.boltLatch = true;
    if (DEBUG_KEYS && input.wasPressed('debug')) this.tuning.open = !this.tuning.open;
    if (input.wasPressed('pause') && !this.world.result) {
      this.paused = !this.paused;
      input.consume('pause');
      input.consume('back');
    }
    this.host.audio.setDuck(this.paused);
    this.time += dt;
    // drove out through an exit: wipe to the next yard
    if (this.world.result === 'exit' && !this.wipe && !this.frozen) this.wipe = { t: 0, swapped: false };
    if (this.wipe && !this.frozen) {
      this.wipe.t += dt;
      if (!this.wipe.swapped && this.wipe.t >= WIPE / 2) {
        this.nextYard();
        this.wipe.swapped = true;
      }
      if (this.wipe.t >= WIPE) this.wipe = null;
    }
    if (this.world.result === 'cleared' || this.world.result === 'scrapped') this.endRun();
    if (!this.paused && !this.frozen) {
      this.fx.update(dt);
      this.hints.update(this.world, dt);
    }
    if (this.world.result && this.world.result !== 'exit') this.endT += dt;
    const p = this.world.player;
    this.host.audio.engine(p.speed / this.world.t.burnMax, revving(this.world), !this.paused && (!this.world.result || this.world.result === 'exit'));
  }

  draw(ui: UI, dt: number) {
    const w = this.world;
    // while the wipe covers the screen, only the yard's name shows
    const covered = !!this.wipe && wipeCover(this.wipe.t) >= 0.83;
    this.fx.audit = ui.audit ? (s, x, y, tw, h) => ui.record('text', x, y, tw, h, s) : null;
    // floating texts keep off the exit signs
    this.fx.avoid = covered ? [] : this.signs().map(({ s }) => s);
    drawWorld(ui.ctx, w, this.fx, { time: this.time, shake: this.host.settings.shake, floor: () => !covered && this.drawExitSigns(ui) });
    if (!covered) {
      if (!w.result) this.hints.draw(ui, this.keys);
      drawHud(ui, w, this.keys, `YARD ${this.run.depth}/${RUN_LENGTH}  WAVE ${Math.min(w.waves.length, w.wave.index + 1)}/${w.waves.length}`);
    }
    if (DEBUG_KEYS) this.tuning.draw(ui, w.t, (on) => (w.flat = on), (id, on) => (on ? giveBolted(w, id) : delete w.player.parts[PARTS[id].mount]), dt);
    if (w.flat) ui.text('FLAT MODE', 8, 22, C.white, { shadow: C.ink });
    if (this.wipe) this.drawWipe(ui);
    if (this.paused) this.drawPause(ui);
    else if (w.result && w.result !== 'exit' && this.endT > 1.2) this.drawResults(ui);
  }

  /** The signs by the open exits, painted on the floor (bodies, parts and texts go over them):
   * where each leads and what its enemies carry. */
  private drawExitSigns(ui: UI) {
    const w = this.world;
    const blink = Math.floor(this.time * 3) % 2 === 0;
    for (const { g, s } of this.signs()) {
      ui.fill(s.x, s.y, s.w, s.h, C.ink);
      ui.fill(s.x, s.y, s.w, 1, blink ? C.gold3 : C.gold);
      ui.text(s.name, s.x + 4, s.y + 4, C.white);
      s.icons.forEach((id, i) => drawSprite(ui.ctx, sprite(`icon:part:${id}`), s.x + 4 + i * s.iconStep, s.y + 14));
      ui.text(s.parts, s.x + 4, s.y + 33, C.gold2);
      ui.text(s.wave, s.x + 4, s.y + 43, C.mist);
      // an arrow toward the gate
      if (g.id === 'w' || g.id === 'e') ui.text(g.id === 'w' ? '<' : '>', g.id === 'w' ? 8 : 626, g.rect.y + 12, blink ? C.gold3 : C.gold);
    }
  }

  /** The open exits' signs (src/ui/signs.ts). */
  private signs() {
    const w = this.world;
    return w.exits.map((e) => {
      const g = w.arena.gates.find((q) => q.id === e.gate)!;
      return { g, s: signLayout(g, this.run.options[e.option], this.run.depth + 1) };
    });
  }

  /** Ink bars sweep across and back while the next yard is built. */
  private drawWipe(ui: UI) {
    const f = this.wipe!.t / WIPE;
    const cover = wipeCover(this.wipe!.t);
    const rows = 12;
    for (let i = 0; i < rows; i++) {
      const wdt = Math.round(Math.min(1, cover * 1.4 - (i % 3) * 0.08) * 640);
      if (wdt > 0) ui.fill(f < 0.5 ? 0 : 640 - wdt, i * 30, wdt, 30, C.ink);
    }
    if (cover > 0.8) ui.text(YARDS[this.run.yard].name, 320, 172, C.white, { align: 'center', scale: 2 });
  }

  restart() {
    const fresh = new Play(this.host);
    Object.assign(this, { run: fresh.run, world: fresh.world, fx: fresh.fx, hints: fresh.hints, paused: false, endT: 0, time: 0, recent: [], wipe: null, runDone: false, counted: false });
  }

  private drawPause(ui: UI) {
    ui.dim();
    const x = 250, y = 110, w = 140, h = 136;
    ui.panel(x, y, w, h, 'dark');
    ui.text('PAUSED', x + w / 2, y + 10, C.white, { align: 'center', scale: 2 });
    if (ui.button('p-resume', x + 15, y + 36, 110, 18, 'RESUME')) this.paused = false;
    if (ui.button('p-restart', x + 15, y + 60, 110, 18, 'RESTART')) this.restart();
    if (ui.button('p-settings', x + 15, y + 84, 110, 18, 'SETTINGS')) this.host.openSettings();
    if (ui.button('p-title', x + 15, y + 108, 110, 18, 'TITLE')) this.host.toTitle();
  }

  private drawResults(ui: UI) {
    const r = this.run, T = r.totals, won = r.over === 'won';
    ui.dim();
    const x = 200, y = 60, pw = 240, ph = 236;
    ui.panel(x, y, pw, ph, 'dark');
    ui.text(won ? 'RUN CLEARED' : 'SCRAPPED', x + pw / 2, y + 10, won ? C.white : C.mist, { align: 'center', scale: 2 });
    ui.text(won ? 'ALL SIX YARDS - COMPACTOR WRECKED' : `IN ${YARDS[r.yard].name}, YARD ${r.depth} OF ${RUN_LENGTH}`, x + pw / 2, y + 30, C.mist, { align: 'center' });
    const secs = T.ticks / 60;
    const rows: [string, string][] = [
      ['TIME', `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`],
      ['YARDS CLEARED', `${won ? RUN_LENGTH : r.depth - 1}/${RUN_LENGTH}`],
      ['PARTS TORN OFF', String(T.tears)],
      ['WRECKED', String(T.wrecks)],
      ['JOUSTS', String(T.jousts)],
      ['TOP SPEED', String(Math.round(T.topSpeed))],
    ];
    rows.forEach(([k, v], i) => {
      ui.text(k, x + 16, y + 46 + i * 12, C.mist);
      ui.text(v, x + pw - 16, y + 46 + i * 12, C.white, { align: 'right' });
    });
    // the build you finished with
    ui.text('BUILD', x + 16, y + 122, C.mist);
    const parts = (['rear', 'sides', 'front'] as const).map((m) => r.loadout?.parts[m]).filter((b): b is Bolted => !!b);
    if (!parts.length) ui.text('BARE CHASSIS', x + pw - 16, y + 122, C.lilac, { align: 'right' });
    parts.forEach((b, i) => {
      const ix = x + pw - 16 - (parts.length - i) * 18 + 2;
      drawSprite(ui.ctx, sprite(`icon:part:${b.id}`), ix, y + 118);
      if (b.cracked) crack(ui.ctx, ix + 8, y + 126);
    });
    const b = loadBest();
    const best = b.wins ? `BEST WIN ${Math.floor(b.bestWinTicks / 3600)}:${String(Math.floor((b.bestWinTicks / 60) % 60)).padStart(2, '0')}   WINS ${b.wins}` : `BEST: ${b.bestYards} YARD${b.bestYards === 1 ? '' : 'S'} CLEARED`;
    ui.text(best, x + pw / 2, y + 146, C.lilac, { align: 'center' });
    if (ui.button('r-again', x + 16, y + 168, pw - 32, 20, 'AGAIN')) this.restart();
    if (ui.button('r-title', x + 16, y + 194, pw - 32, 20, 'TITLE')) this.host.toTitle();
  }
}
