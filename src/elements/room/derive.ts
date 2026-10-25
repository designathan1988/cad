// A room's outline: the empty space around its point, bounded by the walls of its level. The wall
// pieces of the level are united (polyclip-ts) and the hole of the union that holds the point is the
// room. Wall pieces are taken before doors and windows are cut, so a door does not open the room.
// A point in no hole (outside the walls, or inside a wall) is "not enclosed", as Revit says.

import { setPrecision, union } from 'polyclip-ts';
import type { Point2 } from '../../core/vector';
import type { Floor, FloorId, Room, RoomId } from './schema';

export interface RoomSolid {
  readonly room: Room;
  readonly enclosed: boolean;
  /** Counter-clockwise outline, or [] when not enclosed. */
  readonly outline: readonly Point2[];
  readonly area: number;
  readonly perimeter: number;
  /** Where its name goes: the middle of the room as it is now (labelPoint), or its point when not enclosed. */
  readonly label: Point2;
  /**
   * The other rooms of the same space (two points in one hole, after a dividing wall was moved or
   * deleted): one name went over the other and was never seen. Empty for a room alone in its space.
   */
  readonly sharing: readonly RoomId[];
}

export interface FloorSolid {
  readonly floor: Floor;
  readonly outline: readonly Point2[];
  readonly area: number;
  readonly bottom: number;
  readonly top: number;
}

export interface RoomWarning {
  readonly kind: 'roomNotEnclosed' | 'roomShared';
  readonly roomId: RoomId;
}

type Ring = [number, number][];

export function signedArea(ring: readonly Point2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

const perimeterOf = (ring: readonly Point2[]): number =>
  ring.reduce((s, a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    return s + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);

export function insideRing(ring: readonly Point2[], p: Point2): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const toRing = (poly: readonly Point2[]): Ring => poly.map((p) => [p.x, p.y]);
const fromRing = (r: Ring): Point2[] => {
  const pts = r.map(([x, y]) => ({ x, y }));
  // polyclip closes its rings: drop the repeated first point.
  const last = pts[pts.length - 1];
  if (last && pts.length > 1 && last.x === pts[0]!.x && last.y === pts[0]!.y) pts.pop();
  return pts;
};

// Neighbouring wall pieces share their edges up to the last bits of a float. Without a tolerance the
// union leaves hair-thin channels along those seams, and a room's outline runs out along them.
setPrecision(1e-9);

const cache = new Map<string, Point2[][]>();

/** Holes of the union of a level's wall pieces, memoised on the pieces themselves. */
/**
 * Where a room's name goes (derived, never stored): the point inside the outline farthest from its
 * edges, to 5 mm, as Mapbox's polylabel finds it. Centred in a rectangle, and inside an L or a U,
 * where the centroid can fall outside. Cells over the outline are split while one could still hold a
 * farther point.
 */
export function labelPoint(ring: readonly Point2[]): Point2 {
  const PRECISION = 0.005;
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const size = Math.min(x1 - x0, y1 - y0);
  if (!(size > 0)) return ring[0] ?? { x: 0, y: 0 };
  // Distance to the nearest edge, negative outside.
  const reach = (p: Point2) => {
    let d = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
      d = Math.min(d, Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t));
    }
    return insideRing(ring, p) ? d : -d;
  };
  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, h: number): Cell => {
    const d = reach({ x, y });
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };
  const queue: Cell[] = [];
  for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) queue.push(cell(x + size / 2, y + size / 2, size / 2));
  // The area's centroid first: in a room with many equally good points (any rectangle) the name
  // stays in its middle, and another point wins only by more than the precision.
  const a2 = signedArea(ring) * 6;
  const centroid = ring.reduce(
    (c, p, i) => {
      const q = ring[(i + 1) % ring.length]!;
      const f = p.x * q.y - q.x * p.y;
      return { x: c.x + ((p.x + q.x) * f) / a2, y: c.y + ((p.y + q.y) * f) / a2 };
    },
    { x: 0, y: 0 },
  );
  let best = a2 !== 0 ? cell(centroid.x, centroid.y, 0) : cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
  while (queue.length > 0) {
    let k = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i]!.max > queue[k]!.max) k = i;
    const c = queue.splice(k, 1)[0]!;
    if (c.d > best.d + PRECISION) best = c;
    if (c.max - best.d <= PRECISION) continue;
    const h = c.h / 2;
    queue.push(cell(c.x - h, c.y - h, h), cell(c.x + h, c.y - h, h), cell(c.x - h, c.y + h, h), cell(c.x + h, c.y + h, h));
  }
  return { x: best.x, y: best.y };
}

function holesOf(pieces: readonly (readonly Point2[])[]): Point2[][] {
  if (pieces.length === 0) return [];
  const key = JSON.stringify(pieces);
  const hit = cache.get(key);
  if (hit) return hit;
  const [first, ...rest] = pieces.map((p) => [toRing(p)]);
  const holes = union(first!, ...rest).flatMap((poly) => poly.slice(1).map(fromRing));
  if (cache.size > 64) cache.clear();
  cache.set(key, holes);
  return holes;
}

export function deriveRooms(
  rooms: readonly Room[],
  piecesByLevel: ReadonlyMap<string, readonly (readonly Point2[])[]>,
): { solids: Map<RoomId, RoomSolid>; warnings: RoomWarning[] } {
  const solids = new Map<RoomId, RoomSolid>();
  const warnings: RoomWarning[] = [];
  // Rooms by the hole they are in (the same array from holesOf for one level).
  const spaces = new Map<string, RoomId[]>();
  for (const room of rooms) {
    const holes = holesOf(piecesByLevel.get(room.levelId) ?? []);
    // The smallest hole holding the point: holes do not overlap, but stay safe if one is nested.
    const hole = holes
      .filter((h) => insideRing(h, room.seed))
      .sort((a, b) => Math.abs(signedArea(a)) - Math.abs(signedArea(b)))[0];
    if (!hole) {
      solids.set(room.id, { room, enclosed: false, outline: [], area: 0, perimeter: 0, label: room.seed, sharing: [] });
      warnings.push({ kind: 'roomNotEnclosed', roomId: room.id });
      continue;
    }
    const outline = signedArea(hole) < 0 ? [...hole].reverse() : hole;
    solids.set(room.id, { room, enclosed: true, outline, area: Math.abs(signedArea(outline)), perimeter: perimeterOf(outline), label: labelPoint(outline), sharing: [] });
    const key = `${room.levelId}|${JSON.stringify(hole)}`;
    spaces.set(key, [...(spaces.get(key) ?? []), room.id]);
  }
  for (const ids of spaces.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      solids.set(id, { ...solids.get(id)!, sharing: ids.filter((x) => x !== id) });
      warnings.push({ kind: 'roomShared', roomId: id });
    }
  }
  return { solids, warnings };
}

export function deriveFloors(
  floors: readonly Floor[],
  rooms: ReadonlyMap<RoomId, RoomSolid>,
  elevation: (levelId: string) => number,
): Map<FloorId, FloorSolid> {
  const out = new Map<FloorId, FloorSolid>();
  for (const floor of floors) {
    const raw = floor.source.kind === 'room' ? (rooms.get(floor.source.roomId)?.outline ?? []) : floor.source.points;
    const outline = signedArea(raw) < 0 ? [...raw].reverse() : [...raw];
    const top = elevation(floor.levelId) + floor.offset;
    out.set(floor.id, { floor, outline, area: Math.abs(signedArea(outline)), bottom: top - floor.thickness, top });
  }
  return out;
}
