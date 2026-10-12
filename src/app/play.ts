// One encounter on screen: runs the sim from input, turns its events into effects and sound,
// draws the world, the HUD, hints, and the pause and results overlays.
import { C } from '../data/palette';
import { DEBUG_KEYS, keyLabel, type Input } from '../engine/input';
import type { Audio } from '../engine/audio/audio';
import { Fx } from '../render/fx';
import { drawWorld, playerSprite } from '../render/renderer';
import { createWorld, giveBolted, hasBooster, type InputFrame, type World } from '../sim/world';
import { step } from '../sim/tick';
import { revving } from '../sim/rip';
import type { SimEvent } from '../sim/events';
import { drawHud } from '../ui/hud';
import { Hints } from '../ui/hints';
import type { UI } from '../ui/ui';
import { LIVE, TuningPanel } from './tuning';
import { loadBest, loadSeenHints, saveBest, saveSeenHints, type Settings } from './settings';

export interface PlayHost {
  input: Input;
  audio: Audio;
  settings: Settings;
  toTitle(): void;
  openSettings(): void;
}

export class Play {
  world: World;
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
  /** events from the last ticks (e2e inspection) */
  recent: SimEvent[] = [];
  /** a scripted player (src/sim/bots.ts) drives instead of the input, for e2e and the critic */
  autopilot: ((w: World) => InputFrame) | null = null;

  constructor(private host: PlayHost, seed = (Math.random() * 1e9) | 0) {
    this.world = createWorld({ seed, tuning: LIVE.t, flat: LIVE.flat });
    if (LIVE.booster) giveBolted(this.world, 'booster');
    this.hints = new Hints(loadSeenHints(), host.settings.hints);
    this.hints.onSeen = saveSeenHints;
  }

  get keys() {
    const pad = this.host.input.usingPad;
    return { rip: pad ? 'A' : keyLabel(this.host.input.binds.rip[0]).toUpperCase(), bolt: pad ? 'Y' : keyLabel(this.host.input.binds.bolt[0]).toUpperCase() };
  }

  /** One fixed tick (called by the loop). */
  tick() {
    if (this.paused || this.frozen) return;
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
    if (p.tier === 'slip' && this.afterTick % 4 === 0) fx.after.push({ name: playerSprite(w, this.time), x: p.x, y: p.y, age: 0 });
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
      // badly damaged: it crackles (faster at 1 HP), so "one more pass" reads without an HP bar
      if (r.hp <= 2 && this.afterTick % (r.hp <= 1 ? 10 : 20) === 0) fx.sparks(r.x + ((this.afterTick * 7) % 11) - 5, r.y - 8, 2, -Math.PI / 2, 1.2, 50);
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
      case 'wave':
        fx.showBanner(`WAVE ${e.n}`, e.n === 1 ? 'TEAR OFF A BOOSTER, BOLT IT ON' : e.n === 3 ? 'LAST WAVE' : '', this.world.t.bannerTime);
        a.sfx('wave');
        break;
      case 'gate': a.sfx('gate'); break;
      case 'enter': break;
      case 'cleared': a.sfx('cleared'); this.recordClear(); break;
      case 'scrapped': a.sfx('scrapped'); break;
    }
  }

  private recordClear() {
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
    if (!this.paused && !this.frozen) {
      this.fx.update(dt);
      this.hints.update(this.world, dt);
    }
    if (this.world.result) this.endT += dt;
    const p = this.world.player;
    this.host.audio.engine(p.speed / this.world.t.burnMax, revving(this.world), !this.paused && !this.world.result);
  }

  draw(ui: UI, dt: number) {
    const w = this.world;
    drawWorld(ui.ctx, w, this.fx, { time: this.time, shake: this.host.settings.shake });
    if (!w.result) this.hints.draw(ui, this.keys);
    drawHud(ui, w, this.keys);
    if (DEBUG_KEYS) this.tuning.draw(ui, w.t, (on) => (w.flat = on), (on) => (on ? giveBolted(w, 'booster') : delete w.player.parts.rear), dt);
    if (w.flat) ui.text('FLAT MODE', 8, 22, C.white, { shadow: C.ink });
    if (this.paused) this.drawPause(ui);
    else if (w.result && this.endT > 1.2) this.drawResults(ui);
  }

  restart() {
    const fresh = new Play(this.host);
    Object.assign(this, { world: fresh.world, fx: fresh.fx, hints: fresh.hints, paused: false, endT: 0, time: 0, recent: [] });
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
    const w = this.world, s = w.stats, cleared = w.result === 'cleared';
    ui.dim();
    const x = 220, y = 80, pw = 200, ph = 196;
    ui.panel(x, y, pw, ph, 'dark');
    ui.text(cleared ? 'YARD CLEARED' : 'SCRAPPED', x + pw / 2, y + 10, cleared ? C.white : C.danger2, { align: 'center', scale: 2 });
    const secs = s.ticks / 60;
    const rows: [string, string][] = [
      ['TIME', `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`],
      ['HULL LEFT', `${Math.max(0, w.player.hull)}/${w.t.hull}`],
      ['BOOSTERS TORN OFF', String(s.tears)],
      ['SLIPSTREAM HITS', String(s.slipHits)],
      ['TOP SPEED', String(Math.round(s.topSpeed))],
    ];
    rows.forEach(([k, v], i) => {
      ui.text(k, x + 16, y + 40 + i * 13, C.mist);
      ui.text(v, x + pw - 16, y + 40 + i * 13, C.white, { align: 'right' });
    });
    const b = loadBest();
    if (b.clears) ui.text(`BEST CLEAR ${Math.floor(b.bestTicks / 3600)}:${String(Math.floor((b.bestTicks / 60) % 60)).padStart(2, '0')}`, x + pw / 2, y + 112, C.lilac, { align: 'center' });
    if (ui.button('r-again', x + 16, y + 130, pw - 32, 20, 'AGAIN')) this.restart();
    if (ui.button('r-title', x + 16, y + 156, pw - 32, 20, 'TITLE')) this.host.toTitle();
  }
}
