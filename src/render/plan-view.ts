// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import { drawLeader } from '../elements/kinds/note';
import { drawSectionMark } from '../elements/kinds/section';
import type { SectionMark } from '../elements/section/schema';
import { DEFAULT_DRAWING, type Detail, detailOf, type DrawingSettings, PEN_UNIT_MM, type PenRole, scaleFactor, TEXT_MM } from '../elements/drawing/schema';
import { drawObjectHandles, type ScreenHandle } from '../app/object-handles';
import { drawAxis } from '../elements/kinds/grid';
import { drawDimension, type Placed } from '../elements/kinds/dimension';
import { eachSolid } from '../elements/registry';
import type { Point2 } from '../core/vector';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import { type DerivedGeometry, openingOutline } from '../app/geometry';
import { layoutRoomTags } from './room-tags';
import type { Handles } from '../app/handles';
import { symbolLines } from '../elements/opening/symbol';
import type { WallId } from '../elements/wall/schema';
import { cutFill, type CutPattern } from '../elements/material/schema';
import { hatchPattern } from './hatch';
import { separateLabels } from '../app/dim-labels';
import type { HeatLayer } from '../app/sim-map';

/**
 * A 1 px line along a screen axis, moved onto pixel centres: drawn between two pixels it would be two
 * half-strength ones, and lose half its contrast. Lines at other angles are left as they are.
 */
export function crisp(a: Point2, b: Point2): [Point2, Point2] {
  const mid = (v: number) => Math.floor(v) + 0.5;
  if (Math.abs(a.x - b.x) < 0.5) {
    const x = mid((a.x + b.x) / 2);
    return [{ x, y: a.y }, { x, y: b.y }];
  }
  if (Math.abs(a.y - b.y) < 0.5) {
    const y = mid((a.y + b.y) / 2);
    return [{ x: a.x, y }, { x: b.x, y }];
  }
  return [a, b];
}

/** Walls are drawn by layer when the thinnest one shown is at least this wide on screen (px). */
export const LAYER_DETAIL_PX = 6;
/** Below this on screen (px), an opening's type tag is left out: the tags would crowd one another. */
const MIN_TAGGED_PX = 18;

/**
 * Whether the plan shows layers: one decision for the whole view, from the thinnest wall shown, so it
 * is never part by layer and part grey.
 */
export function byLayers(thicknesses: readonly number[], scale: number): boolean {
  return thicknesses.length > 0 && Math.min(...thicknesses) * scale >= LAYER_DETAIL_PX;
}

/** A temporary dimension: measured from a to b, drawn beside the element on `side`, clear of it. */
export interface DimMark {
  readonly a: Point2;
  readonly b: Point2;
  readonly side: Point2;
  readonly clear: number;
  /** The value as shown, to keep other text off it. */
  readonly text?: string;
}

/** A grid bubble's radius (px), its centre this far past the axis's end. */
export { GRID_BUBBLE_PX } from '../elements/kinds/grid';

