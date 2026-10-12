// The Garage (PLAN.md 9.6): where a run starts. Pick a chassis (a card each: the body, its name,
// its line; a locked one shows how to unlock it) and any unlocked run modifiers, then START.
import { C } from '../data/palette';
import { CHASSIS, CHASSIS_IDS, type ChassisId } from '../data/chassis';
import { isUnlocked, MOD_IDS, MODS, unlockText, type Career, type ModId } from '../data/unlocks';
import { defaultTuning } from '../data/tuning';
import { drawFit, drawSprite, sprite } from '../render/atlas';
import { silhouette } from '../render/pixgeom';
import type { UI } from '../ui/ui';
import type { PlayOpts } from './play';

export interface GarageHost {
  career(): Career;
  startPlay(opts: PlayOpts): void;
  toTitle(): void;
  backPressed(): boolean;
}

export class Garage {
  chassis: ChassisId = 'scrapper';
  mods: ModId[] = [];

  draw(ui: UI, host: GarageHost, time: number) {
    const c = host.career();
    // a choice that has since become locked (a reset save) falls back to the Scrapper
    if (!isUnlocked(this.chassis, c)) this.chassis = 'scrapper';
    this.mods = this.mods.filter((m) => isUnlocked(m, c));
    ui.text('THE GARAGE', 320, 12, C.cruiseHi, { align: 'center', scale: 2, shadow: C.rust0 });

    // the chassis cards
    const cw = 172, gap = 14, x0 = 320 - Math.floor((cw * 3 + gap * 2) / 2), y = 40, ch = 158;
    CHASSIS_IDS.forEach((id, i) => {
      const def = CHASSIS[id], x = x0 + i * (cw + gap), open = isUnlocked(id, c), on = this.chassis === id;
      ui.panel(x, y, cw, ch, on ? 'metal' : 'dark');
      const name = `pl:${id}:drive:se:${on ? Math.floor(time * 6) % 2 : 0}`, s = sprite(name);
      if (open) drawFit(ui.ctx, s, x + cw / 2 - 32, y + 6, 64, 64);
      else ui.ctx.drawImage(silhouette(s, name, C.ink), 0, 0, s.w, s.h, x + cw / 2 - 32, y + 6, 64, 64);
      ui.text(def.name, x + cw / 2, y + 72, open ? C.white : C.mist, { align: 'center' });
      // its hull, as the HUD shows it: the trade you're making
      const hull = def.tuning.hull ?? defaultTuning().hull, pip = sprite('ui:hull:full');
      for (let k = 0; k < hull; k++) drawSprite(ui.ctx, pip, x + cw / 2 - Math.floor((hull * 9 - 1) / 2) + k * 9, y + 83);
      if (open) ui.para(def.line, x + 10, y + 96, cw - 20, on ? C.white : C.frost);
      else {
        ui.text('LOCKED', x + cw / 2, y + 96, C.lilac, { align: 'center' });
        ui.para(unlockText(id as Exclude<ChassisId, 'scrapper'>, c), x + 10, y + 108, cw - 20, C.mist);
      }
      if (ui.button(`g-${id}`, x + 14, y + ch - 26, cw - 28, 18, !open ? 'LOCKED' : on ? 'TAKEN' : 'TAKE IT', { active: on, disabled: !open, row: 'cards' })) this.chassis = id;
    });

    // the modifiers
    const my = y + ch + 14;
    ui.text('RUN MODIFIERS', x0, my, C.lilac);
    MOD_IDS.forEach((m, i) => {
      const def = MODS[m], ry = my + 14 + i * 14, w = cw * 3 + gap * 2;
      if (isUnlocked(m, c)) {
        const on = ui.toggle(`g-${m}`, x0, ry, w, `${def.name} - ${def.line}`, this.mods.includes(m));
        if (on !== this.mods.includes(m)) this.mods = on ? [...this.mods, m] : this.mods.filter((q) => q !== m);
      } else {
        ui.text(`${def.name} - LOCKED: ${unlockText(m, c)}`, x0, ry, C.slate);
      }
    });

    if (ui.button('g-start', 260, 290, 120, 22, 'START')) host.startPlay({ chassis: this.chassis, mods: [...this.mods] });
    if (ui.button('g-back', 260, 318, 120, 16, 'BACK') || host.backPressed()) host.toTitle();
  }
}
