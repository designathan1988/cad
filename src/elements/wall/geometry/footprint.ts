// Plan footprint of every wall, layer by layer: each layer's band, lengthened at joined ends, clipped
// by the same half-planes. Clipping layers one by one equals splitting the clipped wall at the layer
// lines, so the layers tile the wall exactly.

import { resolveCorner } from '../join/cut-l';
import { resolveAbutment } from '../join/cut-t';
import { deriveJoins } from '../join/discover';
import type { EndCut, JoinWarning } from '../join/types';
import type { EndRef, Wall, WallId, WallType, WallTypeId } from '../schema';
import { clipHalfPlane, type ConvexPolygon } from './convex';
import { strip } from './offset';
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
  for (const { ends: [ra, rb], node } of graph.corners) {
    const result = resolveCorner(byId.get(ra.wallId)!, ra.end, byId.get(rb.wallId)!, rb.end, node);
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) warnings.push(result.warning);
  }
  for (const { abutting, hostId } of graph.abutments) {
    endCuts.set(keyOf(abutting), resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!));
  }

  const pieces = new Map<WallId, readonly Piece[]>();
  for (const wall of walls) if (!byId.has(wall.id)) pieces.set(wall.id, []);
  for (const shape of shapes) {
    const atStart = endCuts.get(keyOf({ wallId: shape.id, end: 'start' }));
    const atEnd = endCuts.get(keyOf({ wallId: shape.id, end: 'end' }));
    const cuts = [...(atStart?.cuts ?? []), ...(atEnd?.cuts ?? [])];
    const layers: Piece[] = [];
    shape.layers.forEach((_, layerIndex) => {
      const band = [shape.layerOffsets[layerIndex]!, shape.layerOffsets[layerIndex + 1]!] as const;
      let polygon = strip(shape, atStart?.extension ?? 0, atEnd?.extension ?? 0, band);
      for (const cut of cuts) polygon = clipHalfPlane(polygon, cut);
      if (polygon.length > 0) layers.push({ layerIndex, polygon });
    });
    pieces.set(shape.id, layers);
  }
  return { pieces, warnings };
}
