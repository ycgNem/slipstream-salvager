// The in-play HUD: hull pips, wave, the part slot and towed part with bolt progress, and the speed
// gauge with its two marks. Speed must read without it (STYLE.md), so it stays small and at the
// edges.
import { C } from '../data/palette';
import { WAVES } from '../data/waves';
import { PARTS } from '../data/parts';
import { drawFit, drawSprite, sprite } from '../render/atlas';
import { playerStats } from '../sim/body';
import type { World } from '../sim/world';
import type { UI } from './ui';

const GAUGE_MAX = 330;

export function drawHud(ui: UI, w: World, keys: { bolt: string }) {
  const p = w.player, t = w.t;

  // hull pips, top left
  ui.fill(4, 4, 6 + t.hull * 10, 14, C.ink);
  for (let i = 0; i < t.hull; i++) drawSprite(ui.ctx, sprite(i < p.hull ? 'ui:hull:full' : 'ui:hull:empty'), 8 + i * 10, 7);

  // wave, top left beside the hull (the top center is a gate)
  const wn = Math.min(WAVES.length, w.wave.index + 1);
  ui.text(`WAVE ${wn}/${WAVES.length}`, 14 + t.hull * 10, 7, C.mist, { shadow: C.ink });

  // part slot, top right
  const sx = 640 - 24, sy = 4;
  ui.panel(sx, sy, 20, 20, 'inset');
  if (p.part) drawFit(ui.ctx, sprite(`icon:part:${p.part}`), sx + 2, sy + 2, 16, 16);
  ui.text(p.part ? PARTS[p.part].name.toUpperCase() : 'NO PART', sx - 4, sy + 2, p.part ? C.gold2 : C.lilac, { align: 'right', shadow: C.ink });
  if (p.tow) {
    const bolting = p.bolt !== null;
    ui.text(bolting ? 'BOLTING...' : `TOWING  ${keys.bolt}: BOLT ON`, sx - 4, sy + 12, C.gold3, { align: 'right', shadow: C.ink });
    if (bolting) {
      ui.fill(sx, sy + 22, 20, 3, C.ink);
      ui.fill(sx + 1, sy + 23, Math.round(18 * Math.min(1, p.bolt! / t.boltTime)), 1, C.gold);
    }
  }

  // speed gauge, bottom left on the wall (the bottom center is a gate)
  const gw = 168, gx = 58, gy = 349;
  const at = (v: number) => gx + 1 + Math.round(((gw - 2) * Math.min(v, GAUGE_MAX)) / GAUGE_MAX);
  ui.fill(gx, gy, gw, 6, C.ink);
  const sp = p.speed;
  const seg = (a: number, b: number, c: number) => {
    const x0 = at(a), x1 = at(Math.min(b, sp));
    if (x1 > x0) ui.fill(x0, gy + 1, x1 - x0, 4, c);
  };
  seg(0, t.cruiseAt, C.crawl);
  seg(t.cruiseAt, t.slipAt, C.cruise);
  seg(t.slipAt, GAUGE_MAX, C.speed3);
  // the two marks and your top speed
  for (const v of [t.cruiseAt, t.slipAt]) ui.fill(at(v), gy - 2, 1, 10, C.frost);
  ui.fill(at(playerStats(w).topSpeed), gy - 1, 1, 8, C.lilac);
  const tier = p.tier === 'slip' ? 'SLIPSTREAM' : p.tier === 'cruise' ? 'CRUISE' : 'CRAWL';
  const col = p.tier === 'slip' ? C.speed4 : p.tier === 'cruise' ? C.cruiseHi : C.crawlHi;
  ui.text(tier, gx - 4, gy - 2, col, { align: 'right', shadow: C.ink });
  ui.text(`${Math.round(sp)}`, gx + gw + 4, gy - 2, C.mist, { shadow: C.ink });
}
