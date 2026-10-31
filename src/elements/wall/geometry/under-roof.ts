// Walls topped by a roof (HeightRule 'roof', Revit's Attach Top): their top follows the underside of
// the roofs of their level over them, so a wall under a gable rises to the ridge (an empena) and one
// under the eaves stops at the slope. Each block of such a wall is cut by the roofs' faces into pieces
// with one plane over each; where no roof covers it, the wall keeps its level's top. Pure.

import type { Point2 } from '../../../model/vector';
import type { RoofSolid } from '../../roof/geometry';
import type { Block } from '../../opening/void';
import { area, clipHalfPlane, clipOut, type ConvexPolygon, halfPlaneThrough, type HalfPlane, signedArea, toCounterClockwise } from './convex';
import { isConvex } from '../../roof/geometry';

/** A sloped top: z = a·x + b·y + c (m). */
export interface TopPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

export const planeAt = (q: TopPlane, p: Point2): number => q.a * p.x + q.b * p.y + q.c;

/** A roof seen from below: convex pieces of its eaves' outline, each under one plane. */
export interface RoofCover {
  readonly pieces: readonly { readonly polygon: ConvexPolygon; readonly plane: TopPlane }[];
}

const planeOf = (z: (p: Point2) => number): TopPlane => {
  const c = z({ x: 0, y: 0 });
  return { a: z({ x: 1, y: 0 }) - c, b: z({ x: 0, y: 1 }) - c, c };
};

/** The half-planes inside a convex counter-clockwise polygon. */
const regionOf = (poly: ConvexPolygon): HalfPlane[] =>
  poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x });
  });

const clipTo = (poly: ConvexPolygon, region: readonly HalfPlane[]): ConvexPolygon =>
  region.reduce<ConvexPolygon>((rest, h) => (rest.length > 0 ? clipHalfPlane(rest, h) : rest), poly);

/** A simple polygon as triangles (ear clipping), counter-clockwise: a flat roof's outline need not be convex. */
function triangles(poly: readonly Point2[]): ConvexPolygon[] {
  const ring = [...toCounterClockwise(poly)];
  const out: ConvexPolygon[] = [];
  const cross = (o: Point2, a: Point2, b: Point2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const inside = (p: Point2, a: Point2, b: Point2, c: Point2) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = ring.length * ring.length;
  while (ring.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length]!;
      const b = ring[i]!;
      const c = ring[(i + 1) % ring.length]!;
      if (cross(a, b, c) <= 0) continue;
      if (ring.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]);
      ring.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (ring.length === 3 && signedArea(ring) > 0) out.push(ring);
  return out;
}

/** The roofs' undersides: each face under its plane, in triangles when it is not convex (a flat roof's
 * outline, a face of an L-shaped roof round its valley). */
export function roofCovers(roofs: readonly RoofSolid[]): RoofCover[] {
  return roofs.map((r) => ({
    pieces: r.faces.flatMap((f) => {
      const plane = planeOf(f.z);
      const polys = isConvex(f.polygon) ? [toCounterClockwise(f.polygon)] : triangles(f.polygon);
      return polys.filter((p) => p.length >= 3 && area(p) > 1e-9).map((polygon) => ({ polygon, plane }));
    }),
  }));
}

/** The highest the roofs' underside comes over a polygon (null where none covers it). */
export function highestUnder(covers: readonly RoofCover[], poly: ConvexPolygon): number | null {
  let best: number | null = null;
  for (const c of covers)
    for (const piece of c.pieces) {
      const part = clipTo(poly, regionOf(piece.polygon));
      for (const p of part) best = Math.max(best ?? -Infinity, planeAt(piece.plane, p));
    }
  return best;
}

/**
 * A wall's block under the roofs: the parts under a face rise or fall with it (their `plane`), never
 * above `block.top` (flat there) nor below its bottom (dropped); the parts no roof covers keep `bare`
 * as their top, the wall's top without a roof.
 */
export function blocksUnder(block: Block, covers: readonly RoofCover[], bare: number): Block[] {
  const out: Block[] = [];
  let rest: ConvexPolygon[] = [block.polygon];
  const eps = 1e-6;
  for (const c of covers) {
    const next: ConvexPolygon[] = [];
    for (const piece of c.pieces) {
      const region = regionOf(piece.polygon);
      const q = piece.plane;
      // The plane above the bottom (kept), and below the block's top (sloped) or above it (flat).
      const over = (z: number): HalfPlane => ({ normal: { x: -q.a, y: -q.b }, offset: q.c - z });
      const under = (z: number): HalfPlane => ({ normal: { x: q.a, y: q.b }, offset: z - q.c });
      for (const poly of rest) {
        const part = clipTo(poly, region);
        if (part.length === 0) continue;
        const flatPlane = Math.hypot(q.a, q.b) < 1e-12;
        if (flatPlane) {
          const top = Math.min(block.top, q.c);
          if (top > block.bottom + eps) out.push({ ...block, polygon: part, top });
          continue;
        }
        const kept = clipHalfPlane(part, over(block.bottom + eps));
        if (kept.length === 0) continue;
        const sloped = clipHalfPlane(kept, under(block.top));
        if (sloped.length > 0) out.push({ ...block, polygon: sloped, plane: q });
        const flat = clipHalfPlane(kept, over(block.top));
        if (flat.length > 0) out.push({ ...block, polygon: flat });
      }
    }
    // What this roof leaves uncovered goes on to the next.
    for (const poly of rest) {
      let left: ConvexPolygon[] = [poly];
      for (const piece of c.pieces) left = left.flatMap((p) => clipOut(p, regionOf(piece.polygon)));
      next.push(...left);
    }
    rest = next;
  }
  const top = Math.min(block.top, bare);
  if (top > block.bottom + eps) for (const poly of rest) out.push({ ...block, polygon: poly, top });
  return out;
}
