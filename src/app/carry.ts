// Rooms go with their walls: when a move or a turn takes every wall around a room (every wall whose
// pieces touch the room's outline), the room's point is moved the same way, so the room stays closed
// and keeps its name. A room with a wall left behind stays where it is.

import type { Point2 } from '../core/vector';
import type { Room } from '../elements/room/schema';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';

const NEAR = 1e-6;

/** Distance from p to the segment a–b. */
function toSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function carriedRooms(doc: Doc, before: DerivedGeometry, moved: ReadonlySet<string>, transform: (p: Point2) => Point2): Room[] {
  return doc.rooms.map((room) => {
    const solid = before.rooms.get(room.id);
    if (!solid || !solid.enclosed) return room;
    const touching = [...before.solids.values()].filter(
      (s) =>
        s.wall.levelId === room.levelId &&
        s.pieces.some((piece) =>
          solid.outline.some((v) => piece.polygon.some((a, i) => toSegment(v, a, piece.polygon[(i + 1) % piece.polygon.length]!) <= NEAR)),
        ),
    );
    const all = touching.length > 0 && touching.every((s) => moved.has(s.wall.id));
    return all ? { ...room, seed: transform(room.seed) } : room;
  });
}
