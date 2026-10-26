// Three or four ends at one point (§7.4, hito's rule). The pair closest to in line, within 10°, is
// the passage and joins as an L; without such a pair, the two thickest cores do. Every other end
// abuts the passage as a T, but only where that is exact: against one passage wall it fits in alone,
// or against both when they show the same faces and layers on its side. Otherwise it warns
// complexJoin and stays square, rather than draw something that overlaps.

import { AREA_EPSILON, COLLINEAR_ANGLE } from '../../../core/tolerance';
import { add, cross, distance, dot, type Point2, scale, sub } from '../../../core/vector';
import { area, clipHalfPlane, type ConvexPolygon, type HalfPlane, halfPlaneThrough } from '../geometry/convex';
import { endPoint, faceOffsets, intoBody, offsetOf, strip, wallDirection, wallLength, wallNormal } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import type { EndRef, WallEnd, WallId } from '../schema';
import { parentOf } from '../geometry/arc';
import { resolveCorner } from './cut-l';
import { type AbutmentResult, resolveAbutment } from './cut-t';
import { goesThrough } from './discover';
import type { EndCut, JoinWarning, Notch } from './types';

/** How far from in line two ends may be and still form the passage (degrees, §7.4). */
const PASSAGE_ANGLE = 10;

export interface NodeResult {
  readonly endCuts: readonly (readonly [EndRef, EndCut])[];
  readonly notches: readonly Notch[];
  readonly warnings: readonly JoinWarning[];
}

interface End {
  readonly ref: EndRef;
  readonly wall: WallShape;
}

const angleBetween = (u: Point2, v: Point2): number => (Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * 180) / Math.PI;

export function resolveNode(walls: ReadonlyMap<WallId, WallShape>, refs: readonly EndRef[], point: Point2): NodeResult {
  const ends: End[] = refs
    .map((ref) => ({ ref, wall: walls.get(ref.wallId)! }))
    .sort((x, y) => (x.wall.id < y.wall.id ? -1 : x.wall.id > y.wall.id ? 1 : x.ref.end < y.ref.end ? -1 : 1));
  const [i, j] = passageOf(ends);
  const [p, q] = [ends[i]!, ends[j]!];
  const others = ends.filter((_, k) => k !== i && k !== j);

  const endCuts: [EndRef, EndCut][] = [];
  const notches: Notch[] = [];
  const warnings: JoinWarning[] = [];
  const corner = resolveCorner(p.wall, p.ref.end, q.wall, q.ref.end, point);
  if (corner.a) endCuts.push([p.ref, corner.a]);
  if (corner.b) endCuts.push([q.ref, corner.b]);
  notches.push(...corner.notches);
  if (corner.warning) warnings.push(corner.warning);

  for (const c of others) {
    // An arc's end segment from outside the corner: the T against one wall (alone) fits that segment,
    // but the arc's next segments, short and still in the corner, cut through the wall's finish; the
    // corner's outer faces bound all of them (footprint.ts gives the notches to every segment).
    const arcEnd = parentOf(c.wall.id) !== c.wall.id;
    const fit =
      (corner.a && corner.b && arcEnd && outside(c, p, corner.a, q, corner.b)) ||
      (corner.a && corner.b && (alone(c, p, corner.a, q, corner.b) ?? alone(c, q, corner.b, p, corner.a))) ||
      (corner.a && corner.b && matching(c, p, q, point)) ||
      (corner.a && corner.b && outside(c, p, corner.a, q, corner.b));
    if (fit) {
      endCuts.push([c.ref, fit.cut]);
      notches.push(...fit.notches);
    } else {
      warnings.push({ kind: 'complexJoin', walls: [c.wall.id, p.wall.id, q.wall.id] });
    }
  }
  return { endCuts, notches, warnings };
}

/** The pair closest to in line within PASSAGE_ANGLE, else the two thickest cores (lower id on a tie). */
function passageOf(ends: readonly End[]): [number, number] {
  let best: [number, number] | null = null;
  let bestGap = PASSAGE_ANGLE;
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const gap = 180 - angleBetween(intoBody(ends[i]!.wall, ends[i]!.ref.end), intoBody(ends[j]!.wall, ends[j]!.ref.end));
      if (gap <= bestGap && (best === null || gap < bestGap)) {
        best = [i, j];
        bestGap = gap;
      }
    }
  }
  if (best) return best;
  const order = ends.map((_, k) => k).sort((x, y) => (goesThrough(ends[x]!.wall, ends[y]!.wall) ? -1 : 1));
  const [x, y] = [order[0]!, order[1]!];
  return x < y ? [x, y] : [y, x];
}

/** The host's face toward the abutting wall, and the half-plane beyond it on the abutting side. */
function nearFace(c: End, host: WallShape): { offset: number; beyond: HalfPlane } {
  const n = wallNormal(host);
  const positive = dot(n, intoBody(c.wall, c.ref.end)) > 0;
  const offset = faceOffsets(host)[positive ? 1 : 0];
  return { offset, beyond: halfPlaneThrough(add(host.start, scale(n, offset)), positive ? n : scale(n, -1)) };
}

