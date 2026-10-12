// The in-play HUD, kept on the wall band so it never covers the floor or a gate: hull and wave top
// left, the part slot top right (with towing and bolt progress), the speed gauge bottom left. Speed
// must read without it (STYLE.md), so it stays small.
import { C } from '../data/palette';
import { WAVES } from '../data/waves';
import { PARTS } from '../data/parts';
import { drawSprite, sprite } from '../render/atlas';
import { playerStats } from '../sim/body';
import type { World } from '../sim/world';
import { textWidth } from './font';
import type { UI } from './ui';

const GAUGE_MAX = 330;

export function drawHud(ui: UI, w: World, keys: { bolt: string }) {
  const p = w.player, t = w.t;

  // hull pips and wave, top left (the top center is a gate)
  const wave = `WAVE ${Math.min(WAVES.length, w.wave.index + 1)}/${WAVES.length}`;
  const wx = 8 + t.hull * 10 + 4;
  ui.fill(2, 1, wx + textWidth(wave) + 4 - 2, 14, C.ink);
  for (let i = 0; i < t.hull; i++) drawSprite(ui.ctx, sprite(i < p.hull ? 'ui:hull:full' : 'ui:hull:empty'), 6 + i * 10, 4);
  ui.text(wave, wx, 4, C.frost);

  // the part slot, top right, with the part's name and what you're towing to its left
  const sx = 622;
  const name = p.part ? PARTS[p.part].name.toUpperCase() : 'NO PART';
  const bolting = p.bolt !== null;
  const tow = p.tow ? (bolting ? 'BOLTING...' : `TOWING  ${keys.bolt}: BOLT ON`) : '';
  const nameW = textWidth(name);
  const left = sx - 6 - nameW - (tow ? textWidth(tow) + 10 : 0);
  ui.fill(left - 4, 1, 640 - left + 4, 14, C.ink);
  ui.fill(sx - 1, 0, 18, 16, C.floor0);
  if (p.part) drawSprite(ui.ctx, sprite(`icon:part:${p.part}`), sx, 0);
  ui.text(name, sx - 6, 4, p.part ? C.gold2 : C.lilac, { align: 'right' });
  if (tow) {
    ui.text(tow, sx - 6 - nameW - 10, 4, C.gold3, { align: 'right' });
    if (bolting) ui.fill(sx - 6 - nameW, 13, Math.max(1, Math.round(nameW * Math.min(1, p.bolt! / t.boltTime))), 1, C.gold);
  }

  // speed gauge, bottom left on the wall (the bottom center is a gate)
  const gw = 168, gx = 58, gy = 349;
  const at = (v: number) => gx + 1 + Math.round(((gw - 2) * Math.min(v, GAUGE_MAX)) / GAUGE_MAX);
  ui.fill(2, gy - 4, gx + gw + 28, 14, C.ink);
  ui.fill(gx, gy, gw, 6, C.plum);
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
  ui.text(tier, gx - 4, gy - 1, col, { align: 'right' });
  ui.text(`${Math.round(sp)}`, gx + gw + 4, gy - 1, C.mist);
}
