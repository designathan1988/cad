// Plan bands of a straight wall. The exterior face is on the right of the drawing direction.

import { add, distance, dot, normalize, perp, type Point2, scale, sub } from '../../../core/vector';
import type { Wall, WallEnd } from '../schema';
import type { ConvexPolygon } from './convex';

export interface Line {
  readonly point: Point2;
  readonly direction: Point2;
}

export const wallDirection = (wall: Wall): Point2 => normalize(sub(wall.end, wall.start));
export const wallNormal = (wall: Wall): Point2 => perp(wallDirection(wall));
export const wallLength = (wall: Wall): number => distance(wall.start, wall.end);

/** Offsets of the two faces along the normal, smaller first. */
export function faceOffsets(wall: Wall): readonly [number, number] {
  const t = wall.thickness;
  switch (wall.referenceLine) {
    case 'centerline':
      return [-t / 2, t / 2];
    case 'exteriorFace':
      return [0, t];
    case 'interiorFace':
      return [-t, 0];
  }
}

export const endPoint = (wall: Wall, end: WallEnd): Point2 => (end === 'start' ? wall.start : wall.end);

/** Unit direction from the given end into the wall body. */
export function intoBody(wall: Wall, end: WallEnd): Point2 {
  const d = wallDirection(wall);
  return end === 'start' ? d : scale(d, -1);
}

export function faceLine(wall: Wall, offset: number): Line {
  return { point: add(wall.start, scale(wallNormal(wall), offset)), direction: wallDirection(wall) };
}

/** Signed distance of a point from the reference line, along the normal. */
export const offsetOf = (wall: Wall, p: Point2): number => dot(wallNormal(wall), sub(p, wall.start));

/** Position of a point along the wall, 0 at start. */
export const stationOf = (wall: Wall, p: Point2): number => dot(wallDirection(wall), sub(p, wall.start));

/** The wall's band, lengthened past each end by the given amounts so join cuts can trim it. */
export function strip(wall: Wall, extendStart: number, extendEnd: number): ConvexPolygon {
  const d = wallDirection(wall);
  const n = wallNormal(wall);
  const [o0, o1] = faceOffsets(wall);
  const s0 = sub(wall.start, scale(d, extendStart));
  const s1 = add(wall.end, scale(d, extendEnd));
  return [add(s0, scale(n, o0)), add(s1, scale(n, o0)), add(s1, scale(n, o1)), add(s0, scale(n, o1))];
}
