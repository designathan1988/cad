// Editing walls while keeping their joins (pure). Ends that met a moved end follow it, so corners
// stay closed (along their own lines in a move); ends that abutted a moved wall's body
// slide along their own wall to stay on it, so Ts stay joined, and so do a moved wall's own ends on
// another's body. Nothing here touches geometry beyond the reference lines: the join engine redoes the rest.

import type { Doc, DocWall } from '../../project/doc';
import { MIN_WALL_LENGTH, POINT_TOLERANCE } from '../../model/tolerance';
import { add, cross, distance, dot, intersectLines, normalize, type Point2, scale, sub } from '../../model/vector';
import type { ReferenceLine, WallEnd, WallId } from './schema';
import { exteriorOffset } from './geometry/shape';
import { arcOf } from './geometry/arc';
import { wallThickness } from '../../project/doc';
import type { LevelId } from '../../project/doc';
import type { WallTypeId } from './schema';

type Ends = { start: Point2; end: Point2 };

/** Whether p lies on the segment a–b, away from its ends. */
function onBody(p: Point2, a: Point2, b: Point2): boolean {
  const len = distance(a, b);
  if (len === 0) return false;
  const u = normalize(sub(b, a));
  const t = dot(sub(p, a), u);
  return t > POINT_TOLERANCE && t < len - POINT_TOLERANCE && Math.abs(cross(u, sub(p, a))) <= POINT_TOLERANCE;
}

/** Sines below this: two lines too near parallel for a corner to go where they meet. */
const NEAR_PARALLEL = 0.05;

/** Where the line through p along u meets the line through q along v; null when they are about parallel. */
export function meet(p: Point2, u: Point2, q: Point2, v: Point2): Point2 | null {
  if (Math.abs(cross(normalize(u), normalize(v))) < NEAR_PARALLEL) return null;
  return intersectLines(p, u, q, v);
}

/** How far an end may slide along its own line to follow a moved wall: this many times the move itself. */
const SLIDE_LIMIT = 4;

/**
 * Where an end p, sliding along its own line (from `other` through p), meets a wall's new line `next`;
 * null when the lines are about parallel (meet) or the meeting lies further from p than SLIDE_LIMIT
 * times `moveBy`, the wall's own move: two walls almost in line meet kilometres away (an end of one sent
 * to 10¹⁴ m when the other moved 0.7 m), and the end must not go there. The one test for every slide.
 */
function slideOnto(p: Point2, other: Point2, next: Ends, moveBy: number): Point2 | null {
  const hit = meet(other, sub(p, other), next.start, sub(next.end, next.start));
  return hit && distance(hit, p) <= SLIDE_LIMIT * moveBy + POINT_TOLERANCE ? hit : null;
}

/** How far a wall went: the larger of its two ends' moves. */
const movedBy = (was: Ends, now: Ends): number => Math.max(distance(was.start, now.start), distance(was.end, now.end));

/** Whether q is on the line through a and b: a corner taken there tilts nothing, and stays exact. */
const onLine = (q: Point2, a: Point2, b: Point2): boolean => Math.abs(cross(normalize(sub(b, a)), sub(q, a))) <= POINT_TOLERANCE;

/**
 * Whether a wall taken from `was` to `now` kept its direction (a move): only then do its corners keep
 * the joins' lines. Turned, its new line meets a left-behind wall's line anywhere: a box turned a
 * quarter about the origin, with a wall joined at its corner (4, 0) left behind along x, had that
 * corner go to (0, 0), and the box's bottom wall shrank to nothing.
 */
function keptDirection(was: Ends, now: Ends): boolean {
  const u = normalize(sub(was.end, was.start));
  const v = normalize(sub(now.end, now.start));
  return Math.abs(cross(u, v)) <= 1e-9 && dot(u, v) > 0;
}

/**
 * New positions for every wall after the walls in `moved` take their new ends. The others keep
 * their joins: an end at a moved wall's old end goes where `map` takes that end, or, with `lines`,
 * along its own line to the moved wall's new line (its direction kept); an end on a moved wall's body
 * slides along its own line to the moved wall's new line.
 */
