// Document → derived wall geometry, through the join engine. Recomputed when the document changes,
// never stored.

import { add, type Point2, scale } from '../core/vector';
import { deriveOpenings, hostsOf, type OpeningWarning, type PlacedOpening } from '../elements/opening/derive';
import type { Opening, OpeningId } from '../elements/opening/schema';
import { symbolLines } from '../elements/opening/symbol';
import { type Block, cutPlan, cutSolid, type OpeningCut, type OpeningFrame, openingFrame } from '../elements/opening/void';
import { computeWallGeometry, type Piece } from '../elements/wall/geometry/footprint';
import { shapeOf } from '../elements/wall/geometry/shape';
import type { JoinWarning } from '../elements/wall/join/types';
import type { WallId } from '../elements/wall/schema';
import { deriveFloors, deriveRooms, type FloorSolid, type RoomSolid, type RoomWarning } from '../elements/room/derive';
import type { FloorId, RoomId } from '../elements/room/schema';
import type { Point2 as P } from '../core/vector';
import { type Doc, type DocWall, wallHeights } from './document';

export interface WallSolid {
  readonly wall: DocWall;
  /** Plan pieces, with the openings cut through. */
  readonly pieces: readonly Piece[];
  /** 3D blocks: the pieces sliced in height around the openings' holes. */
  readonly blocks: readonly Block[];
  readonly bottom: number;
  readonly top: number;
}

export interface OpeningSolid extends PlacedOpening {
  /** Null when the host is missing or has no valid shape: nothing to draw. */
  readonly frame: OpeningFrame | null;
  /** Absolute heights of the bottom and the head. */
  readonly bottom: number;
  readonly top: number;
}

export interface DerivedGeometry {
  readonly solids: ReadonlyMap<WallId, WallSolid>;
  readonly warnings: readonly JoinWarning[];
  readonly openings: ReadonlyMap<OpeningId, OpeningSolid>;
  readonly openingWarnings: readonly OpeningWarning[];
  readonly rooms: ReadonlyMap<RoomId, RoomSolid>;
  readonly roomWarnings: readonly RoomWarning[];
  readonly floors: ReadonlyMap<FloorId, FloorSolid>;
}

/**
 * `extra` are walls being drawn: joined with the rest so the preview shows the real corner.
 * `extraOpenings` are openings being placed, cut and checked like the others.
 */
export function deriveGeometry(doc: Doc, extra: readonly DocWall[] = [], extraOpenings: readonly Opening[] = []): DerivedGeometry {
  const walls = [...doc.walls, ...extra];
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const { pieces, warnings } = computeWallGeometry(walls, types);
  const placed = deriveOpenings([...doc.openings, ...extraOpenings], hostsOf(doc, walls), doc.openingGroups);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const openings = new Map<OpeningId, OpeningSolid>();
  const cuts = new Map<WallId, OpeningCut[]>();
  for (const p of placed.placed.values()) {
    const wall = byId.get(p.opening.wallId);
    const shape = wall && shapeOf(wall, types.get(wall.wallTypeId));
    const base = wall ? wallHeights(doc, wall).bottom : 0;
    const bottom = base + p.opening.sill;
    const top = bottom + p.opening.height;
    const frame = wall && shape && typeof shape !== 'string' ? openingFrame(shape, p.start, p.end) : null;
    openings.set(p.opening.id, { ...p, frame, bottom, top });
    if (frame && wall) cuts.set(wall.id, [...(cuts.get(wall.id) ?? []), { region: frame.region, bottom, top }]);
  }
  const solids = new Map<WallId, WallSolid>();
  for (const wall of walls) {
    const { bottom, top } = wallHeights(doc, wall);
    const own = pieces.get(wall.id) ?? [];
    const mine = cuts.get(wall.id) ?? [];
    solids.set(wall.id, { wall, pieces: cutPlan(own, mine), blocks: cutSolid(own, bottom, top, mine), bottom, top });
  }
  // Rooms see the walls before doors and windows are cut: a door does not open a room.
  const piecesByLevel = new Map<string, P[][]>();
  for (const wall of doc.walls) {
    const list = piecesByLevel.get(wall.levelId) ?? [];
    for (const piece of pieces.get(wall.id) ?? []) list.push([...piece.polygon]);
    piecesByLevel.set(wall.levelId, list);
  }
  const roomResult = deriveRooms(doc.rooms, piecesByLevel);
  const floors = deriveFloors(doc.floors, roomResult.solids, (id) => doc.levels.find((l) => l.id === id)?.elevation ?? 0);
  return { solids, warnings, openings, openingWarnings: placed.warnings, rooms: roomResult.solids, roomWarnings: roomResult.warnings, floors };
}

/** The opening's outline in plan: the jambs across the wall's thickness. */
export function openingOutline(o: OpeningSolid): Point2[] {
  const f = o.frame;
  if (!f) return [];
  const at = (p: Point2, k: number) => add(p, scale(f.normal, f.faces[k]!));
  return [at(f.start, 0), at(f.end, 0), at(f.end, 1), at(f.start, 1)];
}

/** The opening whose outline contains p, last placed first. */
export function openingAt(g: DerivedGeometry, p: Point2): OpeningId | null {
  for (const o of [...g.openings.values()].reverse()) if (insidePolygon(openingOutline(o), p)) return o.opening.id;
  return null;
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

/** Bounding box of the drawn pieces and openings, or null when there is nothing. */
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
  for (const o of g.openings.values()) {
    if (ids && !ids.has(o.opening.id)) continue;
    for (const v of [...openingOutline(o), ...symbolLines(o, o.frame).flat()]) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }
  }
  return minX === Infinity ? null : { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
