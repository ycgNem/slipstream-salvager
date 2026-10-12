// Sprite atlas: sprites are generated lazily (by code, or cut from imported PNG sheets) and packed
// into shared pages.
import { makeCanvas, ctx2d, Ctx } from './art/pixel';

export interface Sprite {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  /** anchor offset (pixels) used when drawing at a world position */
  ox: number;
  oy: number;
}

const PAGE = 2048;
interface Page { c: HTMLCanvasElement; ctx: Ctx; shelfY: number; shelfH: number; x: number }
const pages: Page[] = [];

function newPage(): Page {
  const c = makeCanvas(PAGE, PAGE);
  const p = { c, ctx: ctx2d(c), shelfY: 0, shelfH: 0, x: 0 };
  pages.push(p);
  return p;
}

function alloc(w: number, h: number): { p: Page; x: number; y: number } {
  let p = pages[pages.length - 1] ?? newPage();
  if (p.x + w + 1 > PAGE) {
    p.shelfY += p.shelfH + 1;
    p.shelfH = 0;
    p.x = 0;
  }
  if (p.shelfY + h + 1 > PAGE) {
    p = newPage();
  }
  const x = p.x, y = p.shelfY;
  p.x += w + 1;
  p.shelfH = Math.max(p.shelfH, h);
  return { p, x, y };
}

export type Gen = { w: number; h: number; ox?: number; oy?: number; draw: (ctx: Ctx, c: HTMLCanvasElement) => void; big?: boolean };
const generators = new Map<string, Gen | ((name: string) => Gen | null)>();
const cache = new Map<string, Sprite>();
const prefixGens: [string, (name: string) => Gen | null][] = [];

/** Register a named sprite generator. */
export function defSprite(name: string, gen: Gen) {
  generators.set(name, gen);
}

/** Register a generator for all sprites whose name starts with prefix. */
export function defSpriteFamily(prefix: string, fn: (name: string) => Gen | null) {
  prefixGens.push([prefix, fn]);
}

/**
 * Is imported art for this sprite name loaded? False while its sheet is still loading, so hooks
 * that only exist for imported art keep their fallback until then.
 */
export function hasImage(name: string): boolean {
  const f = imageFrame(name);
  return !!f && !!sheets.get(f.url)?.canvas;
}

export function hasSprite(name: string) {
  return cache.has(name) || generators.has(name) || prefixGens.some(([p]) => name.startsWith(p));
}

let missing: Sprite | null = null;
function missingSprite(): Sprite {
  if (!missing) {
    const c = makeCanvas(16, 16);
    const ctx = ctx2d(c);
    ctx.fillStyle = '#d14b6a';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1a1220';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);
    missing = { img: c, x: 0, y: 0, w: 16, h: 16, ox: 0, oy: 0 };
  }
  return missing;
}

// ---- PNG sprite sheets ----
// Imported art (src/art/*.png, made with scripts/art-import.mjs) registers frames under the same
// names as the procedural sprites it replaces. A sheet wins over a generator once it has loaded.

/** One frame cut out of a sheet. Coordinates are sheet pixels; ox/oy is the anchor as in Sprite. */
export interface ImageFrame {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ox?: number;
  oy?: number;
  /** store the frame mirrored (for a sheet's left-facing row, which the renderer flips back) */
  flipX?: boolean;
  /** exact-color swaps applied to the frame, '#rrggbb' -> '#rrggbb' (palette swaps for looks) */
  recolor?: Record<string, string>;
}
/** waiting: names drawn with the fallback while the sheet loaded; dropped from the cache on load */
interface Sheet { canvas?: HTMLCanvasElement; failed?: boolean; ready: Promise<void>; waiting: Set<string> }
const sheets = new Map<string, Sheet>();
const imageSprites = new Map<string, ImageFrame>();
const imageFamilies: [string, (name: string) => ImageFrame | null][] = [];

function loadSheet(url: string): Sheet {
  let sh = sheets.get(url);
  if (sh) return sh;
  const img = new Image();
  const entry: Sheet = {
    waiting: new Set(),
    ready: new Promise<void>((res) => {
      img.onload = () => {
        const c = makeCanvas(img.width, img.height);
        ctx2d(c).drawImage(img, 0, 0);
        entry.canvas = c;
        for (const n of entry.waiting) cache.delete(n);
        entry.waiting.clear();
        res();
      };
      img.onerror = () => {
        console.error('sprite sheet failed to load', url);
        entry.failed = true;
        res();
      };
    }),
  };
  img.src = url;
  sheets.set(url, entry);
  return entry;
}

/** Register one sprite cut from a PNG sheet (loaded in the background; see artReady). */
export function defImageSprite(name: string, frame: ImageFrame) {
  loadSheet(frame.url);
  imageSprites.set(name, frame);
}

/** Register PNG frames for every sprite whose name starts with prefix; fn returns null to fall back. */
export function defImageFamily(prefix: string, urls: string[], fn: (name: string) => ImageFrame | null) {
  for (const u of urls) loadSheet(u);
  imageFamilies.push([prefix, fn]);
}

/** Resolves when every registered sheet has loaded (or failed and fallen back to the procedural art). */
export function artReady(): Promise<void> {
  return Promise.all([...sheets.values()].map((s) => s.ready)).then(() => {});
}

function imageFrame(name: string): ImageFrame | null {
  const f = imageSprites.get(name);
  if (f) return f;
  for (const [p, fn] of imageFamilies) if (name.startsWith(p)) {
    const r = fn(name);
    if (r) return r;
  }
  return null;
}