function follow(walls: readonly DocWall[], moved: ReadonlyMap<WallId, Ends>, map: (p: Point2) => Point2, lines: boolean): DocWall[] {
  // The moved walls as they were, with their new ends, found once: looked up by a scan of every wall per
  // end of every other wall, a drag of many walls on a large plan stuttered.
  const byId = new Map(walls.map((w) => [w.id, w]));
  const movedWalls = [...moved].map(([id, next]) => ({ before: byId.get(id)!, next }));
  return walls.map((w) => {
    const target = moved.get(w.id);
    if (target) return { ...w, ...target };
    const fix = (p: Point2, other: Point2): Point2 => {
      let corner: Point2 | null = null;
      for (const { before, next } of movedWalls) {
        // Joins are within a level: a wall below with its end under a moved one's stays.
        if (before.levelId !== w.levelId) continue;
        const end = distance(p, before.start) <= POINT_TOLERANCE ? before.start : distance(p, before.end) <= POINT_TOLERANCE ? before.end : null;
        if (!end) continue;
        const mapped = map(end);
        const hit =
          lines && keptDirection(before, next) && !w.bulge && !before.bulge && !onLine(mapped, other, p)
            ? slideOnto(p, other, next, movedBy(before, next))
            : null;
        if (hit) return hit;
        corner ??= mapped;
      }
      if (corner) return corner;
      for (const { before, next } of movedWalls) {
        if (before.levelId !== w.levelId || !onBody(p, before.start, before.end)) continue;
        // Too near parallel, or too far along: the end stays where it is rather than fly off.
        const hit = slideOnto(p, other, next, movedBy(before, next));
        if (hit) return hit;
      }
      return p;
    };
    const start = fix(w.start, w.end);
    const end = fix(w.end, w.start);
    return start === w.start && end === w.end ? w : { ...w, start, end };
  });
}

/**
 * Every wall after those in `ids` are taken by `map` (a move, a turn, a scale or a mirror), the others
 * keeping their joins. `swap`: the moved walls' ends trade places, as a mirror needs so each wall keeps
 * its layers on the mirrored side (a mirror turns a wall's left into its right). `rigid` (a move or a
 * turn): a moved wall's end on another's body stays on it (keepOnHosts), and the joins of a wall that
 * kept its direction keep their lines, as Revit's do: a corner with a wall left behind goes where the
 * two lines meet now, that wall keeping its direction. Taken by the pointer as it was, a hand that
 * drifted 1 cm along the wall tilted the walls at its corners, and the whole outline of a house came
 * out askew. A turned wall takes its corners along (keptDirection).
 */
export function transformWalls(doc: Doc, ids: readonly WallId[], map: (p: Point2) => Point2, swap = false, rigid = false): DocWall[] {
  const set = new Set(ids);
  const moved = new Map<WallId, Ends>();
  for (const w of doc.walls) {
    if (!set.has(w.id)) continue;
    const start = map(w.start);
    const end = map(w.end);
    moved.set(w.id, swap ? { start: end, end: start } : { start, end });
  }
  if (!rigid) return follow(doc.walls, moved, map, false);
  // The straight walls left behind, by level: what a moved end's corner can be with.
  const behind = new Map<string, DocWall[]>();
  for (const o of doc.walls) {
    if (set.has(o.id) || o.bulge) continue;
    const list = behind.get(o.levelId);
    if (list) list.push(o);
    else behind.set(o.levelId, [o]);
  }
  for (const w of doc.walls) {
    const next = moved.get(w.id);
    if (!next || w.bulge || !keptDirection(w, next)) continue;
    // A moved end at a corner with a wall left behind: where its new line meets that wall's line.
    const corner = (p: Point2, mapped: Point2): Point2 | null => {
      for (const o of behind.get(w.levelId) ?? []) {
        const far = distance(o.start, p) <= POINT_TOLERANCE ? o.end : distance(o.end, p) <= POINT_TOLERANCE ? o.start : null;
        if (!far || onLine(mapped, far, p)) continue;
        const hit = slideOnto(p, far, next, movedBy(w, next));
        if (hit) return hit;
      }
      return null;
    };
    const start = corner(w.start, next.start);
    const end = corner(w.end, next.end);
    if (start || end) moved.set(w.id, { start: start ?? next.start, end: end ?? next.end });
  }
  return keepOnHosts(doc, ids, follow(doc.walls, moved, map, true));
}

/**
 * A move or a turn keeps the Ts of the moved walls too: an end of one that met another wall's body (within its
 * thickness, away from its ends) slides along its own wall's new line to stay as far from that wall's
 * line as it was, while that is still along that wall. Moved free, a partition between two walls taken
 * with a hand that drifted 5 mm along it came off one of them, and the two rooms it divided became
 * one; turned, it came off both. `walls`: every wall after the move or the turn, in `doc`'s order.
 */
