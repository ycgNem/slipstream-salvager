// Scripted scenes for the screenshot sweep (e2e/screens.mjs): each puts the game into one state and
// freezes the sim there, so every screen and every feedback state can be checked for overlaps.
import { addEnemy, addRammer, giveBolted, type World } from '../sim/world';
import type { YardId } from '../data/yards';
import { beginWindup } from '../sim/rammer';
import { beginCrouch } from '../sim/hopper';
import { beginRoll } from '../sim/bouncer';
import { beginBossWindup } from '../sim/compactor';
import { step } from '../sim/tick';
import { NO_INPUT, type InputFrame } from '../sim/world';
import type { App } from './app';
import type { Play } from './play';

export const SCENES = [
  'title', 'settings', 'play', 'crawl', 'cruise', 'slip', 'telegraph-track', 'telegraph-lock', 'hitstop',
  'towing', 'bolting', 'booster', 'burn', 'pause', 'tuning', 'cleared', 'scrapped', 'flat',
  // M3: the Snapper and the new parts, the exits, the wipe, every yard
  'snapper', 'parts', 'exits', 'wipe', 'yard-kennel', 'yard-lanes', 'yard-pit', 'yard-jaws', 'yard-heap',
  // M6: the Hopper and the Bouncer, the Jump Jets and the Springs, their yards
  'hopper', 'bouncer', 'jets', 'leap', 'springs', 'yard-hurdles', 'yard-pinball',
  // M7: terrain and its yards
  'boost', 'oil', 'ramp', 'crusher', 'yard-slick', 'yard-jumps', 'yard-press',
  // M8: The Compactor, its core open, its yard
  'boss', 'boss-open', 'yard-compactor',
] as const;

/** The yard a scene that isn't `yard-*` is set in (default: The Ring). */
const SCENE_YARD: Partial<Record<string, YardId>> = {
  snapper: 'kennel', hopper: 'hurdles', jets: 'hurdles', leap: 'hurdles', bouncer: 'pinball', springs: 'pinball',
  boost: 'slick', oil: 'slick', ramp: 'jumps', crusher: 'press', boss: 'compactor', 'boss-open': 'compactor',
};
export type SceneName = (typeof SCENES)[number];

/** Run the sim n ticks with an input, feeding its events to the effects like play does. */
function run(play: Play, n: number, input: InputFrame = NO_INPUT) {
  const w = play.world;
  for (let i = 0; i < n; i++) {
    if (step(w, input)) play.ticked();
    for (const e of w.events) play.handle(e);
    w.events.length = 0;
    play.fx.update(1 / 60);
    play.hints.update(w, 1 / 60);
  }
}

/** Past the wave 1 banner with no enemies on screen yet. */
function quiet(play: Play) {
  const w = play.world;
  w.sandbox = true;
  w.wave.phase = 'fight';
  play.fx.banner = null;
}

function place(w: World, x: number, y: number, heading: number, speed: number) {
  Object.assign(w.player, { x, y, heading, speed, face: Math.round(heading / (Math.PI / 4)) & 7 });
}

