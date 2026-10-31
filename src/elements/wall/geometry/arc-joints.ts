// Where a straight wall meets an arc chain: whether its end fits the arc, the wedge of a segment, the
// stem carried over or spilled along the chain, the pieces split and carried, and overlaps with arcs.

import { type AbutmentResult, resolveAbutment } from '../join/cut-t';
import type { WallShape } from './shape';
import type { EndRef, WallId } from '../schema';
import { type ArcChain, inSector, parentOf, sectorOf } from './arc';
import { area, clipHalfPlane, clipOut, type ConvexPolygon, type HalfPlane, halfPlaneThrough, overlapArea, toCounterClockwise } from './convex';
import type { Piece } from './footprint';
import type { EndCut, JoinWarning, Notch } from '../join/types';
import { AREA_EPSILON, POINT_TOLERANCE } from '../../../model/tolerance';
import { endPoint, faceOffsets, intoBody, offsetOf, strip, wallDirection, wallNormal } from './offset';
import { add, dot, intersectLines, type Point2, scale, sub } from '../../../model/vector';

/**
 * A T against an arc is exact only inside one segment: everything the abutting wall puts into the
 * host (where its faces cross the host's faces, and its deepest points) must lie in the host
 * segment's sector. An arc abutting another wall needs no such check: trimChain carries its cut to
 * the segments before its end.
 */
export function fitsArc(
  result: AbutmentResult,
  abuttingId: string,
  hostId: WallId,
  byId: ReadonlyMap<string, WallShape>,
  chains: ReadonlyMap<WallId, ArcChain>,
): boolean {
  const chain = chains.get(parentOf(hostId));
  if (!chain) return true;
  const sector = sectorOf(chain, chain.segments.findIndex((x) => x.id === hostId));
  return [...result.deepest, ...faceCrossings(byId.get(abuttingId)!, byId.get(hostId)!)].every((p) => inSector(sector, p));
}

/** The two radial planes bounding one segment of an arc's chain: inside both is that segment's wedge. */
export function wedge(chain: ArcChain, segmentId: string): readonly HalfPlane[] {
  return sectorOf(chain, chain.segments.findIndex((x) => x.id === segmentId));
}

/**
 * The T of an arc's end, carried back along its chain: each earlier segment still reaching past the
 * host's face gets its own T cut (no lengthening) and its own notches in the host, kept inside its
 * wedge. The walk stops at the first segment that does not reach, so the cut planes (which are
 * infinite) never trim a far part of the arc.
 */
export function carryArcStem(
  chain: ArcChain,
  end: EndRef,
  host: WallShape,
  piecesOf: (shape: WallShape) => Piece[],
): { clips: Map<string, Carried>; notches: Notch[] } {
  const clips = new Map<string, Carried>();
  const notches: Notch[] = [];
  const at = chain.segments.findIndex((x) => x.id === end.wallId);
  const step = end.end === 'end' ? -1 : 1;
  // The host as it is, its ends cut: a T's cut is an infinite plane, which must act only where the host
  // is (an L's straight wall, whose line runs on along the arc's earlier segments past its own end).
  const within = piecesOf(host).map((p) => p.polygon);
  for (let i = at + step; i >= 0 && i < chain.segments.length; i += step) {
    const segment = chain.segments[i]!;
    // Reaching: it overlaps the host's body.
    if (!piecesOf(segment).some((piece) => within.some((h) => overlapArea(piece.polygon, h) > AREA_EPSILON))) break;
    const r = resolveAbutment(segment, end.end, host, wedge(chain, segment.id));
    clips.set(segment.id, { cut: { ...r.cut, extension: 0 }, within });
    notches.push(...r.notches);
  }
  return { clips, notches };
}

/** A T carried along an arc (carryArcStem): its cut, and the host's body, the only place it acts. */
export interface Carried {
  readonly cut: EndCut;
  readonly within: readonly ConvexPolygon[];
}

