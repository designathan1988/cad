// Plan view on a 2D canvas. Reads derived geometry and draws; never changes the project.
// The joined outline needs no boolean union: every piece is stroked first, then every piece is
// filled over the strokes, so lines between joined pieces disappear and only the outside stays.

import type { Point2 } from '../core/vector';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import { type DerivedGeometry, openingOutline } from '../app/geometry';
import { layoutRoomTags } from './room-tags';
import type { Handles } from '../app/handles';
import { symbolLines } from '../elements/opening/symbol';
import type { WallId } from '../elements/wall/schema';
import { type Note, noteBox, shownHeight } from '../elements/note/schema';
import { LAYER_TOKEN } from '../ui/swatch';
import { separateLabels } from '../app/dim-labels';

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
export const GRID_BUBBLE_PX = 12;

export interface PlanOverlay {
  readonly selected: ReadonlySet<WallId>;
  readonly hover: WallId | null;
  /** The space with no room under the pointer, with the room tool: the room a click makes there. */
  readonly roomSpace?: readonly Point2[] | null;
  /** Walls being drawn (ids present in the geometry), shown as a translucent preview. */
  readonly preview: ReadonlySet<WallId>;
  /** The level's guides: lines without ends, dashed across the whole plan (selected and hovered as elements). */
  readonly guides?: readonly { readonly id: string; readonly point: Point2; readonly dir: Point2 }[];
  /** The level's text notes, as tall as their letters at the plan's scale. */
  readonly notes?: readonly (Note & { readonly selected: boolean })[];
  /**
   * Permanent dimensions (elements/dimension): the points measured (a, b), the dimension line (la to lb),
   * the value. The one being made has no id.
   */
  readonly dimensions?: readonly { readonly id: string; readonly a: Point2; readonly b: Point2; readonly la: Point2; readonly lb: Point2; readonly text: string; readonly selected: boolean }[];
  /** Grid axes: dash-dot lines with their name in a bubble at each end; the one being drawn has no id. */
  readonly grids?: readonly { readonly id: string; readonly name: string; readonly start: Point2; readonly end: Point2; readonly selected: boolean }[];
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
  readonly snap: { readonly point: Point2; readonly label: string | null; readonly guideFrom?: Point2; readonly away?: Point2 } | null;
  /**
   * Live measure of the segment being drawn. With `normal` (unit, world) it is set off the segment on
   * that side, `clear` metres plus a gap, so it never sits on the wall.
   */
  readonly measure: { readonly at: Point2; readonly text: string; readonly normal?: Point2; readonly clear?: number } | null;
  /** The reference line of the segment being drawn, dashed. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  /** Handles of the selection, in screen pixels (app/handles.ts). */
  readonly handles: Handles;
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
    // Floors and rooms lie under the walls; a floor's holes are left out of it, crossed as voids are
    // drawn. A ceiling is above the cut: only its outline, dotted.
    for (const f of g.floors.values()) {
      if (f.outline.length < 3) continue;
      const sel = o.selected.has(f.floor.id) || o.hover === f.floor.id;
      const ceiling = f.floor.kind === 'ceiling';
      trace(f.outline);
      for (const h of f.holes) {
        h.forEach((v, i) => {
          const s = this.toScreen(v);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
      }
      if (!ceiling || sel) {
        ctx.fillStyle = sel ? color('--accent-soft') : color('--floor-fill');
        ctx.fill('evenodd');
      }
      ctx.save();
      ctx.setLineDash(ceiling ? [2, 3] : [5, 4]);
      ctx.strokeStyle = sel ? color('--wall-sel') : color('--text-3');
      ctx.lineWidth = 1;
      ctx.stroke();
      // Each hole crossed corner to corner.
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const h of f.holes) {
        if (h.length < 3) continue;
        const pts = h.map((v) => this.toScreen(v));
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        ctx.lineTo(pts[Math.floor(pts.length / 2)]!.x, pts[Math.floor(pts.length / 2)]!.y);
        if (pts.length >= 4) {
          ctx.moveTo(pts[1]!.x, pts[1]!.y);
          ctx.lineTo(pts[Math.floor(pts.length / 2) + 1]!.x, pts[Math.floor(pts.length / 2) + 1]!.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    for (const r of g.rooms.values()) {
      if (!r.enclosed || !(o.selected.has(r.room.id) || o.hover === r.room.id)) continue;
      trace(r.outline);
      ctx.fillStyle = color('--accent-soft');
      ctx.fill();
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
    // layer function's colour, and a thin line where layers meet (geometry/seams.ts), so they do not
    // depend on colour alone. Narrower, the walls are one colour, as before.
    const thick = (s: (typeof solids)[number]) => s.layers.reduce((t, l) => t + l.thickness, 0);
    const detail = byLayers(normal.filter((s) => s.layers.length > 0 && s.plan === 'cut').map(thick), this.scale);
    const layered = (s: (typeof solids)[number]) => detail && s.layers.length > 0;
    // Pieces of one colour are filled as one path: the canvas covers a path as a whole, so where two
    // of them meet (a core through an L's mitre) no antialiased seam lets the outline under them show.
    const fill = (list: typeof solids, colour: string | null) => {
      const byColour = new Map<string, [Point2[], (typeof solids)[number]['wall']][]>();
      for (const s of list) {
        const byLayer = colour === null && layered(s);
        for (const p of s.pieces) {
          const fn = s.layers[p.layerIndex]?.function;
          const c = colour ?? (byLayer && fn ? color(LAYER_TOKEN[fn]) : color('--wall-fill'));
          byColour.set(c, [...(byColour.get(c) ?? []), [[...p.polygon], s.wall]]);
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
    };
    const seams = (list: typeof solids) => {
      ctx.strokeStyle = color('--wall-line');
      ctx.lineWidth = 1;
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
      ctx.lineWidth = 2;
      ctx.beginPath();
      pieces(s);
      ctx.stroke();
      ctx.restore();
    }
    outline(cut, color('--wall-line'), 3);
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
    // Columns cut, filled as a wall's structure layer is (they are structure), outlined as walls are;
    // lit when selected or under the pointer.
    for (const c of g.columns.values()) {
      const lit = o.selected.has(c.column.id) || o.hover === c.column.id;
      const pts = c.outline.map((v) => this.toScreen(v));
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = lit ? color('--wall-sel-fill') : color('--layer-structure');
      ctx.fill();
      ctx.strokeStyle = lit ? color('--wall-sel') : color('--wall-line');
      ctx.lineWidth = lit ? 2 : 1;
      ctx.stroke();
    }
    // Roofs above the cut: the eaves dashed, the ridges and hips (the faces' sides) thin; lit when selected.
    ctx.save();
    for (const r of g.roofs.values()) {
      const lit = o.selected.has(r.roof.id) || o.hover === r.roof.id;
      const eaves = r.outline.map((v) => this.toScreen(v));
      ctx.beginPath();
      eaves.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      if (lit) {
        ctx.fillStyle = color('--accent-soft');
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = lit ? color('--wall-sel') : color('--text-2');
      ctx.lineWidth = lit ? 2 : 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      for (const f of r.faces) {
        if (r.faces.length < 2) break;
        const pts = f.polygon.map((v) => this.toScreen(v));
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    // Beams above the cut: their outline dashed, as hidden lines are; lit when selected or under the pointer.
    ctx.save();
    ctx.setLineDash([6, 4]);
    for (const b of g.beams.values()) {
      const lit = o.selected.has(b.beam.id) || o.hover === b.beam.id;
      const pts = b.outline.map((v) => this.toScreen(v));
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      if (lit) {
        ctx.fillStyle = color('--wall-sel-fill');
        ctx.fill();
      }
      ctx.strokeStyle = lit ? color('--wall-sel') : color('--text-2');
      ctx.lineWidth = lit ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();
    this.drawOpenings(g, o, { line: color('--wall-line'), sel: color('--wall-sel'), selFill: color('--wall-sel-fill'), warn: color('--warn'), canvas: color('--canvas') });
    if (o.axis) this.dashed(o.axis.start, o.axis.end, color('--snap'));
    for (const g of o.grids ?? []) this.drawGridAxis(g, g.selected ? color('--wall-sel') : color('--text-2'), color('--canvas'));
    // Guides over the walls, thin: a guide laid on a wall's face is seen there.
    for (const g of o.guides ?? []) {
      const lit = o.selected.has(g.id) || o.hover === g.id;
      this.drawLine(g.point, g.dir, lit ? color('--wall-sel') : color('--guide'), lit ? 2 : 1, lit ? [10, 4] : [8, 5]);
    }
    if (o.guideDraft) this.drawLine(o.guideDraft.point, o.guideDraft.dir, color('--guide'), 1.6, [10, 4]);
    if (o.axisLine) this.drawLine(o.axisLine.point, o.axisLine.dir, color('--snap'), 1.4, [12, 4, 2, 4]);
    for (const r of o.refLines ?? []) this.drawRefLine(r, color('--ref-line'));
    if (o.ray) this.dashed(o.ray.start, o.ray.end, color('--snap'));
    this.drawNotes(o.notes ?? [], color);
    this.drawOpeningTags(o.openingTags ?? [], color);
    const kept = o.dimensions ?? [];
    this.drawRoomTags(o.roomLabels, color, [...this.dimValueBoxes(o.dims ?? []), ...kept.map((d) => this.keptDimValueBox(d))], o.dims ?? [], kept.map((d) => ({ a: this.toScreen(d.la), b: this.toScreen(d.lb) })));
    // Dimensions over the room tags: a value under a room's name was lost.
    for (const d of o.dimensions ?? []) this.drawPermanentDim(d, d.selected ? color('--wall-sel') : color('--text-2'), color('--canvas'));
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
    const snapBox = o.snap ? this.drawSnap(o.snap, color('--snap'), color('--bg')) : null;
    if (o.measure) this.drawMeasure(o.measure, snapBox, color('--accent-text'), color('--canvas'));
  }

  /** Squares move an end, arrows stretch along the wall, the arc turns the selection. */
  private drawHandles(h: Handles, bg: string, line: string): void {
    const { ctx } = this;
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

  /** Where a permanent dimension's value is on screen (drawPermanentDim), for the tags to keep off. */
  private keptDimValueBox(d: NonNullable<PlanOverlay['dimensions']>[number]): { x: number; y: number; w: number; h: number } {
    const a = this.toScreen(d.a);
    const la = this.toScreen(d.la);
    const lb = this.toScreen(d.lb);
    const len = Math.hypot(lb.x - la.x, lb.y - la.y) || 1;
    const off = Math.hypot(la.x - a.x, la.y - a.y);
    const n = off > 0.5 ? { x: (la.x - a.x) / off, y: (la.y - a.y) / off } : { x: (lb.y - la.y) / len, y: -(lb.x - la.x) / len };
    const mid = { x: (la.x + lb.x) / 2 + n.x * 9, y: (la.y + lb.y) / 2 + n.y * 9 };
    const w = this.textWidth(d.text, this.font('500', '--fs-xs')) + 8;
    // Upright or along a slope: the box that holds it either way.
    const vertical = Math.abs(lb.y - la.y) > Math.abs(lb.x - la.x);
    return vertical ? { x: mid.x - 9, y: mid.y - w / 2, w: 18, h: w } : { x: mid.x - w / 2, y: mid.y - 9, w, h: 18 };
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

  /** A canvas font from the design tokens: weight, a size token, the family token. */
  /**
   * A permanent dimension: extension lines from just off the points measured to just past its line, the
   * line, a 45° tick at each end, and its value over the line's middle, upright, on a pad.
   */
  private drawPermanentDim(d: NonNullable<PlanOverlay['dimensions']>[number], colour: string, bg: string): void {
    const ctx = this.ctx;
    const a = this.toScreen(d.a);
    const b = this.toScreen(d.b);
    const la = this.toScreen(d.la);
    const lb = this.toScreen(d.lb);
    const len = Math.hypot(lb.x - la.x, lb.y - la.y);
    if (len < 1) return;
    const u = { x: (lb.x - la.x) / len, y: (lb.y - la.y) / len };
    // Toward the line from the points measured; along u's normal when the line is on them.
    const off = Math.hypot(la.x - a.x, la.y - a.y);
    const n = off > 0.5 ? { x: (la.x - a.x) / off, y: (la.y - a.y) / off } : { x: u.y, y: -u.x };
    const gap = Math.min(3, off);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [p, l] of [
      [a, la],
      [b, lb],
    ] as const) {
      if (off > 0.5) {
        ctx.moveTo(p.x + n.x * gap, p.y + n.y * gap);
        ctx.lineTo(l.x + n.x * 4, l.y + n.y * 4);
      }
    }
    ctx.moveTo(la.x - u.x * 4, la.y - u.y * 4);
    ctx.lineTo(lb.x + u.x * 4, lb.y + u.y * 4);
    const tx = (u.x + n.x) * 4;
    const ty = (u.y + n.y) * 4;
    for (const p of [la, lb]) {
      ctx.moveTo(p.x - tx, p.y - ty);
      ctx.lineTo(p.x + tx, p.y + ty);
    }
    ctx.stroke();
    // The value: upright (its angle within ±90°), on the side of the line away from what it measures.
    let angle = Math.atan2(u.y, u.x);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle <= -Math.PI / 2) angle += Math.PI;
    const font = this.font('500', '--fs-xs');
    ctx.font = font;
    const tw = ctx.measureText(d.text).width;
    const mid = { x: (la.x + lb.x) / 2 + n.x * 9, y: (la.y + lb.y) / 2 + n.y * 9 };
    ctx.translate(mid.x, mid.y);
    ctx.rotate(angle);
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-tw / 2 - 3, -8, tw + 6, 15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Too short for its value: the value stays, the line shows what it is of.
    ctx.fillText(d.text, 0, 0);
    ctx.restore();
  }

  /** A grid axis: a dash-dot line between its bubbles, each a circle with its name, past its ends. */
  private drawGridAxis(g: NonNullable<PlanOverlay['grids']>[number], colour: string, bg: string): void {
    const ctx = this.ctx;
    const a = this.toScreen(g.start);
    const b = this.toScreen(g.end);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const r = GRID_BUBBLE_PX;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = this.font('600', '--fs-sm');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [p, s] of [
      [a, -1],
      [b, 1],
    ] as const) {
      const c = { x: p.x + u.x * r * s, y: p.y + u.y * r * s };
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.fillText(g.name, c.x, c.y + 0.5);
    }
    ctx.restore();
  }

  /**
   * A level mark: the plan's level symbol (a circle with two opposite quarters filled, crossed) at its
   * point, and the height it says to its right; a selected one boxed.
   */
  private drawLevelMark(n: NonNullable<PlanOverlay['notes']>[number], c: Point2, px: number, colour: string, family: string): void {
    const ctx = this.ctx;
    const r = px * 0.5;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.moveTo(c.x - r * 1.4, c.y);
    ctx.lineTo(c.x + r * 1.4, c.y);
    ctx.moveTo(c.x, c.y - r * 1.4);
    ctx.lineTo(c.x, c.y + r * 1.4);
    ctx.stroke();
    for (const start of [-Math.PI / 2, Math.PI / 2]) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, r, start, start + Math.PI / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = `${Math.max(2, px)}px ${family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.text, c.x + r + px * 0.3, c.y);
    if (n.selected) {
      const b = noteBox(n, px / this.scale);
      const p0 = this.toScreen({ x: b.x0, y: b.y1 });
      const p1 = this.toScreen({ x: b.x1, y: b.y0 });
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(p0.x - 2, p0.y - 2, p1.x - p0.x + 4, p1.y - p0.y + 4);
    }
    ctx.restore();
  }

  /** Text notes: their letters as tall as they are at this scale, a line each; a selected one boxed. */
  private drawNotes(notes: NonNullable<PlanOverlay['notes']>, color: (v: string) => string): void {
    const ctx = this.ctx;
    const family = getComputedStyle(this.canvas).getPropertyValue('--font').trim() || 'sans-serif';
    for (const n of notes) {
      const px = shownHeight(n, this.scale) * this.scale;
      const lines = n.text.split('\n');
      const c = this.toScreen(n.at);
      if (n.elevation) {
        this.drawLevelMark(n, c, px, n.selected ? color('--wall-sel') : color('--text'), family);
        continue;
      }
      ctx.save();
      ctx.fillStyle = n.selected ? color('--wall-sel') : color('--text');
      ctx.font = `${Math.max(2, px)}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const step = px * 1.3;
      lines.forEach((l, i) => ctx.fillText(l, c.x, c.y + (i - (lines.length - 1) / 2) * step));
      if (n.selected) {
        const b = noteBox(n, shownHeight(n, this.scale));
        const p0 = this.toScreen({ x: b.x0, y: b.y1 });
        const p1 = this.toScreen({ x: b.x1, y: b.y0 });
        ctx.strokeStyle = color('--wall-sel');
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(p0.x - 2, p0.y - 2, p1.x - p0.x + 4, p1.y - p0.y + 4);
      }
      ctx.restore();
    }
  }

  private font(weight: string, size: string): string {
    const css = getComputedStyle(document.documentElement);
    return `${weight} ${css.getPropertyValue(size).trim()} ${css.getPropertyValue('--font').trim()}`;
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
      ctx.lineWidth = active ? 1.6 : 1;
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
    const a = this.toScreen(point);
    const b = this.toScreen({ x: point.x + dir.x, y: point.y + dir.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
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
    ctx.moveTo(p.x - 5, p.y - 5);
    ctx.lineTo(p.x + 5, p.y + 5);
    ctx.moveTo(p.x + 5, p.y - 5);
    ctx.lineTo(p.x - 5, p.y + 5);
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
