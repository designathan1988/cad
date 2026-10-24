// Plan footprint of every wall, layer by layer: each layer's band, lengthened at joined ends, clipped
// by the same half-planes. Clipping layers one by one equals splitting the clipped wall at the layer
// lines, so the layers tile the wall exactly.

import { AREA_EPSILON } from '../../../core/tolerance';
import { add, dot, type Point2, scale } from '../../../core/vector';
import { resolveCorner } from '../join/cut-l';
import { type AbutmentResult, resolveAbutment } from '../join/cut-t';
import { deriveJoins } from '../join/discover';
import { resolveNode } from '../join/node';
import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { EndRef, Wall, WallId, WallType, WallTypeId } from '../schema';
import { type ArcChain, arcOf, expandArc, inSector, parentOf, sectorOf } from './arc';
import { area, clipHalfPlane, clipOut, type ConvexPolygon, type HalfPlane, halfPlaneThrough } from './convex';
import { faceOffsets, offsetOf, stationOf as stationAlong, strip, wallDirection, wallNormal } from './offset';
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
  for (const { ends: [ra, rb], node } of graph.corners) {
    const result = resolveCorner(byId.get(ra.wallId)!, ra.end, byId.get(rb.wallId)!, rb.end, node);
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) report(result.warning);
    notches.push(...result.notches);
  }
  for (const { ends, point } of graph.nodes) {
    const result = resolveNode(byId, ends, point);
    for (const [ref, cut] of result.endCuts) endCuts.set(keyOf(ref), cut);
    notches.push(...result.notches);
    result.warnings.forEach(report);
  }
  for (const { abutting, hostId } of graph.abutments) {
    const result = resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!);
    if (!fitsArc(result, abutting.wallId, hostId, byId, chains)) {
      report({ kind: 'complexJoin', walls: [abutting.wallId, hostId] });
      continue;
    }
    endCuts.set(keyOf(abutting), result.cut);
    notches.push(...result.notches);
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
    if (isArc(throughId) || isArc(cutId)) {
      report({ kind: 'complexJoin', walls: isArc(cutId) ? [throughId, cutId] : [cutId, throughId] });
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

  const pieces = new Map<WallId, Piece[]>();
  for (const wall of walls) pieces.set(wall.id, []);
  for (const shape of shapes) {
    const own = notches.filter((n) => n.wallId === shape.id);
    pieces.get(parentOf(shape.id))!.push(...spans.get(shape.id)!.flatMap((span) => spanPieces(span, own)));
  }
  warnings.push(...overlapsWithArcs(pieces, chains, warnings));
  return { pieces, warnings: dedupe(warnings) };
}

/**
 * A T against an arc is exact only inside one segment: everything the abutting wall puts into the
 * host (where its faces cross the host's faces, and its deepest points) must lie in the host
 * segment's sector. An arc abutting a straight wall must keep all that inside its end segment.
 */
function fitsArc(
  result: AbutmentResult,
  abuttingId: string,
  hostId: string,
  byId: ReadonlyMap<string, WallShape>,
  chains: ReadonlyMap<WallId, ArcChain>,
): boolean {
  const points = [...result.deepest, ...faceCrossings(byId.get(abuttingId)!, byId.get(hostId)!)];
  const fits = (segmentId: string) => {
    const chain = chains.get(parentOf(segmentId));
    if (!chain) return true;
    const sector = sectorOf(chain, chain.segments.findIndex((x) => x.id === segmentId));
    return points.every((p) => inSector(sector, p));
  };
  return fits(hostId) && fits(abuttingId);
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
      if (hit) out.push({ kind: 'complexJoin', walls: chains.has(otherId) ? [arcId, otherId] : [otherId, arcId] });
    }
  }
  return out;
}

/** Area shared by two convex counter-clockwise polygons: one clipped by the other's edges. */
function overlapArea(a: ConvexPolygon, b: ConvexPolygon): number {
  let rest: ConvexPolygon = a;
  for (let i = 0; i < b.length && rest.length > 0; i++) {
    const p = b[i]!;
    const q = b[(i + 1) % b.length]!;
    rest = clipHalfPlane(rest, halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x }));
  }
  return rest.length > 0 ? area(rest) : 0;
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
