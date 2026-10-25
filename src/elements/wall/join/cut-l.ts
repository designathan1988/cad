// Two wall ends meeting at a node (L). With the same layer sequence read from the corner's outer
// face, a miter through the face corners; otherwise a butt, layer by layer, as Revit cleans an L
// between two types: the cores meet (the thicker one goes through to the other's outer core face),
// the layers outside the cores wrap the outer corner, and those inside meet at the inner corner. An
// acute outer tip past MITER_LIMIT is bevelled; nearly in line, one shared cut through the node.

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
  /**
   * Butt layer by layer (two straight walls in an L). Off: the abutting wall meets the through wall
   * as a T and only it has layer cuts, which arcs' chains and nodes' passages rely on (footprint.ts,
   * node.ts); those keep the T butt for now (docs/pendencias.md).
   */
  layered = false,
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
  if (!sameSequence(a, aEnd, b, bEnd) && !layered) return tButt(a, aEnd, b, bEnd, node, extension, bevel, beyond, angle, limit, shared);
  if (!sameSequence(a, aEnd, b, bEnd)) {
    const aThrough = goesThrough(a, b);
    const [t, tEnd, c, cEnd] = aThrough ? [a, aEnd, b, bEnd] : [b, bEnd, a, aEnd];
    const { through, abutting, reached } = butt(t, tEnd, c, cEnd, extension);
    // Every layer's end must stay short of both free ends, or the end swallows the other wall; and,
    // obtuse, within the limit, or the square end becomes a long taper, which steps at the node like
    // the miter.
    if (reached.length === 0 || reached.some(beyond)) return overlapping(a, b);
    if (angle >= 90 && reached.some((p) => distance(node, p) > limit)) return shared();
    const t2: EndCut = { ...through, cuts: [...through.cuts, ...bevel] };
    const c2: EndCut = { ...abutting, cuts: [...abutting.cuts, ...bevel] };
    return aThrough ? { a: t2, b: c2, warning: null, notches: [] } : { a: c2, b: t2, warning: null, notches: [] };
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

/**
 * The butt as a T: the thicker core goes through to the other wall's outer face, whole, and the other
 * abuts it by the T priority rule. Its butt corner (the through wall's inner face on that outer face)
 * and the abutting layers' deepest points must stay short of both free ends.
 */
function tButt(
  a: WallShape,
  aEnd: WallEnd,
  b: WallShape,
  bEnd: WallEnd,
  node: Point2,
  extension: number,
  bevel: readonly HalfPlane[],
  beyond: (p: Point2) => boolean,
  angle: number,
  limit: number,
  shared: () => CornerResult,
): CornerResult {
  const aThrough = goesThrough(a, b);
  const [t, tEnd, c, cEnd] = aThrough ? [a, aEnd, b, bEnd] : [b, bEnd, a, aEnd];
  const n = wallNormal(c);
  const towardT = dot(n, intoBody(t, tEnd)) > 0 ? n : scale(n, -1);
  const [c0, c1] = faceOffsets(c);
  const outerFace = faceLine(c, dot(towardT, n) > 0 ? c0 : c1);
  const m = wallNormal(t);
  const [t0, t1] = faceOffsets(t);
  const innerFace = faceLine(t, dot(m, intoBody(c, cEnd)) > 0 ? t1 : t0);
  const q = intersectLines(innerFace.point, innerFace.direction, outerFace.point, outerFace.direction);
  const { cut, notches, deepest } = resolveAbutment(c, cEnd, t);
  if (q === null || beyond(q) || deepest.some(beyond)) return overlapping(a, b);
  if (angle >= 90 && distance(node, q) > limit) return shared();
  const through: EndCut = { extension, cuts: [halfPlaneThrough(outerFace.point, towardT), ...bevel] };
  const abutting: EndCut = { ...cut, cuts: [...cut.cuts, ...bevel] };
  return aThrough ? { a: through, b: abutting, warning: null, notches } : { a: abutting, b: through, warning: null, notches };
}

/**
 * The butt between two sequences, layer by layer. `t` goes through, `c` stops against it. Each wall's
 * layers are read as inner (on the side of the other wall's body), core, or outer:
 *
 * - t's core runs to c's outer core face, and t's outer layers to c's outer face: the corner's outside;
 * - t's inner layers stop at c's inner core face: c's core passes them, as a core passes finishes in a T;
 * - c's core stops at t's inner core face, its inner layers at t's inner face (they meet t's inner
 *   layers at the inner corner), and its outer layers run over t's core to t's outer core face, so the
 *   outer finishes wrap the corner and no inner finish or bare core shows outside.
 *
 * The region covered is the miter's: outer faces to the outer corner, inner faces to the inner one.
 * Without a core layer the core is the whole wall, and this is a plain square butt. `reached`: where
 * each layer's band edges meet the line it stops on, for the corner's checks.
 */
function butt(t: WallShape, tEnd: WallEnd, c: WallShape, cEnd: WallEnd, extension: number): { through: EndCut; abutting: EndCut; reached: Point2[] } {
  const n = wallNormal(c);
  const m = wallNormal(t);
  // Across c, toward t's body (its inner side); across t, toward c's body (its inner side).
  const cInnerPositive = dot(n, intoBody(t, tEnd)) > 0;
  const tInnerPositive = dot(m, intoBody(c, cEnd)) > 0;
  const towardT = cInnerPositive ? n : scale(n, -1);
  const towardC = tInnerPositive ? m : scale(m, -1);
  const [c0, c1] = faceOffsets(c);
  const [t0, t1] = faceOffsets(t);
  const side = (w: WallShape, innerPositive: boolean, k: number): 'inner' | 'core' | 'outer' => {
    if (k >= w.coreLayers[0] && k <= w.coreLayers[1]) return 'core';
    return (k > w.coreLayers[1]) === innerPositive ? 'inner' : 'outer';
  };
  // The lines each wall's layers stop on, as offsets across the other wall.
  const tStops = { outer: cInnerPositive ? c0 : c1, core: cInnerPositive ? c.core[0] : c.core[1], inner: cInnerPositive ? c.core[1] : c.core[0] };
  const cStops = { inner: tInnerPositive ? t1 : t0, core: tInnerPositive ? t.core[1] : t.core[0], outer: tInnerPositive ? t.core[0] : t.core[1] };
  const line = (w: WallShape, offset: number) => add(w.start, scale(wallNormal(w), offset));
  const reached: Point2[] = [];
  const layerCuts = (w: WallShape, innerPositive: boolean, other: WallShape, stops: Record<'inner' | 'core' | 'outer', number>, inward: Point2) =>
    w.layers.map((_, k) => {
      const at = line(other, stops[side(w, innerPositive, k)]);
      for (const o of [w.layerOffsets[k]!, w.layerOffsets[k + 1]!]) {
        const p = intersectLines(line(w, o), wallDirection(w), at, wallDirection(other));
        if (p) reached.push(p);
      }
      return [halfPlaneThrough(at, inward)];
    });
  // Every layer has its own cut, so none is needed for the wall as a whole (as for a T's abutting end).
  const through: EndCut = { extension, cuts: [], layerCuts: layerCuts(t, tInnerPositive, c, tStops, towardT) };
  const abutting: EndCut = { extension, cuts: [], layerCuts: layerCuts(c, cInnerPositive, t, cStops, towardC) };
  return { through, abutting, reached };
}

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
