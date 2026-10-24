// Plan footprint of every wall, layer by layer: each layer's band, lengthened at joined ends, clipped
// by the same half-planes. Clipping layers one by one equals splitting the clipped wall at the layer
// lines, so the layers tile the wall exactly.

import { resolveCorner } from '../join/cut-l';
import { resolveAbutment } from '../join/cut-t';
import { deriveJoins } from '../join/discover';
import { resolveNode } from '../join/node';
import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { EndRef, Wall, WallId, WallType, WallTypeId } from '../schema';
import { clipHalfPlane, clipOut, type ConvexPolygon } from './convex';
import { stationOf as stationAlong, strip } from './offset';
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
  for (const wall of [...walls].sort(byIdOrder)) {
    const shape = shapeOf(wall, types.get(wall.wallTypeId));
    if (typeof shape === 'string') warnings.push({ kind: shape, walls: [wall.id] });
    else shapes.push(shape);
  }

  const graph = deriveJoins(shapes);
  warnings.push(...graph.warnings);
  const byId = new Map(shapes.map((w) => [w.id, w]));
  const endCuts = new Map<string, EndCut>();
  const notches: Notch[] = [];
  for (const { ends: [ra, rb], node } of graph.corners) {
    const result = resolveCorner(byId.get(ra.wallId)!, ra.end, byId.get(rb.wallId)!, rb.end, node);
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) warnings.push(result.warning);
    notches.push(...result.notches);
  }
  for (const { ends, point } of graph.nodes) {
    const result = resolveNode(byId, ends, point);
    for (const [ref, cut] of result.endCuts) endCuts.set(keyOf(ref), cut);
    notches.push(...result.notches);
    warnings.push(...result.warnings);
  }
  for (const { abutting, hostId } of graph.abutments) {
    const { cut, notches: own } = resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!);
    endCuts.set(keyOf(abutting), cut);
    notches.push(...own);
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

  const pieces = new Map<WallId, readonly Piece[]>();
  for (const wall of walls) if (!byId.has(wall.id)) pieces.set(wall.id, []);
  for (const shape of shapes) {
    const own = notches.filter((n) => n.wallId === shape.id);
    pieces.set(shape.id, spans.get(shape.id)!.flatMap((span) => spanPieces(span, own)));
  }
  return { pieces, warnings };
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
