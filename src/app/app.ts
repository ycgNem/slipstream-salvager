// The app: one canvas, everything drawn at 640x360 into a buffer and scaled up by a whole number
// (letterboxed), the fixed 60 Hz loop, and the screens (title, play, settings).
import { C, PALETTE } from '../data/palette';
import { GameLoop } from '../engine/loop';
import { ACTION_LABELS, DEBUG_KEYS, Input, keyLabel, type Action } from '../engine/input';
import { version } from '../../package.json';
import { Audio } from '../engine/audio/audio';
import { artReady, drawFit, sprite } from '../render/atlas';
import { allSpriteNames } from '../render/names';
import { makeCanvas, ctx2d } from '../render/art/pixel';
import { registerCodeArt } from '../render/art/code/index';
import { registerImportedArt } from '../render/art/imported';
import { resetBackground } from '../render/renderer';
import { UI } from '../ui/ui';
import { Play } from './play';
import { loadBest, loadSettings, saveSettings, type Settings } from './settings';
import { scene, SCENES, type SceneName } from './debug';
import type { YardId } from '../data/yards';

export const VIEW_W = 640;
export const VIEW_H = 360;

type Screen = 'title' | 'play' | 'settings';

export class App {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  buf = makeCanvas(VIEW_W, VIEW_H);
  bctx = ctx2d(this.buf);
  input = new Input();
  ui = new UI();
  settings: Settings = loadSettings();
  audio = new Audio(this.settings, this.settings.musicOn);
  loop: GameLoop;
  screen: Screen = 'title';
  /** where Settings returns to */
  private settingsFrom: Screen = 'title';
  play: Play | null = null;
  dpr = 1;
  zoom = 1;
  ox = 0;
  oy = 0;
  time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    registerCodeArt();
    registerImportedArt();
    artReady().then(() => {
      // the floor may have been cached from the fallback tiles if PLAY came first
      resetBackground();
      this.warm = allSpriteNames();
    });
    this.input.attach(canvas);
    this.input.onGesture = () => this.audio.unlock();
    this.ui.sfx = (id) => this.audio.sfx(id);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.loop = new GameLoop(() => this.tick(), (dt) => this.frame(dt));
    this.loop.start();
    (window as any).__app = this;
  }

  /** Fit the 640x360 view at the largest whole-number scale, centered. */
  resize() {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.floor(window.innerWidth * this.dpr), ch = Math.floor(window.innerHeight * this.dpr);
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.zoom = Math.max(1, Math.floor(Math.min(cw / VIEW_W, ch / VIEW_H)));
    this.ox = Math.floor((cw - VIEW_W * this.zoom) / 2);
    this.oy = Math.floor((ch - VIEW_H * this.zoom) / 2);
  }

  /** Sprites not yet generated; a few are made each frame so play never hitches on a first use
   * (once the imported sheets are in, so they're cut from the sheets, not the fallbacks). */
  private warm: string[] = [];

  private tick() {
    if (this.screen === 'play' && this.play) this.play.tick();
  }

  private frame(dt: number) {
    this.time += dt;
    // code-drawn sprites take ~1 s in all to generate: spread it over the first frames
    if (this.warm.length) {
      const t0 = performance.now();
      while (this.warm.length && performance.now() - t0 < 6) sprite(this.warm.pop()!);
    }
    this.input.pollPad();
    if (this.input.wasPressed('music')) this.toggleMusic();
    const mx = Math.floor((this.input.mouse.x * this.dpr - this.ox) / this.zoom);
    const my = Math.floor((this.input.mouse.y * this.dpr - this.oy) / this.zoom);
    const ctx = this.bctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const inPlay = this.screen === 'play' && this.play;
    this.ui.begin(ctx, this.input, mx, my, dt, !inPlay || this.play!.paused || !!this.play!.world.result || this.play!.tuning.open);
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'settings') this.drawSettings();
    else if (this.play) {
      this.play.update(dt);
      this.play.draw(this.ui, dt);
    }
    this.ui.end();
    this.audio.update();
    if (this.screen !== 'play') this.audio.engine(0, false, false);
    // blit, whole-number scale, letterboxed
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = PALETTE[C.ink];
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.buf, 0, 0, VIEW_W, VIEW_H, this.ox, this.oy, VIEW_W * this.zoom, VIEW_H * this.zoom);
    this.input.endFrame();
  }

  /** Put the game in a scripted state and freeze it (e2e/screens.mjs). */
  scene(name: SceneName) {
    scene(this, name);
  }

  get scenes() {
    return SCENES;
  }

  startPlay(seed?: number, yard?: YardId) {
    this.play = new Play(this, seed, yard);
    this.screen = 'play';
  }

  toTitle() {
    this.play = null;
    this.screen = 'title';
  }

  openSettings() {
    this.settingsFrom = this.screen;
    this.screen = 'settings';
  }

  toggleMusic() {
    this.settings.musicOn = !this.settings.musicOn;
    this.applySettings();
  }

  applySettings() {
    saveSettings(this.settings);
    this.audio.applySettings(this.settings, this.settings.musicOn);
    if (this.play) this.play.hints.enabled = this.settings.hints;
  }

  // ---------------- screens ----------------

  private drawTitle() {
    const ui = this.ui, t = this.time;
    // a slow drift of wind lines behind the title
    for (let i = 0; i < 24; i++) {
      const y = 20 + ((i * 53) % 320), x = (i * 97 + t * (60 + (i % 5) * 30)) % 700 - 30;
      ui.fill(Math.round(x), y, 6 + (i % 3) * 3, 1, i % 4 === 0 ? C.speed1 : C.plum);
    }
    ui.text('SLIPSTREAM', 320, 46, C.speed4, { align: 'center', scale: 5, shadow: C.speed0 });
    ui.text('SALVAGER', 320, 96, C.cruiseHi, { align: 'center', scale: 4, shadow: C.rust0 });
    // the two robots: you, and the thing whose booster you want
    const bob = Math.floor(t * 4) % 2;
    drawFit(ui.ctx, sprite(`pl:scrapper:drive:e:${bob}`), 150, 150, 96, 96);
    drawFit(ui.ctx, sprite('en:rammer:stalk:w:0'), 394, 140, 120, 120);
    drawFit(ui.ctx, sprite('part:booster:w'), 470, 160, 48, 48);
    if (ui.button('t-play', 260, 168, 120, 22, 'PLAY')) this.startPlay();
    if (ui.button('t-settings', 260, 196, 120, 18, 'SETTINGS')) this.openSettings();
    const pad = this.input.usingPad;
    const lines = pad
      ? ['STICK  STEER', 'A  RIP (HOLD WITH A BOOSTER)', 'Y  BOLT ON', 'START  PAUSE']
      : ['WASD / ARROWS  STEER', `${keyLabel(this.input.binds.rip[0]).toUpperCase()} / J  RIP (HOLD WITH A BOOSTER)`, 'E / K  BOLT ON', 'ESC  PAUSE    N  MUSIC'];
    lines.forEach((l, i) => ui.text(l, 320, 254 + i * 11, C.mist, { align: 'center' }));
    const b = loadBest();
    if (b.runs) ui.text(b.wins ? `RUNS ${b.runs}   WINS ${b.wins}   BEST WIN ${Math.floor(b.bestWinTicks / 3600)}:${String(Math.floor((b.bestWinTicks / 60) % 60)).padStart(2, '0')}` : `RUNS ${b.runs}   BEST ${b.bestYards}/5 YARDS`, 320, 304, C.lilac, { align: 'center' });
    ui.text('A SHORT RUN - FIVE YARDS, SIX PARTS TO RIP OFF', 320, 340, C.slate, { align: 'center' });
    ui.text(`V${version}`, 4, 350, C.slate);
    if (DEBUG_KEYS) ui.text('` TUNING IN PLAY', 636, 350, C.slate, { align: 'right' });
  }

  private drawSettings() {
    const ui = this.ui, s = this.settings;
    if (this.settingsFrom === 'play' && this.play) {
      this.play.draw(ui, 0);
      ui.dim();
    }
    const x = 200, y = 70, w = 240, h = 220;
    ui.panel(x, y, w, h, 'dark');
    ui.text('SETTINGS', x + w / 2, y + 10, C.white, { align: 'center', scale: 2 });
    const before = JSON.stringify(s);
    s.master = ui.slider('s-master', x + 16, y + 40, w - 32, 'VOLUME', s.master);
    s.music = ui.slider('s-music', x + 16, y + 56, w - 32, 'MUSIC', s.music);
    s.sfx = ui.slider('s-sfx', x + 16, y + 72, w - 32, 'SOUNDS', s.sfx);
    s.musicOn = ui.toggle('s-musicon', x + 16, y + 92, w - 32, 'MUSIC ON (N)', s.musicOn);
    s.shake = ui.toggle('s-shake', x + 16, y + 106, w - 32, 'SCREEN SHAKE', s.shake);
    s.hints = ui.toggle('s-hints', x + 16, y + 120, w - 32, 'HINTS', s.hints);
    if (JSON.stringify(s) !== before) this.applySettings();
    // the controls, read-only in the slice (DECISIONS #27)
    const acts: Action[] = ['rip', 'bolt', 'pause'];
    acts.forEach((a, i) => {
      ui.text(ACTION_LABELS[a].toUpperCase(), x + 16, y + 140 + i * 11, C.lilac);
      ui.text(this.input.binds[a].map(keyLabel).join(' / ').toUpperCase(), x + w - 16, y + 140 + i * 11, C.mist, { align: 'right' });
    });
    if (ui.button('s-back', x + w / 2 - 50, y + h - 30, 100, 18, 'BACK') || this.input.wasPressed('back')) {
      this.input.consume('back');
      this.input.consume('pause');
      this.screen = this.settingsFrom;
    }
  }
}

