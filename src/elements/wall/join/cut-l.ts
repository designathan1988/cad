// Two wall ends meeting at a node (L). Miter through the face corners, bevelled when an acute
// outer tip reaches past MITER_LIMIT; a shared cut through the node when nearly in line.

import { COLLINEAR_ANGLE, MITER_LIMIT } from '../../../core/tolerance';
import {
  add,
  cross,
  distance,
  dot,
  intersectLines,
  normalize,
  perp,
  type Point2,
  scale,
  sub,
} from '../../../core/vector';
import { type HalfPlane, halfPlaneThrough } from '../geometry/convex';
import {
  endPoint,
  faceLine,
  faceOffsets,
  intoBody,
  wallDirection,
  wallNormal,
} from '../geometry/offset';
import type { WallEnd } from '../schema';
import type { WallShape } from '../geometry/shape';
import type { EndCut, JoinWarning } from './types';

export interface CornerResult {
  readonly a: EndCut | null;
  readonly b: EndCut | null;
  readonly warning: JoinWarning | null;
}

export const joinExtension = (a: WallShape, b: WallShape): number =>
  2 * (MITER_LIMIT + 1) * Math.max(a.thickness, b.thickness);

/** Every measure is taken from `node`, so ends that overran each other resolve like ends that touch. */
export function resolveCorner(a: WallShape, aEnd: WallEnd, b: WallShape, bEnd: WallEnd, node: Point2): CornerResult {
  const ua = intoBody(a, aEnd);
  const ub = intoBody(b, bEnd);
  const angle = (Math.atan2(Math.abs(cross(ua, ub)), dot(ua, ub)) * 180) / Math.PI;
  // Discovery keeps every end within MITER_LIMIT·T of the node, and every cut reaches at most
  // MITER_LIMIT·T past it, so 2·(MITER_LIMIT + 1)·T of band past the end always suffices.
  const extension = joinExtension(a, b);
  const shared = () => sharedCut(node, ua, ub, extension);

  if (angle < COLLINEAR_ANGLE) return overlapping(a, b);
  if (angle > 180 - COLLINEAR_ANGLE) return shared();

  // The miter runs along the diagonal of the overlap parallelogram, from the inner corner (inner
  // faces) to the outer corner (outer faces). Its two half-planes are complementary, so the
  // pieces can never overlap, and the union always turns cleanly through both corners.
  const corners = faceCorners(a, aEnd, b, bEnd);
  if (corners === null) return shared();
  const { inner, outer } = corners;
  // A corner past either wall's far end means the corner swallows that wall: a stub, not a join.
  const reachA = dot(sub(far(a, aEnd), node), ua);
  const reachB = dot(sub(far(b, bEnd), node), ub);
  const beyond = (p: Point2) => dot(sub(p, node), ua) > reachA || dot(sub(p, node), ub) > reachB;
  if (beyond(inner) || beyond(outer)) return overlapping(a, b);

  // Nearly in line with different faces, the corners fly apart and the miter would become a long
  // taper: step at the node instead. An acute corner keeps its miter and bevels the outer tip.
  const limit = MITER_LIMIT * Math.max(a.thickness, b.thickness);
  if (angle >= 90 && Math.max(distance(node, inner), distance(node, outer)) > limit) return shared();

  const across = normalize(perp(sub(inner, outer)));
  const cutA: HalfPlane[] = [halfPlaneThrough(outer, dot(across, ua) > 0 ? across : scale(across, -1))];
  const cutB: HalfPlane[] = [halfPlaneThrough(outer, dot(across, ub) > 0 ? across : scale(across, -1))];

  if (distance(node, outer) > limit) {
    const tip = normalize(sub(outer, node));
    const bevel = halfPlaneThrough(add(node, scale(tip, limit)), scale(tip, -1));
    cutA.push(bevel);
    cutB.push(bevel);
  }
  return { a: { extension, cuts: cutA }, b: { extension, cuts: cutB }, warning: null };
}

const far = (w: WallShape, end: WallEnd): Point2 => endPoint(w, end === 'start' ? 'end' : 'start');

/** Intersections of the two inner faces and of the two outer faces. */
export function faceCorners(
  a: WallShape,
  aEnd: WallEnd,
  b: WallShape,
  bEnd: WallEnd,
): { inner: Point2; outer: Point2 } | null {
  const [a0, a1] = faceOffsets(a);
  const [b0, b1] = faceOffsets(b);
  const bOnPositiveSideOfA = dot(wallNormal(a), intoBody(b, bEnd)) > 0;
  const aOnPositiveSideOfB = dot(wallNormal(b), intoBody(a, aEnd)) > 0;
  const aInner = faceLine(a, bOnPositiveSideOfA ? a1 : a0);
  const aOuter = faceLine(a, bOnPositiveSideOfA ? a0 : a1);
  const bInner = faceLine(b, aOnPositiveSideOfB ? b1 : b0);
  const bOuter = faceLine(b, aOnPositiveSideOfB ? b0 : b1);
  const da = wallDirection(a);
  const db = wallDirection(b);
  const inner = intersectLines(aInner.point, da, bInner.point, db);
  const outer = intersectLines(aOuter.point, da, bOuter.point, db);
  return inner && outer ? { inner, outer } : null;
}

/** Both ends cut by one line through the node, across the mean direction. */
function sharedCut(node: Point2, ua: Point2, ub: Point2, extension: number): CornerResult {
  const across = normalize(sub(ua, ub));
  return {
    a: { extension, cuts: [halfPlaneThrough(node, across)] },
    b: { extension, cuts: [halfPlaneThrough(node, scale(across, -1))] },
    warning: null,
  };
}

function overlapping(a: WallShape, b: WallShape): CornerResult {
  return { a: null, b: null, warning: { kind: 'wallsOverlap', walls: [a.id, b.id] } };
}
