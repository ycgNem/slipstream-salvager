// Immediate-mode UI kit drawn on the 640x360 logical canvas (adapted from Sprocket & Sprout's).
// Buttons, sliders and toggles work with the mouse and with keys or a gamepad: up/down moves the
// focus, confirm presses, left/right moves a slider. Records what it draws for the overlap audit.
import { C, PALETTE, rgba } from '../data/palette';
import type { Input } from '../engine/input';
import { drawText, textWidth, wrapText, LINE_H, FONT_H } from './font';
import type { AuditRec, AuditKind } from './audit';

export interface Rect { x: number; y: number; w: number; h: number }

export type PanelStyle = 'dark' | 'metal' | 'inset';

export class UI {
  ctx!: CanvasRenderingContext2D;
  input!: Input;
  w = 640;
  h = 360;
  mx = -1;
  my = -1;
  time = 0;
  clicked = false;
  sfx: (id: string) => void = () => {};
  /** focus for keys/gamepad: the focused control's id, shown only after a nav key */
  focus: string | null = null;
  kbFocus = false;
  private order: string[] = [];
  private prevOrder: string[] = [];
  /** buttons side by side (`row`): Left/Right moves the focus along the row */
  private rowOf = new Map<string, string>();
  private rowMove: { row: string; dir: number } | null = null;
  private nav = 0;
  private confirm = false;
  private side = 0;
  /** debug: record what each frame draws for the overlap audit (npm run screens) */
  audit = false;
  lastAudit: AuditRec[] = [];
  private auditLog: AuditRec[] = [];

  private rec(kind: AuditKind, x: number, y: number, w: number, h: number, s?: string) {
    if (this.audit) this.auditLog.push({ kind, x, y, w, h, s, layer: 'ui', seq: this.auditLog.length });
  }

  /** Record something drawn outside the kit (floating and banner texts) for the overlap audit. */
  record(kind: AuditKind, x: number, y: number, w: number, h: number, s?: string) {
    this.rec(kind, x, y, w, h, s);
  }

  /** Start a frame. mx/my: the mouse in logical pixels. */
  begin(ctx: CanvasRenderingContext2D, input: Input, mx: number, my: number, dt: number, menus = true) {
    this.ctx = ctx;
    this.input = input;
    if (input.mouse.moved && (mx !== this.mx || my !== this.my)) this.kbFocus = false;
    this.mx = mx;
    this.my = my;
    this.time += dt;
    this.clicked = input.mouse.pressed[0];
    this.prevOrder = this.order;
    this.order = [];
    this.rowOf.clear();
    this.rowMove = null;
    this.nav = 0;
    this.side = 0;
    this.confirm = false;
    const shown = this.kbFocus;
    if (menus) {
      if (input.wasPressed('down')) this.nav++;
      if (input.wasPressed('up')) this.nav--;
      if (input.wasPressed('right')) this.side++;
      if (input.wasPressed('left')) this.side--;
      if (this.nav || this.side) this.kbFocus = true;
      this.confirm = input.wasPressed('confirm');
      if (this.confirm) this.kbFocus = true;
    }
    if (this.nav && this.prevOrder.length) {
      const i = this.focus ? this.prevOrder.indexOf(this.focus) : -1;
      const n = this.prevOrder.length;
      // while the focus was hidden (the mouse was in use) the first press only shows where it is
      this.focus = this.prevOrder[i < 0 ? 0 : shown ? (i + this.nav + n) % n : i];
      this.nav = 0;
    }
    // ... and a first Left/Right doesn't change a toggle or a slider it couldn't see
    if (!shown) this.side = 0;
    if (this.audit) {
      this.lastAudit = this.auditLog;
      this.auditLog = [];
    }
  }

