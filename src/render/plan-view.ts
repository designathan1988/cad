// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import type { Point2 } from '../core/vector';
import { type DerivedGeometry, openingOutline } from '../app/geometry';
import { symbolLines } from '../elements/opening/symbol';
import type { WallId } from '../elements/wall/schema';

/** A temporary dimension: measured from a to b, drawn beside the element on `side`, clear of it. */
export interface DimMark {
  readonly a: Point2;
  readonly b: Point2;
  readonly side: Point2;
  readonly clear: number;
}

export interface PlanOverlay {
  readonly selected: ReadonlySet<WallId>;
  readonly hover: WallId | null;
  /** Walls being drawn (ids present in the geometry), shown as a translucent preview. */
  readonly preview: ReadonlySet<WallId>;
  /** `away`: the direction the segment being drawn arrives from, so the label goes beyond its end. */
  readonly snap: { readonly point: Point2; readonly label: string | null; readonly guideFrom?: Point2; readonly away?: Point2 } | null;
  /**
   * Live measure of the segment being drawn. With `normal` (unit, world) it is set off the segment on
   * that side, `clear` metres plus a gap, so it never sits on the wall.
   */
  readonly measure: { readonly at: Point2; readonly text: string; readonly normal?: Point2; readonly clear?: number } | null;
  /** The reference line of the segment being drawn, dashed. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  /** End grips of the selected wall: small squares to drag. */
  readonly grips: readonly Point2[];
  /** Room name and area tags, at each room's point. */
  readonly roomLabels: readonly { readonly at: Point2; readonly name: string; readonly area: string; readonly warn: boolean }[];
  /** A floor outline being drawn, ending at the cursor. */
  readonly draft: readonly Point2[] | null;
  /** The opening being placed (an id present in the geometry), drawn in the accent colour. */
  readonly openingPreview?: string | null;
  /** Temporary dimensions of the selected element. */
  readonly dims?: readonly DimMark[];
}