export interface PlanOverlay {
  readonly selected: ReadonlySet<WallId>;
  readonly hover: WallId | null;
  /** The space with no room under the pointer, with the room tool: the room a click makes there. */
  readonly roomSpace?: readonly Point2[] | null;
  /** Walls being drawn (ids present in the geometry), shown as a translucent preview. */
  readonly preview: ReadonlySet<WallId>;
  /** The level's text notes, as tall as their letters at the plan's scale. */
  /** The dimension being made (the dimension tool), placed, with its value. */
  readonly dimensionDraft?: (Placed & { readonly text: string }) | null;
  /** Grid axes: dash-dot lines with their name in a bubble at each end; the one being drawn has no id. */
  /** The axis being drawn (the grid tool), with the name it will get. */
  readonly gridDraft?: { readonly name: string; readonly start: Point2; readonly end: Point2 } | null;
  /** The section being drawn with its tool. */
  readonly sectionDraft?: SectionMark | null;
  /** The callout being placed: its arrow's point, and the pointer where its text will go. */
  readonly calloutDraft?: { readonly from: Point2; readonly to: Point2 } | null;
  /** The two points of a reference being calibrated, and their distance as it is now. */
  readonly calibrateDraft?: { readonly a: Point2; readonly b: Point2; readonly text: string } | null;
  /** The guide being placed. */
  readonly guideDraft?: { readonly point: Point2; readonly dir: Point2 } | null;
  /**
   * Walls' reference lines (the line they are drawn by: centre, exterior or interior face), each with
   * an arrow at its end: the drawing direction, whose right is the exterior side. As ArchiCAD shows them.
   */
  readonly refLines?: readonly { readonly start: Point2; readonly end: Point2; readonly bulge?: number }[];
  /** A mirror's axis while it is set: a line without ends, in the snap's colour. */
  readonly axisLine?: { readonly point: Point2; readonly dir: Point2 } | null;
  /** The reference of an angle or a scale being set (Rotate, Scale), dashed from its base. */
  readonly ray?: { readonly start: Point2; readonly end: Point2 } | null;
  /** `away`: the direction the segment being drawn arrives from, so the label goes beyond its end. */
  readonly snap: { readonly point: Point2; readonly label: string | null; readonly guideFrom?: Point2; readonly away?: Point2; readonly kind?: string } | null;
  /**
   * Live measure of the segment being drawn. With `normal` (unit, world) it is set off the segment on
   * that side, `clear` metres plus a gap, so it never sits on the wall.
   */
  readonly measure: { readonly at: Point2; readonly text: string; readonly normal?: Point2; readonly clear?: number } | null;
  /** The reference line of the segment being drawn, dashed. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  /** Handles of the selection, in screen pixels (app/handles.ts). */
  readonly handles: Handles;
  /** The selected object's handles (app/object-handles.ts), and the one under the pointer. */
  readonly objectHandles?: readonly ScreenHandle[];
  readonly hotHandle?: ScreenHandle | null;
  /** The point a wall chain goes on from: marked even before the pointer moves. */
  readonly anchor?: Point2 | null;
  /** Wall numbers at the middle of the walls selected or under the pointer, as snap labels name them. */
  readonly wallTags?: readonly { readonly at: Point2; readonly text: string }[];
  /** Where something is outside the norms (rules/): a warning sign there. */
  readonly normMarks?: readonly Point2[];
  /** A simulation's colours under the walls (app/sim-map.ts). */
  readonly heat?: HeatLayer | null;
  /** Doors' and windows' type marks beside them (opening/marks.ts); `width` is the opening's (m). */
  readonly openingTags?: readonly { readonly at: Point2; readonly text: string; readonly width: number }[];
  /**
   * Room name and area tags, at each room's point. `short` is shown when the name does not fit the room
   * on screen, `brief` when the area line (a warning) does not; `outline` is the room's, if closed.
   */
  readonly roomLabels: readonly {
    readonly at: Point2;
    readonly name: string;
    readonly short: string;
    readonly area: string;
    readonly brief?: string;
    readonly warn: boolean;
    readonly outline: readonly Point2[];
  }[];
  /** A floor outline being drawn, ending at the cursor. */
  readonly draft: readonly Point2[] | null;
  /** Points the pointer rested on, to align with (snap.ts, acquired): a small plus each. */
  readonly acquired?: readonly Point2[];
  /** A circle guide being drawn: its centre and the radius to the pointer, dashed. */
  readonly circleDraft?: { readonly center: Point2; readonly radius: number } | null;
  /** A move's smart guides: dashed alignments, and equal gaps each with its length. */
  readonly smart?: { readonly lines: readonly { a: Point2; b: Point2 }[]; readonly gaps: readonly { a: Point2; b: Point2; text: string }[] } | null;
  /** Its corners so far, each marked: a typed first corner shows before the pointer moves. */
  readonly draftCorners?: readonly Point2[];
  /** The opening being placed (an id present in the geometry), drawn in the accent colour. */
  readonly openingPreview?: string | null;
  /** Temporary dimensions of the selected element. */
  readonly dims?: readonly DimMark[];
  /** The walls of the level below, as their pieces: drawn faint under everything, to draw on top of. */
  readonly underlay?: readonly (readonly Point2[])[];
}

/** How much of the canvas a panel covers, at its right and bottom edges, in screen pixels. */
export interface Insets {
  readonly right: number;
  readonly bottom: number;
  /** The project browser's drawer, over the left edge. */
  readonly left?: number;
}
export const NO_INSETS: Insets = { right: 0, bottom: 0 };

/**
 * Scale and centre that fit the box in the visible part of a canvas of `size`: 70% of it, the box's
 * centre at the visible part's centre (screen y grows downward, world y upward).
 */