/** Pieces with carried T cuts: inside the host's body, cut layer by layer; outside it, as they are. */
export function carriedPieces(pieces: readonly Piece[], carried: readonly Carried[]): Piece[] {
  const keep = (layerIndex: number, polygon: ConvexPolygon): Piece[] => (polygon.length > 0 && area(polygon) > AREA_EPSILON ? [{ layerIndex, polygon }] : []);
  return carried.reduce<Piece[]>(
    (ps, { cut, within }) =>
      ps.flatMap((piece) => {
        const planes = [...cut.cuts, ...(cut.layerCuts?.[piece.layerIndex] ?? [])];
        const outside = within.reduce<ConvexPolygon[]>((left, h) => left.flatMap((p) => clipOut(p, regionOf(h))), [piece.polygon]);
        const inside = within.map((h) => regionOf(h).reduce<ConvexPolygon>((p, plane) => (p.length > 0 ? clipHalfPlane(p, plane) : p), piece.polygon));
        return [
          ...outside.flatMap((p) => keep(piece.layerIndex, p)),
          ...inside.flatMap((p) => keep(piece.layerIndex, planes.reduce<ConvexPolygon>((q, plane) => (q.length > 0 ? clipHalfPlane(q, plane) : q), p))),
        ];
      }),
    [...pieces],
  );
}

/** A convex polygon as the half-planes of its sides, inside each (either winding). */
export function regionOf(poly: ConvexPolygon): HalfPlane[] {
  const ccw = toCounterClockwise(poly);
  return ccw.map((p, i) => {
    const q = ccw[(i + 1) % ccw.length]!;
    return halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x });
  });
}

/** How a wall's end is cut against an arc wider than one segment: per wedge, that segment's T. */
export interface StemSplit {
  /** The end zone (kept, then cut per wedge) and the rest of the wall (kept as it is). */
  readonly near: HalfPlane;
  readonly far: HalfPlane;
  readonly parts: readonly { readonly wedge: readonly HalfPlane[]; readonly cut: EndCut }[];
  /** A T: behind the wall's own end is what stays of the end zone outside every wedge (past the arc's end). */
  readonly behind?: HalfPlane;
  /** An L: outside every wedge (its tip past the arc's end) the zone takes the L's own cut. */
  readonly outsideCut?: EndCut;
}

/**
 * A T against an arc wider than one segment. Near its end the wall is split by the radial wedges of
 * the segments it reaches, and each part takes that segment's T: its layers stop on that segment's
 * faces by priority, and the segment is notched where they pass. A wedge is where its segment's faces
 * are the arc's, so the parts meet the chain exactly. The end zone is where the wall's band meets the
 * arc's body, measured: from as far past the end as the body reaches to as far back, 1 cm more each
 * way. What of the zone lies in no wedge (past the arc's end) touches no segment: there the wall keeps
 * its own body and loses only its extension past the end.
 */
export function spreadOverArc(stem: WallShape, end: EndRef['end'], chain: ArcChain): { extension: number; split: StemSplit; notches: Notch[] } | null {
  const MARGIN = 0.01;
  const into = intoBody(stem, end);
  const at = endPoint(stem, end);
  const along = (p: Point2) => dot(sub(p, at), into);
  const n = wallNormal(stem);
  const [o0, o1] = faceOffsets(stem);
  const band = [halfPlaneThrough(add(stem.start, scale(n, o0)), n), halfPlaneThrough(add(stem.start, scale(n, o1)), scale(n, -1))];
  const clip = (poly: ConvexPolygon, planes: readonly HalfPlane[]) => planes.reduce<ConvexPolygon>((p, h) => (p.length > 0 ? clipHalfPlane(p, h) : p), poly);
  // Where the band crosses each segment's body (its strip within its wedge), as an interval along the
  // wall from its end. Only the crossing nearest the end counts, the one it is in or just short of
  // (discovery takes an end within POINT_TOLERANCE of the band, which along a slanted wall is farther):
  // past it the band can cross the ring and meet the arc again on the far side, not this T's.
  const spans = chain.segments
    .map((segment, i) => clip(clip(strip(segment, 0, 0), sectorOf(chain, i)), band).map(along))
    .filter((as) => as.length > 0)
    .map((as) => [Math.min(...as), Math.max(...as)] as const)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + POINT_TOLERANCE) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const crossing = merged.filter(([a]) => a <= POINT_TOLERANCE).sort((x, y) => y[1] - x[1])[0];
  if (!crossing) return null;
  const [lo, hi] = crossing;
  const extension = Math.max(0, -lo) + MARGIN;
  // The zone always takes in the end itself, even when the arc lies just past it.
  const edge = add(at, scale(into, Math.max(hi, 0) + MARGIN));
  const near = halfPlaneThrough(edge, scale(into, -1));
  const far = halfPlaneThrough(edge, into);
  const zone = clipHalfPlane(strip(stem, end === 'start' ? extension : 0, end === 'end' ? extension : 0), near);
  const parts: { wedge: readonly HalfPlane[]; cut: EndCut }[] = [];
  const notches: Notch[] = [];
  chain.segments.forEach((segment, i) => {
    const w = sectorOf(chain, i);
    const inWedge = w.reduce<ConvexPolygon>((poly, h) => (poly.length > 0 ? clipHalfPlane(poly, h) : poly), zone);
    if (inWedge.length === 0 || area(inWedge) <= AREA_EPSILON) return;
    const r = resolveAbutment(stem, end, segment);
    parts.push({ wedge: w, cut: r.cut });
    notches.push(...r.notches);
  });
  if (parts.length === 0) return null;
  return { extension, split: { near, far, parts, behind: halfPlaneThrough(at, into) }, notches };
}