export class PlanView {
  /** Screen pixels per metre and the world point at the canvas centre. */
  scale = 60;
  center: Point2 = { x: 4, y: 3 };
  private readonly ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  private get size() {
    return { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
  }

  toScreen(p: Point2): Point2 {
    const { w, h } = this.size;
    return { x: w / 2 + (p.x - this.center.x) * this.scale, y: h / 2 - (p.y - this.center.y) * this.scale };
  }

  /** A dimension on screen: its line (a to b) and where its extension lines start at the element. */
  dimLine(d: DimMark): { a: Point2; b: Point2; fromA: Point2; fromB: Point2 } {
    const side = { x: d.side.x, y: -d.side.y };
    const at = (p: Point2, px: number) => {
      const s = this.toScreen(p);
      return { x: s.x + side.x * px, y: s.y + side.y * px };
    };
    const clear = d.clear * this.scale;
    return { a: at(d.a, clear + 18), b: at(d.b, clear + 18), fromA: at(d.a, clear + 3), fromB: at(d.b, clear + 3) };
  }

  toWorld(s: Point2): Point2 {
    const { w, h } = this.size;
    return { x: this.center.x + (s.x - w / 2) / this.scale, y: this.center.y - (s.y - h / 2) / this.scale };
  }

  /** Zooms by `factor` keeping the world point under the screen point fixed. */
  zoomAt(screen: Point2, factor: number): void {
    const before = this.toWorld(screen);
    this.scale = Math.min(4000, Math.max(2, this.scale * factor));
    const after = this.toWorld(screen);
    this.center = { x: this.center.x + before.x - after.x, y: this.center.y + before.y - after.y };
  }

  panBy(dx: number, dy: number): void {
    this.center = { x: this.center.x - dx / this.scale, y: this.center.y + dy / this.scale };
  }

  /** Fits a world box with a margin; an empty drawing shows 10 m around the origin. */
  frame(box: { min: Point2; max: Point2 } | null): void {
    const b = box ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } };
    const { w, h } = this.size;
    const bw = Math.max(b.max.x - b.min.x, 0.5);
    const bh = Math.max(b.max.y - b.min.y, 0.5);
    this.scale = Math.min(4000, Math.max(2, Math.min((w * 0.7) / bw, (h * 0.7) / bh)));
    this.center = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 };
  }

  draw(g: DerivedGeometry, o: PlanOverlay): void {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this.size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();
    ctx.fillStyle = color('--canvas');
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(color('--grid-minor'), color('--grid-major'), color('--axis-x'), color('--axis-y'));

    const solids = [...g.solids.values()];
    const normal = solids.filter((s) => !o.preview.has(s.wall.id));
    const trace = (poly: readonly Point2[]) => {
      ctx.beginPath();
      poly.forEach((v, i) => {
        const s = this.toScreen(v);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
    };
    // Floors and rooms lie under the walls.
    for (const f of g.floors.values()) {
      if (f.outline.length < 3) continue;
      const sel = o.selected.has(f.floor.id) || o.hover === f.floor.id;
      trace(f.outline);
      ctx.fillStyle = sel ? color('--accent-soft') : color('--floor-fill');
      ctx.fill();
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = sel ? color('--wall-sel') : color('--text-3');
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    for (const r of g.rooms.values()) {
      if (!r.enclosed || !(o.selected.has(r.room.id) || o.hover === r.room.id)) continue;
      trace(r.outline);
      ctx.fillStyle = color('--accent-soft');
      ctx.fill();
    }
    // Square corners stay sharp (miter ratio 1.41); a piece's 45° miter corner (ratio 2.61) is
    // bevelled, or its stroke would poke a spike out of the joined outline.
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    // Outline: stroke all pieces 3 px wide, then fill them over it. Each fill also gets a 1 px stroke
    // of its own colour, which closes the anti-aliasing seam between neighbouring pieces and leaves
    // 1 px of outline outside.
    const outline = (list: typeof solids, line: string, width: number) => {
      ctx.strokeStyle = line;
      ctx.lineWidth = width;
      for (const s of list) for (const p of s.pieces) (trace(p.polygon), ctx.stroke());
    };
    const fill = (list: typeof solids, colour: string) => {
      ctx.fillStyle = colour;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1;
      for (const s of list) for (const p of s.pieces) (trace(p.polygon), ctx.fill(), ctx.stroke());
    };
    outline(normal, color('--wall-line'), 3);
    fill(normal, color('--wall-fill'));
    // Hover and selection: the wall's own outline in the accent colour over its neighbours.
    for (const s of normal) {
      const sel = o.selected.has(s.wall.id);
      if (!sel && o.hover !== s.wall.id) continue;
      outline([s], color('--wall-sel'), sel ? 4 : 3);
      fill([s], sel ? color('--wall-sel-fill') : color('--wall-fill'));
    }
    // Preview of walls being drawn.
    const drawn = solids.filter((x) => o.preview.has(x.wall.id));
    outline(drawn, color('--wall-sel'), 3);
    fill(drawn, color('--wall-sel-fill'));
    this.drawOpenings(g, o, { line: color('--wall-line'), sel: color('--wall-sel'), selFill: color('--wall-sel-fill'), warn: color('--warn'), canvas: color('--canvas') });
    if (o.axis) this.dashed(o.axis.start, o.axis.end, color('--snap'));
    for (const l of o.roomLabels) {
      this.label(l.at, l.name, l.warn ? color('--warn') : color('--text'), color('--canvas'), '600 12px Inter, system-ui', { x: 0, y: -4 });
      this.label(l.at, l.area, color('--text-2'), color('--canvas'), '12px Inter, system-ui', { x: 0, y: 12 });
    }
    if (o.draft && o.draft.length > 0) {
      ctx.save();
      ctx.strokeStyle = color('--wall-sel');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      o.draft.forEach((v, i) => {
        const s = this.toScreen(v);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.restore();
    }
    for (const g of o.grips) {
      const p = this.toScreen(g);
      ctx.fillStyle = color('--bg');
      ctx.strokeStyle = color('--wall-sel');
      ctx.lineWidth = 1.5;
      ctx.fillRect(Math.round(p.x) - 4.5, Math.round(p.y) - 4.5, 9, 9);
      ctx.strokeRect(Math.round(p.x) - 4.5, Math.round(p.y) - 4.5, 9, 9);
    }
    for (const d of o.dims ?? []) this.drawDim(d, color('--wall-sel'));
    const snapBox = o.snap ? this.drawSnap(o.snap, color('--snap'), color('--bg')) : null;
    if (o.measure) this.drawMeasure(o.measure, snapBox, color('--accent-text'), color('--canvas'));
  }

  /** The live measure, off the segment along its normal, and moved further out while it would cover the snap label. */
  private drawMeasure(m: NonNullable<PlanOverlay['measure']>, avoid: Box | null, colour: string, bg: string): void {
    const font = 'bold 12px Inter, system-ui';
    if (!m.normal) {
      this.label(m.at, m.text, colour, bg, font);
      return;
    }
    const n = { x: m.normal.x, y: -m.normal.y };
    const base = this.toScreen(m.at);
    const w = this.textWidth(m.text, font) + 8;
    // Far enough along the normal for the whole pad to clear the wall face, whatever the angle.
    const reach = (m.clear ?? 0) * this.scale + 6 + Math.abs(n.x) * (w / 2) + Math.abs(n.y) * 8;
    let p = { x: base.x + n.x * reach, y: base.y + n.y * reach };
    for (let i = 0; i < 4 && avoid && overlaps(this.boxAt(p, w), avoid); i++) p = { x: p.x + n.x * 20, y: p.y + n.y * 20 };
    this.tag(p, m.text, colour, bg, font);
  }

  private textWidth(text: string, font: string): number {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  }

  /** The pad of a tag of width w centred on p. */
  private boxAt(p: Point2, w: number): Box {
    return { x: p.x - w / 2, y: p.y - 8, w, h: 16 };
  }

  /** A text tag centred on a screen point, kept inside the canvas. */
  private tag(p: Point2, text: string, colour: string, bg: string, font: string): void {
    const tw = this.textWidth(text, font);
    const { w, h } = this.size;
    const x = Math.min(Math.max(4, p.x - tw / 2), w - tw - 8);
    const y = Math.min(Math.max(12, p.y + 3), h - 6);
    const { ctx } = this;
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x - 4, y - 11, tw + 8, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 1);
  }

  /**
   * Doors and windows as plans draw them, over the cut in the wall. A door: its leaf standing open at
   * 90° from the hinge jamb, on the side it opens to, and the quarter arc its edge sweeps back to the
   * other jamb. A window: the frame lines at both wall faces and the glass line between them. Invalid
   * openings are drawn the same, in the warning colour.
   */
  private drawOpenings(g: DerivedGeometry, o: PlanOverlay, c: { line: string; sel: string; selFill: string; warn: string; canvas: string }): void {
    const { ctx } = this;
    const path = (pts: readonly Point2[], close = false) => {
      ctx.beginPath();
      pts.forEach((v, i) => {
        const p = this.toScreen(v);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (close) ctx.closePath();
    };
    for (const op of g.openings.values()) {
      const f = op.frame;
      if (!f) continue;
      const id = op.opening.id;
      const active = o.selected.has(id) || o.openingPreview === id;
      const colour = !op.valid ? c.warn : active || o.hover === id ? c.sel : c.line;
      if (active) {
        ctx.fillStyle = c.selFill;
        ctx.globalAlpha = 0.5;
        path(openingOutline(op), true);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = active ? 1.6 : 1;
      for (const line of symbolLines(op, op.frame)) (path(line), ctx.stroke());
    }
  }

  private drawGrid(minor: string, major: string, axisX: string, axisY: string): void {
    const { ctx } = this;
    const { w, h } = this.size;
    // The step follows the zoom so the density stays the same: about 24 px between minor lines.
    const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];
    const step = steps.find((s) => s * this.scale >= 24) ?? 100;
    const majorEvery = step < 1 ? Math.round(1 / step) : 5;
    const a = this.toWorld({ x: 0, y: h });
    const b = this.toWorld({ x: w, y: 0 });
    ctx.lineWidth = 1;
    for (let i = Math.floor(a.x / step); i <= Math.ceil(b.x / step); i++) {
      const x = Math.round(this.toScreen({ x: i * step, y: 0 }).x) + 0.5;
      ctx.strokeStyle = i % majorEvery === 0 ? major : minor;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let j = Math.floor(a.y / step); j <= Math.ceil(b.y / step); j++) {
      const y = Math.round(this.toScreen({ x: 0, y: j * step }).y) + 0.5;
      ctx.strokeStyle = j % majorEvery === 0 ? major : minor;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const o = this.toScreen({ x: 0, y: 0 });
    ctx.strokeStyle = axisX;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(o.y) + 0.5);
    ctx.lineTo(w, Math.round(o.y) + 0.5);
    ctx.stroke();
    ctx.strokeStyle = axisY;
    ctx.beginPath();
    ctx.moveTo(Math.round(o.x) + 0.5, 0);
    ctx.lineTo(Math.round(o.x) + 0.5, h);
    ctx.stroke();
  }

  private dashed(a: Point2, b: Point2, colour: string): void {
    const { ctx } = this;
    const sa = this.toScreen(a);
    const sb = this.toScreen(b);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawSnap(s: NonNullable<PlanOverlay['snap']>, colour: string, bg: string): Box | null {
    const { ctx } = this;
    if (s.guideFrom) this.dashed(s.guideFrom, s.point, colour);
    const p = this.toScreen(s.point);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y - 5);
    ctx.lineTo(p.x + 5, p.y + 5);
    ctx.moveTo(p.x + 5, p.y - 5);
    ctx.lineTo(p.x - 5, p.y + 5);
    ctx.stroke();
    if (!s.label) return null;
    // Beyond the end of the segment, never back over it: to the left when it arrives going left.
    const font = '600 11px Inter, system-ui';
    const left = s.away !== undefined && s.away.x < 0;
    const offset = left ? { x: -14 - this.textWidth(s.label, font), y: -12 } : { x: 14, y: -12 };
    return this.label({ x: s.point.x, y: s.point.y }, s.label, colour, bg, font, offset);
  }

  /** Extension lines, the dimension line and a slash tick at each end; the value is a DOM field. */
  private drawDim(d: DimMark, colour: string): void {
    const { ctx } = this;
    const l = this.dimLine(d);
    const dx = l.b.x - l.a.x;
    const dy = l.b.y - l.a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    // The side, on screen, for extending the extension lines a little past the dimension line.
    const sx = (l.a.x - l.fromA.x) / 15;
    const sy = (l.a.y - l.fromA.y) / 15;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [from, to] of [
      [l.fromA, l.a],
      [l.fromB, l.b],
    ] as const) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x + sx * 4, to.y + sy * 4);
    }
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    // Ticks at 45° to the line.
    const tx = (ux + sx) * 4;
    const ty = (uy + sy) * 4;
    for (const p of [l.a, l.b]) {
      ctx.moveTo(p.x - tx, p.y - ty);
      ctx.lineTo(p.x + tx, p.y + ty);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** A text tag on a background pad, at a world point plus a screen offset. */
  private label(at: Point2, text: string, colour: string, bg: string, font: string, offset = { x: 0, y: -14 }): Box {
    const { ctx } = this;
    const p = this.toScreen(at);
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const { w } = this.size;
    let x = p.x + offset.x;
    if (offset.x === 0) x -= tw / 2;
    x = Math.min(Math.max(4, x), w - tw - 8);
    const y = p.y + offset.y;
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x - 4, y - 11, tw + 8, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 1);
    return { x: x - 4, y: y - 11, w: tw + 8, h: 16 };
  }
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

