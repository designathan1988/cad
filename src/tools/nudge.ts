// Moving the selection from the keyboard by a small step (ref/chat.txt:242): walls move with their
// joins (and the rooms they surround), doors and windows slide along their wall by the part of the
// step along it, a room's point, an outline floor and a guide move. One document out, for one undo step.

import { wallsOnGrids } from '../elements/grid/carry';
import { moveRooms, roomsGoingWith } from '../app/carry';
import type { Doc } from '../app/document';
import { type DerivedGeometry, hostsIn } from '../app/geometry';
import { dot, normalize, type Point2, sub } from '../model/vector';
import { detachedFrom } from '../elements/opening/commands';
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

export function nudge(doc0: Doc, g: DerivedGeometry, ids: readonly string[], step: Point2): Doc {
  // An opening moved alone: what was measured from it is held by its wall instead, and stays (commands.ts).
  const doc = ids.reduce((d, id) => {
    const openings = detachedFrom(d, id);
    return openings === d.openings ? d : { ...d, openings };
  }, doc0);
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
  const changed = next !== doc || openings.some((o, i) => o !== next.openings[i]);
  // The registry's elements (rooms, columns, beams, roofs, stairs, guardrails, texts, axes, guides,
  // outline floors, a dimension's free ends) by their own move; a room gone with its walls not again.
  const own = new Set([...set].filter((id) => !carried.has(id)));
  return moveKinds(changed ? { ...next, openings } : doc, own, step);
}

/** The rule moved `along` metres toward the wall's end; one without a distance is measured from the start. */
function slid(rule: PositionRule, along: number, start: number): PositionRule {
  if (rule.kind === 'fromStart') return { ...rule, distance: rule.distance + along };
  if (rule.kind === 'fromEnd') return { ...rule, distance: rule.distance - along };
  if (rule.kind === 'fromOpening') return { ...rule, distance: rule.distance + (rule.toward === 'end' ? along : -along) };
  return hasDistance(rule) ? rule : { kind: 'fromStart', distance: start + along };
}
