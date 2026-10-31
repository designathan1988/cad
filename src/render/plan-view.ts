// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import { drawLeader } from '../elements/kinds/note';
import { drawSectionMark } from '../elements/kinds/section';
import { DEFAULT_DRAWING, type Detail, detailOf, type DrawingSettings, PEN_UNIT_MM, type PenRole } from '../elements/drawing/schema';
import { drawAxis } from '../elements/kinds/grid';
import { eachSolid } from '../elements/registry';
import type { Point2 } from '../model/vector';
import type { DerivedGeometry } from '../project/derive';
import { layoutRoomTags } from './room-tags';
import { separateLabels } from '../session/dim-labels';
import { dashed, drawOpeningTags, label, planFont, textWidth } from './plan-text';
import { drawGrid, drawLine, drawOpenings, drawRefLine } from './plan-strokes';
import { wallPainters } from './plan-walls';
import { type DimMark, fitPlan, type Insets, NO_INSETS, type PlanOverlay } from './plan-types';
import { drawAnnotations } from './plan-annotations';

/** A grid bubble's radius (px), its centre this far past the axis's end. */
export { GRID_BUBBLE_PX } from '../elements/kinds/grid';

export class PlanView {
  /** Room tags drawn last time, in canvas pixels: what the floating bar must not cover. */
  labelBoxes: { x: number; y: number; w: number; h: number }[] = [];
  /** Screen pixels per metre and the world point at the canvas centre. */
  scale = 60;
  center: Point2 = { x: 4, y: 3 };
  /** The project's scale and pens, set before each drawing (elements/drawing/schema.ts). */
  drawing: DrawingSettings = DEFAULT_DRAWING;
  /** Graphic overrides: walls of a type filled with a colour (app/layer-sets.ts); empty when off. */
  overrides: ReadonlyMap<string, string> = new Map();
  /** The walls' phases in a renovation (app/layer-sets.ts: wallPhases), each drawn in its token's colour; empty when off. */
  phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'> = new Map();
  /** Graphic overrides of rooms: a use filled with a colour (app/layer-sets.ts); empty when off. */
  roomOverrides: ReadonlyMap<string, string> = new Map();
  /**
   * Drawn for paper (app/print.ts), not for the screen: its size in pen units, device pixels a unit,
   * the scale printed and the paper's colours. No grid; pens, texts and hatches keep their size on paper.
   */
  printing: { readonly w: number; readonly h: number; readonly ratio: number; readonly den: number; readonly color: (name: string) => string } | null = null;
  /** The context drawn on (plan-text.ts and plan-strokes.ts draw on it too). */
  readonly ctx: CanvasRenderingContext2D;

