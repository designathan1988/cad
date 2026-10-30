// Collisions (on by default, a toggle in the footer, K): what is moved or placed is stopped
// by what it would go into — walls (their blocks: a doorway is clear), objects, columns, stairs, railings,
// curtain walls — where their heights overlap, sliding along it when it can; nothing is set below the floor.
// Pure: shapes from the derived geometry, a move clamped against them.

import type { Point2 } from '../model/vector';
import { eachSolid } from '../elements/registry';
import type { App } from '../session/app';
import type { DerivedGeometry } from '../project/derive';

/** A solid as collisions see it: a convex outline in plan and its heights. */
export interface Shape {
  readonly poly: readonly Point2[];
  readonly bottom: number;
  readonly top: number;
}

/** Kinds that take part: those that stand in a room and can be walked or moved into. */
const SOLID_KINDS = new Set(['objects', 'columns', 'stairs', 'railings', 'curtains']);
/** Kinds moved with collisions: what stands loose on a floor. */
const MOVED_KINDS = new Set(['objects', 'columns', 'stairs']);
/** Lower than this (m) it is laid on the floor, not stood in the way: a rug, a mat. */
const FLAT = 0.03;
/** Touching is not overlapping: outlines this close (m), heights this close, pass. */
const TOUCH = 0.002;

import { hull } from '../model/hull';

/** The convex hull of points (model/hull.ts), re-exported for the drag code. */
export { hull };

/** Whether two convex outlines overlap by more than touching (separating axes). */
export function overlaps(a: readonly Point2[], b: readonly Point2[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      const proj = (pts: readonly Point2[]) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const r of pts) {
          const v = (r.x * nx + r.y * ny) / len;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
        return [lo, hi] as const;
      };
      const [a0, a1] = proj(a);
      const [b0, b1] = proj(b);
      if (a1 <= b0 + TOUCH || b1 <= a0 + TOUCH) return false;
    }
  }
  return true;
}

const hits = (m: Shape, o: Shape) => m.top > o.bottom + TOUCH && o.top > m.bottom + TOUCH && overlaps(m.poly, o.poly);

/** Each outline of a solid of a kind as a convex shape with the solid's heights; none for a flat one. */
export function shapesOf(outlines: readonly (readonly Point2[])[], span: { bottom: number; top: number }): Shape[] {
  if (span.top - span.bottom < FLAT) return [];
  return outlines.filter((o) => o.length >= 3).map((o) => ({ poly: hull(o), bottom: span.bottom, top: span.top }));
}

/** The shapes of the elements `ids` on a level (those that are moved with collisions). */
export function movingShapes(g: DerivedGeometry, ids: ReadonlySet<string>): Shape[] {
  const out: Shape[] = [];
  for (const x of eachSolid(g.kinds)) {
    if (!ids.has(x.id) || !MOVED_KINDS.has(x.kind.key) || !x.kind.span) continue;
    out.push(...shapesOf(x.kind.outlines(x.solid), x.kind.span(x.solid)));
  }
  return out;
}

/** Everything on a level that stops them: wall blocks and the solid kinds, but those being moved. */
export function obstacleShapes(g: DerivedGeometry, levelId: string, moving: ReadonlySet<string>): Shape[] {
  const out: Shape[] = [];
  for (const s of g.solids.values()) {
    if (s.wall.levelId !== levelId || moving.has(s.wall.id)) continue;
    for (const b of s.blocks) if (b.polygon.length >= 3) out.push({ poly: hull(b.polygon), bottom: b.bottom, top: b.top });
  }
  for (const x of eachSolid(g.kinds)) {
    if (x.levelId !== levelId || moving.has(x.id) || !SOLID_KINDS.has(x.kind.key) || !x.kind.span) continue;
    out.push(...shapesOf(x.kind.outlines(x.solid), x.kind.span(x.solid)));
  }
  return out;
}

const moved = (s: Shape, d: Point2): Shape => ({ ...s, poly: s.poly.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) });

/**
 * How far shapes go of a move `delta` before something stops them: in steps of 2 cm (never through a thin
 * wall), each whole if clear, else along x or y alone (sliding along what stops it), else no further. An
 * obstacle they already overlap at the start does not hold them (they can always be moved out of it).
 */
export function clampMove(shapes: readonly Shape[], obstacles: readonly Shape[], delta: Point2): Point2 {
  if (shapes.length === 0 || (delta.x === 0 && delta.y === 0)) return delta;
  const free = obstacles.filter((o) => !shapes.some((s) => hits(s, o)));
  if (free.length === 0) return delta;
  const clear = (d: Point2) => shapes.every((s) => {
    const m = moved(s, d);
    return free.every((o) => !hits(m, o));
  });
  if (clear(delta)) {
    // Clear at the end: also clear on the way (a thin wall jumped over in one drag step is not crossed).
    const n = Math.ceil(Math.hypot(delta.x, delta.y) / 0.02);
    let ok = true;
    for (let i = 1; i < n && ok; i++) ok = clear({ x: (delta.x * i) / n, y: (delta.y * i) / n });
    if (ok) return delta;
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 0.02));
  let at = { x: 0, y: 0 };
  for (let i = 0; i < steps; i++) {
    const sx = delta.x / steps;
    const sy = delta.y / steps;
    const next = [{ x: at.x + sx, y: at.y + sy }, { x: at.x + sx, y: at.y }, { x: at.x, y: at.y + sy }].find((q) => (q.x !== at.x || q.y !== at.y) && clear(q));
    if (!next) break;
    at = next;
  }
  return at;
}

/**
 * Where to put shapes placed at their place: there if clear, else the nearest clear place found round it
 * (rings 5 cm apart, 16 directions, up to 3 m); there anyway when none is.
 */
export function freePlace(shapes: readonly Shape[], obstacles: readonly Shape[]): Point2 {
  const clear = (d: Point2) => shapes.every((s) => {
    const m = moved(s, d);
    return obstacles.every((o) => !hits(m, o));
  });
  if (clear({ x: 0, y: 0 })) return { x: 0, y: 0 };
  for (let r = 0.05; r <= 3; r += 0.05) {
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      const d = { x: r * Math.cos(a), y: r * Math.sin(a) };
      if (clear(d)) return d;
    }
  }
  return { x: 0, y: 0 };
}

/** The shapes of elements `ids` as they stand, and what stops them on their level (walls, other solids). */
export function collisionFor(app: App, ids: ReadonlySet<string>): { shapes: Shape[]; obstacles: Shape[] } {
  const g = app.geometry;
  const shapes = movingShapes(g, ids);
  const level = [...eachSolid(g.kinds)].find((x) => ids.has(x.id))?.levelId ?? app.ui.levelId;
  return { shapes, obstacles: shapes.length > 0 && level ? obstacleShapes(g, level, ids) : [] };
}
