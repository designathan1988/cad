// Document → derived wall geometry, through the join engine. Recomputed when the document changes,
// never stored.

import type { Point2 } from '../core/vector';
import { computeWallGeometry, type Piece } from '../elements/wall/geometry/footprint';
import type { JoinWarning } from '../elements/wall/join/types';
import type { WallId } from '../elements/wall/schema';
import { type Doc, type DocWall, wallHeights } from './document';

export interface WallSolid {
  readonly wall: DocWall;
  readonly pieces: readonly Piece[];
  readonly bottom: number;
  readonly top: number;
}

export interface DerivedGeometry {
  readonly solids: ReadonlyMap<WallId, WallSolid>;
  readonly warnings: readonly JoinWarning[];
}

/** `extra` are walls being drawn: joined with the rest so the preview shows the real corner. */
export function deriveGeometry(doc: Doc, extra: readonly DocWall[] = []): DerivedGeometry {
  const walls = [...doc.walls, ...extra];
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const { pieces, warnings } = computeWallGeometry(walls, types);
  const solids = new Map<WallId, WallSolid>();
  for (const wall of walls) {
    const { bottom, top } = wallHeights(doc, wall);
    solids.set(wall.id, { wall, pieces: pieces.get(wall.id) ?? [], bottom, top });
  }
  return { solids, warnings };
}

/** Even-odd ray crossing: is p inside the polygon? */
export function insidePolygon(poly: readonly Point2[], p: Point2): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The wall whose drawn pieces contain p, topmost (last drawn) first. */
export function wallAt(g: DerivedGeometry, p: Point2, ids?: ReadonlySet<WallId>): WallId | null {
  const list = [...g.solids.values()].reverse();
  for (const s of list) {
    if (ids && !ids.has(s.wall.id)) continue;
    if (s.pieces.some((piece) => insidePolygon(piece.polygon, p))) return s.wall.id;
  }
  return null;
}

/** Bounding box of the drawn pieces, or null when there is nothing. */
export function boundsOf(g: DerivedGeometry, ids?: ReadonlySet<WallId>): { min: Point2; max: Point2 } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of g.solids.values()) {
    if (ids && !ids.has(s.wall.id)) continue;
    for (const piece of s.pieces) {
      for (const v of piece.polygon) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
    }
  }
  return minX === Infinity ? null : { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