  /** `context`: drawn on it instead of the canvas's own (a vector page, io/pdf-canvas.ts). */
  constructor(
    readonly canvas: HTMLCanvasElement,
    context?: CanvasRenderingContext2D,
  ) {
    const ctx = context ?? canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  /** The canvas size the centre was last kept for (see size). */
  private seen = { w: 0, h: 0 };

  /**
   * The canvas size. When it changes (the panel opened or closed beside the drawing, the window
   * resized) the drawing keeps its top left corner where it was: keeping its centre slid everything
   * by half the panel's width, a jump the user saw on every panel shown or hidden.
   */
  get size() {
    if (this.printing) return { w: this.printing.w, h: this.printing.h };
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w > 0 && h > 0 && (w !== this.seen.w || h !== this.seen.h)) {
      if (this.seen.w > 0 && this.seen.h > 0) this.center = { x: this.center.x + (w - this.seen.w) / (2 * this.scale), y: this.center.y - (h - this.seen.h) / (2 * this.scale) };
      this.seen = { w, h };
    }
    return { w, h };
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
  /**
   * Fits the box in the part of the canvas left visible: `covered` is how much a panel lying over the
   * canvas hides at its right and bottom edges (the drawer on a tablet, the sheet on a phone).
   */
  frame(box: { min: Point2; max: Point2 } | null, covered: Insets = NO_INSETS): void {
    const fit = fitPlan(box ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } }, this.size, covered);
    this.scale = fit.scale;
    this.center = fit.center;
  }

  /** A pen's width in the plan's units: a pixel on screen for 0.12 mm (drawing/schema.ts). */
  pen(role: PenRole): number {
    return this.drawing.pens[role] / PEN_UNIT_MM;
  }

  /** What the scale shows: the printed one's, or the project's on screen. */
  get detail(): Detail {
    return detailOf(this.printing?.den ?? this.drawing.scale);
  }

  draw(g: DerivedGeometry, o: PlanOverlay): void {
    const { canvas, ctx } = this;
    const dpr = this.printing?.ratio ?? (window.devicePixelRatio || 1);
    const { w, h } = this.size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const color = this.printing?.color ?? ((name: string) => css.getPropertyValue(name).trim());
    ctx.fillStyle = color('--canvas');
    ctx.fillRect(0, 0, w, h);
    if (!this.printing) drawGrid(this, color('--grid-minor'), color('--grid-major'), color('--axis-x'), color('--axis-y'));

    const solids = [...g.solids.values()];
    const normal = solids.filter((s) => !o.preview.has(s.wall.id));
    const { trace, outline, fill, seams, seen, cut, pieces } = wallPainters(this, { ctx, canvas, color, dpr, w, h, solids, normal });
    // The level below, faint, under everything of this one: an upper floor is drawn over its walls
    // (it was drawn blind, with nothing to align to). Filled only, so it never reads as this level's.
    if (o.underlay && o.underlay.length > 0) {
      ctx.beginPath();
      for (const poly of o.underlay)
        poly.forEach((v, i) => {
          const q = this.toScreen(v);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
          if (i === poly.length - 1) ctx.closePath();
        });
      ctx.fillStyle = color('--underlay');
      ctx.fill('nonzero');
    }
    // The registry's kinds (elements/registry.ts), each drawing itself; lit when selected or under the pointer.
    const family = (this.printing ? css : getComputedStyle(this.canvas)).getPropertyValue('--font').trim() || 'sans-serif';
    const paint = {
      ctx,
      toScreen: (v: Point2) => this.toScreen(v),
      color,
      scale: this.scale,
      family,
      font: (weight: string, size: string) => planFont(this, weight, size),
      line: (point: Point2, dir: Point2, colour: string, width: number, dash: readonly number[]) => drawLine(this, point, dir, colour, width, dash),
      pen: (role: PenRole) => this.pen(role),
      detail: this.detail,
    };
    const kinds = [...eachSolid(g.kinds)];
    const shownLit = (id: string) => o.selected.has(id) || o.hover === id;
    // Floors (contract.ts: under) and rooms lie under the walls.
    for (const x of kinds) if (x.kind.layer === 'under') x.kind.plan(paint, x.solid, shownLit(x.id));
    // Rooms of a use in their override colour, translucent over their floor (app/layer-sets.ts).
    if (this.roomOverrides.size > 0)
      for (const r of g.rooms.values()) {
        const c = r.enclosed && r.room.use ? this.roomOverrides.get(r.room.use) : undefined;
        if (!c) continue;
        trace(r.outline);
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = c;
        ctx.fill();
        ctx.restore();
      }
    // The room the room tool would make: the space under the pointer, dashed, as a room not yet there.
    if (o.roomSpace && o.roomSpace.length >= 3) {
      trace(o.roomSpace);
      ctx.fillStyle = color('--accent-soft');
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color('--wall-sel');
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    // Square corners stay sharp (miter ratio 1.41); a piece's 45° miter corner (ratio 2.61) is
    // bevelled, or its stroke would poke a spike out of the joined outline.
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    for (const s of seen) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      pieces(s);
      ctx.clip('evenodd');
      if (s.plan === 'above') ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color('--wall-line');
      ctx.lineWidth = this.pen('seen');
      ctx.beginPath();
      pieces(s);
      ctx.stroke();
      ctx.restore();
    }
    outline(cut, color('--wall-line'), this.pen('cut'));
    fill(cut, null);
    seams(cut);
    // Hover and selection: the walls' outline in the accent colour over their neighbours. As for the
    // others, every outline first and the fills over them: wall by wall, each next outline crossed the
    // join with the one before, and selected walls read as not joined.
    const lit = normal.filter((s) => o.selected.has(s.wall.id) || o.hover === s.wall.id);
    for (const s of lit) outline([s], color('--wall-sel'), o.selected.has(s.wall.id) ? 4 : 3);
    // The selected ones as one path, so no seam shows where they meet.
    fill(
      lit.filter((s) => o.selected.has(s.wall.id)),
      color('--wall-sel-fill'),
    );
    for (const s of lit) {
      if (o.selected.has(s.wall.id)) continue;
      // A seen wall is never filled with its layers, even under the pointer: it is not cut.
      fill([s], s.plan !== 'cut' ? color('--wall-sel-fill') : null);
      if (s.plan === 'cut') seams([s]);
    }
    // Preview of walls being drawn.
    const drawn = solids.filter((x) => o.preview.has(x.wall.id));
    outline(drawn, color('--wall-sel'), 3);
    fill(drawn, color('--wall-sel-fill'));
    // The registry's kinds over the walls; guides and texts over the doors and the rest (contract.ts: over), below.
    for (const x of kinds) if (!x.kind.layer) x.kind.plan(paint, x.solid, shownLit(x.id));
    drawOpenings(this, g, o, { line: color('--wall-line'), sel: color('--wall-sel'), selFill: color('--wall-sel-fill'), warn: color('--warn'), canvas: color('--canvas') });
    if (o.axis) dashed(this, o.axis.start, o.axis.end, color('--snap'));
    if (o.gridDraft) drawAxis(paint, o.gridDraft.start, o.gridDraft.end, o.gridDraft.name, color('--wall-sel'));
    if (o.sectionDraft) drawSectionMark(paint, o.sectionDraft, color('--wall-sel'));
    if (o.calloutDraft) drawLeader(paint, o.calloutDraft.to, o.calloutDraft.from, color('--wall-sel'));
    if (o.calibrateDraft) {
      dashed(this, o.calibrateDraft.a, o.calibrateDraft.b, color('--snap'));
      label(this, { x: (o.calibrateDraft.a.x + o.calibrateDraft.b.x) / 2, y: (o.calibrateDraft.a.y + o.calibrateDraft.b.y) / 2 }, o.calibrateDraft.text, color('--snap'), color('--canvas'), planFont(this, '700', '--fs-sm'));
    }
    // Guides over the walls, thin (a guide laid on a wall's face is seen there), and texts over all.
    for (const x of kinds) if (x.kind.layer === 'over') x.kind.plan(paint, x.solid, shownLit(x.id));
    if (o.guideDraft) drawLine(this, o.guideDraft.point, o.guideDraft.dir, color('--guide'), 1.6, [10, 4]);
    if (o.axisLine) drawLine(this, o.axisLine.point, o.axisLine.dir, color('--snap'), 1.4, [12, 4, 2, 4]);
    for (const r of o.refLines ?? []) drawRefLine(this, r, color('--ref-line'));
    if (o.ray) dashed(this, o.ray.start, o.ray.end, color('--snap'));
    drawOpeningTags(this, o.openingTags ?? [], color);
    drawAnnotations(this, o, { ctx, color, paint, kinds, shownLit });
  }

  /**
   * Where the temporary dimensions' values go, as boxes on screen: at the middle of their lines unless
   * one would sit on another (app/dim-labels.ts). The app puts its value buttons at their centres, and
   * room and wall tags keep off them: one placement for all three.
   */
  dimValueBoxes(dims: readonly DimMark[]): { x: number; y: number; w: number; h: number }[] {
    const font = planFont(this, '600', '--fs-sm');
    const sized = dims.map((d) => ({ ...this.dimLine(d), w: textWidth(this, d.text ?? '0,00', font) + 16, h: 22 }));
    const at = separateLabels(sized);
    return sized.map((s, i) => ({ x: at[i]!.x - s.w / 2, y: at[i]!.y - s.h / 2, w: s.w, h: s.h }));
  }

  /** Room tags where room-tags.ts places them: with their room, shortened or left out when crowded. */
  drawRoomTags(
    labels: PlanOverlay['roomLabels'],
    color: (name: string) => string,
    avoid: readonly { x: number; y: number; w: number; h: number }[] = [],
    dims: readonly DimMark[] = [],
    keptLines: readonly { a: Point2; b: Point2 }[] = [],
  ): void {
    const { ctx } = this;
    const nameFont = planFont(this, '600', '--fs-sm');
    const areaFont = planFont(this, '400', '--fs-sm');
    const inputs = labels.map((l) => {
      const p = this.toScreen(l.at);
      const outline = l.outline.map((v) => this.toScreen(v));
      const xs = outline.map((v) => v.x);
      // An open room has no outline: its warning is shown whole.
      const width = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : Infinity;
      return { x: p.x, y: p.y, width, outline, name: l.name, short: l.short, area: l.area, ...(l.brief ? { brief: l.brief } : {}), warn: l.warn };
    });
    const measure = (text: string) => textWidth(this, text, nameFont);
    // The dimensions are drawn over the tags: each tag steps aside from their lines (room-tags.ts),
    // not from the short extension lines at their ends, whose tips sent a tag far off.
    const lines = [
      ...dims.map((d) => {
        const l = this.dimLine(d);
        return { a: l.a, b: l.b };
      }),
      ...keptLines,
    ];
    const tags = layoutRoomTags(inputs, measure, this.size, avoid, lines);
    this.labelBoxes = tags.map((tag) => tag.box);
    for (const tag of tags) {
      // By its input: a tag moved off a dimension no longer stands at its room's point.
      const warn = inputs[tag.index]?.warn ?? false;
      ctx.fillStyle = color('--canvas');
      ctx.globalAlpha = 0.92;
      ctx.fillRect(tag.box.x, tag.box.y, tag.box.w, tag.box.h);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      tag.lines.forEach((line, i) => {
        ctx.font = i === 0 ? nameFont : areaFont;
        ctx.fillStyle = i === 0 ? (warn ? color('--warn') : color('--text')) : color('--text-2');
        ctx.fillText(line, tag.x, tag.box.y + 12 + i * 16);
      });
      ctx.textAlign = 'start';
    }
  }

}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
