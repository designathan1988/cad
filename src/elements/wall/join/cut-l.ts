// Two wall ends meeting at a node (L). With the same layer sequence read from the corner's outer
// face, a miter through the face corners; otherwise a butt: the thicker core goes through to the
// other wall's outer face and the other wall abuts it as a T. An acute outer tip past MITER_LIMIT is
// bevelled; nearly in line, one shared cut through the node.

import { COLLINEAR_ANGLE, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
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
import { joinExtension, resolveAbutment } from './cut-t';
import { goesThrough } from './discover';
import type { EndCut, JoinWarning, Notch } from './types';

export interface CornerResult {
  readonly a: EndCut | null;
  readonly b: EndCut | null;
  readonly warning: JoinWarning | null;
  readonly notches: readonly Notch[];
}

/**
 * Every measure is taken from `node`, so ends that overran each other resolve like ends that touch.
 * `reach`: how far from the node a wall's free end is, when it is not its own far end: an arc's end
 * segment goes on into the rest of its arc (§5.2), so only the arc's own far end is free (§7.1).
 */
export function resolveCorner(
  a: WallShape,
  aEnd: WallEnd,
  b: WallShape,
  bEnd: WallEnd,
  node: Point2,
  reach: { readonly a?: number; readonly b?: number } = {},
): CornerResult {
  const ua = intoBody(a, aEnd);
  const ub = intoBody(b, bEnd);
  const angle = (Math.atan2(Math.abs(cross(ua, ub)), dot(ua, ub)) * 180) / Math.PI;
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
  const reachA = reach.a ?? dot(sub(far(a, aEnd), node), ua);
  const reachB = reach.b ?? dot(sub(far(b, bEnd), node), ub);
  const beyond = (p: Point2) => dot(sub(p, node), ua) > reachA || dot(sub(p, node), ub) > reachB;
  if (beyond(inner) || beyond(outer)) return overlapping(a, b);

  // Nearly in line with different faces, the corners fly apart and the miter would become a long
  // taper: step at the node instead. An acute corner keeps its miter and bevels the outer tip.
  const limit = MITER_LIMIT * Math.max(a.thickness, b.thickness);
  if (angle >= 90 && Math.max(distance(node, inner), distance(node, outer)) > limit) return shared();

  const bevel: HalfPlane[] = [];
  if (distance(node, outer) > limit) {
    const tip = normalize(sub(outer, node));
    bevel.push(halfPlaneThrough(add(node, scale(tip, limit)), scale(tip, -1)));
  }

  // A butt covers the same region as the miter (outer faces to the outer corner, inner faces to the
  // inner one), so every degenerate rule above holds for both.
  if (!sameSequence(a, aEnd, b, bEnd)) {
    const aThrough = goesThrough(a, b);
    const [t, tEnd, c, cEnd] = aThrough ? [a, aEnd, b, bEnd] : [b, bEnd, a, aEnd];
    // The through wall stops on the other's outer face: the face away from its own body. Its square
    // end reaches that face across its whole width, so its inner-face corner there must stay short of
    // both free ends, or the end swallows the other wall; and, obtuse, within the limit, or the end
    // becomes a long taper, which steps at the node like the miter.
    const n = wallNormal(c);
    const towardT = dot(n, intoBody(t, tEnd)) > 0 ? n : scale(n, -1);
    const [c0, c1] = faceOffsets(c);
    const outerFace = faceLine(c, dot(towardT, n) > 0 ? c0 : c1);
    const m = wallNormal(t);
    const [t0, t1] = faceOffsets(t);
    const innerFace = faceLine(t, dot(m, intoBody(c, cEnd)) > 0 ? t1 : t0);
    const q = intersectLines(innerFace.point, innerFace.direction, outerFace.point, outerFace.direction);
    const { cut, notches, deepest } = resolveAbutment(c, cEnd, t);
    // The abutting layers reach into the through wall as in a T; a short through wall can end first.
    if (q === null || beyond(q) || deepest.some(beyond)) return overlapping(a, b);
    if (angle >= 90 && distance(node, q) > limit) return shared();
    const through: EndCut = { extension, cuts: [halfPlaneThrough(outerFace.point, towardT), ...bevel] };
    const abutting: EndCut = { ...cut, cuts: [...cut.cuts, ...bevel] };
    return aThrough
      ? { a: through, b: abutting, warning: null, notches }
      : { a: abutting, b: through, warning: null, notches };
  }

  const across = normalize(perp(sub(inner, outer)));
  const cutA: HalfPlane[] = [halfPlaneThrough(outer, dot(across, ua) > 0 ? across : scale(across, -1)), ...bevel];
  const cutB: HalfPlane[] = [halfPlaneThrough(outer, dot(across, ub) > 0 ? across : scale(across, -1)), ...bevel];
  return { a: { extension, cuts: cutA }, b: { extension, cuts: cutB }, warning: null, notches: [] };
}

/**
 * Whether both walls show the same layers read from the corner's outer face: same functions, and
 * thicknesses within POINT_TOLERANCE. A wall drawn the other way reads its layers reversed.
 */
function sameSequence(a: WallShape, aEnd: WallEnd, b: WallShape, bEnd: WallEnd): boolean {
  const fromOuter = (w: WallShape, other: WallShape, otherEnd: WallEnd) =>
    dot(wallNormal(w), intoBody(other, otherEnd)) > 0 ? w.layers : [...w.layers].reverse();
  const la = fromOuter(a, b, bEnd);
  const lb = fromOuter(b, a, aEnd);
  return (
    la.length === lb.length &&
    la.every((l, i) => l.function === lb[i]!.function && Math.abs(l.thickness - lb[i]!.thickness) <= POINT_TOLERANCE)
  );
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
    notches: [],
  };
}

function overlapping(a: WallShape, b: WallShape): CornerResult {
  return { a: null, b: null, warning: { kind: 'wallsOverlap', walls: [a.id, b.id] }, notches: [] };
}
