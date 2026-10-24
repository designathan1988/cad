// Plan footprint of every wall: band, lengthened at joined ends, clipped by each join's half-planes.

import { resolveCorner } from '../join/cut-l';
import { resolveAbutment } from '../join/cut-t';
import { deriveJoins } from '../join/discover';
import type { EndCut, JoinWarning } from '../join/types';
import type { EndRef, Wall, WallId } from '../schema';
import { clipHalfPlane, type ConvexPolygon } from './convex';
import { strip } from './offset';

export interface WallGeometry {
  readonly pieces: ReadonlyMap<WallId, readonly ConvexPolygon[]>;
  readonly warnings: readonly JoinWarning[];
}

const keyOf = (r: EndRef): string => `${r.wallId}:${r.end}`;

export function computeWallGeometry(walls: readonly Wall[]): WallGeometry {
  const graph = deriveJoins(walls);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const endCuts = new Map<string, EndCut>();
  const warnings: JoinWarning[] = [...graph.warnings];

  for (const { ends: [ra, rb], node } of graph.corners) {
    const result = resolveCorner(byId.get(ra.wallId)!, ra.end, byId.get(rb.wallId)!, rb.end, node);
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) warnings.push(result.warning);
  }
  for (const { abutting, hostId } of graph.abutments) {
    endCuts.set(keyOf(abutting), resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!));
  }

  const pieces = new Map<WallId, readonly ConvexPolygon[]>();
  const sorted = [...walls].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const wall of sorted) {
    const atStart = endCuts.get(keyOf({ wallId: wall.id, end: 'start' }));
    const atEnd = endCuts.get(keyOf({ wallId: wall.id, end: 'end' }));
    let poly = strip(wall, atStart?.extension ?? 0, atEnd?.extension ?? 0);
    for (const cut of [...(atStart?.cuts ?? []), ...(atEnd?.cuts ?? [])]) poly = clipHalfPlane(poly, cut);
    pieces.set(wall.id, poly.length > 0 ? [poly] : []);
  }
  return { pieces, warnings };
}
