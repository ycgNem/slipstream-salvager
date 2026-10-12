// Imported art (STYLE.md "The art overhaul"): every packed sheet in src/art/ (made by
// scripts/sprites-import.mjs from the pixel-art build scripts) registers its frames by sprite name,
// and an imported frame wins over the code-drawn placeholder once its sheet has loaded.
// A manifest entry's `match` is a sprite name or a pattern: `*` matches one `:`-segment and a
// final `**` matches the rest.
import { defImageFamily, defImageSprite } from '../atlas';

interface Manifest {
  name: string;
  file: string;
  sprites: { match: string; r: [number, number, number, number]; o: [number, number]; flipX?: boolean; recolor?: Record<string, string> }[];
}

const manifests = import.meta.glob<Manifest>('../../art/*.json', { eager: true, import: 'default' });
const urls = import.meta.glob<string>('../../art/*.png', { eager: true, query: '?url', import: 'default' });

/** Does a sprite name match a manifest pattern? */
export function matchName(pattern: string, name: string): boolean {
  if (!pattern.includes('*')) return pattern === name;
  const p = pattern.split(':'), n = name.split(':');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '**' && i === p.length - 1) return n.length >= i;
    if (i >= n.length) return false;
    if (p[i] !== '*' && p[i] !== n[i]) return false;
  }
  return p.length === n.length;
}

export function registerImportedArt() {
  for (const [path, m] of Object.entries(manifests)) {
    const url = urls[path.replace(/\.json$/, '.png')];
    if (!url) continue;
    const frame = (s: Manifest['sprites'][number]) => ({ url, x: s.r[0], y: s.r[1], w: s.r[2], h: s.r[3], ox: s.o[0], oy: s.o[1], flipX: s.flipX, recolor: s.recolor });
    const exact = m.sprites.filter((s) => !s.match.includes('*'));
    const patterns = m.sprites.filter((s) => s.match.includes('*'));
    for (const s of exact) defImageSprite(s.match, frame(s));
    if (patterns.length) {
      // first match wins, in recipe order
      defImageFamily('', [url], (name) => {
        const s = patterns.find((q) => matchName(q.match, name));
        return s ? frame(s) : null;
      });
    }
  }
}
