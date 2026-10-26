// Moving the selection from the keyboard by a small step (ref/chat.txt:242): walls move with their
// joins (and the rooms they surround), doors and windows slide along their wall by the part of the
// step along it, a room's point, an outline floor and a guide move. One document out, for one undo step.

import { wallsOnGrids } from '../elements/grid/carry';
import type { DimAnchor } from '../elements/dimension/schema';
import { moveFloors, moveRooms, roomsGoingWith } from '../app/carry';
import type { Doc } from '../app/document';
import { type DerivedGeometry, hostsIn } from '../app/geometry';
import { dot, normalize, type Point2, sub } from '../core/vector';
import { deriveOpenings } from '../elements/opening/derive';
import { hasDistance, type PositionRule } from '../elements/opening/schema';
import { moveKinds } from '../elements/registry';
import { moveWalls } from './edit';

/** The step of an arrow key: 5 cm (the snap grid), 1 cm with Alt; up is +y. Null for other keys. */
export function arrowStep(key: string, fine: boolean): Point2 | null {
  const s = fine ? 0.01 : 0.05;
  const dirs: Record<string, Point2> = { ArrowLeft: { x: -s, y: 0 }, ArrowRight: { x: s, y: 0 }, ArrowUp: { x: 0, y: s }, ArrowDown: { x: 0, y: -s } };
  return dirs[key] ?? null;
}

export function nudge(doc: Doc, g: DerivedGeometry, ids: readonly string[], step: Point2): Doc {
  // The walls on a selected axis go with it.
  const set = new Set([...ids, ...wallsOnGrids(doc, ids)]);
  const wallIds = doc.walls.filter((w) => set.has(w.id)).map((w) => w.id);
  const movedWalls = new Set(wallIds);
  const moved = (p: Point2) => ({ x: p.x + step.x, y: p.y + step.y });
  // The rooms whose walls all move go along, once: a selected one among them is not moved again.
  const carried = wallIds.length > 0 ? roomsGoingWith(doc, g, movedWalls) : new Set<string>();
  let next: Doc = doc;
  if (wallIds.length > 0) next = { ...next, walls: moveWalls(doc, wallIds, step), rooms: moveRooms(doc.rooms, carried, moved) };
  // Openings on a moved wall go with it; the others slide along their own wall.
  const placed = deriveOpenings(doc.openings, hostsIn(doc), doc.openingGroups).placed;
  const openings = next.openings.map((o) => {
    // A member of a distributed group is placed by its group: the arrows leave it (move the wall).
    if (!set.has(o.id) || movedWalls.has(o.wallId) || o.rule.kind === 'inGroup') return o;
    const host = doc.walls.find((w) => w.id === o.wallId);
    const p = placed.get(o.id);
    if (!host || !p || host.bulge) return o;
    const along = dot(step, normalize(sub(host.end, host.start)));
    if (Math.abs(along) < 1e-12) return o;
    return { ...o, rule: slid(o.rule, along, p.start) };
  });
  const rooms = next.rooms.map((r) => (set.has(r.id) && !carried.has(r.id) ? { ...r, seed: moved(r.seed) } : r));
  const floors = moveFloors(next.floors, set, moved);
  const guides = next.guides.map((g) => (set.has(g.id) ? { ...g, point: moved(g.point) } : g));
  // A dimension's free ends go; an end held by a wall or an opening stays with it.
  const free = (a: DimAnchor): DimAnchor => (a.kind === 'point' ? { kind: 'point', at: moved(a.at) } : a);
  const dimensions = next.dimensions.map((d) => (set.has(d.id) && (d.a.kind === 'point' || d.b.kind === 'point') ? { ...d, a: free(d.a), b: free(d.b) } : d));
  const changed =
    next !== doc ||
    openings.some((o, i) => o !== next.openings[i]) ||
    rooms.some((r, i) => r !== next.rooms[i]) ||
    floors.some((f, i) => f !== next.floors[i]) ||
    guides.some((g, i) => g !== next.guides[i]) ||
    dimensions.some((d, i) => d !== next.dimensions[i]);
  // The registry's elements (columns, beams, roofs, stairs, guardrails, texts, axes) by their own move.
  return moveKinds(changed ? { ...next, openings, rooms, floors, guides, dimensions } : doc, set, step);
}

/** The rule moved `along` metres toward the wall's end; one without a distance is measured from the start. */
function slid(rule: PositionRule, along: number, start: number): PositionRule {
  if (rule.kind === 'fromStart') return { ...rule, distance: rule.distance + along };
  if (rule.kind === 'fromEnd') return { ...rule, distance: rule.distance - along };
  if (rule.kind === 'fromOpening') return { ...rule, distance: rule.distance + (rule.toward === 'end' ? along : -along) };
  return hasDistance(rule) ? rule : { kind: 'fromStart', distance: start + along };
}
