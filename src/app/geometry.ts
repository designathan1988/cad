// Document → derived wall geometry, through the join engine. Recomputed when the document changes,
// never stored.

import { add, type Point2, scale } from '../core/vector';
import { deriveOpenings, hostsOf, type OpeningWarning, type PlacedOpening } from '../elements/opening/derive';
import type { Opening, OpeningId } from '../elements/opening/schema';
import { symbolLines } from '../elements/opening/symbol';
import { type Block, cutPlan, cutSolid, type OpeningCut, type OpeningFrame, openingFrame } from '../elements/opening/void';
import { computeWallGeometry, type Piece } from '../elements/wall/geometry/footprint';
import { area, clipHalfPlane, type ConvexPolygon, halfPlaneThrough, overlapArea, toCounterClockwise } from '../elements/wall/geometry/convex';
import { faceOffsets, stationOf, wallLength, wallNormal } from '../elements/wall/geometry/offset';
import { AREA_EPSILON, POINT_TOLERANCE } from '../core/tolerance';

/** How far past the host's faces another wall still counts as meeting it inside an opening (m). */
const JOINT_REACH = 0.01;
import { shapeOf } from '../elements/wall/geometry/shape';
import type { JoinWarning } from '../elements/wall/join/types';
import type { WallId, WallLayer, WallType } from '../elements/wall/schema';
import { layerSeams, type Seam } from '../elements/wall/geometry/seams';
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
  /** Its type's layers, from the exterior face: what each piece's layerIndex is (none when the type is missing). */
  readonly layers: readonly WallLayer[];
  /** Lines in plan where its pieces meet pieces of another layer (geometry/seams.ts). */
  readonly seams: readonly Seam[];
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
  const { pieces, warnings } = wallPieces(walls, types);
  const placed = deriveOpenings([...doc.openings, ...extraOpenings], hostsOf(doc, walls, jointsIn(walls, types, pieces)), doc.openingGroups);
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
    // One that does not fit in its wall cuts nothing: it would open the wall past its end and undo the
    // joint there. It is drawn with its warning until it is fixed.
    if (frame && wall && !p.warnings.includes('openingOutside')) cuts.set(wall.id, [...(cuts.get(wall.id) ?? []), { region: frame.region, bottom, top }]);
  }
  // An opening over another wall's joint (a wall meeting its host inside the opening's span): the
  // other wall's pieces touch the opening across the host's thickness, a hair beyond its faces.
  const jointWarnings: OpeningWarning[] = [];
  for (const [id, o] of openings) {
    const host = o.frame && byId.get(o.opening.wallId);
    if (!o.frame || !host || o.warnings.includes('openingOutside')) continue;
    const f = o.frame;
    const at = (p: Point2, offset: number) => add(p, scale(f.normal, offset));
    const lo = Math.min(...f.faces) - JOINT_REACH;
    const hi = Math.max(...f.faces) + JOINT_REACH;
    const span = toCounterClockwise([at(f.start, lo), at(f.end, lo), at(f.end, hi), at(f.start, hi)]);
    const touched = walls.some(
      (w) => w.id !== host.id && w.levelId === host.levelId && (pieces.get(w.id) ?? []).some((p) => overlapArea(p.polygon, span) > AREA_EPSILON),
    );
    if (!touched) continue;
    openings.set(id, { ...o, valid: false, warnings: [...o.warnings, 'openingAtJoint'] });
    jointWarnings.push({ kind: 'openingAtJoint', openings: [id] });
  }
  const solids = new Map<WallId, WallSolid>();
  const planPieces = new Map<WallId, Piece[]>();
  for (const wall of walls) planPieces.set(wall.id, cutPlan(pieces.get(wall.id) ?? [], cuts.get(wall.id) ?? []));
  // Seams per level: walls on two levels can lie over each other in plan without meeting.
  const seams = new Map<WallId, Seam[]>();
  for (const levelId of new Set(walls.map((w) => w.levelId))) {
    const list = walls
      .filter((w) => w.levelId === levelId)
      .flatMap((w) => {
        const layers = types.get(w.wallTypeId)?.layers ?? [];
        return (planPieces.get(w.id) ?? []).map((p) => ({ wallId: w.id, polygon: p.polygon, key: `${layers[p.layerIndex]?.function}|${layers[p.layerIndex]?.materialId}` }));
      });
    for (const [id, s] of layerSeams(list)) seams.set(id, s);
  }
  for (const wall of walls) {
    const { bottom, top } = wallHeights(doc, wall);
    const own = pieces.get(wall.id) ?? [];
    const mine = cuts.get(wall.id) ?? [];
    const layers = types.get(wall.wallTypeId)?.layers ?? [];
    solids.set(wall.id, { wall, pieces: planPieces.get(wall.id)!, blocks: cutSolid(own, bottom, top, mine), bottom, top, layers, seams: seams.get(wall.id) ?? [] });
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
  return { solids, warnings, openings, openingWarnings: [...placed.warnings, ...jointWarnings], rooms: roomResult.solids, roomWarnings: roomResult.warnings, floors };
}

