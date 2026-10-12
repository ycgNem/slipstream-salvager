// The three first-time hints (PLAN.md 4.5): shown once each, in the world above the robot rather
// than as a checklist, and dropped as soon as you've done the thing.
import { C } from '../data/palette';
import type { World } from '../sim/world';
import type { SimEvent } from '../sim/events';
import type { UI } from './ui';

export type HintId = 'speed' | 'tear' | 'bolt';

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
    if (e.k === 'tear') this.done('tear');
    if (e.k === 'bolted') this.done('bolt');
  }

  update(w: World, dt: number) {
    if (!this.enabled) {
      this.current = null;
      return;
    }
    const want: HintId | null =
      !this.seen.bolt && w.player.tow ? 'bolt'
      : !this.seen.speed && w.wave.phase !== 'banner' ? 'speed'
      : !this.seen.tear && this.seen.speed && w.rammers.length > 0 ? 'tear'
      : null;
    if (want !== this.current) {
      this.current = want;
      this.shownFor = 0;
    }
    this.shownFor += dt;
  }

  draw(ui: UI, w: World, keys: { rip: string; bolt: string }) {
    if (!this.current) return;
    const text = this.current === 'speed' ? 'BUILD SPEED - THE CLAW TURNS TEAL'
      : this.current === 'tear' ? `HIT ITS BACK AT TEAL (${keys.rip}) TO TEAR THE BOOSTER OFF`
      : `TAP ${keys.bolt} TO BOLT IT ON`;
    const p = w.player;
    const y = p.y < 60 ? Math.round(p.y) + 18 : Math.round(p.y) - 34;
    const x = Math.max(110, Math.min(530, Math.round(p.x)));
    const blink = this.shownFor < 0.6 && Math.floor(this.shownFor * 10) % 2 === 1;
    ui.text(text, x, y, blink ? C.white : this.current === 'speed' ? C.speed4 : C.gold3, { align: 'center', shadow: C.ink });
  }
}
