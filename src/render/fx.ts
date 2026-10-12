// Presentation-only effects: particles, floating text, skid marks, afterimages, flashes, shake and
// the wave banner. They run on render time, so they keep moving through hit-stop (STYLE.md
// "Motion and feedback rules"). Math.random is fine here: nothing in the sim reads it.
import { C } from '../data/palette';
import { drawSprite, sprite } from './atlas';
import { dot, pline } from './pixgeom';
import { drawText, FONT_H, textWidth } from '../ui/font';
import { PALETTE } from '../data/palette';
import type { Tier } from '../sim/world';

type Ctx = CanvasRenderingContext2D;

type Kind = 'spark' | 'dust' | 'steam' | 'smoke' | 'dot' | 'line' | 'text';

interface Particle {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: number;
  size: number;
  drag: number;
  text?: string;
}

export interface Afterimage {
  name: string;
  x: number;
  y: number;
  age: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  parts: Particle[] = [];
  /** skid marks: dark floor pixels that fade by thinning out */
  marks: { x: number; y: number; life: number }[] = [];
  after: Afterimage[] = [];
  /** rammer id -> seconds of hit flash */
  flash = new Map<number, number>();
  playerFlash = 0;
  shake = 0;
  banner: { text: string; sub: string; t: number; dur: number } | null = null;
  /** debug: floating and banner texts report here for the overlap audit (npm run screens) */
  audit: ((s: string, x: number, y: number, w: number, h: number) => void) | null = null;
  /** rectangles floating texts keep off (the exit signs) */
  avoid: { x: number; y: number; w: number; h: number }[] = [];
  /** the current claw slash, drawn at the player */
  slash: { tier: Tier; dir: number; t: number } | null = null;
  time = 0;

