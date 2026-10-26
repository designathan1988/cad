// Rooms go with their walls: when a move or a turn takes every wall around a room (every wall whose
// pieces touch the room's outline), the room's point is moved the same way, so the room stays closed
// and keeps its name. A room with a wall left behind stays where it is, unless a wall moved past its
// point (keepRooms).

import type { Point2 } from '../core/vector';
import { insideRing, middleOfRest, type RoomSolid } from '../elements/room/derive';
import type { Floor, Room } from '../elements/room/schema';
import type { Doc } from './document';
import { deriveGeometry, type DerivedGeometry } from './geometry';

const NEAR = 1e-6;

/** Distance from p to the segment a–b. */
function toSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The walls around a room: every wall of its level whose pieces touch its outline. None when it is open. */
export function wallsAround(g: DerivedGeometry, room: Room): string[] {
  const solid = g.rooms.get(room.id);
  if (!solid || !solid.enclosed) return [];
  return [...g.solids.values()]
    .filter(
      (s) =>
        s.wall.levelId === room.levelId &&
        s.pieces.some((piece) =>
          solid.outline.some((v) => piece.polygon.some((a, i) => toSegment(v, a, piece.polygon[(i + 1) % piece.polygon.length]!) <= NEAR)),
        ),
    )
    .map((s) => s.wall.id);
}

/** The rooms whose every surrounding wall is in `moved`: they go with a move or a turn of those walls. */
export function roomsGoingWith(doc: Doc, before: DerivedGeometry, moved: ReadonlySet<string>): Set<string> {
  return new Set(
    doc.rooms
      .filter((room) => {
        const around = wallsAround(before, room);
        return around.length > 0 && around.every((id) => moved.has(id));
      })
      .map((room) => room.id),
  );
}

/** The outline floors in `ids` with their points moved by `transform`; a room's floor follows its room. */
export const moveFloors = (floors: readonly Floor[], ids: ReadonlySet<string>, transform: (p: Point2) => Point2): Floor[] =>
  floors.map((f) => (ids.has(f.id) && f.source.kind === 'outline' ? { ...f, source: { kind: 'outline', points: f.source.points.map(transform) } } : f));

/** The rooms with the points of those in `going` moved by `transform`. */
export const moveRooms = (rooms: readonly Room[], going: ReadonlySet<string>, transform: (p: Point2) => Point2): Room[] =>
  rooms.map((room) => (going.has(room.id) ? { ...room, seed: transform(room.seed) } : room));

export function carriedRooms(doc: Doc, before: DerivedGeometry, moved: ReadonlySet<string>, transform: (p: Point2) => Point2): Room[] {
  return moveRooms(doc.rooms, roomsGoingWith(doc, before, moved), transform);
}

/** The geometry of a version, derived once: the version before a drag is asked for at every step of it. */
const derived = new WeakMap<Doc, DerivedGeometry>();
export function geometryOf(doc: Doc): DerivedGeometry {
  const hit = derived.get(doc);
  if (hit) return hit;
  const g = deriveGeometry(doc);
  derived.set(doc, g);
  return g;
}

const alone = (s: RoomSolid | undefined): boolean => !!s && s.enclosed && s.sharing.length === 0;

/**
 * A wall moved past a room's point: a room closed in on its own before a change to the walls, and not
 * after it (in another room's space, or in none), takes a point in what is left of its space, when that
 * is a space of its own after the change: the middle it had before, or, when another room's space has
 * that now, the middle of the part of its old space no room has. Revit leaves the point and warns: the
 * wall between two bedrooms dragged past one's point left it in the other's space and the rest of it
 * without a room. Returns `to` (and its geometry) when no room needed it.
 */
export function keepRooms(from: Doc, to: Doc): { doc: Doc; geometry: DerivedGeometry } {
  const before = geometryOf(from);
  const after = geometryOf(to);
  const lost = to.rooms.filter((r) => alone(before.rooms.get(r.id)) && !alone(after.rooms.get(r.id)));
  if (lost.length === 0) return { doc: to, geometry: after };
  const middle = new Map<string, Point2>();
  for (const r of lost) {
    const was = before.rooms.get(r.id)!;
    const taken = [...after.rooms.values()].filter((s) => s.enclosed && s.room.levelId === r.levelId).map((s) => s.outline);
    const p = taken.some((o) => insideRing(o, was.label)) ? middleOfRest(was.outline, taken) : was.label;
    if (p) middle.set(r.id, p);
  }
  if (middle.size === 0) return { doc: to, geometry: after };
  const reseed = (ids: ReadonlySet<string>): Doc => ({ ...to, rooms: to.rooms.map((r) => (ids.has(r.id) ? { ...r, seed: middle.get(r.id)! } : r)) });
  const tried = reseed(new Set(middle.keys()));
  const g = geometryOf(tried);
  // Only a room on its own at its new point takes it; the others keep theirs, and their warning.
  const kept = new Set([...middle.keys()].filter((id) => alone(g.rooms.get(id))));
  if (kept.size === 0) return { doc: to, geometry: after };
  if (kept.size === middle.size) return { doc: tried, geometry: g };
  const doc = reseed(kept);
  return { doc, geometry: geometryOf(doc) };
}