function keepOnHosts(doc: Doc, ids: readonly WallId[], walls: readonly DocWall[]): DocWall[] {
  const set = new Set(ids);
  const hosts = doc.walls.filter((h) => !set.has(h.id) && !h.bulge && distance(h.start, h.end) > 0);
  return walls.map((w, i) => {
    const was = doc.walls[i]!;
    if (!set.has(w.id) || w.bulge) return w;
    const along = sub(w.end, w.start);
    const keep = (from: Point2, to: Point2): Point2 => {
      for (const h of hosts) {
        if (h.levelId !== w.levelId) continue;
        const len = distance(h.start, h.end);
        const u = normalize(sub(h.end, h.start));
        const t = dot(sub(from, h.start), u);
        if (t <= POINT_TOLERANCE || t >= len - POINT_TOLERANCE || Math.abs(cross(u, sub(from, h.start))) > wallThickness(doc, h) + POINT_TOLERANCE) continue;
        // Its own line about parallel to the host's: no meeting to keep (meet's guard, as every slide).
        const hit = meet(to, along, from, u);
        if (!hit) continue;
        const s = dot(sub(hit, h.start), u);
        if (s > POINT_TOLERANCE && s < len - POINT_TOLERANCE) return hit;
      }
      return to;
    };
    const start = keep(was.start, w.start);
    const end = keep(was.end, w.end);
    return start === w.start && end === w.end ? w : { ...w, start, end };
  });
}

export function moveWalls(doc: Doc, ids: readonly WallId[], delta: Point2): DocWall[] {
  return transformWalls(doc, ids, (p) => add(p, delta), false, true);
}

export function stretchEnd(doc: Doc, id: WallId, end: WallEnd, to: Point2): DocWall[] {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return [...doc.walls];
  const next = end === 'start' ? { start: to, end: w.end } : { start: w.start, end: to };
  // Onto its other end: a wall of no length, refused (it stays as it was).
  if (distance(next.start, next.end) < MIN_WALL_LENGTH) return [...doc.walls];
  // Only the corner at the dragged end follows; Ts on the body stay where they are along the host.
  const old = end === 'start' ? w.start : w.end;
  return doc.walls.map((x) => {
    if (x.id === id) return { ...x, ...next };
    // A wall of another level with an end under this one is not joined to it: it stays.
    if (x.levelId !== w.levelId) return x;
    const s = distance(x.start, old) <= POINT_TOLERANCE ? to : x.start;
    const e = distance(x.end, old) <= POINT_TOLERANCE ? to : x.end;
    return s === x.start && e === x.end ? x : { ...x, start: s, end: e };
  });
}

/** Turns the walls about a point by an angle (radians, counter-clockwise); joins kept as for a move. */
export function rotateWalls(doc: Doc, ids: readonly WallId[], pivot: Point2, angle: number): DocWall[] {
  const set = new Set(ids);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const turn = (p: Point2): Point2 => {
    const d = sub(p, pivot);
    return add(pivot, { x: d.x * c - d.y * s, y: d.x * s + d.y * c });
  };
  return transformWalls(doc, [...set], turn, false, true);
}

/**
 * The walls in `ids` on another reference line, their bodies where they were, as Revit's and ArchiCAD's
 * do: each line moves across by the difference between where the old and the new line leave the
 * exterior face (an arc's line takes another radius about the same centre), and the walls joined to
 * it keep their joins, as for a move. Before, only the field changed and the body jumped across.
 */
export function changeReferenceLine(doc: Doc, ids: readonly WallId[], line: ReferenceLine): DocWall[] {
  let walls: readonly DocWall[] = doc.walls;
  for (const id of ids) {
    const w = walls.find((x) => x.id === id);
    if (!w || w.referenceLine === line) continue;
    const t = wallThickness(doc, w);
    // The new line, this far along the left normal from the old one, leaves the faces where they are.
    const shift = exteriorOffset(w.referenceLine, t) - exteriorOffset(line, t);
    walls = shiftWall({ ...doc, walls }, w, shift).map((x) => (x.id === id ? { ...x, referenceLine: line } : x));
  }
  return [...walls];
}

