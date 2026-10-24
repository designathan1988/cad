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
}

export interface FloorSolid {
  readonly floor: Floor;
  readonly outline: readonly Point2[];
  readonly area: number;
  readonly bottom: number;
  readonly top: number;
}

export interface RoomWarning {
  readonly kind: 'roomNotEnclosed';
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
  for (const room of rooms) {
    const holes = holesOf(piecesByLevel.get(room.levelId) ?? []);
    // The smallest hole holding the point: holes do not overlap, but stay safe if one is nested.
    const hole = holes
      .filter((h) => insideRing(h, room.seed))
      .sort((a, b) => Math.abs(signedArea(a)) - Math.abs(signedArea(b)))[0];
    if (!hole) {
      solids.set(room.id, { room, enclosed: false, outline: [], area: 0, perimeter: 0 });
      warnings.push({ kind: 'roomNotEnclosed', roomId: room.id });
      continue;
    }
    const outline = signedArea(hole) < 0 ? [...hole].reverse() : hole;
    solids.set(room.id, { room, enclosed: true, outline, area: Math.abs(signedArea(outline)), perimeter: perimeterOf(outline) });
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