  update(dt: number) {
    this.time += dt;
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k;
      p.vy *= k;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const m of this.marks) m.life -= dt;
    this.marks = this.marks.filter((m) => m.life > 0);
    for (const a of this.after) a.age += dt;
    this.after = this.after.filter((a) => a.age < 0.18);
    for (const [id, t] of this.flash) {
      if (t - dt <= 0) this.flash.delete(id);
      else this.flash.set(id, t - dt);
    }
    this.playerFlash = Math.max(0, this.playerFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 14);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.slash) {
      this.slash.t += dt;
      if (this.slash.t > 0.15) this.slash = null;
    }
  }

  addShake(px: number) {
    this.shake = Math.max(this.shake, px);
  }

  /** Whole-pixel camera offset (at most 3 px; off when screen shake is off). */
  shakeOffset(enabled: boolean): { x: number; y: number } {
    if (!enabled || this.shake < 0.5) return { x: 0, y: 0 };
    const a = Math.min(3, Math.round(this.shake));
    return { x: Math.round(rnd(-a, a)), y: Math.round(rnd(-a, a)) };
  }

  private add(p: Partial<Particle> & { k: Kind; x: number; y: number }) {
    if (this.parts.length > 600) return;
    const life = p.life ?? 0.4;
    this.parts.push({ vx: 0, vy: 0, max: life, life, c: C.white, size: 1, drag: 0.9, ...p });
  }

  sparks(x: number, y: number, n: number, angle = 0, spread = Math.PI * 2, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-spread / 2, spread / 2), s = rnd(speed * 0.4, speed);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.15, 0.35), drag: 0.86 });
    }
  }

  dots(x: number, y: number, n: number, colors: number[], speed = 100, life = 0.5, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(speed * 0.3, speed);
      this.add({ k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.5, life), c: colors[i % colors.length], size: Math.random() < 0.3 ? size + 1 : size, drag: 0.88 });
    }
  }

  puff(k: 'dust' | 'steam' | 'smoke', x: number, y: number, vx = 0, vy = 0, life = 0.45) {
    this.add({ k, x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: vx + rnd(-10, 10), vy: vy + rnd(-12, 4), life, drag: 0.92 });
  }

  /** a short streak of wind behind a fast body */
  wind(x: number, y: number, angle: number) {
    const s = rnd(30, 60);
    this.add({ k: 'line', x: x + rnd(-6, 6), y: y + rnd(-5, 5), vx: -Math.cos(angle) * s, vy: -Math.sin(angle) * s, life: 0.18, c: Math.random() < 0.5 ? C.speed3 : C.speed4, size: 4, drag: 0.95 });
  }

  /**
   * Floating text. It stays clear of the wall bands and the HUD (it drifts up about 8 px), and a
   * second text at the same spot stacks above (or below) the first instead of printing over it.
   */
  text(x: number, y: number, s: string, c: number) {
    const tw = textWidth(s);
    x = Math.max(18 + Math.ceil(tw / 2), Math.min(622 - Math.ceil(tw / 2), x));
    y = Math.max(30, Math.min(328, y));
    const near = (p: Particle, yy: number) => p.k === 'text' && p.life > 0 && Math.abs(p.y - yy) < 9 && Math.abs(p.x - x) < (tw + textWidth(p.text!)) / 2 + 3;
    const onSign = (yy: number) => this.avoid.some((r) => x + tw / 2 + 1 > r.x && x - tw / 2 - 1 < r.x + r.w && yy + FONT_H + 1 > r.y && yy - 9 < r.y + r.h);
    const clash = (yy: number) => onSign(yy) || this.parts.some((p) => near(p, yy));
    const slot = [0, -9, -18, 9, 18, -27, 27, -36, 36].find((dy) => y + dy >= 26 && y + dy <= 334 && !clash(y + dy));
    if (slot !== undefined) y += slot;
    // nowhere free: the older texts at the spot make way
    else for (const p of this.parts) if (near(p, y)) p.life = 0;
    this.add({ k: 'text', x, y, vx: 0, vy: -24, life: 0.9, c, text: s, drag: 0.95 });
  }

  mark(x: number, y: number) {
    if (this.marks.length < 900) this.marks.push({ x: Math.round(x), y: Math.round(y), life: 3 });
  }

  showBanner(text: string, sub: string, dur = 1.5) {
    this.banner = { text, sub, t: 0, dur };
  }

  /** skid marks go under everything */
  drawMarks(ctx: Ctx) {
    for (const m of this.marks) {
      // thin out as they age instead of fading with alpha
      if (m.life < 1.5 && ((m.x + m.y) & 1) === (m.life < 0.75 ? 0 : 1)) continue;
      if (m.life < 0.75 && (m.x & 1)) continue;
      dot(ctx, m.x, m.y, C.ink);
    }
  }

  draw(ctx: Ctx) {
    for (const p of this.parts) {
      const f = 1 - p.life / p.max;
      const x = Math.round(p.x), y = Math.round(p.y);
      switch (p.k) {
        case 'spark':
          drawSprite(ctx, sprite(`fx:spark:${Math.min(2, Math.floor(f * 3))}`), x, y);
          break;
        case 'dust': case 'steam': case 'smoke':
          drawSprite(ctx, sprite(`fx:${p.k}:${Math.min(3, Math.floor(f * 4))}`), x, y);
          break;
        case 'dot':
          dot(ctx, x, y, p.c, p.size);
          break;
        case 'line': {
          const l = Math.hypot(p.vx, p.vy) || 1;
          pline(ctx, x, y, x - (p.vx / l) * p.size, y - (p.vy / l) * p.size, p.c);
          break;
        }
        case 'text': {
          const tw = textWidth(p.text!);
          drawText(ctx, p.text!, x - Math.floor(tw / 2), y, PALETTE[p.c], 1, PALETTE[C.ink]);
          this.audit?.(p.text!, x - Math.floor(tw / 2), y, tw, FONT_H);
          break;
        }
      }
    }
  }
}