/**
 * The L at an arc's end, when the other wall's body reaches the segments past the end one (a thick
 * wall, an obtuse or a tight corner). The corner is made with the end segment (spec part 6); past it the
 * arc goes on and that wall abuts it: near its end it is split by the segments' wedges, the end
 * segment's part taking the L's own cut, each other part that segment's T (layers by priority, the
 * segment notched where they pass), and what lies outside every wedge (the corner's tip past the arc's
 * end) the L's cut too. Null when it reaches no other segment: the L alone.
 */
export function spillOverArc(stem: WallShape, end: EndRef['end'], chain: ArcChain, endSegmentId: string, lCut: EndCut): { split: StemSplit; notches: Notch[] } | null {
  const MARGIN = 0.01;
  const into = intoBody(stem, end);
  const at = endPoint(stem, end);
  const along = (p: Point2) => dot(sub(p, at), into);
  const n = wallNormal(stem);
  const [o0, o1] = faceOffsets(stem);
  const band = [halfPlaneThrough(add(stem.start, scale(n, o0)), n), halfPlaneThrough(add(stem.start, scale(n, o1)), scale(n, -1))];
  const clip = (poly: ConvexPolygon, planes: readonly HalfPlane[]) => planes.reduce<ConvexPolygon>((p, h) => (p.length > 0 ? clipHalfPlane(p, h) : p), poly);
  // Where the band crosses the chain's bodies near the node, as for a T (spreadOverArc).
  const spans = chain.segments
    .map((segment, i) => clip(clip(strip(segment, 0, 0), sectorOf(chain, i)), band).map(along))
    .filter((as) => as.length > 0)
    .map((as) => [Math.min(...as), Math.max(...as)] as const)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + POINT_TOLERANCE) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const crossing = merged.filter(([a]) => a <= POINT_TOLERANCE).sort((x, y) => y[1] - x[1])[0];
  if (!crossing) return null;
  // The corner itself: as far along the wall as the end segment's face and layer lines meet the wall's
  // faces (a butt cuts on layer faces; the end segment of an arc that passes runs into the corner).
  const endSegment = chain.segments.find((x) => x.id === endSegmentId)!;
  const ds = wallDirection(endSegment);
  const ns = wallNormal(endSegment);
  const dw = wallDirection(stem);
  const corner = endSegment.layerOffsets.flatMap((os) =>
    [o0, o1].map((ow) => {
      const p = intersectLines(add(endSegment.start, scale(ns, os)), ds, add(stem.start, scale(n, ow)), dw);
      return p ? along(p) : 0;
    }),
  );
  const edge = add(at, scale(into, Math.max(crossing[1], 0, ...corner) + MARGIN));
  const near = halfPlaneThrough(edge, scale(into, -1));
  const far = halfPlaneThrough(edge, into);
  const zone = clipHalfPlane(strip(stem, end === 'start' ? lCut.extension : 0, end === 'end' ? lCut.extension : 0), near);
  const parts: { wedge: readonly HalfPlane[]; cut: EndCut }[] = [];
  const notches: Notch[] = [];
  let spills = false;
  chain.segments.forEach((segment, i) => {
    const w = sectorOf(chain, i);
    const inWedge = clip(zone, w);
    if (inWedge.length === 0 || area(inWedge) <= AREA_EPSILON) return;
    if (segment.id === endSegmentId) {
      parts.push({ wedge: w, cut: lCut });
      return;
    }
    // Only where the wall's own band reaches this segment's body: elsewhere in its wedge the L's cut.
    if (clip(clip(clip(strip(segment, 0, 0), w), band), [near]).length === 0) {
      parts.push({ wedge: w, cut: lCut });
      return;
    }
    spills = true;
    const r = resolveAbutment(stem, end, segment);
    parts.push({ wedge: w, cut: r.cut });
    notches.push(...r.notches);
  });
  if (!spills) return null;
  return { split: { near, far, parts, outsideCut: lCut }, notches };
}

