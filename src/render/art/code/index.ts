// Code-drawn placeholder art (STYLE.md "Code-drawn placeholder rules"). Each module registers its
// sprite family with the atlas by final name, size and anchor; the art overhaul replaces pixels only.
import { registerTiles } from './tiles';
import { registerScrapper } from './scrapper';
import { registerRammer } from './rammer';
import { registerParts } from './parts';
import { registerFx } from './fx';
import { registerUi } from './ui';

export function registerCodeArt() {
  registerTiles();
  registerScrapper();
  registerRammer();
  registerParts();
  registerFx();
  registerUi();
}
