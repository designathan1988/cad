// Plan bands of a straight wall. The exterior face is on the right of the drawing direction.

import { add, distance, dot, normalize, perp, type Point2, scale, sub } from '../../../core/vector';
import type { WallEnd } from '../schema';
import type { ConvexPolygon } from './convex';
import type { WallShape } from './shape';

export interface Line {
  readonly point: Point2;
  readonly direction: Point2;
}

export const wallDirection = (wall: WallShape): Point2 => normalize(sub(wall.end, wall.start));
export const wallNormal = (wall: WallShape): Point2 => perp(wallDirection(wall));
export const wallLength = (wall: WallShape): number => distance(wall.start, wall.end);

/** Offsets of the exterior and interior faces along the normal, exterior (smaller) first. */
export function faceOffsets(wall: WallShape): readonly [number, number] {
  return [wall.layerOffsets[0]!, wall.layerOffsets[wall.layerOffsets.length - 1]!];
}

export const endPoint = (wall: WallShape, end: WallEnd): Point2 => (end === 'start' ? wall.start : wall.end);

/** Unit direction from the given end into the wall body. */
export function intoBody(wall: WallShape, end: WallEnd): Point2 {
  const d = wallDirection(wall);
  return end === 'start' ? d : scale(d, -1);
}

export function faceLine(wall: WallShape, offset: number): Line {
  return { point: add(wall.start, scale(wallNormal(wall), offset)), direction: wallDirection(wall) };
}

/** Signed distance of a point from the reference line, along the normal. */
export const offsetOf = (wall: WallShape, p: Point2): number => dot(wallNormal(wall), sub(p, wall.start));

/** Position of a point along the wall, 0 at start. */
export const stationOf = (wall: WallShape, p: Point2): number => dot(wallDirection(wall), sub(p, wall.start));

/**
 * The band between two offsets (by default the whole wall), lengthened past each end by the given
 * amounts so join cuts can trim it.
 */
export function strip(
  wall: WallShape,
  extendStart: number,
  extendEnd: number,
  [o0, o1]: readonly [number, number] = faceOffsets(wall),
): ConvexPolygon {
  const d = wallDirection(wall);
  const n = wallNormal(wall);
  const s0 = sub(wall.start, scale(d, extendStart));
  const s1 = add(wall.end, scale(d, extendEnd));
  return [add(s0, scale(n, o0)), add(s1, scale(n, o0)), add(s1, scale(n, o1)), add(s0, scale(n, o1))];
}
