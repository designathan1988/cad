// The void an opening makes in its wall. In plan the region between the two jambs is removed from
// every piece of the host with clipOut: the jamb lines are half-planes, so the cut is exact and the
// pieces stay convex. In 3D each piece is split into height slices at the openings' sills and heads,
// and each slice loses the regions of the openings that span it; slices with the same openings are
// one block. Doors and windows are always cut in plan, as Revit cuts its door and window families
// whatever the view's cut height.

import type { TopPlane } from '../wall/geometry/under-roof';
import { add, normalize, perp, type Point2, scale, sub } from '../../core/vector';
import { arcOf, pointAt, tangentAt } from '../wall/geometry/arc';
import { clipOut, type ConvexPolygon, type HalfPlane, halfPlaneThrough } from '../wall/geometry/convex';
import type { Piece } from '../wall/geometry/footprint';
import { faceOffsets, wallDirection } from '../wall/geometry/offset';
import type { WallShape } from '../wall/geometry/shape';

export interface OpeningCut {
  /** The region between the jambs: where all of these hold. */
  readonly region: readonly HalfPlane[];
  /** Absolute heights of the bottom and the head. */
  readonly bottom: number;
  readonly top: number;
}

/** A piece of wall over a height range: one prism in 3D. */
export interface Block {
  readonly layerIndex: number;
  readonly polygon: ConvexPolygon;
  readonly bottom: number;
  /** Its top; under a roof (wall/geometry/under-roof.ts) the highest it reaches, its `plane` the top itself. */
  readonly top: number;
  readonly plane?: TopPlane;
}

/** Where the opening is drawn: its jambs on the reference line and the wall's faces there. */
export interface OpeningFrame {
  /** Jamb points on the reference line, at the start and end stations. */
  readonly start: Point2;
  readonly end: Point2;
  /** Unit vector from start to end, and its left normal. */
  readonly dir: Point2;
  readonly normal: Point2;
  /** Offsets of the exterior and interior faces along `normal`, exterior first. */
  readonly faces: readonly [number, number];
  readonly region: readonly HalfPlane[];
}

/** The frame of an opening between two stations of a wall (straight or arc). */
export function openingFrame(shape: WallShape, start: number, end: number): OpeningFrame {
  const arc = arcOf(shape);
  if (arc === null) {
    const d = wallDirection(shape);
    const p0 = add(shape.start, scale(d, start));
    const p1 = add(shape.start, scale(d, end));
    return { start: p0, end: p1, dir: d, normal: perp(d), faces: faceOffsets(shape), region: [halfPlaneThrough(p0, d), halfPlaneThrough(p1, scale(d, -1))] };
  }
  // On an arc the jambs are radial: stations are lengths along the reference arc.
  const step = Math.sign(arc.sweep) / arc.radius;
  const a0 = arc.startAngle + start * step;
  const a1 = arc.startAngle + end * step;
  const p0 = pointAt(arc, a0);
  const p1 = pointAt(arc, a1);
  const d = normalize(sub(p1, p0));
  return {
    start: p0,
    end: p1,
    dir: d,
    normal: perp(d),
    faces: faceOffsets(shape),
    region: [halfPlaneThrough(arc.center, tangentAt(arc, a0)), halfPlaneThrough(arc.center, scale(tangentAt(arc, a1), -1))],
  };
}

/** The plan pieces with every opening's region removed. */
export function cutPlan(pieces: readonly Piece[], cuts: readonly OpeningCut[]): Piece[] {
  return pieces.flatMap((piece) =>
    cuts.reduce<ConvexPolygon[]>((parts, c) => parts.flatMap((p) => clipOut(p, c.region)), [piece.polygon]).map((polygon) => ({
      layerIndex: piece.layerIndex,
      polygon,
    })),
  );
}

/** The 3D blocks of a wall's pieces between bottom and top, with the openings' holes. */
export function cutSolid(pieces: readonly Piece[], bottom: number, top: number, cuts: readonly OpeningCut[]): Block[] {
  const live = cuts
    .map((c) => ({ ...c, bottom: Math.max(c.bottom, bottom), top: Math.min(c.top, top) }))
    .filter((c) => c.top > c.bottom);
  const zs = [...new Set([bottom, top, ...live.flatMap((c) => [c.bottom, c.top])])].sort((a, b) => a - b);
  // Consecutive slices spanned by the same openings make one band.
  const bands: { bottom: number; top: number; cuts: OpeningCut[]; key: string }[] = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const z0 = zs[i]!;
    const z1 = zs[i + 1]!;
    const active = live.filter((c) => c.bottom <= z0 && c.top >= z1);
    const key = active.map((c) => live.indexOf(c)).join(',');
    const last = bands[bands.length - 1];
    if (last && last.key === key) last.top = z1;
    else bands.push({ bottom: z0, top: z1, cuts: active, key });
  }
  return bands.flatMap((band) =>
    cutPlan(pieces, band.cuts).map((p) => ({ layerIndex: p.layerIndex, polygon: p.polygon, bottom: band.bottom, top: band.top })),
  );
}