/** A wall's pieces with one end split (StemSplit): the far part as it is, the near part per wedge. */
export function splitPieces(pieces: readonly Piece[], split: StemSplit): Piece[] {
  const clip = (poly: ConvexPolygon, planes: readonly HalfPlane[]) => planes.reduce<ConvexPolygon>((p, h) => (p.length > 0 ? clipHalfPlane(p, h) : p), poly);
  const keep = (layerIndex: number, polygon: ConvexPolygon): Piece[] => (polygon.length > 0 && area(polygon) > AREA_EPSILON ? [{ layerIndex, polygon }] : []);
  return pieces.flatMap((piece) => {
    const near = clip(piece.polygon, [split.near]);
    // Outside every wedge: the near part less each wedge, behind the wall's end.
    const outside = split.parts.reduce<ConvexPolygon[]>((left, part) => left.flatMap((p) => clipOut(p, part.wedge)), [near]);
    return [
      ...keep(piece.layerIndex, clip(piece.polygon, [split.far])),
      ...split.parts.flatMap((part) =>
        keep(piece.layerIndex, clip(near, [...part.wedge, ...part.cut.cuts, ...(part.cut.layerCuts?.[piece.layerIndex] ?? [])])),
      ),
      ...outside.flatMap((p) =>
        keep(piece.layerIndex, clip(p, split.behind ? [split.behind] : [...(split.outsideCut?.cuts ?? []), ...(split.outsideCut?.layerCuts?.[piece.layerIndex] ?? [])])),
      ),
    ];
  });
}

/** Where the abutting wall's two faces cross the host's two faces. */
export function faceCrossings(abutting: WallShape, host: WallShape): Point2[] {
  const d = wallDirection(abutting);
  const m = wallNormal(abutting);
  const denom = dot(wallNormal(host), d);
  if (denom === 0) return [];
  return faceOffsets(abutting).flatMap((o) => {
    const p = add(abutting.start, scale(m, o));
    return faceOffsets(host).map((h) => add(p, scale(d, (h - offsetOf(host, p)) / denom)));
  });
}

/**
 * The last guard: an arc's pieces must not overlap another wall's. A join that could not be made
 * exact against the chain shows up here and is reported, once per pair of walls.
 */
export function overlapsWithArcs(
  pieces: ReadonlyMap<WallId, readonly Piece[]>,
  chains: ReadonlyMap<WallId, ArcChain>,
  already: readonly JoinWarning[],
): JoinWarning[] {
  const out: JoinWarning[] = [];
  const reported = (a: WallId, b: WallId) => [...already, ...out].some((w) => w.walls.includes(a) && w.walls.includes(b));
  for (const arcId of chains.keys()) {
    const mine = pieces.get(arcId)!;
    for (const [otherId, theirs] of pieces) {
      if (otherId === arcId || (chains.has(otherId) && otherId < arcId) || reported(arcId, otherId)) continue;
      const hit = mine.some((p) => theirs.some((q) => overlapArea(p.polygon, q.polygon) > AREA_EPSILON));
      if (hit) out.push({ kind: 'arcJoinUnsupported', walls: chains.has(otherId) ? [arcId, otherId] : [otherId, arcId] });
    }
  }
  return out;
}
