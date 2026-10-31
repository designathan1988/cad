import type { Point2 } from '../model/vector';
import { arcOf } from '../elements/wall/geometry/arc';
import { cutFill, type CutPattern } from '../elements/material/schema';
import { hatchPattern } from '../elements/material/hatch';
import type { PlanView } from './plan-view';
import type { WallSolid } from '../project/derive';


/** What the painters use of the drawing in progress. */
export interface WallPaintDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  readonly color: (name: string) => string;
  readonly dpr: number;
  readonly w: number;
  readonly h: number;
  readonly solids: readonly WallSolid[];
  readonly normal: readonly WallSolid[];
}

export function wallPainters(view: PlanView, d: WallPaintDeps) {
  const { ctx, color, dpr, solids, normal } = d;
  const trace = (poly: readonly Point2[]) => {
    ctx.beginPath();
    poly.forEach((v, i) => {
      const s = view.toScreen(v);
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
    const c = arc ? view.toScreen(arc.center) : null;
    const radius = (p: Point2) => (arc ? Math.hypot(p.x - arc.center.x, p.y - arc.center.y) : 0);
    return (u: Point2, v: Point2) => {
      const q = view.toScreen(v);
      const ru = radius(u);
      if (!c || ru < 1e-6 || Math.abs(ru - radius(v)) >= 1e-7) return ctx.lineTo(q.x, q.y);
      const p = view.toScreen(u);
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
    const first = view.toScreen(poly[0]!);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < poly.length; i++) edge(poly[i - 1]!, poly[i]!);
    edge(poly[poly.length - 1]!, poly[0]!);
    ctx.closePath();
  };

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
  const detail = view.detail === 'fine' && (byLayers(normal.filter((s) => s.layers.length > 0 && s.plan === 'cut').map(thick), view.scale));
  // An overridden wall is its colour alone: no layers, no hatches.
  // A wall's own id (an arc's segments are "id#k", geometry/arc.ts) and its phase's colour, if phases are drawn.
  const phaseOf = (s: (typeof solids)[number]) => view.phases.get(s.wall.id.split('#')[0]!);
  const phaseColour = (s: (typeof solids)[number]) => {
    const p = phaseOf(s);
    return p ? color(`--phase-${p}`) : undefined;
  };
  const layered = (s: (typeof solids)[number]) => detail && s.layers.length > 0 && !view.overrides.has(s.wall.wallTypeId) && !phaseOf(s);
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
        const c = colour ?? phaseColour(s) ?? view.overrides.get(s.wall.wallTypeId) ?? (m ? (m.cut === 'none' ? color('--canvas') : cutFill(m.color, shadeBy, wallLine)) : color('--wall-fill'));
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
    ctx.lineWidth = view.pen('fine');
    ctx.beginPath();
    for (const s of list) {
      if (!layered(s)) continue;
      if (s.wall.bulge) {
        // On an arc, along the layers' circle, as the faces are (piecePath).
        const edge = edgeOf(s.wall);
        for (const seam of s.seams) {
          const a = view.toScreen(seam.a);
          ctx.moveTo(a.x, a.y);
          edge(seam.a, seam.b);
        }
        continue;
      }
      for (const seam of s.seams) {
        const [a, b] = crisp(view.toScreen(seam.a), view.toScreen(seam.b));
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
  return { trace, edgeOf, piecePath, outline, thick, detail, phaseOf, phaseColour, layered, shadeBy, wallLine, fill, seams, seen, cut, pieces };
}

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
