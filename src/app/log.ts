// The Log (PLAN.md 9.6): every enemy and every part, a card each with its sprite, its name, its line
// and your counts. One you haven't met is a dark silhouette and "???".
import { C } from '../data/palette';
import { PARTS, PART_IDS } from '../data/parts';
import type { EnemyKind } from '../data/parts';
import { sprite } from '../render/atlas';
import { silhouette } from '../render/pixgeom';
import type { UI } from '../ui/ui';
import type { LogBook } from './settings';

const ENEMIES: { kind: EnemyKind; name: string; sprite: string; line: string }[] = [
  { kind: 'rammer', name: 'RAMMER', sprite: 'en:rammer:stalk:se:0', line: 'CHARGES DOWN A RED LANE. DODGE, THEN HIT ITS BACK.' },
  { kind: 'snapper', name: 'SNAPPER', sprite: 'en:snapper:hunt:se:0', line: 'HUNTS FAST AND SNAPS. GET BEHIND IT.' },
  { kind: 'hopper', name: 'HOPPER', sprite: 'en:hopper:stalk:se:0', line: "LEAPS ONTO A RED RING. HIT IT WHILE IT'S STUCK." },
  { kind: 'bouncer', name: 'BOUNCER', sprite: 'en:bouncer:idle:se:0', line: 'ROLLS OFF THE WALLS. CUT ACROSS IT.' },
  { kind: 'compactor', name: 'COMPACTOR', sprite: 'bo:compactor:stalk:se:0', line: 'EACH PART IS ONE OF ITS MOVES. TAKE IT APART.' },
];

const PART_LINES: Record<string, string> = {
  booster: 'FASTER. HOLD RIP TO REV A BURN.',
  treads: 'PULL BACK AT SPEED TO POWER-SLIDE.',
  plow: 'RAM THEM AT TEAL. BLOCKS A CHARGE.',
  jaws: 'A TEAL HIT BITES ON AND SLINGS YOU.',
  jets: 'HOLD TO CROUCH, LET GO TO LEAP.',
  springs: 'BOUNCE OFF WALLS INSTEAD OF CLANKING.',
};

export function drawLog(ui: UI, log: LogBook, onBack: () => void, backPressed: boolean) {
  ui.text('THE LOG', 320, 8, C.cruiseHi, { align: 'center', scale: 2, shadow: C.rust0 });
  const card = (x: number, y: number, w: number, h: number, name: string, spr: string, line: string, counts: string, seen: boolean) => {
    ui.panel(x, y, w, h, 'dark');
    // the drawFit rule (a whole-number scale into 40x40), for the sprite or its dark silhouette
    const s = sprite(spr), k = Math.floor(Math.min(40 / s.w, 40 / s.h)), d = Math.ceil(Math.max(s.w / 40, s.h / 40));
    const [dw, dh] = k >= 1 ? [s.w * k, s.h * k] : [Math.floor(s.w / d), Math.floor(s.h / d)];
    const img = seen ? s.img : silhouette(s, spr, C.ink), sx = seen ? s.x : 0, sy = seen ? s.y : 0;
    ui.ctx.drawImage(img, sx, sy, s.w, s.h, Math.round(x + w / 2 - dw / 2), Math.round(y + 24 - dh / 2), dw, dh);
    ui.text(seen ? name : '???', x + w / 2, y + 47, seen ? C.white : C.mist, { align: 'center' });
    if (seen) {
      ui.para(line, x + 5, y + 59, w - 10, C.frost);
      ui.text(counts, x + w / 2, y + h - 12, C.lilac, { align: 'center' });
    }
  };
  // the enemies, then the parts
  const ew = 120, eg = 4, ex = 320 - Math.floor((ew * 5 + eg * 4) / 2);
  ui.text('ENEMIES', ex, 30, C.lilac);
  ENEMIES.forEach((e, i) => {
    const met = log.met[e.kind] ?? 0, wrecked = log.wrecked[e.kind] ?? 0;
    card(ex + i * (ew + eg), 40, ew, 118, e.name, e.sprite, e.line, `MET ${met}  WRECKED ${wrecked}`, met > 0);
  });
  const pw = 100, pg = 4, px = 320 - Math.floor((pw * 6 + pg * 5) / 2);
  ui.text('PARTS', px, 166, C.lilac);
  PART_IDS.forEach((id, i) => {
    const torn = log.torn[id] ?? 0, bolted = log.bolted[id] ?? 0;
    card(px + i * (pw + pg), 176, pw, 140, PARTS[id].name.toUpperCase(), `pickup:${id}`, PART_LINES[id], `TORN ${torn}  ON ${bolted}`, torn + bolted > 0);
  });
  if (ui.button('l-back', 260, 326, 120, 18, 'BACK') || backPressed) onBack();
}
