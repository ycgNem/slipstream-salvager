// The dev tuning panel (DECISIONS #18, #28): every movement and combat number, editable while you
// play, with flat mode (the removal test as an A/B) and a Copy button whose output pastes into
// src/data/tuning.ts. Only in dev builds or with ?debug in the address.
import { C } from '../data/palette';
import { DEFAULT_TUNING, TUNING_GROUPS, defaultTuning, type Tuning, type TuningKey } from '../data/tuning';
import type { UI } from '../ui/ui';
import { PARTS, PART_IDS, type PartId } from '../data/parts';

/** The numbers new encounters start with (edits here carry over to Again). */
export const LIVE: { t: Tuning; flat: boolean; parts: PartId[] } = { t: defaultTuning(), flat: false, parts: [] };

const round = (v: number) => Math.round(v * 1000) / 1000;

export class TuningPanel {
  open = false;
  scroll = 0;
  private note = '';
  private noteT = 0;

  /** Changes from the defaults, as lines to paste into DEFAULT_TUNING. */
  diff(): string {
    const lines: string[] = [];
    for (const k of Object.keys(DEFAULT_TUNING) as TuningKey[]) if (LIVE.t[k] !== DEFAULT_TUNING[k]) lines.push(`  ${k}: ${round(LIVE.t[k])},`);
    return lines.length ? lines.join('\n') : '// no changes from the defaults';
  }

  /** setPart: bolt a part on now (or take it off), so a whole run can be played with it */
  draw(ui: UI, worldT: Tuning, setFlat: (on: boolean) => void, setPart: (id: PartId, on: boolean) => void, dt: number) {
    if (!this.open) return;
    this.noteT = Math.max(0, this.noteT - dt);
    const x = 446, y = 28, w = 190, h = 316;
    ui.panel(x, y, w, h, 'dark');
    ui.text('TUNING', x + 6, y + 5, C.white);
    ui.text('` TO CLOSE', x + w - 6, y + 5, C.lilac, { align: 'right' });
    const flat = ui.toggle('t-flat', x + 6, y + 18, w - 12, 'FLAT MODE (REMOVAL TEST)', LIVE.flat);
    if (flat !== LIVE.flat) {
      LIVE.flat = flat;
      setFlat(flat);
    }
    // start with a part: one small toggle per part
    ui.text('START WITH', x + 6, y + 31, C.mist);
    PART_IDS.forEach((id, i) => {
      const on = LIVE.parts.includes(id);
      if (ui.button(`t-part-${id}`, x + 62 + i * 21, y + 29, 20, 11, id.slice(0, 3).toUpperCase(), { active: on })) {
        LIVE.parts = on ? LIVE.parts.filter((q) => q !== id) : [...LIVE.parts.filter((q) => PARTS[q].mount !== PARTS[id].mount), id];
        setPart(id, !on);
      }
    });
    if (ui.button('t-copy', x + 6, y + 42, 56, 12, 'COPY')) {
      const text = this.diff();
      try {
        navigator.clipboard?.writeText(text);
        this.note = 'COPIED';
      } catch {
        this.note = 'COPY FAILED';
      }
      console.log(text);
      this.noteT = 1.5;
    }
    if (ui.button('t-reset', x + 68, y + 42, 56, 12, 'RESET')) {
      Object.assign(LIVE.t, defaultTuning());
      Object.assign(worldT, defaultTuning());
    }
    if (this.noteT > 0) ui.text(this.note, x + w - 6, y + 44, C.white, { align: 'right' });

    // the list, clipped and scrolled with the wheel
    const lx = x + 4, ly = y + 60, lh = h - 64;
    if (ui.hover(x, y, w, h)) this.scroll = Math.max(0, this.scroll + ui.input.mouse.wheel * 20);
    const ctx = ui.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx, ly, w - 8, lh);
    ctx.clip();
    let cy = ly - this.scroll;
    for (const g of TUNING_GROUPS) {
      if (cy > ly - 12 && cy < ly + lh) ui.text(g.title.toUpperCase(), lx + 2, cy + 2, C.white);
      cy += 12;
      for (const [k, step] of g.keys) {
        const visible = cy > ly - 2 && cy < ly + lh - 10;
        if (visible) {
          const changed = LIVE.t[k] !== DEFAULT_TUNING[k];
          ui.text(k, lx + 2, cy + 1, changed ? C.white : C.mist);
          ui.text(String(round(LIVE.t[k])), lx + w - 40, cy + 1, changed ? C.cruiseHi : C.frost, { align: 'right' });
          if (ui.button('t-' + k + '-', lx + w - 36, cy, 12, 10, '-')) set(k, LIVE.t[k] - step);
          if (ui.button('t-' + k + '+', lx + w - 22, cy, 12, 10, '+')) set(k, LIVE.t[k] + step);
        }
        cy += 11;
      }
      cy += 2;
    }
    ctx.restore();
    const total = cy + this.scroll - ly;
    this.scroll = Math.min(this.scroll, Math.max(0, total - lh));

    function set(k: TuningKey, v: number) {
      v = round(Math.max(0, v));
      LIVE.t[k] = v;
      worldT[k] = v;
    }
  }
}
