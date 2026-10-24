// Moving the selection from the keyboard by a small step (ref/chat.txt:242): walls move with their
// joins (and the rooms they surround), doors and windows slide along their wall by the part of the
// step along it, a room's point and an outline floor move. One document out, for one undo step.

import { carriedRooms } from '../app/carry';
import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { dot, normalize, type Point2, sub } from '../core/vector';
import { deriveOpenings, hostsOf } from '../elements/opening/derive';
import { hasDistance, type PositionRule } from '../elements/opening/schema';
import { moveWalls } from './edit';

/** The step of an arrow key: 5 cm (the snap grid), 1 cm with Alt; up is +y. Null for other keys. */
export function arrowStep(key: string, fine: boolean): Point2 | null {
  const s = fine ? 0.01 : 0.05;
  const dirs: Record<string, Point2> = { ArrowLeft: { x: -s, y: 0 }, ArrowRight: { x: s, y: 0 }, ArrowUp: { x: 0, y: s }, ArrowDown: { x: 0, y: -s } };
  return dirs[key] ?? null;
}

export function nudge(doc: Doc, g: DerivedGeometry, ids: readonly string[], step: Point2): Doc {
  const set = new Set(ids);
  const wallIds = doc.walls.filter((w) => set.has(w.id)).map((w) => w.id);
  const moved = (p: Point2) => ({ x: p.x + step.x, y: p.y + step.y });
  let next: Doc = doc;
  if (wallIds.length > 0) {
    next = { ...next, walls: moveWalls(doc, wallIds, step), rooms: carriedRooms(doc, g, new Set(wallIds), moved) };
  }
  // Openings on a moved wall go with it; the others slide along their own wall.
  const placed = deriveOpenings(doc.openings, hostsOf(doc), doc.openingGroups).placed;
  const openings = next.openings.map((o) => {
    // A member of a distributed group is placed by its group: the arrows leave it (move the wall).
    if (!set.has(o.id) || set.has(o.wallId) || o.rule.kind === 'inGroup') return o;
    const host = doc.walls.find((w) => w.id === o.wallId);
    const p = placed.get(o.id);
    if (!host || !p || host.bulge) return o;
    const along = dot(step, normalize(sub(host.end, host.start)));
    if (Math.abs(along) < 1e-12) return o;
    return { ...o, rule: slid(o.rule, along, p.start) };
  });
  const rooms = next.rooms.map((r) => (set.has(r.id) ? { ...r, seed: moved(r.seed) } : r));
  const floors = next.floors.map((f) =>
    set.has(f.id) && f.source.kind === 'outline' ? { ...f, source: { kind: 'outline' as const, points: f.source.points.map(moved) } } : f,
  );
  const changed =
    next !== doc || openings.some((o, i) => o !== next.openings[i]) || rooms.some((r, i) => r !== next.rooms[i]) || floors.some((f, i) => f !== next.floors[i]);
  return changed ? { ...next, openings, rooms, floors } : doc;
}

/** The rule moved `along` metres toward the wall's end; one without a distance is measured from the start. */
function slid(rule: PositionRule, along: number, start: number): PositionRule {
  if (rule.kind === 'fromStart') return { ...rule, distance: rule.distance + along };
  if (rule.kind === 'fromEnd') return { ...rule, distance: rule.distance - along };
  if (rule.kind === 'fromOpening') return { ...rule, distance: rule.distance + (rule.toward === 'end' ? along : -along) };
  return hasDistance(rule) ? rule : { kind: 'fromStart', distance: start + along };
}
