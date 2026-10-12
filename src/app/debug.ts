// Scripted scenes for the screenshot sweep (e2e/screens.mjs): each puts the game into one state and
// freezes the sim there, so every screen and every feedback state can be checked for overlaps.
import { addRammer, giveBolted, type World } from '../sim/world';
import { beginWindup } from '../sim/rammer';
import { step } from '../sim/tick';
import { NO_INPUT, type InputFrame } from '../sim/world';
import type { App } from './app';
import type { Play } from './play';

export const SCENES = [
  'title', 'settings', 'play', 'crawl', 'cruise', 'slip', 'telegraph-track', 'telegraph-lock', 'hitstop',
  'towing', 'bolting', 'booster', 'burn', 'pause', 'tuning', 'cleared', 'scrapped', 'flat',
] as const;
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
  app.startPlay(3);
  const play = app.play!;
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
