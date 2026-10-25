// Plan footprint of every wall, layer by layer: each layer's band, lengthened at joined ends, clipped
// by the same half-planes. Clipping layers one by one equals splitting the clipped wall at the layer
// lines, so the layers tile the wall exactly.

import { AREA_EPSILON, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, distance, dot, intersectLines, type Point2, scale, sub } from '../../../core/vector';
import { resolveCorner } from '../join/cut-l';
import { type AbutmentResult, resolveAbutment } from '../join/cut-t';
import { deriveJoins } from '../join/discover';
import { resolveNode } from '../join/node';
import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { EndRef, Wall, WallId, WallType, WallTypeId } from '../schema';
import { type ArcChain, arcOf, expandArc, inSector, parentOf, sectorOf } from './arc';
import { area, clipHalfPlane, clipOut, type ConvexPolygon, type HalfPlane, halfPlaneThrough, overlapArea, toCounterClockwise } from './convex';
import { endPoint, faceOffsets, intoBody, offsetOf, stationOf as stationAlong, strip, wallDirection, wallNormal } from './offset';
import { shapeOf, type WallShape } from './shape';

export interface Piece {
  readonly layerIndex: number;
  readonly polygon: ConvexPolygon;
}

export interface WallGeometry {
  readonly pieces: ReadonlyMap<WallId, readonly Piece[]>;
  readonly warnings: readonly JoinWarning[];
}

