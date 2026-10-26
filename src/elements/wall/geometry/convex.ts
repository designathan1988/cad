// The only clipping primitives in the project. Every piece stays convex and every cut is a
// half-plane, so clipping is exact: no rounding step exists where a gap or sliver could appear.

import { AREA_EPSILON } from '../../../core/tolerance';
import { dot, type Point2, vec } from '../../../core/vector';

/** Keeps the points p with normal·p ≤ offset. */
export interface HalfPlane {
  readonly normal: Point2;
  readonly offset: number;
}

/** How near a line (m) a vertex counts as on it, far below any drawn or modelled size. */
const ON_LINE = 1e-11;

/** Counter-clockwise, at least three vertices, no repeated consecutive vertex. */
export type ConvexPolygon = readonly Point2[];

/** Half-plane bounded by the line through `point`, keeping the side `inward` points to. */
export function halfPlaneThrough(point: Point2, inward: Point2): HalfPlane {
  const normal = vec(-inward.x, -inward.y);
  return { normal, offset: dot(normal, point) };
}

export function signedArea(poly: readonly Point2[]): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

export const area = (poly: readonly Point2[]): number => Math.abs(signedArea(poly));

export function toCounterClockwise(poly: readonly Point2[]): ConvexPolygon {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/**
 * Sutherland–Hodgman against one half-plane. Returns [] when nothing of substance is left. A vertex
 * within ON_LINE of the line is on it: kept, and no crossing is made next to it. Clipped twice by one
 * line (a sector of a half-turn has both its sides on it), the vertices left on it came back with
 * rounding of either sign, and the "crossing" between two of them, an ill-conditioned division, put a
 * vertex microns off a straight side.
 */
export function clipHalfPlane(poly: ConvexPolygon, plane: HalfPlane): ConvexPolygon {
  const out: Point2[] = [];
  const tol = ON_LINE * Math.hypot(plane.normal.x, plane.normal.y);
  const side = (p: Point2): number => {
    const s = dot(plane.normal, p) - plane.offset;
    return Math.abs(s) <= tol ? 0 : s;
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) push(out, a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      push(out, vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  if (out.length > 1 && same(out[0]!, out[out.length - 1]!)) out.pop();
  return out.length >= 3 && area(out) >= AREA_EPSILON ? out : [];
}

/** The same line, keeping the other side. */
export const opposite = (plane: HalfPlane): HalfPlane => ({
  normal: vec(-plane.normal.x, -plane.normal.y),
  offset: -plane.offset,
});

/**
 * Removes the convex region where every half-plane of `region` holds. The rest comes back as
 * convex pieces: for each plane in turn, the part outside it is kept and the part inside goes on.
 */
export function clipOut(poly: ConvexPolygon, region: readonly HalfPlane[]): ConvexPolygon[] {
  const out: ConvexPolygon[] = [];
  let rest = poly;
  for (const plane of region) {
    const outside = clipHalfPlane(rest, opposite(plane));
    if (outside.length > 0) out.push(outside);
    rest = clipHalfPlane(rest, plane);
    if (rest.length === 0) break;
  }
  return out;
}

function push(out: Point2[], p: Point2): void {
  const last = out[out.length - 1];
  if (last === undefined || !same(last, p)) out.push(p);
}

const same = (a: Point2, b: Point2): boolean => a.x === b.x && a.y === b.y;

/** Area shared by two convex counter-clockwise polygons: one clipped by the other's edges. */
export function overlapArea(a: ConvexPolygon, b: ConvexPolygon): number {
  let rest: ConvexPolygon = a;
  for (let i = 0; i < b.length && rest.length > 0; i++) {
    const p = b[i]!;
    const q = b[(i + 1) % b.length]!;
    rest = clipHalfPlane(rest, halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x }));
  }
  return rest.length > 0 ? area(rest) : 0;
}
