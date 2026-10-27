// A room's outline: the empty space around its point, bounded by the walls of its level. The wall
// pieces of the level are united (polyclip-ts) and the hole of the union that holds the point is the
// room. Wall pieces are taken before doors and windows are cut, so a door does not open the room.
// A point in no hole (outside the walls, or inside a wall) is "not enclosed", as Revit says.

import { difference, setPrecision, union } from 'polyclip-ts';
import type { Point2 } from '../../core/vector';
import type { Floor, Room, RoomId } from './schema';
import type { Material } from '../material/schema';

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
  /** Its holes' outlines, wound against its outline. */
  readonly holes: readonly (readonly Point2[])[];
  /** A sloped slab: a point p is `k · (p·u − base)` above `top`. */
  readonly rise?: { readonly u: Point2; readonly base: number; readonly k: number };
  /** Its build-up's materials, layer by layer from the top (the kind reads them from the project). */
  readonly layerMaterials?: readonly Material[];
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

/**
 * An outline with holes less the `cuts` (a stair's well through a floor): the largest part that is left,
 * its holes with it, counter-clockwise outline and clockwise holes. Null when nothing is left.
 */
export function cutOut(
  outline: readonly Point2[],
  holes: readonly (readonly Point2[])[],
  cuts: readonly (readonly Point2[])[],
): { outline: Point2[]; holes: Point2[][] } | null {
  if (outline.length < 3) return null;
  const rest = difference([toRing(outline), ...holes.map(toRing)], ...cuts.map((c) => [toRing(c)]));
  const parts = rest.map((poly) => poly.map(fromRing)).filter((p) => p[0]!.length >= 3);
  if (parts.length === 0) return null;
  const best = parts.reduce((a, b) => (Math.abs(signedArea(b[0]!)) > Math.abs(signedArea(a[0]!)) ? b : a));
  const [out, ...inner] = best;
  return {
    outline: signedArea(out!) < 0 ? [...out!].reverse() : out!,
    holes: inner.filter((h) => h.length >= 3).map((h) => (signedArea(h) > 0 ? [...h].reverse() : h)),
  };
}

/** Parts smaller than this (m²) are slivers along shared edges, not space. */
const SLIVER = 0.05;

/**
 * The middle (labelPoint) of the largest part of `ring` that is in none of `taken`: where a room whose
 * space a moved wall gave to another room can go, in what is left of its space. Null when nothing is.
 */
export function middleOfRest(ring: readonly Point2[], taken: readonly (readonly Point2[])[]): Point2 | null {
  if (ring.length < 3) return null;
  const rest = taken.length === 0 ? [[toRing(ring)]] : difference([toRing(ring)], ...taken.map((t) => [toRing(t)]));
  const parts = rest.map((poly) => fromRing(poly[0]!)).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > SLIVER);
  if (parts.length === 0) return null;
  return labelPoint(parts.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a)));
}

/** The spaces walls close in on a level (the holes of its pieces' union), counter-clockwise: where a room can go. */
export const spacesOf = (pieces: readonly (readonly Point2[])[]): Point2[][] => holesOf(pieces).map((h) => (signedArea(h) < 0 ? [...h].reverse() : h));

/** Holes of the union of a level's wall pieces, memoised on the pieces themselves. */
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

/** A floor as built: its outline (its room's, or its own) wound counter-clockwise, its holes, area and heights. */
export function deriveFloor(floor: Floor, rooms: ReadonlyMap<RoomId, RoomSolid>, elevation: (levelId: string) => number): FloorSolid {
  const raw = floor.source.kind === 'room' ? (rooms.get(floor.source.roomId)?.outline ?? []) : floor.source.points;
  const outline = signedArea(raw) < 0 ? [...raw].reverse() : [...raw];
  const top = elevation(floor.levelId) + floor.offset;
  // Holes the other way round from the outline, as a shape with holes is traced.
  const holes = (floor.holes ?? []).filter((h) => h.length >= 3).map((h) => (signedArea(h) > 0 ? [...h].reverse() : [...h]));
  const area = Math.abs(signedArea(outline)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
  // Rising from its lowest corner: how far up each point of it is.
  let rise: FloorSolid['rise'];
  if (floor.slope && floor.slope.grade !== 0 && outline.length >= 3) {
    const u = { x: Math.cos(floor.slope.dir), y: Math.sin(floor.slope.dir) };
    const base = Math.min(...outline.map((p) => p.x * u.x + p.y * u.y));
    rise = { u, base, k: floor.slope.grade / 100 };
  }
  return { floor, outline, holes, area: Math.max(0, area), bottom: top - floor.thickness, top, ...(rise ? { rise } : {}) };
}

/** How far above its `top` a sloped floor is at p (0 for a flat one). */
export const riseAt = (f: FloorSolid, p: Point2): number => (f.rise ? f.rise.k * (p.x * f.rise.u.x + p.y * f.rise.u.y - f.rise.base) : 0);
