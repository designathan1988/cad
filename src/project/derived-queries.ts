// Questions asked of the derived geometry: the hosts an opening can sit in, what wall or opening lies
// under a point, and the bounds of what is drawn.

import { type Doc, type DocWall, wallHeights } from './doc';
import { type DerivedGeometry, endsIn, jointsIn, type OpeningSolid, planCutHeight, wallPieces } from './derive';
import { hostsOf } from '../elements/opening/derive';
import { add, insidePolygon, type Point2, polygonDistance, polylineDistance, scale } from '../model/vector';
import type { OpeningId } from '../elements/opening/schema';
import { symbolLines } from '../elements/opening/symbol';
import type { WallId } from '../elements/wall/schema';
import { eachSolid } from '../elements/registry';
import type { ElementId } from '../core/id';
import type { WallSolid } from './derive';
import { isOpeningId } from '../elements/opening/schema';
import type { RoomSolid } from '../elements/room/derive';
import type { RoomId } from '../elements/room/schema';

/** Hosts for placing openings, with the joints inside each (which bound a distributed group's stretch). */
export function hostsIn(doc: Doc, walls: readonly DocWall[] = doc.walls) {
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const pieces = wallPieces(walls, types, (w) => wallHeights(doc, w), (w) => planCutHeight(doc, w)).pieces;
  return hostsOf(doc, walls, jointsIn(walls, types, pieces), endsIn(walls, types, pieces));
}

/** The opening's outline in plan: the jambs across the wall's thickness. */
export function openingOutline(o: OpeningSolid): Point2[] {
  const f = o.frame;
  if (!f) return [];
  const at = (p: Point2, k: number) => add(p, scale(f.normal, f.faces[k]!));
  return [at(f.start, 0), at(f.end, 0), at(f.end, 1), at(f.start, 1)];
}

/** The opening whose outline contains p, last placed first. */
/**
 * The door or window under p: inside its outline in the wall, or within `reach` (m) of it or of its
 * symbol (a door's leaf and swing, a window's panes), the nearest winning. Its symbol is what the plan
 * shows of it: a click on a door's leaf took the room behind it.
 */
export function openingAt(g: DerivedGeometry, p: Point2, reach = 0): OpeningId | null {
  let best: OpeningId | null = null;
  let bestD = reach;
  for (const o of [...g.openings.values()].reverse()) {
    const outline = openingOutline(o);
    if (insidePolygon(outline, p)) return o.opening.id;
    if (reach <= 0) continue;
    const d = Math.min(polygonDistance(outline, p), ...symbolLines(o, o.frame).map((line) => polylineDistance(line, p)));
    if (d <= bestD) {
      best = o.opening.id;
      bestD = d;
    }
  }
  return best;
}

/**
 * The wall whose drawn pieces contain p, topmost (last drawn) first; else the one whose pieces come
 * nearest p within `reach` (m): a wall 15 cm thick is a few pixels wide, and missing it by one took
 * the room beside it.
 */
export function wallAt(g: DerivedGeometry, p: Point2, ids?: ReadonlySet<ElementId>, reach = 0): WallId | null {
  const list = [...g.solids.values()].reverse().filter((s) => !ids || ids.has(s.wall.id));
  for (const s of list) if (s.pieces.some((piece) => insidePolygon(piece.polygon, p))) return s.wall.id;
  let best: WallId | null = null;
  let bestD = reach;
  for (const s of reach > 0 ? list : []) {
    const d = Math.min(...s.pieces.map((piece) => polygonDistance(piece.polygon, p)));
    if (d <= bestD) {
      best = s.wall.id;
      bestD = d;
    }
  }
  return best;
}

/** A wall's solid by any element's id (a selection's): none when the id is not a wall's. */
export const solidOf = (g: DerivedGeometry, id: ElementId): WallSolid | undefined => g.solids.get(id as WallId);

/** A door's or window's placement by any element's id (a selection's): none when the id is not an opening's. */
export const placedOf = (g: DerivedGeometry, id: ElementId): OpeningSolid | undefined => (isOpeningId(id) ? g.openings.get(id) : undefined);

/** A room's solid by any element's id (a selection's): none when the id is not a room's. */
export const roomOf = (g: DerivedGeometry, id: ElementId): RoomSolid | undefined => g.rooms.get(id as RoomId);

/** Bounding box of the drawn pieces and openings, or null when there is nothing. */
export function boundsOf(g: DerivedGeometry, ids?: ReadonlySet<ElementId>): { min: Point2; max: Point2 } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // Rooms and floors: their outlines.
  const outlines = [
    ...[...g.rooms.values()].filter((r) => !ids || ids.has(r.room.id)).map((r) => r.outline),
    // A guide has no ends: its point only.
    // A guide has no ends: its point only. A door with its swing (contract.ts: extent).
    ...[...eachSolid(g.kinds)]
      .filter((x) => !ids || ids.has(x.id))
      .flatMap((x) => (x.kind.endless ? [x.kind.outlines(x.solid)[0]!.slice(0, 1)] : x.kind.extent ? [x.kind.extent(x.solid)] : x.kind.outlines(x.solid))),
  ];
  for (const v of outlines.flat()) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return minX === Infinity ? null : { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
