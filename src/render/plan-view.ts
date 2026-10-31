// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import { drawLeader } from '../elements/kinds/note';
import { drawSectionMark } from '../elements/kinds/section';
import type { SectionMark } from '../elements/section/schema';
import { DEFAULT_DRAWING, type Detail, detailOf, type DrawingSettings, PEN_UNIT_MM, type PenRole } from '../elements/drawing/schema';
import { drawObjectHandles, type ScreenHandle } from '../session/object-handles';
import { drawAxis } from '../elements/kinds/grid';
import { drawDimension, type Placed } from '../elements/kinds/dimension';
import { eachSolid } from '../elements/registry';
import type { Point2 } from '../model/vector';
import { arcOf } from '../elements/wall/geometry/arc';
import type { DerivedGeometry } from '../project/derive';
import { layoutRoomTags } from './room-tags';
import type { Handles } from '../session/handles';
import type { WallId } from '../elements/wall/schema';
import { cutFill, type CutPattern } from '../elements/material/schema';
import { hatchPattern } from '../elements/material/hatch';
import { separateLabels } from '../session/dim-labels';
import { dashed, drawDim, drawMeasure, drawOpeningTags, drawSnap, label, overlaps, planFont, textWidth } from './plan-text';
import { drawGrid, drawLine, drawOpenings, drawRefLine, drawSelectionHandles } from './plan-strokes';

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
    // The tags keep off the kinds' values and lines (a dimension's: contract.ts, keepOut), the one being made's too.
    const draft = o.dimensionDraft ?? null;
    const kept = [...kinds.flatMap((x) => x.kind.keepOut?.(paint, x.solid) ?? []), ...(draft ? [{ boxes: [], lines: [{ a: this.toScreen(draft.la), b: this.toScreen(draft.lb) }] }] : [])];
    this.drawRoomTags(o.roomLabels, color, [...this.dimValueBoxes(o.dims ?? []), ...kept.flatMap((k) => k.boxes)], o.dims ?? [], kept.flatMap((k) => k.lines));
    // Dimensions over the room tags (contract.ts: layer top): a value under a room's name was lost.
    for (const x of kinds) if (x.kind.layer === 'top') x.kind.plan(paint, x.solid, shownLit(x.id));
    // Outside the norms: the warning sign, over the rest.
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
      const font = planFont(this, '600', '--fs-xs');
      const tw = textWidth(this, tag.text, font) + 8;
      const p = this.toScreen(tag.at);
      let dy = 4;
      const box = (y: number) => ({ x: p.x - tw / 2, y: p.y + y - 11, w: tw, h: 16 });
      for (let k = 0; k < values.length + 1; k++) {
        const hit = values.find((v) => overlaps(box(dy), v));
        if (!hit) break;
        dy = hit.y + hit.h + 11 + 2 - p.y;
      }
      if (p.y + dy + 5 > this.size.h) dy = 4 - 24;
      label(this, tag.at, tag.text, color('--wall-sel'), color('--canvas'), font, { x: 0, y: dy });
    }
    drawSelectionHandles(this, o.handles, color('--bg'), color('--wall-sel'));
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
    for (const d of o.dims ?? []) drawDim(this, d, color('--wall-sel'));
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
        label(this, { x: (gp.a.x + gp.b.x) / 2, y: (gp.a.y + gp.b.y) / 2 }, gp.text, color('--snap'), color('--canvas'), planFont(this, '600', '--fs-xs'));
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
    const snapBox = o.snap ? drawSnap(this, o.snap, color('--snap'), color('--bg')) : null;
    if (o.measure) drawMeasure(this, o.measure, snapBox, color('--accent-text'), color('--canvas'));
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
  private drawRoomTags(
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