/** Where the abutting wall's two faces cross the host's near face. */
function nearFacePoints(c: End, host: WallShape): Point2[] {
  const { offset } = nearFace(c, host);
  const n = wallNormal(host);
  const m = wallNormal(c.wall);
  const d = wallDirection(c.wall);
  return faceOffsets(c.wall).flatMap((o) => {
    const p = add(c.wall.start, scale(m, o));
    const denom = dot(n, d);
    if (denom === 0) return [];
    return [add(p, scale(d, (offset - offsetOf(host, p)) / denom))];
  });
}

const holds = (plane: HalfPlane, p: Point2): boolean => dot(plane.normal, p) <= plane.offset;

/** Within the wall's length, measured from its joined end. */
function withinLength(w: WallShape, end: WallEnd, p: Point2): boolean {
  return dot(sub(p, endPoint(w, end)), intoBody(w, end)) <= wallLength(w);
}

/**
 * The abutting end against `host` alone: everything it puts inside the host lies on the host's side
 * of the passage cut and short of the host's far end, and nothing of it beyond the host's face
 * reaches the other passage wall.
 */
function alone(c: End, host: End, hostCut: EndCut, other: End, otherCut: EndCut): AbutmentResult | null {
  if (hostCut.layerCuts) return null; // the host itself abuts in a butt passage: no clean face
  const result = resolveAbutment(c.wall, c.ref.end, host.wall);
  const points = [...nearFacePoints(c, host.wall), ...result.deepest];
  if (!points.every((p) => hostCut.cuts.every((plane) => holds(plane, p)) && withinLength(host.wall, host.ref.end, p))) {
    return null;
  }
  // The rest of the abutting wall, past the host's face, against the other passage wall as far as
  // this node trims it (its other end can only trim it more).
  let mine: ConvexPolygon = clipHalfPlane(strip(c.wall, 0, 0), nearFace(c, host.wall).beyond);
  const ext = otherCut.extension;
  let theirs: ConvexPolygon = strip(other.wall, other.ref.end === 'start' ? ext : 0, other.ref.end === 'end' ? ext : 0);
  for (const plane of otherCut.cuts) theirs = clipHalfPlane(theirs, plane);
  for (let k = 0; k < theirs.length && mine.length > 0; k++) {
    const a = theirs[k]!;
    const b = theirs[(k + 1) % theirs.length]!;
    // theirs is counter-clockwise: its inside is on the left of each edge.
    mine = clipHalfPlane(mine, halfPlaneThrough(a, { x: -(b.y - a.y), y: b.x - a.x }));
  }
  if (mine.length > 0 && area(mine) >= AREA_EPSILON) return null;
  return result;
}

/**
 * The abutting end against a passage in line whose two walls show the very same face lines on its
 * side: cut by one, notch both. With other layers between those lines (a wall drawn the other way
 * shows its exterior finish), each abutting layer is cut by the wall it meets. Everything it puts
 * inside them stays within their lengths.
 */
function matching(c: End, p: End, q: End, node: Point2): AbutmentResult | null {
  const up = intoBody(p.wall, p.ref.end);
  const uq = intoBody(q.wall, q.ref.end);
  if (angleBetween(up, uq) <= 180 - COLLINEAR_ANGLE) return null;
  // "The same lines" means: any difference makes slivers smaller than AREA_EPSILON, which the engine
  // drops anyway, over the zone where the abutting wall meets the passage.
  const sin = Math.abs(cross(wallDirection(c.wall), wallDirection(p.wall)));
  if (sin === 0) return null;
  const zone = c.wall.thickness / sin + p.wall.thickness + q.wall.thickness;
  if (Math.abs(cross(wallDirection(p.wall), wallDirection(q.wall))) * zone * zone > AREA_EPSILON) return null;
  const sideP = sideLines(c, p.wall);
  const sideQ = sideLines(c, q.wall);
  if (sideP.length !== sideQ.length) return null;
  for (let k = 0; k < sideP.length; k++) {
    const line = add(q.wall.start, scale(wallNormal(q.wall), sideQ[k]!.offset));
    const atNode = add(line, scale(wallDirection(q.wall), dot(sub(node, line), wallDirection(q.wall))));
    if (Math.abs(offsetOf(p.wall, atNode) - sideP[k]!.offset) * zone > AREA_EPSILON) return null;
  }
  const fromP = resolveAbutment(c.wall, c.ref.end, p.wall);
  const fromQ = resolveAbutment(c.wall, c.ref.end, q.wall);
  const points = [...nearFacePoints(c, p.wall), ...fromP.deepest, ...fromQ.deepest];
  const lengthTo = (w: End, u: Point2) => dot(sub(far(w), node), u);
  if (!points.every((x) => dot(sub(x, node), up) <= lengthTo(p, up) && dot(sub(x, node), uq) <= lengthTo(q, uq))) return null;
  if (sideP.every((l, k) => l.fn === sideQ[k]!.fn)) return { cut: fromP.cut, notches: [...fromP.notches, ...fromQ.notches], deepest: fromP.deepest };
  // The same lines with other finishes on that side (one of the two drawn the other way round, its
  // exterior finish there): each abutting layer stops where the passage wall it meets has it stop. A
  // layer meeting only one of them takes that one's depth; one meeting both (the core, at least) must
  // stop at the same line in both, or it would step at the node.
  const zoneSide = (x: Point2) => dot(sub(x, node), up) * zone;
  const layerCuts: (readonly HalfPlane[])[] = [];
  const deepest: Point2[] = [];
  for (let k = 0; k < c.wall.layers.length; k++) {
    const ownP = fromP.deepest.slice(2 * k, 2 * k + 2);
    const ownQ = fromQ.deepest.slice(2 * k, 2 * k + 2);
    const band = [...layerFacePoints(c, p.wall, k), ...ownP, ...ownQ];
    const fromWall = band.every((x) => zoneSide(x) >= -AREA_EPSILON)
      ? fromP
      : band.every((x) => zoneSide(x) <= AREA_EPSILON)
        ? fromQ
        : ownP.every((x, i) => distance(x, ownQ[i]!) * zone <= AREA_EPSILON)
          ? fromP
          : null;
    if (!fromWall?.cut.layerCuts) return null;
    layerCuts.push(fromWall.cut.layerCuts[k]!);
    deepest.push(...fromWall.deepest.slice(2 * k, 2 * k + 2));
  }
  return {
    cut: { extension: Math.max(fromP.cut.extension, fromQ.cut.extension), cuts: [], layerCuts },
    notches: [...fromP.notches, ...fromQ.notches],
    deepest,
  };
}

