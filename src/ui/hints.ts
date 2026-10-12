// The first-time hints (PLAN.md 4.5, 8.5, DECISIONS #51): shown once each, one at a time, when
// they're relevant (not as a checklist), and dropped as soon as you've done the thing. They sit on
// the bottom wall band so they never cover a lane (DECISIONS #44).
import { C } from '../data/palette';
import { MOUNTS } from '../data/mounts';
import type { PartId } from '../data/parts';
import type { World } from '../sim/world';
import type { SimEvent } from '../sim/events';
import type { UI } from './ui';
import { textWidth } from './font';

export type HintId = 'speed' | 'tear' | 'bolt' | 'burn' | 'exit' | 'treads' | 'plow' | 'jaws' | 'snapper' | 'plowfoe' | 'jawfoe';

/** a hint about a part you've bolted on, by part */
const PART_HINT: Record<PartId, HintId> = { booster: 'burn', treads: 'treads', plow: 'plow', jaws: 'jaws' };

export class Hints {
  seen: Record<string, boolean>;
  current: HintId | null = null;
  private shownFor = 0;
  enabled: boolean;
  onSeen: (seen: Record<string, boolean>) => void = () => {};

  constructor(seen: Record<string, boolean>, enabled: boolean) {
    this.seen = { ...seen };
    this.enabled = enabled;
  }

  private done(id: HintId) {
    if (this.seen[id]) return;
    this.seen[id] = true;
    if (this.current === id) this.current = null;
    this.onSeen(this.seen);
  }

  /** React to what just happened in the sim. */
  event(e: SimEvent) {
    if (e.k === 'tier' && e.tier === 'slip') this.done('speed');
    if (e.k === 'tear') {
      if (e.part === 'booster') this.done('tear');
      if (e.part === 'treads') this.done('snapper');
      if (e.part === 'plow') this.done('plowfoe');
      if (e.part === 'jaws') this.done('jawfoe');
    }
    if (e.k === 'joust') this.done('plowfoe');
    if (e.k === 'bolted') this.done('bolt');
    if (e.k === 'rip' && e.burn && e.tier === 'slip') this.done('burn');
    if (e.k === 'exit') this.done('exit');
    if (e.k === 'slide') this.done('treads');
    if (e.k === 'ram' && e.tier === 'slip') this.done('plow');
    if (e.k === 'sling') this.done('jaws');
  }

  update(w: World, dt: number) {
    if (!this.enabled) {
      this.current = null;
      return;
    }
    const p = w.player, s = this.seen;
    const bolted = w.flat ? [] : MOUNTS.map((m) => p.parts[m]?.id).filter((id): id is PartId => !!id);
    const partHint = bolted.map((id) => PART_HINT[id]).find((h) => !s[h]);
    const foes = (part: PartId) => w.enemies.some((e) => Object.values(e.parts).includes(part));
    const want: HintId | null =
      !s.bolt && p.tow ? 'bolt'
      : !s.exit && w.exits.length ? 'exit'
      : partHint ? partHint
      : !s.speed && w.wave.phase !== 'banner' ? 'speed'
      : !s.plowfoe && foes('plow') ? 'plowfoe'
      : !s.jawfoe && foes('jaws') ? 'jawfoe'
      : !s.snapper && s.speed && w.enemies.some((e) => e.kind === 'snapper' && e.parts.sides) ? 'snapper'
      : !s.tear && s.speed && w.enemies.some((e) => e.parts.rear === 'booster') ? 'tear'
      : null;
    if (want !== this.current) {
      this.current = want;
      this.shownFor = 0;
    }
    this.shownFor += dt;
  }

  /** On the bottom wall band, right of the gate: a fixed spot, so a hint never covers a lane. */
  draw(ui: UI, keys: { rip: string; bolt: string }) {
    if (!this.current) return;
    const TEXT: Record<HintId, string> = {
      speed: 'BUILD SPEED - THE CLAW TURNS TEAL',
      tear: `DODGE ITS CHARGE, THEN HIT ITS BACK AT TEAL (${keys.rip})`,
      burn: `HOLD ${keys.rip} TO REV A BURN, LET GO TO LAUNCH`,
      bolt: `TAP ${keys.bolt} TO BOLT IT ON`,
      exit: 'DRIVE OUT A GATE - ITS SIGN SHOWS THE SALVAGE',
      treads: 'PUSH BACK HARD AT SPEED TO POWER-SLIDE ROUND',
      plow: 'DRIVE INTO THEM AT TEAL - YOUR FRONT IS A RAM',
      jaws: 'A TEAL HIT BITES ON AND SLINGS YOU BACK OUT',
      snapper: 'GET BEHIND A SNAPPER AT TEAL TO RIP ITS TREADS',
      plowfoe: 'A PLOW TAKES NOTHING - JOUST ITS CHARGE HEAD-ON',
      jawfoe: 'HIT ITS JAWS HEAD-ON AT TEAL TO TEAR THEM OFF',
    };
    const text = TEXT[this.current];
    const speedy = this.current === 'speed' || this.current === 'burn' || this.current === 'treads' || this.current === 'plow' || this.current === 'jaws';
    const tw = textWidth(text);
    ui.fill(632 - tw - 4, 345, tw + 8, 14, C.ink);
    const blink = this.shownFor < 0.6 && Math.floor(this.shownFor * 10) % 2 === 1;
    ui.text(text, 632, 348, blink ? C.white : speedy ? C.speed4 : C.gold3, { align: 'right' });
  }
}
