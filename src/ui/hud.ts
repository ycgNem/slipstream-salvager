// The in-play HUD, kept on the wall band so it never covers the floor or a gate: hull and wave top
// left, The Compactor's bar left of the north gate while it's in the yard, the three part slots top
// right (rear, sides, front; with towing and bolt progress), the speed gauge bottom left. Speed
// must read without it (STYLE.md), so it stays small.
import { C } from '../data/palette';
import { PARTS } from '../data/parts';
import { MOUNTS } from '../data/mounts';
import { drawSprite, sprite } from '../render/atlas';
import { crack } from '../render/pixgeom';
import { playerStats } from '../sim/body';
import type { World } from '../sim/world';
import { textWidth } from './font';
import type { UI } from './ui';

const GAUGE_MAX = 330;

/** label: what goes after the hull pips (the yard and wave in a run) */
export function drawHud(ui: UI, w: World, keys: { bolt: string }, label?: string) {
  const p = w.player, t = w.t;

  // hull pips and wave, top left (the top center is a gate)
  const wave = label ?? `WAVE ${Math.min(w.waves.length, w.wave.index + 1)}/${w.waves.length}`;
  const wx = 8 + t.hull * 10 + 4;
  ui.fill(2, 1, wx + textWidth(wave) + 4 - 2, 14, C.ink);
  for (let i = 0; i < t.hull; i++) drawSprite(ui.ctx, sprite(i < p.hull ? 'ui:hull:full' : 'ui:hull:empty'), 6 + i * 10, 4);
  ui.text(wave, wx, 4, C.frost);

  // The Compactor: its name and a pip per hull point, on the wall band left of the north gate
  const boss = w.enemies.find((e) => e.kind === 'compactor');
  if (boss) {
    const name = 'COMPACTOR', bx = 300 - t.compactorHp * 4 - 4 - textWidth(name);
    ui.fill(bx - 4, 1, 300 - bx + 6, 14, C.ink);
    ui.text(name, bx, 4, C.mist);
    const px0 = bx + textWidth(name) + 4;
    for (let i = 0; i < t.compactorHp; i++) ui.fill(px0 + i * 4, 4, 3, 7, i < boss.hp ? C.frost : C.plum);
  }

  // the three part slots, top right, with what you're towing to their left
  const slotX = (i: number) => 584 + i * 18;
  const bolting = p.bolt !== null;
  const tow = p.tow ? (bolting ? `BOLTING ${PARTS[p.tow.part].name.toUpperCase()}...` : `${PARTS[p.tow.part].name.toUpperCase()}  ${keys.bolt}: BOLT ON`) : '';
  const left = slotX(0) - 6 - (tow ? textWidth(tow) + 4 : 0);
  ui.fill(left - 4, 1, 640 - left + 2, 14, C.ink);
  MOUNTS.forEach((m, i) => {
    const b = p.parts[m], x = slotX(i);
    ui.fill(x - 1, 0, 18, 16, C.floor0);
    if (b) {
      drawSprite(ui.ctx, sprite(`icon:part:${b.id}`), x, 0);
      if (b.cracked) crack(ui.ctx, x + 8, 8);
    } else {
      // an empty mount: a dim socket
      ui.fill(x + 5, 5, 6, 6, C.plum);
      ui.fill(x + 6, 6, 4, 4, C.ink);
    }
    // the slot a towed part will go on
    if (p.tow && PARTS[p.tow.part].mount === m) ui.fill(x, 15, 16, 1, bolting ? C.gold : C.gold0);
  });
  if (tow) {
    ui.text(tow, slotX(0) - 6, 4, C.gold3, { align: 'right' });
    if (bolting) {
      const tw = textWidth(tow);
      ui.fill(slotX(0) - 6 - tw, 13, Math.max(1, Math.round(tw * Math.min(1, p.bolt! / t.boltTime))), 1, C.gold);
    }
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

