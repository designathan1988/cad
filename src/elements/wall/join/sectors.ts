// Walls meeting at one point beyond what a plain L, T or X covers (§7.6): three or more arms with no
// pair in line, more than four ends, walls crossing there, or an end on a crossing. Around the point,
// each two neighbouring arms meet on the line from the point to the corner their facing faces make,
// and each arm keeps the sector between its two lines. Neighbours take the two sides of one line, so
// nothing overlaps and nothing is left open: the faces meet at the corners and the cores in the
// middle, every layer of an arm clipped by the same half-planes. A wall passing the point is two arms,
// one each way. The passage-and-abutments rule (node.ts) left a Y with a gap where the third wall met
// the passage's corner, finishes inside the junction, and five or more walls square and overlapping.

import { COLLINEAR_ANGLE, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, cross, distance, dot, intersectLines, normalize, perp, type Point2, scale, sub, vec } from '../../../core/vector';
import { type HalfPlane, halfPlaneThrough } from '../geometry/convex';
import { faceLine, faceOffsets, intoBody, type Line, offsetOf, wallNormal } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import type { WallEnd } from '../schema';
import type { EndCut } from './types';

export interface SectorArm {
  /** A straight wall, or the part of one up to the point, with its `end` there. */
  readonly wall: WallShape;
  readonly end: WallEnd;
  /** How far from the point, along the arm, it goes: a corner past that would swallow it. */
  readonly reach: number;
}

const TAU = 2 * Math.PI;

/** The angle from u to v turning counter-clockwise, in [0, 2π). */
function ccw(u: Point2, v: Point2): number {
  const a = Math.atan2(cross(u, v), dot(u, v));
  return a < 0 ? a + TAU : a;
}

const rotate = (u: Point2, a: number): Point2 => vec(u.x * Math.cos(a) - u.y * Math.sin(a), u.x * Math.sin(a) + u.y * Math.cos(a));

/** The arm's face on the side `side` points to, across it. */
function faceToward(arm: SectorArm, side: Point2): Line {
  const [o0, o1] = faceOffsets(arm.wall);
  return faceLine(arm.wall, dot(wallNormal(arm.wall), side) > 0 ? o1 : o0);
}

/**
 * Each arm's cut, in the order given, or null when the point cannot be split exactly: two arms on top
 * of each other, a corner past an arm's far end, or thicknesses so unlike that a dividing line falls
 * outside the gap it divides. The caller then keeps the old rule and its warning.
 */
export function resolveSectors(arms: readonly SectorArm[], point: Point2): EndCut[] | null {
  const n = arms.length;
  if (n < 3) return null;
  const dirs = arms.map((a) => intoBody(a.wall, a.end));
  const order = arms.map((_, i) => i).sort((i, j) => Math.atan2(dirs[i]!.y, dirs[i]!.x) - Math.atan2(dirs[j]!.y, dirs[j]!.x));
  const limit = MITER_LIMIT * Math.max(...arms.map((a) => a.wall.thickness));
  const minGap = (COLLINEAR_ANGLE * Math.PI) / 180;

  // Each arm and the next one counter-clockwise: the angle between them and the corner their facing
  // faces make (none across a straight gap).
  const gaps: { a: number; b: number; gap: number; corner: Point2 | null }[] = [];
  for (let k = 0; k < n; k++) {
    const a = order[k]!;
    const b = order[(k + 1) % n]!;
    const gap = ccw(dirs[a]!, dirs[b]!);
    if (gap < minGap) return null;
    const fa = faceToward(arms[a]!, perp(dirs[a]!));
    const fb = faceToward(arms[b]!, scale(perp(dirs[b]!), -1));
    const straight = Math.abs(gap - Math.PI) < minGap;
    gaps.push({ a, b, gap, corner: straight ? null : intersectLines(fa.point, fa.direction, fb.point, fb.direction) });
  }

  /** The sectors around `centre`, each line from it through a corner. */
  const around = (centre: Point2): EndCut[] | null => {
    // The line between each arm and the next one counter-clockwise; a far outer corner is bevelled.
    const lines: { u: Point2; bevel: HalfPlane | null }[] = [];
    for (const { a, b, gap, corner } of gaps) {
      const da = dirs[a]!;
      const db = dirs[b]!;
      let c = corner;
      // Nearly in line with other faces, the corner flies off and the line would be a long taper:
      // across at the centre instead, a step, as an L does.
      if (c !== null && gap >= Math.PI / 2 && gap <= Math.PI && distance(c, centre) > limit) c = null;
      let u: Point2;
      if (c === null) u = rotate(da, gap / 2);
      else if (distance(c, centre) <= POINT_TOLERANCE) u = rotate(da, gap / 2);
      else u = normalize(sub(c, centre));
      const at = ccw(da, u);
      if (!(at > 0 && at < gap)) return null;
      let bevel: HalfPlane | null = null;
      if (c !== null) {
        // A corner ahead along an arm past its far end swallows it.
        if (dot(sub(c, centre), da) > arms[a]!.reach || dot(sub(c, centre), db) > arms[b]!.reach) return null;
        // An outer corner (behind the centre, all the arms on one side) too far out is bevelled, as an L's.
        if (distance(c, centre) > limit) {
          if (gap <= Math.PI) return null;
          bevel = halfPlaneThrough(add(centre, scale(u, limit)), scale(u, -1));
        }
      }
      lines.push({ u, bevel });
    }

    const extension = 2 * (MITER_LIMIT + 1) * Math.max(...arms.map((a) => a.wall.thickness));
    const cuts: EndCut[] = new Array<EndCut>(n);
    for (let k = 0; k < n; k++) {
      const before = lines[(k - 1 + n) % n]!;
      const after = lines[k]!;
      // Two half-planes make the sector only when it is at most a half-turn.
      if (ccw(before.u, after.u) > Math.PI + 1e-9) return null;
      cuts[order[k]!] = {
        extension,
        cuts: [
          halfPlaneThrough(centre, perp(before.u)),
          halfPlaneThrough(centre, scale(perp(after.u), -1)),
          ...(before.bevel ? [before.bevel] : []),
          ...(after.bevel ? [after.bevel] : []),
        ],
      };
    }
    return cuts;
  };

  // Walls of unlike thickness at wide angles (25 cm between 15 and 10): their lines meet outside the
  // corners their faces make, and from there the thick arm's sector is more than a half-turn. The node
  // fell back to the passage rule, the thin arm's finish stopping short of its corner over bare core.
  // From the middle of the corners every sector is less, where that point lies inside every arm.
  const corners = gaps.flatMap((g) => (g.corner ? [g.corner] : []));
  if (corners.length < 2) return around(point);
  const middle = scale(corners.reduce((s, c) => add(s, c), vec(0, 0)), 1 / corners.length);
  return around(point) ?? (arms.every((a) => withinBand(a.wall, middle)) ? around(middle) : null);
}

/** Inside the wall's band, faces included. */
function withinBand(w: WallShape, p: Point2): boolean {
  const [o0, o1] = faceOffsets(w);
  const f = offsetOf(w, p);
  return f >= o0 - POINT_TOLERANCE && f <= o1 + POINT_TOLERANCE;
}