const keyOf = (r: EndRef): string => `${r.wallId}:${r.end}`;
const byIdOrder = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function computeWallGeometry(walls: readonly Wall[], types: ReadonlyMap<WallTypeId, WallType>): WallGeometry {
  const warnings: JoinWarning[] = [];
  const shapes: WallShape[] = [];
  const chains = new Map<WallId, ArcChain>();
  for (const wall of [...walls].sort(byIdOrder)) {
    const shape = shapeOf(wall, types.get(wall.wallTypeId));
    if (typeof shape === 'string') {
      warnings.push({ kind: shape, walls: [wall.id] });
    } else if (shape.bulge !== 0 && arcOf(shape) !== null) {
      // An arc joins as the chain of its straight segments (geometry/arc.ts).
      const chain = expandArc(shape);
      if (chain === 'arcTooTight') warnings.push({ kind: chain, walls: [wall.id] });
      else {
        chains.set(wall.id, chain);
        shapes.push(...chain.segments);
      }
    } else shapes.push(shape);
  }

  const graph = deriveJoins(shapes);
  const byId = new Map(shapes.map((w) => [w.id, w]));
  const isArc = (id: string) => parentOf(id) !== id;
  const endCuts = new Map<string, EndCut>();
  const notches: Notch[] = [];
  // Warnings are reported by wall, not by segment. A join the engine cannot make exact against an arc
  // is dropped and reported, and the walls stay as drawn.
  const report = (w: JoinWarning) => warnings.push({ ...w, walls: w.walls.map(parentOf) });
  graph.warnings.forEach(report);
  // An L at an arc's end is made with its end segment. In a butt where the arc abuts, the other wall's
  // body can still reach the segments before that one: the cut is carried on as for an arc stem in a T.
  const arcStems: { end: EndRef; host: WallShape }[] = [];
  // Walls split near an end against an arc wider than one segment (spreadOverArc, spillOverArc).
  const splits = new Map<string, StemSplit[]>();
  // An arc's end segment at the arc's free end is not free at its other end: the arc goes on (§5.2).
  // Its reach in an L is the whole arc's, up to the arc's own far end (§7.1, "ponta livre").
  const arcReach = (r: EndRef, other: EndRef): number | undefined => {
    const chain = chains.get(parentOf(r.wallId));
    if (!chain || parentOf(other.wallId) === parentOf(r.wallId)) return undefined;
    return chain.segments.reduce((sum, s) => sum + distance(s.start, s.end), 0);
  };
  for (const { ends: [ra, rb], node } of graph.corners) {
    const reachA = arcReach(ra, rb);
    const reachB = arcReach(rb, ra);
    // Two straight walls butt layer by layer; with an arc's segment, the T butt its chain relies on.
    const straight = !chains.has(parentOf(ra.wallId)) && !chains.has(parentOf(rb.wallId));
    const result = resolveCorner(
      byId.get(ra.wallId)!,
      ra.end,
      byId.get(rb.wallId)!,
      rb.end,
      node,
      { ...(reachA !== undefined ? { a: reachA } : {}), ...(reachB !== undefined ? { b: reachB } : {}) },
      straight,
    );
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) report(result.warning);
    // An arc's end segment abutting in a butt notches the other wall only up to its joint with the next
    // segment, a radial plane, as in a T (the next segments carry their own): bounded square at its
    // chord's end, a sliver of the other wall's finish was left un-notched.
    const abutsArc = (r: EndRef, cut: EndCut | null) => !result.warning && cut?.layerCuts && chains.has(parentOf(r.wallId));
    if (abutsArc(ra, result.a) || abutsArc(rb, result.b)) {
      const [arc, other] = abutsArc(ra, result.a) ? [ra, rb] : [rb, ra];
      const chain = chains.get(parentOf(arc.wallId))!;
      const back = wedge(chain, arc.wallId).filter((_, k) => k === (arc.end === 'end' ? 0 : 1));
      notches.push(...resolveAbutment(byId.get(arc.wallId)!, arc.end, byId.get(other.wallId)!, back).notches);
    } else notches.push(...result.notches);
    for (const [arc, other, arcCut, otherCut] of [
      [ra, rb, result.a, result.b],
      [rb, ra, result.b, result.a],
    ] as const) {
      if (!chains.has(parentOf(arc.wallId)) || result.warning || !arcCut || !otherCut) continue;
      // The abutting side of a butt has layer cuts (cut-l.ts: resolveAbutment); a miter has none.
      if (arcCut.layerCuts) {
        arcStems.push({ end: arc, host: byId.get(other.wallId)! });
        continue;
      }
      // A miter, or a butt the arc passes: the other wall can reach the segments past the end one.
      const chain = chains.get(parentOf(arc.wallId))!;
      if (chains.has(parentOf(other.wallId))) continue;
      const spill = spillOverArc(byId.get(other.wallId)!, other.end, chain, arc.wallId, otherCut);
      if (!spill) continue;
      endCuts.set(keyOf(other), { extension: otherCut.extension, cuts: [] });
      notches.push(...spill.notches);
      splits.set(other.wallId, [...(splits.get(other.wallId) ?? []), spill.split]);
    }
  }
  for (const { ends, point } of graph.nodes) {
    const result = resolveNode(byId, ends, point);
    for (const [ref, cut] of result.endCuts) endCuts.set(keyOf(ref), cut);
    // A notch an arc's end segment takes in a node (against the outside of an L) is taken by every
    // segment of the arc: its short segments next to the end reach into the corner too.
    notches.push(...result.notches.flatMap((n) => (isArc(n.wallId) ? chains.get(parentOf(n.wallId))!.segments.map((x) => ({ ...n, wallId: x.id })) : [n])));
    result.warnings.forEach(report);
  }
  // An arc ending against a wall: its end segment takes the T cut, and the segments before it that
  // still reach past the host's face take their own (carryArcStem).
  // A straight wall against an arc wider than one segment: split near its end by the segments' wedges
  // (spreadOverArc), each part with that segment's T.
  for (const { abutting, hostId } of graph.abutments) {
    const stemChain = chains.get(parentOf(abutting.wallId));
    // The end segment's notches stop at the joint with the segment before it, a radial plane.
    const back = stemChain ? wedge(stemChain, abutting.wallId).filter((_, k) => k === (abutting.end === 'end' ? 0 : 1)) : undefined;
    const result = resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!, back);
    if (!fitsArc(result, abutting.wallId, hostId, byId, chains)) {
      const hostChain = chains.get(parentOf(hostId));
      const spread = hostChain && !stemChain ? spreadOverArc(byId.get(abutting.wallId)!, abutting.end, hostChain) : null;
      if (!spread) {
        report({ kind: 'arcJoinUnsupported', walls: [abutting.wallId, hostId] });
        continue;
      }
      endCuts.set(keyOf(abutting), { extension: spread.extension, cuts: [] });
      notches.push(...spread.notches);
      splits.set(abutting.wallId, [...(splits.get(abutting.wallId) ?? []), spread.split]);
      continue;
    }
    endCuts.set(keyOf(abutting), result.cut);
    notches.push(...result.notches);
    if (stemChain) arcStems.push({ end: abutting, host: byId.get(hostId)! });
  }
  // The free ends of an arc are radial.
  for (const chain of chains.values()) {
    const head = chain.segments[0]!;
    const tail = chain.segments[chain.segments.length - 1]!;
    const cap = (plane: HalfPlane): EndCut => ({ extension: head.thickness, cuts: [plane] });
    const first = keyOf({ wallId: head.id, end: 'start' });
    const last = keyOf({ wallId: tail.id, end: 'end' });
    if (!endCuts.has(first)) endCuts.set(first, cap(chain.startCap));
    if (!endCuts.has(last)) endCuts.set(last, cap(chain.endCap));
  }

  // A crossing splits the cut wall into spans. Each side of the crossing is a T against the through
  // wall: the same normal and offsets as the whole wall, so resolveAbutment applies unchanged.
  const spans = new Map<WallId, Span[]>(
    shapes.map((shape) => [
      shape.id,
      [
        {
          shape,
          atStart: endCuts.get(keyOf({ wallId: shape.id, end: 'start' })),
          atEnd: endCuts.get(keyOf({ wallId: shape.id, end: 'end' })),
        },
      ],
    ]),
  );
  for (const { throughId, cutId, point } of [...graph.crossings].sort((x, y) =>
    stationAlong(byId.get(x.cutId)!, x.point) - stationAlong(byId.get(y.cutId)!, y.point),
  )) {
    if (isArc(throughId) && isArc(cutId)) {
      report({ kind: 'arcJoinUnsupported', walls: [throughId, cutId] });
      continue;
    }
    if (isArc(throughId)) {
      // The arc passes: each side of the straight wall is a T against it (spreadOverArc), per span.
      const chain = chains.get(parentOf(throughId))!;
      const list = spans.get(cutId)!;
      const last = list.pop()!;
      const before = spreadOverArc({ ...last.shape, end: point }, 'end', chain);
      const after = spreadOverArc({ ...byId.get(cutId)!, start: point }, 'start', chain);
      if (!before || !after) {
        list.push(last);
        report({ kind: 'arcJoinUnsupported', walls: [cutId, throughId] });
        continue;
      }
      list.push(
        { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: { extension: before.extension, cuts: [] }, splits: [...(last.splits ?? []), before.split] },
        { shape: { ...last.shape, start: point }, atStart: { extension: after.extension, cuts: [] }, atEnd: last.atEnd, splits: [after.split] },
      );
      notches.push(...before.notches, ...after.notches);
      continue;
    }
    if (isArc(cutId)) {
      // The straight wall passes: the arc is cut there, and each side ends against it as an arc does
      // (its segment takes the T, the ones before carry it: carryArcStem).
      const through = byId.get(throughId)!;
      const chain = chains.get(parentOf(cutId))!;
      const k = chain.segments.findIndex((x) => x.id === cutId);
      const seg = chain.segments[k]!;
      const s = stationAlong(seg, point);
      const back = (id: string, end: 'start' | 'end') => wedge(chain, id).filter((_, i) => i === (end === 'end' ? 0 : 1));
      // On a joint the chain's corner there gives way: the segment before ends there, the next starts.
      const [left, right] =
        s <= POINT_TOLERANCE ? [chain.segments[k - 1], seg] : s >= stationAlong(seg, seg.end) - POINT_TOLERANCE ? [seg, chain.segments[k + 1]] : [null, null];
      if (left !== null || right !== null) {
        for (const [part, end] of [
          [left, 'end'],
          [right, 'start'],
        ] as const) {
          if (!part) continue;
          const r = resolveAbutment(part, end, through, back(part.id, end));
          const list = spans.get(part.id)!;
          const i = end === 'end' ? list.length - 1 : 0;
          list[i] = end === 'end' ? { ...list[i]!, atEnd: r.cut } : { ...list[i]!, atStart: r.cut };
          notches.push(...r.notches);
          arcStems.push({ end: { wallId: part.id, end }, host: through });
        }
        continue;
      }
      const list = spans.get(cutId)!;
      const last = list.pop()!;
      const before = resolveAbutment({ ...last.shape, end: point }, 'end', through, back(cutId, 'end'));
      const after = resolveAbutment({ ...seg, start: point }, 'start', through, back(cutId, 'start'));
      list.push(
        { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: before.cut },
        { shape: { ...last.shape, start: point }, atStart: after.cut, atEnd: last.atEnd },
      );
      notches.push(...before.notches, ...after.notches);
      arcStems.push({ end: { wallId: cutId, end: 'end' }, host: through }, { end: { wallId: cutId, end: 'start' }, host: through });
      continue;
    }
    const through = byId.get(throughId)!;
    const list = spans.get(cutId)!;
    const last = list.pop()!;
    const before = resolveAbutment({ ...last.shape, end: point }, 'end', through);
    const after = resolveAbutment({ ...byId.get(cutId)!, start: point }, 'start', through);
    list.push(
      { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: before.cut },
      { shape: { ...last.shape, start: point }, atStart: after.cut, atEnd: last.atEnd },
    );
    notches.push(...before.notches, ...after.notches);
  }

  const clips = new Map<string, Carried[]>();
  for (const { end, host } of arcStems) {
    const carried = carryArcStem(chains.get(parentOf(end.wallId))!, end, host, (shape) => spans.get(shape.id)!.flatMap((span) => spanPieces(span, [])));
    for (const [id, cut] of carried.clips) clips.set(id, [...(clips.get(id) ?? []), cut]);
    notches.push(...carried.notches);
  }
  const pieces = new Map<WallId, Piece[]>();
  for (const wall of walls) pieces.set(wall.id, []);
  for (const shape of shapes) {
    const own = notches.filter((n) => n.wallId === shape.id);
    // A span cut against an arc on a side (an X with the arc passing) is split there, by span: the
    // split of one side must not touch the other.
    let raw = spans.get(shape.id)!.flatMap((span) => (span.splits ?? []).reduce((ps, split) => splitPieces(ps, split), spanPieces(span, own)));
    for (const split of splits.get(shape.id) ?? []) raw = splitPieces(raw, split);
    pieces.get(parentOf(shape.id))!.push(...(clips.has(shape.id) ? carriedPieces(raw, clips.get(shape.id)!) : raw));
  }
  warnings.push(...overlapsWithArcs(pieces, chains, warnings));
  return { pieces, warnings: dedupe(warnings) };
}