function hexRGB(h: string): number {
  return parseInt(h.slice(1), 16);
}

/** A generator that copies a sheet frame (mirrored and recolored if asked). */
function frameGen(f: ImageFrame, src: HTMLCanvasElement): Gen {
  const ox = f.ox ?? 0;
  return {
    w: f.w, h: f.h, oy: f.oy ?? 0,
    // a mirrored frame keeps its anchor on the same pixel column
    ox: f.flipX ? f.w - ox : ox,
    draw: (ctx) => {
      ctx.save();
      if (f.flipX) { ctx.translate(f.w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(src, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      ctx.restore();
      if (!f.recolor) return;
      const map = new Map<number, number>();
      for (const [a, b] of Object.entries(f.recolor)) map.set(hexRGB(a), hexRGB(b));
      const id = ctx.getImageData(0, 0, f.w, f.h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const to = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        if (to !== undefined) { d[i] = to >> 16; d[i + 1] = (to >> 8) & 255; d[i + 2] = to & 255; }
      }
      ctx.putImageData(id, 0, 0);
    },
  };
}

/** every sprite name this page has drawn by code (a generator) instead of from an imported sheet */
export const codeDrawn = new Set<string>();

export function sprite(name: string): Sprite {
  let s = cache.get(name);
  if (s) return s;
  const base = name;
  let g: Gen | undefined;
  /** its sheet is still loading: draw the fallback (or nothing) until it lands */
  let pending = false;
  {
    const f = imageFrame(base);
    if (f) {
      const sh = loadSheet(f.url);
      if (sh.canvas) g = frameGen(f, sh.canvas);
      else if (!sh.failed) {
        sh.waiting.add(name);
        pending = true;
      }
    }
  }
  if (!g) {
    g = generators.get(base) as Gen | undefined;
    if (!g) {
      for (const [p, fn] of prefixGens) {
        if (base.startsWith(p)) {
          const r = fn(base);
          if (r) { g = r; break; }
        }
      }
    }
    // names drawn by code rather than an imported sheet (e2e/coverage.mjs --drawn lists them)
    if (g) codeDrawn.add(base);
  }
  if (!g && pending) {
    // imported-only art whose sheet hasn't loaded yet: blank for a frame or two, not missing
    s = { img: makeCanvas(1, 1), x: 0, y: 0, w: 1, h: 1, ox: 0, oy: 0 };
    cache.set(name, s);
    return s;
  }
  if (!g) {
    if (import.meta.env?.DEV) console.warn('missing sprite', name);
    s = missingSprite();
    cache.set(name, s);
    return s;
  }
  const tmp = makeCanvas(g.w, g.h);
  const tctx = ctx2d(tmp);
  g.draw(tctx, tmp);
  if (g.big || g.w > 256 || g.h > 256) {
    s = { img: tmp, x: 0, y: 0, w: g.w, h: g.h, ox: g.ox ?? 0, oy: g.oy ?? 0 };
  } else {
    const a = alloc(g.w, g.h);
    a.p.ctx.drawImage(tmp, a.x, a.y);
    s = { img: a.p.c, x: a.x, y: a.y, w: g.w, h: g.h, ox: g.ox ?? 0, oy: g.oy ?? 0 };
  }
  cache.set(name, s);
  return s;
}

/** Draw a sprite with its anchor at (x, y). */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1, flipX = false) {
  if (flipX) {
    ctx.save();
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.img, s.x, s.y, s.w, s.h, -s.ox * scale, Math.round(y - s.oy * scale), s.w * scale, s.h * scale);
    ctx.restore();
    return;
  }
  ctx.drawImage(s.img, s.x, s.y, s.w, s.h, Math.round(x - s.ox * scale), Math.round(y - s.oy * scale), s.w * scale, s.h * scale);
}

/**
 * Draw a sprite centered in a w×h box at the largest whole-number scale that fits. A sprite
 * bigger than the box draws at 1x and overflows it: pixel art is never shrunk (STYLE.md hard rule
 * 1), so make the box fit.
 */
export function drawFit(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, w: number, h: number) {
  const k = Math.max(1, Math.floor(Math.min(w / s.w, h / s.h)));
  const dw = s.w * k, dh = s.h * k;
  ctx.drawImage(s.img, s.x, s.y, s.w, s.h, Math.round(x + (w - dw) / 2), Math.round(y + (h - dh) / 2), dw, dh);
}

const bounds = new Map<string, { x: number; y: number; w: number; h: number }>();

/** The box round a sprite's opaque pixels, in its frame (cached by name; whole frame if empty). */
export function artBounds(s: Sprite, name: string): { x: number; y: number; w: number; h: number } {
  let b = bounds.get(name);
  if (b) return b;
  const d = s.img.getContext('2d')!.getImageData(s.x, s.y, s.w, s.h).data;
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  for (let i = 0; i < s.w * s.h; i++) {
    if (!d[i * 4 + 3]) continue;
    const px = i % s.w, py = (i / s.w) | 0;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  b = x1 < 0 ? { x: 0, y: 0, w: s.w, h: s.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  bounds.set(name, b);
  return b;
}

/** Forget every cached sprite so all regenerate on next use. */
export function resetSprites() {
  cache.clear();
  bounds.clear();
  pages.length = 0;
}

export function invalidateSprite(name: string) {
  cache.delete(name);
}

/** Drop every cached sprite whose name starts with prefix, so it regenerates on next use. */
export function invalidateSpritePrefix(prefix: string) {
  for (const name of cache.keys()) if (name.startsWith(prefix)) cache.delete(name);
}