export function scene(app: App, name: SceneName) {
  app.settings.hints = true;
  if (name === 'title') return app.toTitle();
  if (name === 'settings') {
    app.toTitle();
    return app.openSettings();
  }
  app.startPlay(3, name.startsWith('yard-') ? (name.slice(5) as YardId) : SCENE_YARD[name] ?? 'ring');
  const play = app.play!;
  // scripted scenes never touch the player's best record
  play.record = false;
  const w = play.world;
  play.hints.seen = { speed: true, tear: true, bolt: true };
  switch (name) {
    case 'play':
      play.hints.seen = {};
      run(play, 200, NO_INPUT);
      break;
    case 'crawl':
      quiet(play);
      place(w, 200, 300, 0, 0);
      run(play, 5, { x: 1, y: 0, rip: false, bolt: false });
      break;
    case 'cruise':
      quiet(play);
      place(w, 120, 300, 0, 0);
      run(play, 26, { x: 1, y: 0, rip: false, bolt: false });
      break;
    case 'slip':
      quiet(play);
      place(w, 60, 300, 0, 0);
      run(play, 70, { x: 1, y: 0, rip: false, bolt: false });
      break;
    case 'telegraph-track':
    case 'telegraph-lock': {
      quiet(play);
      place(w, 470, 300, Math.PI, 0);
      const r = addRammer(w, 300, 300, 0);
      beginWindup(w, r, false);
      run(play, name === 'telegraph-lock' ? 36 : 12);
      break;
    }
    case 'hitstop': {
      quiet(play);
      place(w, 262, 300, 0, 230);
      const r = addRammer(w, 300, 300, Math.PI);
      r.cd = 99;
      run(play, 1, { x: 1, y: 0, rip: true, bolt: false });
      run(play, 3, { x: 1, y: 0, rip: true, bolt: false });
      break;
    }
    case 'towing':
    case 'bolting': {
      quiet(play);
      place(w, 200, 300, 0, 150);
      w.player.tow = { part: 'booster', x: 186, y: 300, vx: 0, vy: 0, cracked: false };
      const r = addRammer(w, 520, 80, Math.PI, { booster: false });
      r.cd = 99;
      run(play, 10, { x: 1, y: 0, rip: false, bolt: false });
      if (name === 'bolting') run(play, 18, { x: 1, y: 0, rip: false, bolt: true });
      break;
    }
    case 'booster':
      quiet(play);
      giveBolted(w, 'booster');
      place(w, 80, 300, 0, 0);
      run(play, 70, { x: 1, y: 0, rip: false, bolt: false });
      break;
    case 'burn':
      quiet(play);
      giveBolted(w, 'booster');
      place(w, 60, 180, 0, 0);
      run(play, 30, { x: 1, y: 0, rip: true, bolt: false });
      break;
    case 'pause':
      run(play, 120);
      play.paused = true;
      break;
    case 'tuning':
      quiet(play);
      play.tuning.open = true;
      break;
    case 'flat':
      quiet(play);
      w.flat = true;
      play.tuning.open = true;
      break;
    case 'snapper': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, snapper: false };
      place(w, 300, 250, 0, 200);
      const a = addEnemy(w, 'snapper', 360, 230, -Math.PI / 2);
      Object.assign(a, { state: 'slide', t: 0.2, skidFor: 0.6, speed: 60, cd: 99, slideDir: -Math.PI / 2 });
      const b = addEnemy(w, 'snapper', 470, 140, Math.PI, { parts: ['treads', 'jaws'] });
      b.cd = 0;
      run(play, 10, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'parts': {
      quiet(play);
      for (const id of ['booster', 'treads', 'plow'] as const) giveBolted(w, id);
      place(w, 100, 300, 0, 0);
      const r = addRammer(w, 470, 120, Math.PI, { parts: ['booster', 'plow'] });
      r.cd = 99;
      const s = addEnemy(w, 'snapper', 520, 260, Math.PI, { parts: ['treads', 'jaws'] });
      s.cd = 99;
      run(play, 50, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'hopper': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, hopper: false };
      place(w, 320, 300, 0, 150);
      const a = addEnemy(w, 'hopper', 470, 220, Math.PI);
      beginCrouch(w, a, false);
      const b = addEnemy(w, 'hopper', 200, 150, 0);
      b.cd = 99;
      run(play, 30, { x: 1, y: 0, rip: false, bolt: false });
      // the second one mid-leap, high over the floor
      Object.assign(b, { state: 'air', t: w.t.hopAir / 2, sx: 160, sy: 140, tx: 240, ty: 200, stomp: false, x: 200, y: 170 });
      break;
    }
    case 'bouncer': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, bouncer: false };
      place(w, 140, 300, 0, 150);
      const a = addEnemy(w, 'bouncer', 400, 200, Math.PI);
      beginRoll(w, a);
      const b = addEnemy(w, 'bouncer', 520, 300, Math.PI);
      Object.assign(b, { state: 'roll', speed: 280, cd: 99 });
      // a Spring Rammer winding up at the wall: its lane shows the bounce
      const c = addRammer(w, 540, 110, -Math.PI / 4, { parts: ['booster', 'springs'] });
      beginWindup(w, c, false);
      run(play, 30, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'jets':
      quiet(play);
      giveBolted(w, 'jets');
      play.hints.seen = { ...play.hints.seen, jets: false };
      place(w, 300, 180, 0, 200);
      run(play, 20, { x: 1, y: 0, rip: true, bolt: false });
      break;
    case 'leap': {
      quiet(play);
      giveBolted(w, 'jets');
      const r = addRammer(w, 320, 140, Math.PI);
      r.cd = 99;
      place(w, 250, 140, 0, 230);
      w.player.rev = w.t.burnTapTime;
      run(play, 1, { x: 1, y: 0, rip: false, bolt: false });
      run(play, 12);
      break;
    }
    case 'springs':
      quiet(play);
      giveBolted(w, 'springs');
      play.hints.seen = { ...play.hints.seen, springs: false };
      place(w, 300, 40, -Math.PI / 2, 230);
      run(play, 6, { x: 0, y: -1, rip: false, bolt: false });
      break;
    case 'boost':
      quiet(play);
      play.hints.seen = { ...play.hints.seen, boost: false };
      place(w, 190, 88, 0, 150);
      run(play, 20, { x: 1, y: 0, rip: false, bolt: false });
      break;
    case 'oil': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, boost: true, oil: false };
      place(w, 230, 150, 0.3, 200);
      const s = addEnemy(w, 'snapper', 380, 210, Math.PI);
      Object.assign(s, { speed: 150, cd: 99 });
      run(play, 10, { x: 0, y: -1, rip: false, bolt: false });
      break;
    }
    case 'ramp': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, ramp: false };
      const r = addRammer(w, 300, 120, Math.PI);
      r.cd = 99;
      place(w, 170, 184, 0, 220);
      run(play, 14, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'crusher': {
      quiet(play);
      play.hints.seen = { ...play.hints.seen, crusher: false };
      place(w, 320, 184, 0, 120);
      const a = addRammer(w, 192, 128, 0);
      a.cd = 99;
      const b = addEnemy(w, 'snapper', 448, 240, Math.PI);
      b.cd = 99;
      // the left top plate (phase 0) mid-warning, the middle bottom one (0.5) just slammed
      w.tick = 150;
      run(play, 12, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'boss': {
      // winding up a charge at you from across the yard: the lane and the bounce off the wall
      quiet(play);
      play.hints.seen = { ...play.hints.seen, boss: false, crusher: true };
      place(w, 470, 260, Math.PI, 150);
      const b = addEnemy(w, 'compactor', 160, 140, 0, { parts: ['booster', 'springs', 'plow'] });
      b.hp = 9;
      beginBossWindup(w, b, false);
      run(play, 40, { x: 0, y: 1, rip: false, bolt: false });
      break;
    }
    case 'boss-open': {
      // stripped to its core, crouching to leap: the ring on the floor, a Snapper it called in
      quiet(play);
      play.hints.seen = { ...play.hints.seen, boss: true, crusher: true };
      giveBolted(w, 'booster');
      place(w, 420, 250, 0, 200);
      const b = addEnemy(w, 'compactor', 260, 150, 0, { parts: [] });
      b.hp = 4;
      beginCrouch(w, b, false);
      const s = addEnemy(w, 'snapper', 560, 100, Math.PI);
      s.cd = 99;
      run(play, 30, { x: 1, y: 0, rip: false, bolt: false });
      break;
    }
    case 'exits':
      w.wave.index = w.waves.length - 1;
      w.wave.phase = 'fight';
      w.player.hull = 3;
      run(play, 50);
      play.hints.seen = { ...play.hints.seen, exit: false };
      run(play, 2);
      break;
    case 'wipe':
      w.wave.index = w.waves.length - 1;
      w.wave.phase = 'exit';
      w.exits = w.exitPlan;
      w.result = 'exit';
      w.exitChoice = 0;
      play.wipe = { t: 0.42, swapped: false };
      play.update(0);
      break;
    case 'yard-kennel':
    case 'yard-lanes':
    case 'yard-pit':
    case 'yard-jaws':
    case 'yard-hurdles':
    case 'yard-pinball':
    case 'yard-slick':
    case 'yard-jumps':
    case 'yard-press':
    case 'yard-heap':
    case 'yard-compactor':
      run(play, 240);
      break;
    case 'cleared':
    case 'scrapped':
      run(play, 30);
      play.fx.banner = null;
      w.result = name;
      play.endT = 2;
      w.stats.ticks = 6123;
      w.stats.tears = 2;
      w.stats.slipHits = 9;
      w.stats.topSpeed = 288;
      if (name === 'scrapped') w.player.hull = 0;
      break;
  }
  play.frozen = true;
}
