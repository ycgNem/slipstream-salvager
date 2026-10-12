// HUD pieces: the hull pips (8x8, anchor 0,0). Full is a little rust-orange hex bolt head with a
// plum outline; empty is just the dark outline of one.
import { defSprite } from '../../atlas';
import { tpl } from '../pixel';

const PIP = [
  '..oooo..',
  '.ohhbbo.',
  'ohbbbbdo',
  'obbssbdo',
  'obbssbdo',
  'odbbbddo',
  '.oddddo.',
  '..oooo..',
];

export function registerUi() {
  defSprite('ui:hull:full', {
    w: 8, h: 8, ox: 0, oy: 0,
    draw: (ctx) => tpl(ctx, PIP, 0, 0, { o: 0, h: 63, b: 21, d: 20, s: 19 }),
  });
  defSprite('ui:hull:empty', {
    w: 8, h: 8, ox: 0, oy: 0,
    draw: (ctx) => tpl(ctx, PIP, 0, 0, { o: 0, h: 1, d: 1 }),
  });
}