/** The wall's line moved across, this far along its left normal; the walls joined to it keep their joins. */
function shiftWall(doc: Doc, w: DocWall, shift: number): readonly DocWall[] {
  if (Math.abs(shift) < 1e-12) return doc.walls;
  const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
  let map: (p: Point2) => Point2;
  if (arc) {
    // Offset o along the left normal is radius r − turn·o: the line's radius changes, its centre stays.
    const k = (arc.radius - arc.turn * shift) / arc.radius;
    map = (p) => add(arc.center, scale(sub(p, arc.center), k));
  } else {
    const u = normalize(sub(w.end, w.start));
    map = (p) => add(p, scale({ x: -u.y, y: u.x }, shift));
  }
  return transformWalls(doc, [w.id], map);
}

/** Which of a wall's faces stays where it is when its type changes: null, its reference line does. */
export type KeptFace = 'exterior' | 'interior' | 'middle' | null;

/**
 * The walls in `ids` of another type, each with the face `kept` names left where it was: the room's
 * side, so the room keeps its clear size ("manter o vão livre", docs/plano-de-escopo.md, diferenciais,
 * 3), its middle between two rooms, which share the change. The line moves across by the difference,
 * the walls joined to it keep their joins, as for a move; its reference line stays the same kind.
 */
export function changeWallType(doc: Doc, ids: readonly WallId[], typeId: WallTypeId, kept: (w: DocWall) => KeptFace): DocWall[] {
  let walls: readonly DocWall[] = doc.walls;
  const type = doc.wallTypes.find((x) => x.id === typeId);
  if (!type) return [...walls];
  const t1 = type.layers.reduce((s, l) => s + l.thickness, 0);
  for (const id of ids) {
    const w = walls.find((x) => x.id === id);
    if (!w || w.wallTypeId === typeId) continue;
    const t0 = wallThickness(doc, w);
    const face = t0 > 0 ? kept(w) : null;
    // Across the left normal the body runs from its exterior face, e, to its interior face, e + t.
    const e0 = exteriorOffset(w.referenceLine, t0);
    const e1 = exteriorOffset(w.referenceLine, t1);
    const shift = face === 'exterior' ? e0 - e1 : face === 'interior' ? e0 + t0 - (e1 + t1) : face === 'middle' ? e0 + t0 / 2 - (e1 + t1 / 2) : 0;
    walls = shiftWall({ ...doc, walls }, w, shift).map((x) => (x.id === id ? { ...x, wallTypeId: typeId } : x));
  }
  return [...walls];
}

/**
 * The face of a wall a room is against, from where the enclosed rooms of its level are: just past
 * each face, at a quarter, the middle and three quarters of its length. A room on one side: that
 * face; on both (a partition): its middle; on neither: null, its reference line.
 */
export function roomFace(doc: Doc, w: DocWall, inRoom: (levelId: LevelId, p: Point2) => boolean): KeptFace {
  const t = wallThickness(doc, w);
  const e = exteriorOffset(w.referenceLine, t);
  const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
  // A point of the reference line and its left normal, at a fraction of the wall's length.
  const at = (f: number): { p: Point2; n: Point2 } => {
    if (arc) {
      const a = arc.startAngle + arc.sweep * f;
      const r = { x: Math.cos(a), y: Math.sin(a) };
      return { p: add(arc.center, scale(r, arc.radius)), n: scale(r, -arc.turn) };
    }
    const u = normalize(sub(w.end, w.start));
    return { p: add(w.start, scale(sub(w.end, w.start), f)), n: { x: -u.y, y: u.x } };
  };
  const past = 0.05;
  let exterior = false;
  let interior = false;
  for (const f of [0.25, 0.5, 0.75]) {
    const { p, n } = at(f);
    if (inRoom(w.levelId, add(p, scale(n, e - past)))) exterior = true;
    if (inRoom(w.levelId, add(p, scale(n, e + t + past)))) interior = true;
  }
  return exterior && interior ? 'middle' : interior ? 'interior' : exterior ? 'exterior' : null;
}

/** Stretches an end along the wall's own line, to the foot of `cursor` on it: the direction stays. */
export function stretchAlong(doc: Doc, id: WallId, end: WallEnd, cursor: Point2): DocWall[] {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return [...doc.walls];
  const u = normalize(sub(w.end, w.start));
  const foot = add(w.start, scale(u, dot(sub(cursor, w.start), u)));
  return stretchEnd(doc, id, end, foot);
}