/**
 * A T against an arc is exact only inside one segment: everything the abutting wall puts into the
 * host (where its faces cross the host's faces, and its deepest points) must lie in the host
 * segment's sector. An arc abutting another wall needs no such check: trimChain carries its cut to
 * the segments before its end.
 */
function fitsArc(
  result: AbutmentResult,
  abuttingId: string,
  hostId: string,
  byId: ReadonlyMap<string, WallShape>,
  chains: ReadonlyMap<WallId, ArcChain>,
): boolean {
  const chain = chains.get(parentOf(hostId));
  if (!chain) return true;
  const sector = sectorOf(chain, chain.segments.findIndex((x) => x.id === hostId));
  return [...result.deepest, ...faceCrossings(byId.get(abuttingId)!, byId.get(hostId)!)].every((p) => inSector(sector, p));
}

/** The two radial planes bounding one segment of an arc's chain: inside both is that segment's wedge. */
function wedge(chain: ArcChain, segmentId: string): readonly HalfPlane[] {
  return sectorOf(chain, chain.segments.findIndex((x) => x.id === segmentId));
}

/**
 * The T of an arc's end, carried back along its chain: each earlier segment still reaching past the
 * host's face gets its own T cut (no lengthening) and its own notches in the host, kept inside its
 * wedge. The walk stops at the first segment that does not reach, so the cut planes (which are
 * infinite) never trim a far part of the arc.
 */