/** The joined plan pieces of every wall. Walls join only within their level: one level's walls never cut, notch or warn about another's. */
function wallPieces(walls: readonly DocWall[], types: ReadonlyMap<string, WallType>): { pieces: Map<WallId, readonly Piece[]>; warnings: JoinWarning[] } {
  const byLevel = new Map<string, DocWall[]>();
  for (const w of walls) byLevel.set(w.levelId, [...(byLevel.get(w.levelId) ?? []), w]);
  const pieces = new Map<WallId, readonly Piece[]>();
  const warnings: JoinWarning[] = [];
  for (const list of byLevel.values()) {
    const g = computeWallGeometry(list, types);
    for (const [id, p] of g.pieces) pieces.set(id, p);
    warnings.push(...g.warnings);
  }
  return { pieces, warnings };
}

/**
 * Where other walls meet each straight wall inside its length (a T or an X): the stations along its
 * reference line that their pieces cover within its faces (a hair beyond, as for an opening over a
 * joint). Corners at the wall's ends are not inside it.
 */
function jointsIn(
  walls: readonly DocWall[],
  types: ReadonlyMap<string, WallType>,
  pieces: ReadonlyMap<WallId, readonly Piece[]>,
): Map<WallId, Map<WallId, { lo: number; hi: number }>> {
  const out = new Map<WallId, Map<WallId, { lo: number; hi: number }>>();
  for (const host of walls) {
    if (host.bulge) continue;
    const shape = shapeOf(host, types.get(host.wallTypeId));
    if (typeof shape === 'string') continue;
    const n = wallNormal(shape);
    const [f0, f1] = faceOffsets(shape);
    const band = [
      halfPlaneThrough(add(shape.start, scale(n, f0 - JOINT_REACH)), n),
      halfPlaneThrough(add(shape.start, scale(n, f1 + JOINT_REACH)), scale(n, -1)),
    ];
    const length = wallLength(shape);
    const mine = new Map<WallId, { lo: number; hi: number }>();
    for (const other of walls) {
      if (other.id === host.id || other.levelId !== host.levelId) continue;
      const stations = (pieces.get(other.id) ?? [])
        .map((p) => band.reduce<ConvexPolygon>((poly, h) => (poly.length > 0 ? clipHalfPlane(poly, h) : poly), p.polygon))
        .filter((poly) => poly.length > 0 && area(poly) > AREA_EPSILON)
        .flatMap((poly) => poly.map((v) => stationOf(shape, v)));
      if (stations.length === 0) continue;
      const lo = Math.min(...stations);
      const hi = Math.max(...stations);
      if (lo > POINT_TOLERANCE && hi < length - POINT_TOLERANCE) mine.set(other.id, { lo, hi });
    }
    if (mine.size > 0) out.set(host.id, mine);
  }
  return out;
}

/** Hosts for placing openings, with the joints inside each (which bound a distributed group's stretch). */
export function hostsIn(doc: Doc, walls: readonly DocWall[] = doc.walls) {
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  return hostsOf(doc, walls, jointsIn(walls, types, wallPieces(walls, types).pieces));
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
  // Rooms and floors: their outlines.
  const outlines = [
    ...[...g.rooms.values()].filter((r) => !ids || ids.has(r.room.id)).map((r) => r.outline),
    ...[...g.floors.values()].filter((f) => !ids || ids.has(f.floor.id)).map((f) => f.outline),
  ];
  for (const v of outlines.flat()) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return minX === Infinity ? null : { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/** Categories of elements the project browser can hide from view (not from the document). */
export type Category = 'walls' | 'openings' | 'rooms' | 'floors';

/** The geometry without the hidden categories; the same object when nothing is hidden. */
export function hideCategories(g: DerivedGeometry, hidden: ReadonlySet<Category>): DerivedGeometry {
  if (hidden.size === 0) return g;
  return {
    ...g,
    solids: hidden.has('walls') ? new Map() : g.solids,
    openings: hidden.has('openings') ? new Map() : g.openings,
    rooms: hidden.has('rooms') ? new Map() : g.rooms,
    floors: hidden.has('floors') ? new Map() : g.floors,
  };
}