export function fitPlan(box: { min: Point2; max: Point2 }, size: { w: number; h: number }, covered: Insets = NO_INSETS): { scale: number; center: Point2 } {
  const left = covered.left ?? 0;
  const w = Math.max(size.w - covered.right - left, size.w * 0.3);
  const h = Math.max(size.h - covered.bottom, size.h * 0.3);
  const bw = Math.max(box.max.x - box.min.x, 0.5);
  const bh = Math.max(box.max.y - box.min.y, 0.5);
  const scale = Math.min(4000, Math.max(2, Math.min((w * 0.7) / bw, (h * 0.7) / bh)));
  // The box's centre on screen goes to the visible part's centre, left + w / 2.
  const center = { x: (box.min.x + box.max.x) / 2 - (left + w / 2 - size.w / 2) / scale, y: (box.min.y + box.max.y) / 2 - (size.h - h) / 2 / scale };
  return { scale, center };
}

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
  private readonly ctx: CanvasRenderingContext2D;

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
  private get size() {
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

  /** Points of interest (app/points.ts): a numbered disc each, over the drawing; the open one filled. */
  drawPoints(points: readonly { readonly n: number; readonly at: Point2; readonly open: boolean }[]): void {
    const { ctx } = this;
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const bg = css.getPropertyValue('--bg').trim();
    const font = css.getPropertyValue('--font').trim() || 'sans-serif';
    for (const p of points) drawPointDisc(ctx, this.toScreen(p.at), p.n, p.open, accent, bg, font);
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
    if (!this.printing) this.drawGrid(color('--grid-minor'), color('--grid-major'), color('--axis-x'), color('--axis-y'));

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
    /**
     * A wall piece's outline on the path. On an arc wall an edge whose ends lie on one face circle (the
     * chord the engine's 0.5 mm segments take, ADR 0001) is drawn as the circle itself: zoomed past
     * ~2000 px/m the chords showed. A point cut on a chord is up to 0.5 mm inside the circle, so the
     * test of equal radii (to 0.1 µm) takes the chords only.
     */
    type Walled = { start: Point2; end: Point2; bulge?: number };
    /** From u (where the path is) to v: along the wall's face circle when both lie on it, else straight. */
    const edgeOf = (wall: Walled) => {
      const arc = wall.bulge ? arcOf({ start: wall.start, end: wall.end, bulge: wall.bulge }) : null;
      const c = arc ? this.toScreen(arc.center) : null;
      const radius = (p: Point2) => (arc ? Math.hypot(p.x - arc.center.x, p.y - arc.center.y) : 0);
      return (u: Point2, v: Point2) => {
        const q = this.toScreen(v);
        const ru = radius(u);
        if (!c || ru < 1e-6 || Math.abs(ru - radius(v)) >= 1e-7) return ctx.lineTo(q.x, q.y);
        const p = this.toScreen(u);
        const a0 = Math.atan2(p.y - c.y, p.x - c.x);
        const a1 = Math.atan2(q.y - c.y, q.x - c.x);
        let d = a1 - a0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        ctx.arc(c.x, c.y, Math.hypot(p.x - c.x, p.y - c.y), a0, a1, d < 0);
      };
    };
    const piecePath = (poly: readonly Point2[], wall: Walled) => {
      const edge = edgeOf(wall);
      if (poly.length === 0) return;
      const first = this.toScreen(poly[0]!);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.length; i++) edge(poly[i - 1]!, poly[i]!);
      edge(poly[poly.length - 1]!, poly[0]!);
      ctx.closePath();
    };
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
      font: (weight: string, size: string) => this.font(weight, size),
      line: (point: Point2, dir: Point2, colour: string, width: number, dash: readonly number[]) => this.drawLine(point, dir, colour, width, dash),
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
    // A simulation's map over the floors and rooms, under the walls: its cells scaled to the plan, smoothed.
    if (o.heat) {
      const h = o.heat;
      const img = document.createElement('canvas');
      img.width = h.cols;
      img.height = h.rows;
      img.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(h.rgba), h.cols, h.rows), 0, 0);
      const a = this.toScreen(h.origin);
      const b = this.toScreen({ x: h.origin.x + h.cols * h.cell, y: h.origin.y - h.rows * h.cell });
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, a.x, a.y, b.x - a.x, b.y - a.y);
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
    // Outline: stroke all pieces 3 px wide, then fill them over it. Each fill also gets a 1 px stroke
    // of its own colour, which closes the anti-aliasing seam between neighbouring pieces and leaves
    // 1 px of outline outside.
    const outline = (list: typeof solids, line: string, width: number) => {
      ctx.strokeStyle = line;
      ctx.lineWidth = width;
      for (const s of list)
        for (const p of s.pieces) {
          ctx.beginPath();
          piecePath(p.polygon, s.wall);
          ctx.stroke();
        }
    };
    // By layer when the walls are wide enough on screen to tell them apart (byLayers): each piece in its
    // material's colour (darker in the dark theme: --material-shade) and cut pattern (hatch.ts), and a
    // thin line where layers meet (geometry/seams.ts), so they do not depend on colour alone. Narrower,
    // the walls are one colour, as before.
    const thick = (s: (typeof solids)[number]) => s.layers.reduce((t, l) => t + l.thickness, 0);
    // And only where the scale draws them (1:50 and larger): at 1:100 a wall is its outline, filled.
    const detail = this.detail === 'fine' && (this.printing !== null || byLayers(normal.filter((s) => s.layers.length > 0 && s.plan === 'cut').map(thick), this.scale));
    // An overridden wall is its colour alone: no layers, no hatches.
    // A wall's own id (an arc's segments are "id#k", geometry/arc.ts) and its phase's colour, if phases are drawn.
    const phaseOf = (s: (typeof solids)[number]) => this.phases.get(s.wall.id.split('#')[0]!);
    const phaseColour = (s: (typeof solids)[number]) => {
      const p = phaseOf(s);
      return p ? color(`--phase-${p}`) : undefined;
    };
    const layered = (s: (typeof solids)[number]) => detail && s.layers.length > 0 && !this.overrides.has(s.wall.wallTypeId) && !phaseOf(s);
    // Pieces of one colour are filled as one path: the canvas covers a path as a whole, so where two
    // of them meet (a core through an L's mitre) no antialiased seam lets the outline under them show.
    const shadeBy = Number(color('--material-shade')) || 1;
    // A layer's colour lightened (or darkened) only as much as the wall's line needs to read on it.
    const wallLine = color('--wall-line');
    const fill = (list: typeof solids, colour: string | null) => {
      type Polys = [Point2[], (typeof solids)[number]['wall']][];
      const byColour = new Map<string, Polys>();
      const byPattern = new Map<CutPattern, Polys>();
      for (const s of list) {
        const byLayer = colour === null && layered(s);
        for (const p of s.pieces) {
          const m = byLayer ? s.materials[p.layerIndex] : undefined;
          const c = colour ?? phaseColour(s) ?? this.overrides.get(s.wall.wallTypeId) ?? (m ? (m.cut === 'none' ? color('--canvas') : cutFill(m.color, shadeBy, wallLine)) : color('--wall-fill'));
          const poly: Polys[number] = [[...p.polygon], s.wall];
          byColour.set(c, [...(byColour.get(c) ?? []), poly]);
          if (m) byPattern.set(m.cut, [...(byPattern.get(m.cut) ?? []), poly]);
        }
      }
      ctx.lineWidth = 1;
      for (const [c, polys] of byColour) {
        ctx.beginPath();
        for (const [poly, wall] of polys) piecePath(poly, wall);
        ctx.fillStyle = c;
        ctx.strokeStyle = c;
        ctx.fill('nonzero');
        ctx.stroke();
      }
      const ink = color('--hatch');
      for (const [cut, polys] of byPattern) {
        const pattern = hatchPattern(ctx, cut, ink, dpr);
        if (!pattern) continue;
        ctx.beginPath();
        for (const [poly, wall] of polys) piecePath(poly, wall);
        ctx.fillStyle = pattern;
        ctx.fill('nonzero');
      }
    };
    const seams = (list: typeof solids) => {
      ctx.strokeStyle = color('--wall-line');
      ctx.lineWidth = this.pen('fine');
      ctx.beginPath();
      for (const s of list) {
        if (!layered(s)) continue;
        if (s.wall.bulge) {
          // On an arc, along the layers' circle, as the faces are (piecePath).
          const edge = edgeOf(s.wall);
          for (const seam of s.seams) {
            const a = this.toScreen(seam.a);
            ctx.moveTo(a.x, a.y);
            edge(seam.a, seam.b);
          }
          continue;
        }
        for (const seam of s.seams) {
          const [a, b] = crisp(this.toScreen(seam.a), this.toScreen(seam.b));
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
    };
    // The plan is a section at the level's cut height (app/geometry.ts): walls that do not cross it are
    // seen, not cut, and drawn as their outline only, thin, under the cut ones; dashed above the cut.
    // The stroke is clipped to outside the wall's pieces (the canvas less them, even-odd), so the lines
    // between its own pieces and the inner half of the stroke do not show.
    const seen = normal.filter((s) => s.plan !== 'cut');
    const cut = normal.filter((s) => s.plan === 'cut');
    const pieces = (s: (typeof solids)[number]) => {
      for (const p of s.pieces) piecePath(p.polygon, s.wall);
    };
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
    this.drawOpenings(g, o, { line: color('--wall-line'), sel: color('--wall-sel'), selFill: color('--wall-sel-fill'), warn: color('--warn'), canvas: color('--canvas') });
    if (o.axis) this.dashed(o.axis.start, o.axis.end, color('--snap'));
    if (o.gridDraft) drawAxis(paint, o.gridDraft.start, o.gridDraft.end, o.gridDraft.name, color('--wall-sel'));
    if (o.sectionDraft) drawSectionMark(paint, o.sectionDraft, color('--wall-sel'));
    if (o.calloutDraft) drawLeader(paint, o.calloutDraft.to, o.calloutDraft.from, color('--wall-sel'));
    if (o.calibrateDraft) {
      this.dashed(o.calibrateDraft.a, o.calibrateDraft.b, color('--snap'));
      this.label({ x: (o.calibrateDraft.a.x + o.calibrateDraft.b.x) / 2, y: (o.calibrateDraft.a.y + o.calibrateDraft.b.y) / 2 }, o.calibrateDraft.text, color('--snap'), color('--canvas'), this.font('700', '--fs-sm'));
    }
    // Guides over the walls, thin (a guide laid on a wall's face is seen there), and texts over all.
    for (const x of kinds) if (x.kind.layer === 'over') x.kind.plan(paint, x.solid, shownLit(x.id));
    if (o.guideDraft) this.drawLine(o.guideDraft.point, o.guideDraft.dir, color('--guide'), 1.6, [10, 4]);
    if (o.axisLine) this.drawLine(o.axisLine.point, o.axisLine.dir, color('--snap'), 1.4, [12, 4, 2, 4]);
    for (const r of o.refLines ?? []) this.drawRefLine(r, color('--ref-line'));
    if (o.ray) this.dashed(o.ray.start, o.ray.end, color('--snap'));
    this.drawOpeningTags(o.openingTags ?? [], color);
    // The tags keep off the kinds' values and lines (a dimension's: contract.ts, keepOut), the one being made's too.
    const draft = o.dimensionDraft ?? null;
    const kept = [...kinds.flatMap((x) => x.kind.keepOut?.(paint, x.solid) ?? []), ...(draft ? [{ boxes: [], lines: [{ a: this.toScreen(draft.la), b: this.toScreen(draft.lb) }] }] : [])];
    this.drawRoomTags(o.roomLabels, color, [...this.dimValueBoxes(o.dims ?? []), ...kept.flatMap((k) => k.boxes)], o.dims ?? [], kept.flatMap((k) => k.lines));
    // Dimensions over the room tags (contract.ts: layer top): a value under a room's name was lost.
    for (const x of kinds) if (x.kind.layer === 'top') x.kind.plan(paint, x.solid, shownLit(x.id));
    // Outside the norms: the warning sign, over the rest.
    for (const m of o.normMarks ?? []) this.warnSign(this.toScreen(m), color('--warn'), color('--canvas'));
    if (draft) drawDimension(paint, draft, draft.text, color('--wall-sel'));
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
    for (const v of o.draftCorners ?? []) {
      const s = this.toScreen(v);
      ctx.save();
      ctx.fillStyle = color('--bg');
      ctx.strokeStyle = color('--wall-sel');
      ctx.lineWidth = 1.5;
      ctx.fillRect(Math.round(s.x) - 3.5, Math.round(s.y) - 3.5, 7, 7);
      ctx.strokeRect(Math.round(s.x) - 3.5, Math.round(s.y) - 3.5, 7, 7);
      ctx.restore();
    }
    // A wall's tag keeps off the dimensions' values (the tester's R03: "3,00" covered "Parede 49") and
    // the room tags ("Parede 13" over a room whose point a copied wall had covered): moved down past the
    // one it would meet, or up if that runs off the canvas.
    const values = [...this.dimValueBoxes(o.dims ?? []), ...this.labelBoxes];
    for (const tag of o.wallTags ?? []) {
      const font = this.font('600', '--fs-xs');
      const tw = this.textWidth(tag.text, font) + 8;
      const p = this.toScreen(tag.at);
      let dy = 4;
      const box = (y: number) => ({ x: p.x - tw / 2, y: p.y + y - 11, w: tw, h: 16 });
      for (let k = 0; k < values.length + 1; k++) {
        const hit = values.find((v) => overlaps(box(dy), v));
        if (!hit) break;
        dy = hit.y + hit.h + 11 + 2 - p.y;
      }
      if (p.y + dy + 5 > this.size.h) dy = 4 - 24;
      this.label(tag.at, tag.text, color('--wall-sel'), color('--canvas'), font, { x: 0, y: dy });
    }
    this.drawHandles(o.handles, color('--bg'), color('--wall-sel'));
    if (o.objectHandles) drawObjectHandles(this.ctx, o.objectHandles, color('--bg'), color('--wall-sel'), o.hotHandle ?? null);
    if (o.anchor) {
      const p = this.toScreen(o.anchor);
      ctx.save();
      ctx.strokeStyle = color('--snap');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const d of o.dims ?? []) this.drawDim(d, color('--wall-sel'));
    if (o.smart) {
      ctx.save();
      ctx.strokeStyle = color('--snap');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const l of o.smart.lines) {
        const [a, b] = crisp(this.toScreen(l.a), this.toScreen(l.b));
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1.4;
      for (const gp of o.smart.gaps) {
        const a = this.toScreen(gp.a);
        const b = this.toScreen(gp.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        for (const p of [a, b]) {
          ctx.moveTo(p.x - n.x * 4, p.y - n.y * 4);
          ctx.lineTo(p.x + n.x * 4, p.y + n.y * 4);
        }
        ctx.stroke();
        this.label({ x: (gp.a.x + gp.b.x) / 2, y: (gp.a.y + gp.b.y) / 2 }, gp.text, color('--snap'), color('--canvas'), this.font('600', '--fs-xs'));
      }
      ctx.restore();
    }
    if (o.circleDraft) {
      const c = this.toScreen(o.circleDraft.center);
      ctx.save();
      ctx.strokeStyle = color('--wall-sel');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, o.circleDraft.radius * this.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (o.acquired?.length) {
      ctx.save();
      ctx.strokeStyle = color('--snap');
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const a of o.acquired) {
        const q = this.toScreen(a);
        ctx.moveTo(q.x - 4, q.y);
        ctx.lineTo(q.x + 4, q.y);
        ctx.moveTo(q.x, q.y - 4);
        ctx.lineTo(q.x, q.y + 4);
      }
      ctx.stroke();
      ctx.restore();
    }
    const snapBox = o.snap ? this.drawSnap(o.snap, color('--snap'), color('--bg')) : null;
    if (o.measure) this.drawMeasure(o.measure, snapBox, color('--accent-text'), color('--canvas'));
  }

  /** Squares move an end, arrows stretch along the wall, the arc turns the selection. */
  private drawHandles(h: Handles, bg: string, line: string): void {
    drawHandles(this.ctx, h, bg, line);
  }

  /**
   * Where the temporary dimensions' values go, as boxes on screen: at the middle of their lines unless
   * one would sit on another (app/dim-labels.ts). The app puts its value buttons at their centres, and
   * room and wall tags keep off them: one placement for all three.
   */
  dimValueBoxes(dims: readonly DimMark[]): { x: number; y: number; w: number; h: number }[] {
    const font = this.font('600', '--fs-sm');
    const sized = dims.map((d) => ({ ...this.dimLine(d), w: this.textWidth(d.text ?? '0,00', font) + 16, h: 22 }));
    const at = separateLabels(sized);
    return sized.map((s, i) => ({ x: at[i]!.x - s.w / 2, y: at[i]!.y - s.h / 2, w: s.w, h: s.h }));
  }

  /** Room tags where room-tags.ts places them: with their room, shortened or left out when crowded. */
  private drawRoomTags(
    labels: PlanOverlay['roomLabels'],
    color: (name: string) => string,
    avoid: readonly { x: number; y: number; w: number; h: number }[] = [],
    dims: readonly DimMark[] = [],
    keptLines: readonly { a: Point2; b: Point2 }[] = [],
  ): void {
    const { ctx } = this;
    const nameFont = this.font('600', '--fs-sm');
    const areaFont = this.font('400', '--fs-sm');
    const inputs = labels.map((l) => {
      const p = this.toScreen(l.at);
      const outline = l.outline.map((v) => this.toScreen(v));
      const xs = outline.map((v) => v.x);
      // An open room has no outline: its warning is shown whole.
      const width = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : Infinity;
      return { x: p.x, y: p.y, width, outline, name: l.name, short: l.short, area: l.area, ...(l.brief ? { brief: l.brief } : {}), warn: l.warn };
    });
    const measure = (text: string) => this.textWidth(text, nameFont);
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

  /**
   * The type marks of doors and windows, each in a small outlined tag beside its opening; left out while
   * an opening is too small on screen to tell its tag from its neighbours'.
   */
  private drawOpeningTags(tags: NonNullable<PlanOverlay['openingTags']>, color: (name: string) => string): void {
    const { ctx } = this;
    const font = this.font('600', '--fs-xs');
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (const tag of tags) {
      if (tag.width * this.scale < MIN_TAGGED_PX || tag.text === '') continue;
      const p = this.toScreen(tag.at);
      const w = this.textWidth(tag.text, font) + 8;
      const h = 15;
      ctx.fillStyle = color('--canvas');
      ctx.strokeStyle = color('--text-3');
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color('--text-2');
      ctx.fillText(tag.text, p.x, p.y + 0.5);
    }
    ctx.restore();
  }

  /** A grid axis: a dash-dot line between its bubbles, each a circle with its name, past its ends. */
  private font(weight: string, size: string): string {
    const css = getComputedStyle(document.documentElement);
    // On paper a text keeps its size in millimetres whatever the scale (drawing/schema.ts, TEXT_MM).
    const p = this.printing;
    const px = p ? `${(TEXT_MM[size] ?? 2.5) / (PEN_UNIT_MM * scaleFactor(p.den))}px` : css.getPropertyValue(size).trim();
    return `${weight} ${px} ${css.getPropertyValue('--font').trim()}`;
  }

  /** The live measure, off the segment along its normal, and moved further out while it would cover the snap label. */
  private drawMeasure(m: NonNullable<PlanOverlay['measure']>, avoid: Box | null, colour: string, bg: string): void {
    const font = this.font('700', '--fs-sm');
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
      ctx.lineWidth = this.pen('fine') * (active ? 1.6 : 1);
      for (const line of symbolLines(op, op.frame)) (path(line), ctx.stroke());
      if (!op.valid) this.warnSign(this.clearOfHandles(f.start, f.end, o.handles), c.warn, c.canvas);
    }
  }

  /**
   * Where an opening's warning sign goes: at its middle, or stepped across the wall away from the
   * selection's handles. One at a wall's joint lay under the square of the wall's end, unseen.
   */
  private clearOfHandles(a: Point2, b: Point2, h: Handles): Point2 {
    const mid = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const marks = [...h.squares.map((s) => s.at), ...h.arrows.map((x) => x.at), ...(h.rotate ? [h.rotate.at] : []), ...(h.bulge ? [h.bulge.at] : [])];
    const clear = (p: Point2) => marks.every((m) => Math.hypot(m.x - p.x, m.y - p.y) >= 16);
    if (clear(mid)) return mid;
    const sa = this.toScreen(a);
    const sb = this.toScreen(b);
    const len = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
    const n = { x: -(sb.y - sa.y) / len, y: (sb.x - sa.x) / len };
    for (const k of [1, -1, 2, -2]) {
      const p = { x: mid.x + n.x * 16 * k, y: mid.y + n.y * 16 * k };
      if (clear(p)) return p;
    }
    return mid;
  }

  /** A small triangle with "!" at a screen point: the sign of a problem, readable without colour. */
  private warnSign(p: Point2, colour: string, bg: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x + 8, p.y + 6);
    ctx.lineTo(p.x - 8, p.y + 6);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = this.font('700', '--fs-xs');
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y + 4.5);
    ctx.restore();
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

  /** A reference line along the wall (its arc, for an arc wall), a dot at its start and an arrow at its end. */
  private drawRefLine(r: { start: Point2; end: Point2; bulge?: number }, colour: string): void {
    const { ctx } = this;
    const arc = r.bulge ? arcOf({ start: r.start, end: r.end, bulge: r.bulge }) : null;
    const pts = arc ? Array.from({ length: 33 }, (_, i) => pointAt(arc, arc.startAngle + (arc.sweep * i) / 32)) : [r.start, r.end];
    const screen = pts.map((p) => this.toScreen(p));
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    screen.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    const a = screen[0]!;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // The arrow along the line's last stretch, short of its end, where the end's grip would cover it.
    const end = screen.at(-1)!;
    const p = screen.at(-2)!;
    const len = Math.hypot(end.x - p.x, end.y - p.y);
    if (len > 0) {
      const ux = (end.x - p.x) / len;
      const uy = (end.y - p.y) / len;
      const back = Math.min(14, len / 2);
      const b = { x: end.x - ux * back, y: end.y - uy * back };
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - ux * 9 - uy * 4.5, b.y - uy * 9 + ux * 4.5);
      ctx.lineTo(b.x - ux * 9 + uy * 4.5, b.y - uy * 9 - ux * 4.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** A line without ends through `point` along `dir`, dashed across the canvas, its dashes fixed to the plan. */
  private drawLine(point: Point2, dir: Point2, colour: string, width: number, dash: readonly number[]): void {
    const { ctx } = this;
    const at = this.toScreen(point);
    const b = this.toScreen({ x: point.x + dir.x, y: point.y + dir.y });
    const len = Math.hypot(b.x - at.x, b.y - at.y);
    if (len === 0) return;
    const ux = (b.x - at.x) / len;
    const uy = (b.y - at.y) / len;
    // Level or upright, on the middle of a pixel row (an odd width) or between two (even): a 1 px line
    // between rows was smeared over both, pale, and guides of one colour looked of two.
    const crisp = (v: number) => (width % 2 === 1 ? Math.round(v - 0.5) + 0.5 : Math.round(v));
    const a = { x: Math.abs(ux) < 1e-9 ? crisp(at.x) : at.x, y: Math.abs(uy) < 1e-9 ? crisp(at.y) : at.y };
    const { w, h } = this.size;
    // Past both edges of the canvas from the line's point, wherever that point is.
    const reach = Math.hypot(w, h) + Math.hypot(a.x - w / 2, a.y - h / 2);
    const period = dash.reduce((s, x) => s + x, 0);
    ctx.save();
    ctx.setLineDash([...dash]);
    ctx.lineDashOffset = -(reach % period);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x - ux * reach, a.y - uy * reach);
    ctx.lineTo(a.x + ux * reach, a.y + uy * reach);
    ctx.stroke();
    ctx.restore();
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
    snapMark(ctx, s.kind ?? '', p);
    ctx.stroke();
    if (!s.label) return null;
    // Beyond the end of the segment, never back over it: to the left when it arrives going left.
    const font = this.font('600', '--fs-xs');
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


/** A point of interest's disc: its number in it, the accent ring; filled when its card is open. */
export const POINT_DISC_R = 11;
export function drawPointDisc(ctx: CanvasRenderingContext2D, at: Point2, n: number, open: boolean, accent: string, bg: string, font: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, at.y, POINT_DISC_R, 0, Math.PI * 2);
  ctx.fillStyle = open ? accent : bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.fillStyle = open ? bg : accent;
  ctx.font = `700 12px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), at.x, at.y + 0.5);
  ctx.restore();
}

/**
 * A snap's mark, its shape saying what it is (as CAD programs draw them): a square at an end or a
 * corner, a triangle at a middle, a diamond at a division, a circle at a centre, a circle with a dot
 * at an element's point, a cross where lines cross, ⊥ square to a wall, an hourglass on a wall or a
 * guide, a plus along a direction or an alignment, a dot on the grid.
 */
export function snapMark(ctx: CanvasRenderingContext2D, kind: string, p: Point2): void {
  const r = 5;
  switch (kind) {
    case 'endpoint':
    case 'corner':
    case 'start':
      ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r);
      return;
    case 'midpoint':
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r + 1, p.y + r);
      ctx.lineTo(p.x - r - 1, p.y + r);
      ctx.closePath();
      return;
    case 'division':
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r + 1, p.y);
      ctx.lineTo(p.x, p.y + r + 1);
      ctx.lineTo(p.x - r - 1, p.y);
      ctx.closePath();
      return;
    case 'center':
      ctx.moveTo(p.x + r + 1, p.y);
      ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      return;
    case 'node':
      ctx.moveTo(p.x + r + 1, p.y);
      ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      ctx.moveTo(p.x + 1.5, p.y);
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      return;
    case 'perpendicular':
      ctx.moveTo(p.x - r, p.y + r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x, p.y + r);
      ctx.lineTo(p.x, p.y - r);
      return;
    case 'onWall':
    case 'onFace':
    case 'onGuide':
      ctx.moveTo(p.x - r, p.y - r);
      ctx.lineTo(p.x + r, p.y - r);
      ctx.lineTo(p.x - r, p.y + r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.closePath();
      return;
    case 'extension':
    case 'aligned':
    case 'axis':
    case 'parallel':
    case 'locked':
    case 'angle':
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x + r, p.y);
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x, p.y + r);
      return;
    case 'grid':
      ctx.moveTo(p.x + 2, p.y);
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      return;
    default:
      // Where lines cross (two walls, guides, the origin), and anything else: a cross.
      ctx.moveTo(p.x - r, p.y - r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x + r, p.y - r);
      ctx.lineTo(p.x - r, p.y + r);
  }
}

/** The selection's handles (app/handles.ts) on a 2D canvas, in plan and over the 3D view alike. */
export function drawHandles(ctx: CanvasRenderingContext2D, h: Handles, bg: string, line: string): void {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  for (const s of h.squares) {
    ctx.fillRect(Math.round(s.at.x) - 4.5, Math.round(s.at.y) - 4.5, 9, 9);
    ctx.strokeRect(Math.round(s.at.x) - 4.5, Math.round(s.at.y) - 4.5, 9, 9);
  }
  for (const a of h.arrows) {
    // A triangle pointing outward along the wall.
    const n = { x: -a.dir.y, y: a.dir.x };
    ctx.beginPath();
    ctx.moveTo(a.at.x + a.dir.x * 6, a.at.y + a.dir.y * 6);
    ctx.lineTo(a.at.x - a.dir.x * 4 + n.x * 5, a.at.y - a.dir.y * 4 + n.y * 5);
    ctx.lineTo(a.at.x - a.dir.x * 4 - n.x * 5, a.at.y - a.dir.y * 4 - n.y * 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (h.bulge) {
    // A diamond at the middle of the arc: not a square, which moves an end.
    const { x, y } = h.bulge.at;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  for (const f of h.flips) {
    // A disc with a double arrow along its axis, as Revit's flip controls.
    const { x, y } = f.at;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const d = f.dir;
    const n = { x: -d.y, y: d.x };
    ctx.beginPath();
    ctx.moveTo(x - d.x * 5, y - d.y * 5);
    ctx.lineTo(x + d.x * 5, y + d.y * 5);
    for (const s of [1, -1]) {
      const tip = { x: x + d.x * 5 * s, y: y + d.y * 5 * s };
      ctx.moveTo(tip.x - d.x * 3 * s + n.x * 3, tip.y - d.y * 3 * s + n.y * 3);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(tip.x - d.x * 3 * s - n.x * 3, tip.y - d.y * 3 * s - n.y * 3);
    }
    ctx.stroke();
  }
  if (h.rotate) {
    // A disc with a three-quarter arc and its arrowhead.
    const { x, y } = h.rotate.at;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.5, -Math.PI * 0.9, Math.PI * 0.6);
    ctx.stroke();
    const tip = { x: x + 4.5 * Math.cos(Math.PI * 0.6), y: y + 4.5 * Math.sin(Math.PI * 0.6) };
    ctx.beginPath();
    ctx.moveTo(tip.x - 3, tip.y - 1);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x + 1, tip.y - 3);
    ctx.stroke();
  }
  ctx.restore();
}
