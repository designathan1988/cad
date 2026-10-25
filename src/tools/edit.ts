// Editing walls while keeping their joins (pure). Ends that met a moved end follow it, so corners
// stay closed; ends that abutted a moved wall's body slide along their own wall to stay on it, so Ts
// stay joined. Nothing here touches geometry beyond the reference lines: the join engine redoes the rest.

import type { Doc, DocWall } from '../app/document';
import { POINT_TOLERANCE } from '../core/tolerance';
import { add, cross, distance, dot, intersectLines, normalize, type Point2, scale, sub } from '../core/vector';
import type { ReferenceLine, WallEnd, WallId } from '../elements/wall/schema';
import { exteriorOffset } from '../elements/wall/geometry/shape';
import { arcOf } from '../elements/wall/geometry/arc';
import { wallThickness } from '../app/document';

type Ends = { start: Point2; end: Point2 };

/** Whether p lies on the segment a–b, away from its ends. */
function onBody(p: Point2, a: Point2, b: Point2): boolean {
  const len = distance(a, b);
  if (len === 0) return false;
  const u = normalize(sub(b, a));
  const t = dot(sub(p, a), u);
  return t > POINT_TOLERANCE && t < len - POINT_TOLERANCE && Math.abs(cross(u, sub(p, a))) <= POINT_TOLERANCE;
}

/**
 * New positions for every wall after the walls in `moved` take their new ends. The others keep
 * their joins: an end at a moved wall's old end goes where `map` takes that end; an end on a moved
 * wall's body slides along its own line to the moved wall's new line.
 */
function follow(walls: readonly DocWall[], moved: ReadonlyMap<WallId, Ends>, map: (p: Point2) => Point2): DocWall[] {
  return walls.map((w) => {
    const target = moved.get(w.id);
    if (target) return { ...w, ...target };
    const fix = (p: Point2, other: Point2): Point2 => {
      for (const [id] of moved) {
        const before = walls.find((x) => x.id === id)!;
        if (distance(p, before.start) <= POINT_TOLERANCE) return map(before.start);
        if (distance(p, before.end) <= POINT_TOLERANCE) return map(before.end);
      }
      for (const [id, next] of moved) {
        const before = walls.find((x) => x.id === id)!;
        if (!onBody(p, before.start, before.end)) continue;
        const hit = intersectLines(other, sub(p, other), next.start, sub(next.end, next.start));
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
 * its layers on the mirrored side (a mirror turns a wall's left into its right).
 */
export function transformWalls(doc: Doc, ids: readonly WallId[], map: (p: Point2) => Point2, swap = false): DocWall[] {
  const set = new Set(ids);
  const moved = new Map<WallId, Ends>();
  for (const w of doc.walls) {
    if (!set.has(w.id)) continue;
    const start = map(w.start);
    const end = map(w.end);
    moved.set(w.id, swap ? { start: end, end: start } : { start, end });
  }
  return follow(doc.walls, moved, map);
}

export function moveWalls(doc: Doc, ids: readonly WallId[], delta: Point2): DocWall[] {
  return transformWalls(doc, ids, (p) => add(p, delta));
}

export function stretchEnd(doc: Doc, id: WallId, end: WallEnd, to: Point2): DocWall[] {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return [...doc.walls];
  const next = end === 'start' ? { start: to, end: w.end } : { start: w.start, end: to };
  // Only the corner at the dragged end follows; Ts on the body stay where they are along the host.
  const old = end === 'start' ? w.start : w.end;
  return doc.walls.map((x) => {
    if (x.id === id) return { ...x, ...next };
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
  return transformWalls(doc, [...set], turn);
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
    walls = transformWalls({ ...doc, walls }, [id], map).map((x) => (x.id === id ? { ...x, referenceLine: line } : x));
  }
  return [...walls];
}

/** Stretches an end along the wall's own line, to the foot of `cursor` on it: the direction stays. */
export function stretchAlong(doc: Doc, id: WallId, end: WallEnd, cursor: Point2): DocWall[] {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return [...doc.walls];
  const u = normalize(sub(w.end, w.start));
  const foot = add(w.start, scale(u, dot(sub(cursor, w.start), u)));
  return stretchEnd(doc, id, end, foot);
}
