// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import type { Point2 } from '../core/vector';
import { type DerivedGeometry, type OpeningSolid, openingOutline } from '../app/geometry';
import { add, distance, normalize, scale, sub } from '../core/vector';
import type { WallId } from '../elements/wall/schema';

export interface PlanOverlay {
  readonly selected: ReadonlySet<WallId>;
  readonly hover: WallId | null;
  /** Walls being drawn (ids present in the geometry), shown as a translucent preview. */
  readonly preview: ReadonlySet<WallId>;
  readonly snap: { readonly point: Point2; readonly label: string | null; readonly guideFrom?: Point2 } | null;
  /** Live measure next to the segment being drawn. */
  readonly measure: { readonly at: Point2; readonly text: string } | null;
  /** The reference line of the segment being drawn, dashed. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  /** The opening being placed (an id present in the geometry), drawn in the accent colour. */
  readonly openingPreview?: string | null;
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
    if (o.snap) this.drawSnap(o.snap, color('--snap'), color('--bg'));
    if (o.measure) this.label(o.measure.at, o.measure.text, color('--accent-text'), color('--canvas'), 'bold 12px Inter, system-ui');
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
      for (const line of symbolLines(op)) (path(line), ctx.stroke());
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

  private drawSnap(s: NonNullable<PlanOverlay['snap']>, colour: string, bg: string): void {
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
    if (s.label) this.label({ x: s.point.x, y: s.point.y }, s.label, colour, bg, '600 11px Inter, system-ui', { x: 14, y: -12 });
  }

  /** A text tag on a background pad, at a world point plus a screen offset. */
  private label(at: Point2, text: string, colour: string, bg: string, font: string, offset = { x: 0, y: -14 }): void {
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
  }
}

/** The polylines of an opening's plan symbol, in world coordinates. */
export function symbolLines(op: OpeningSolid): Point2[][] {
  const f = op.frame;
  if (!f) return [];
  const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
  const [o0, o1] = f.faces;
  if (op.opening.kind === 'window') {
    const mid = (o0 + o1) / 2;
    return [o0, o1, mid].map((off) => [at(f.start, off), at(f.end, off)]);
  }
  // Door: the hinge on the face it opens to; the leaf perpendicular to the wall, the arc back.
  const left = op.opening.swing === 'left';
  const face = left ? o1 : o0;
  const out = scale(f.normal, left ? 1 : -1);
  const hinge = at(op.opening.hinge === 'start' ? f.start : f.end, face);
  const strike = at(op.opening.hinge === 'start' ? f.end : f.start, face);
  // The chord between the jambs: on an arc wall it is a little shorter than the width along the arc.
  const width = distance(hinge, strike);
  const tip = add(hinge, scale(out, width));
  const along = normalize(sub(strike, hinge));
  const arc: Point2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    arc.push(add(hinge, add(scale(out, width * Math.cos(a)), scale(along, width * Math.sin(a)))));
  }
  return [[hinge, tip], arc];
}