  /** End a frame: keep the focus on something that exists. */
  end() {
    if (this.rowMove) {
      const row = this.order.filter((id) => this.rowOf.get(id) === this.rowMove!.row);
      const i = row.indexOf(this.focus ?? '');
      if (i >= 0) this.focus = row[Math.max(0, Math.min(row.length - 1, i + this.rowMove.dir))];
    }
    if (this.order.length && (!this.focus || !this.order.includes(this.focus))) this.focus = this.order[0];
  }

  private focusable(id: string): boolean {
    this.order.push(id);
    return this.kbFocus && this.focus === id;
  }

  hover(x: number, y: number, w: number, h: number) {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  fill(x: number, y: number, w: number, h: number, c: number, a = 1) {
    if (a >= 0.85 && w > 2 && h > 2) this.rec('fill', x, y, w, h);
    this.ctx.fillStyle = a >= 1 ? PALETTE[c] : rgba(c, a);
    this.ctx.fillRect(x, y, w, h);
  }

  private dimPattern: CanvasPattern | null = null;

  /** Dim everything drawn so far with a checker of ink pixels (palette-true; no alpha). */
  dim() {
    if (!this.dimPattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      const x = c.getContext('2d')!;
      x.fillStyle = PALETTE[C.ink];
      x.fillRect(0, 0, 1, 1);
      x.fillRect(1, 1, 1, 1);
      this.dimPattern = this.ctx.createPattern(c, 'repeat');
    }
    this.ctx.fillStyle = this.dimPattern!;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  panel(x: number, y: number, w: number, h: number, style: PanelStyle = 'dark') {
    x = Math.round(x);
    y = Math.round(y);
    this.rec('panel', x, y, w, h);
    const f = (xx: number, yy: number, ww: number, hh: number, c: number) => {
      this.ctx.fillStyle = PALETTE[c];
      this.ctx.fillRect(xx, yy, ww, hh);
    };
    switch (style) {
      case 'dark':
        f(x + 2, y + h, w - 2, 2, C.ink);
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.plum);
        f(x + 1, y + 1, w - 2, 1, C.slate);
        f(x + 1, y + h - 2, w - 2, 1, C.ink);
        // corner bolts
        for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) f(cx, cy, 2, 2, C.dusk);
        break;
      case 'metal':
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.mauve);
        f(x + 1, y + 1, w - 2, 1, C.lilac);
        f(x + 1, y + h - 2, w - 2, 1, C.slate);
        break;
      case 'inset':
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.floor0);
        break;
    }
  }

  text(s: string, x: number, y: number, c: number = C.frost, opts: { scale?: number; shadow?: number; align?: 'left' | 'center' | 'right' } = {}) {
    const sc = opts.scale ?? 1;
    let tx = x;
    if (opts.align === 'center') tx = x - Math.floor((textWidth(s) * sc) / 2);
    else if (opts.align === 'right') tx = x - textWidth(s) * sc;
    if (s.trim()) this.rec('text', Math.round(tx), Math.round(y), textWidth(s) * sc, FONT_H * sc, s);
    return drawText(this.ctx, s, Math.round(tx), Math.round(y), PALETTE[c], sc, opts.shadow !== undefined ? PALETTE[opts.shadow] : null);
  }

  /** Wrapped paragraph; returns the height used. */
  para(s: string, x: number, y: number, w: number, c: number = C.frost, lineH = LINE_H): number {
    const lines = wrapText(s, w);
    lines.forEach((l, i) => this.text(l, x, y + i * lineH, c));
    return lines.length * lineH;
  }

  button(id: string, x: number, y: number, w: number, h: number, label: string, opts: { active?: boolean; disabled?: boolean; row?: string } = {}): boolean {
    // a disabled button is skipped by the focus: the ring never sits on something that does nothing
    const focused = !opts.disabled && this.focusable(id);
    if (opts.row && !opts.disabled) {
      this.rowOf.set(id, opts.row);
      if (focused && this.side) this.rowMove = { row: opts.row, dir: this.side };
    }
    const hov = (this.hover(x, y, w, h) || focused) && !opts.disabled;
    const down = this.hover(x, y, w, h) && this.input.mouse.down[0];
    this.rec('button', x, y, w, h);
    const base = opts.disabled ? C.slate : opts.active ? C.rust2 : C.rust1;
    const hi = opts.disabled ? C.mauve : hov ? C.rust3 : C.rust2;
    const f = (xx: number, yy: number, ww: number, hh: number, c: number) => {
      this.ctx.fillStyle = PALETTE[c];
      this.ctx.fillRect(xx, yy, ww, hh);
    };
    f(x, y, w, h, C.ink);
    f(x + 1, y + 1, w - 2, h - 2, hov ? hi : base);
    if (!down) {
      f(x + 1, y + 1, w - 2, 1, hov ? C.peach : hi);
      f(x + 1, y + h - 2, w - 2, 1, C.rust0);
    }
    if (focused) {
      f(x - 2, y - 2, w + 4, 1, C.frost);
      f(x - 2, y + h + 1, w + 4, 1, C.frost);
      f(x - 2, y - 2, 1, h + 4, C.frost);
      f(x + w + 1, y - 2, 1, h + 4, C.frost);
    }
    if (label) this.text(label, x + w / 2, y + Math.floor((h - 7) / 2) + (down ? 1 : 0), opts.disabled ? C.mist : C.white, { align: 'center', shadow: C.rust0 });
    if (opts.disabled) return false;
    if ((this.hover(x, y, w, h) && this.clicked) || (focused && this.confirm)) {
      this.clicked = false;
      this.confirm = false;
      this.focus = id;
      this.sfx('click');
      return true;
    }
    return false;
  }

  /** A 0..1 slider; returns the new value. */
  slider(id: string, x: number, y: number, w: number, label: string, v: number): number {
    const focused = this.focusable(id);
    this.text(label, x, y, focused ? C.white : C.frost);
    const bx = x + 70, bw = w - 70 - 24, by = y + 2;
    this.fill(bx, by, bw, 4, C.ink);
    this.fill(bx + 1, by + 1, Math.round((bw - 2) * v), 2, C.rust3);
    const kx = bx + Math.round((bw - 3) * v);
    this.fill(kx, by - 2, 3, 8, focused ? C.white : C.peach);
    this.text(`${Math.round(v * 100)}%`, x + w, y, C.mist, { align: 'right' });
    if (this.input.mouse.down[0] && this.hover(bx - 2, by - 4, bw + 4, 12)) {
      v = Math.max(0, Math.min(1, (this.mx - bx) / (bw - 1)));
      this.focus = id;
    }
    if (focused && this.side) v = Math.max(0, Math.min(1, Math.round((v + this.side * 0.1) * 10) / 10));
    return v;
  }

  /** A checkbox row; returns the new value. */
  toggle(id: string, x: number, y: number, w: number, label: string, v: boolean): boolean {
    const focused = this.focusable(id);
    const hov = this.hover(x, y - 2, w, 11);
    this.text(label, x, y, focused || hov ? C.white : C.frost);
    // the keyboard focus: the buttons' frost ring, round the whole row
    if (focused) {
      this.ctx.fillStyle = PALETTE[C.frost];
      this.ctx.fillRect(x - 3, y - 3, w + 6, 1);
      this.ctx.fillRect(x - 3, y + 9, w + 6, 1);
      this.ctx.fillRect(x - 3, y - 3, 1, 13);
      this.ctx.fillRect(x + w + 2, y - 3, 1, 13);
    }
    const bx = x + w - 9;
    this.fill(bx, y - 1, 9, 9, C.ink);
    this.fill(bx + 1, y, 7, 7, v ? C.rust3 : C.floor0);
    if ((hov && this.clicked) || (focused && (this.confirm || this.side))) {
      this.clicked = false;
      this.confirm = false;
      this.sfx('click');
      return !v;
    }
    return v;
  }
}
