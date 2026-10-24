// The only clipping primitives in the project. Every piece stays convex and every cut is a
// half-plane, so clipping is exact: no rounding step exists where a gap or sliver could appear.

import { AREA_EPSILON } from '../../../core/tolerance';
import { dot, type Point2, vec } from '../../../core/vector';

/** Keeps the points p with normal·p ≤ offset. */
export interface HalfPlane {
  readonly normal: Point2;
  readonly offset: number;
}

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

/** Sutherland–Hodgman against one half-plane. Returns [] when nothing of substance is left. */
export function clipHalfPlane(poly: ConvexPolygon, plane: HalfPlane): ConvexPolygon {
  const out: Point2[] = [];
  const side = (p: Point2): number => dot(plane.normal, p) - plane.offset;
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

/** Removes the band between two parallel lines; `keepA` and `keepB` keep each outer side. */
export function clipOutBand(poly: ConvexPolygon, keepA: HalfPlane, keepB: HalfPlane): ConvexPolygon[] {
  return [clipHalfPlane(poly, keepA), clipHalfPlane(poly, keepB)].filter((p) => p.length > 0);
}

function push(out: Point2[], p: Point2): void {
  const last = out[out.length - 1];
  if (last === undefined || !same(last, p)) out.push(p);
}

const same = (a: Point2, b: Point2): boolean => a.x === b.x && a.y === b.y;