/** Where the two sides of the abutting wall's layer k cross the host's near face. */
function layerFacePoints(c: End, host: WallShape, k: number): Point2[] {
  const { offset } = nearFace(c, host);
  const n = wallNormal(host);
  const d = wallDirection(c.wall);
  const denom = dot(n, d);
  if (denom === 0) return [];
  return [c.wall.layerOffsets[k]!, c.wall.layerOffsets[k + 1]!].map((o) => {
    const p = add(c.wall.start, scale(wallNormal(c.wall), o));
    return add(p, scale(d, (offset - offsetOf(host, p)) / denom));
  });
}

const far = (w: End): Point2 => endPoint(w.wall, w.ref.end === 'start' ? 'end' : 'start');

/**
 * The third end against the outside of the L's corner: it comes from the reflex side (outside the
 * angle between the two passage walls), so its end lies in the corner and its body leaves through
 * the L's two outer faces. It keeps its own end and loses, in every layer, what lies inside either
 * passage wall as this node cuts it: it then starts exactly on those faces. An arc drawn from the
 * outer corner of a house was refused here (complexJoin, then "join with an arc not supported").
 */
function outside(c: End, p: End, pCut: EndCut, q: End, qCut: EndCut): AbutmentResult | null {
  const up = intoBody(p.wall, p.ref.end);
  const uq = intoBody(q.wall, q.ref.end);
  const dc = intoBody(c.wall, c.ref.end);
  const turn = cross(up, uq);
  // A corner, not a passage in line; and c not inside its angle (where it would meet the inner faces).
  if (angleBetween(up, uq) > 180 - COLLINEAR_ANGLE || Math.abs(turn) < 1e-9) return null;
  const inside = Math.sign(cross(up, dc)) === Math.sign(turn) && Math.sign(cross(dc, uq)) === Math.sign(turn);
  if (inside) return null;
  const body = (w: End, cut: EndCut): HalfPlane[] => {
    let poly: ConvexPolygon = strip(w.wall, w.ref.end === 'start' ? cut.extension : 0, w.ref.end === 'end' ? cut.extension : 0);
    for (const plane of cut.cuts) poly = clipHalfPlane(poly, plane);
    return poly.map((a, k) => {
      const b = poly[(k + 1) % poly.length]!;
      return halfPlaneThrough(a, { x: -(b.y - a.y), y: b.x - a.x });
    });
  };
  const all: [number, number] = [0, c.wall.layers.length - 1];
  return {
    cut: { extension: 0, cuts: [] },
    notches: [
      { wallId: c.wall.id, region: body(p, pCut), layers: all },
      { wallId: c.wall.id, region: body(q, qCut), layers: all },
    ],
    deepest: [],
  };
}

/**
 * The host's layer boundaries on the abutting wall's side, from the near face to the core face, each
 * with the function of the layer beyond it.
 */
function sideLines(c: End, host: WallShape): { offset: number; fn: string }[] {
  const positive = dot(wallNormal(host), intoBody(c.wall, c.ref.end)) > 0;
  const out: { offset: number; fn: string }[] = [];
  if (positive) {
    for (let i = host.layers.length - 1; i > host.coreLayers[1]; i--) {
      out.push({ offset: host.layerOffsets[i + 1]!, fn: host.layers[i]!.function });
    }
    out.push({ offset: host.core[1], fn: 'core' });
  } else {
    for (let i = 0; i < host.coreLayers[0]; i++) out.push({ offset: host.layerOffsets[i]!, fn: host.layers[i]!.function });
    out.push({ offset: host.core[0], fn: 'core' });
  }
  return out;
}