function carryArcStem(
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
interface Carried {
  readonly cut: EndCut;
  readonly within: readonly ConvexPolygon[];
}

/** Pieces with carried T cuts: inside the host's body, cut layer by layer; outside it, as they are. */
function carriedPieces(pieces: readonly Piece[], carried: readonly Carried[]): Piece[] {
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
function regionOf(poly: ConvexPolygon): HalfPlane[] {
  const ccw = toCounterClockwise(poly);
  return ccw.map((p, i) => {
    const q = ccw[(i + 1) % ccw.length]!;
    return halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x });
  });
}

/** How a wall's end is cut against an arc wider than one segment: per wedge, that segment's T. */
interface StemSplit {
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
function spreadOverArc(stem: WallShape, end: EndRef['end'], chain: ArcChain): { extension: number; split: StemSplit; notches: Notch[] } | null {
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
function spillOverArc(stem: WallShape, end: EndRef['end'], chain: ArcChain, endSegmentId: string, lCut: EndCut): { split: StemSplit; notches: Notch[] } | null {
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
function splitPieces(pieces: readonly Piece[], split: StemSplit): Piece[] {
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
function faceCrossings(abutting: WallShape, host: WallShape): Point2[] {
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
function overlapsWithArcs(
  pieces: ReadonlyMap<WallId, readonly Piece[]>,
  chains: ReadonlyMap<WallId, ArcChain>,
  already: readonly JoinWarning[],
): JoinWarning[] {
  const out: JoinWarning[] = [];
  const reported = (a: string, b: string) => [...already, ...out].some((w) => w.walls.includes(a) && w.walls.includes(b));
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

function dedupe(ws: readonly JoinWarning[]): JoinWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => {
    const k = `${w.kind}:${w.walls.join(',')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

interface Span {
  readonly shape: WallShape;
  readonly atStart: EndCut | undefined;
  readonly atEnd: EndCut | undefined;
  /** Its ends against an arc it does not go through (an X with the arc passing): split per wedge. */
  readonly splits?: readonly StemSplit[];
}

function spanPieces({ shape, atStart, atEnd }: Span, notches: readonly Notch[]): Piece[] {
  const out: Piece[] = [];
  shape.layers.forEach((_, layerIndex) => {
    const cuts = [atStart, atEnd].flatMap((c) => (c ? [...c.cuts, ...(c.layerCuts?.[layerIndex] ?? [])] : []));
    const band = [shape.layerOffsets[layerIndex]!, shape.layerOffsets[layerIndex + 1]!] as const;
    let polygon = strip(shape, atStart?.extension ?? 0, atEnd?.extension ?? 0, band);
    for (const cut of cuts) polygon = clipHalfPlane(polygon, cut);
    let parts = polygon.length > 0 ? [polygon] : [];
    for (const n of notches) {
      if (layerIndex >= n.layers[0] && layerIndex <= n.layers[1]) parts = parts.flatMap((p) => clipOut(p, n.region));
    }
    for (const part of parts) out.push({ layerIndex, polygon: part });
  });
  return out;
}
