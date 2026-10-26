// Finds which wall ends meet (corners, nodes) and which ends stop against another wall (abutments).
// Pure and deterministic: walls are always visited in ascending id order.

import { COLLINEAR_ANGLE, MIN_WALL_LENGTH, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, cross, distance, dot, intersectLines, normalize, type Point2, scale, sub } from '../../../core/vector';
import { endPoint, faceOffsets, intoBody, offsetOf, stationOf, wallDirection, wallLength, wallNormal } from '../geometry/offset';
import type { EndRef, WallEnd } from '../schema';
import type { WallShape } from '../geometry/shape';
import { parentOf, SEGMENT_MARK } from '../geometry/arc';
import type { Corner, Crossing, JoinGraph, JoinWarning, JoinNode } from './types';

const ENDS: readonly WallEnd[] = ['start', 'end'];

export function deriveJoins(walls: readonly WallShape[]): JoinGraph {
  const sorted = [...walls].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const warnings: JoinWarning[] = [];
  const valid = sorted.filter((w) => {
    const ok = wallLength(w) >= MIN_WALL_LENGTH;
    if (!ok) warnings.push({ kind: 'wallTooShort', walls: [w.id] });
    return ok;
  });

  const ends: EndRef[] = valid.flatMap((w) => ENDS.map((end) => ({ wallId: w.id, end })));
  const byId = new Map(valid.map((w) => [w.id, w]));
  const at = (r: EndRef) => endPoint(byId.get(r.wallId)!, r.end);
  // A joint of an arc's own chain is not a meeting of walls: another wall's end there is kept apart
  // from it (a free end, so it abuts the arc), and the joint stays the chain's corner.
  const internal = (r: EndRef, s: EndRef) => {
    const [a, b] = r.end === 'end' ? [r, s] : [s, r];
    if (a.end !== 'end' || b.end !== 'start' || parentOf(a.wallId) === a.wallId || parentOf(a.wallId) !== parentOf(b.wallId)) return false;
    const index = (id: string) => Number(id.slice(id.lastIndexOf(SEGMENT_MARK) + 1));
    return index(b.wallId) === index(a.wallId) + 1;
  };
  const clusters = clusterEnds(ends, at).flatMap((cluster) => {
    if (cluster.length <= 2) return [cluster];
    for (let i = 0; i < cluster.length; i++)
      for (let j = i + 1; j < cluster.length; j++)
        if (internal(cluster[i]!, cluster[j]!)) return [[cluster[i]!, cluster[j]!], cluster.filter((_, k) => k !== i && k !== j)];
    return [cluster];
  });

  // An arc's segments meet one another at joints that are not ends of the wall: a wall end there is
  // inside the arc, not beside an end of it, so it abuts a segment (the T spreads to the next one).
  // Each joint is bounded by the plane the two segments share, radial: the bisector of their directions.
  const segment = new Map<string, WallShape>(valid.filter((w) => parentOf(w.id) !== w.id).map((w) => [w.id, w]));
  const neighbour = (w: WallShape, step: number) => {
    const k = w.id.lastIndexOf(SEGMENT_MARK);
    return segment.get(`${w.id.slice(0, k)}${SEGMENT_MARK}${Number(w.id.slice(k + 1)) + step}`);
  };
  const joint = (w: WallShape): Joints => {
    if (!segment.has(w.id)) return {};
    const d = wallDirection(w);
    const before = neighbour(w, -1);
    const after = neighbour(w, 1);
    return {
      ...(before ? { start: normalize(add(wallDirection(before), d)) } : {}),
      ...(after ? { end: normalize(add(d, wallDirection(after))) } : {}),
    };
  };

  // Two ends that meet inside another wall's band, coming from either of its faces: not an L running
  // on through that wall's body, but two Ts against it, one on each face (a wall continued across
  // another, drawn to its axis from both sides). As an L they overlapped it, with no warning.
  const across = (pair: readonly [EndRef, EndRef]): boolean =>
    !internal(pair[0], pair[1]) &&
    valid.some((host) => {
      if (pair.some((r) => parentOf(r.wallId) === parentOf(host.id) || !insideBand(host, at(r), joint(host)))) return false;
      const n = wallNormal(host);
      const [a, b] = pair.map((r) => byId.get(r.wallId)!);
      return !parallel(a!, host) && !parallel(b!, host) && dot(n, intoBody(a!, pair[0].end)) * dot(n, intoBody(b!, pair[1].end)) < 0;
    });

  const corners: Corner[] = [];
  const nodes: JoinNode[] = [];
  const free: EndRef[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) free.push(cluster[0]!);
    else if (cluster.length === 2) {
      const ends = [cluster[0]!, cluster[1]!] as const;
      if (across(ends)) free.push(...ends);
      else corners.push({ ends, node: scale(add(at(ends[0]), at(ends[1])), 0.5) });
    } else if (cluster.length <= 4) {
      const sum = cluster.reduce((s, r) => add(s, at(r)), { x: 0, y: 0 });
      nodes.push({ ends: cluster, point: scale(sum, 1 / cluster.length) });
    } else warnings.push({ kind: 'complexJoin', walls: cluster.map((r) => r.wallId) });
  }

  let abutments: { abutting: EndRef; hostId: string }[] = [];
  for (const ref of free) {
    const wall = byId.get(ref.wallId)!;
    const p = at(ref);
    for (const host of valid) {
      if (host.id === wall.id || parentOf(host.id) === parentOf(wall.id) || !insideBand(host, p, joint(host))) continue;
      if (parallel(wall, host)) {
        warnings.push({ kind: 'wallsOverlap', walls: [wall.id, host.id] });
      } else {
        abutments.push({ abutting: ref, hostId: host.id });
      }
      break;
    }
  }

  // Both ends inside the same host: the wall lies within it. Two Ts would cut it away entirely and
  // notch the host for nothing.
  const inside = new Set(
    abutments
      .filter((x, i) => abutments.some((y, j) => j > i && y.abutting.wallId === x.abutting.wallId && y.hostId === x.hostId))
      .map((x) => x.abutting.wallId),
  );
  for (const id of inside) {
    warnings.push({ kind: 'wallsOverlap', walls: [id, abutments.find((x) => x.abutting.wallId === id)!.hostId] });
  }
  abutments = abutments.filter((x) => !inside.has(x.abutting.wallId));

  // Each end inside the other wall: not two Ts but one corner that overran. Cutting both against
  // each other's face would leave the corner empty. When the reference lines cross far from the
  // ends, the walls run side by side (nearly in line, overlapping): that is an overlap, not a corner.
  const mutual = new Set<number>();
  abutments.forEach((x, i) => {
    abutments.forEach((y, j) => {
      if (j <= i || x.abutting.wallId !== y.hostId || y.abutting.wallId !== x.hostId) return;
      const a = byId.get(x.abutting.wallId)!;
      const b = byId.get(y.abutting.wallId)!;
      mutual.add(i).add(j);
      const node = intersectLines(a.start, wallDirection(a), b.start, wallDirection(b));
      const limit = MITER_LIMIT * Math.max(a.thickness, b.thickness);
      if (node && distance(node, at(x.abutting)) <= limit && distance(node, at(y.abutting)) <= limit) {
        corners.push({ ends: [x.abutting, y.abutting], node });
      } else {
        warnings.push({ kind: 'wallsOverlap', walls: [a.id, b.id] });
      }
    });
  });
  abutments = abutments.filter((_, i) => !mutual.has(i));
  // A wall whose end abuts an arc can pass the arc's reference line of a neighbouring segment on its
  // way in, at a slant: that is the same T (footprint.ts spreads it over the segments), not an X. It is
  // when its axis stays inside the arc's band from that point to its end.
  const inArc = (parent: string, p: Point2) => valid.some((h) => parentOf(h.id) === parent && h.id !== parent && insideBand(h, p, joint(h)));
  const crossings = findCrossings(valid, joint).filter(({ throughId, cutId, point }) => {
    for (const [wallId, segId] of [
      [cutId, throughId],
      [throughId, cutId],
    ] as const) {
      const parent = parentOf(segId);
      if (parent === segId) continue;
      const abut = abutments.find((x) => x.abutting.wallId === wallId && parentOf(x.hostId) === parent);
      if (!abut) continue;
      const end = at(abut.abutting);
      const steps = 16;
      const within = Array.from({ length: steps + 1 }, (_, k) => add(point, scale({ x: end.x - point.x, y: end.y - point.y }, k / steps))).every((q) => inArc(parent, q));
      if (within) return false;
    }
    return true;
  });
  for (const [a, b] of lyingOver(valid)) {
    if (!warnings.some((w) => w.kind === 'wallsOverlap' && w.walls.includes(a.id) && w.walls.includes(b.id))) warnings.push({ kind: 'wallsOverlap', walls: [a.id, b.id] });
  }
  return { corners, nodes, abutments, crossings, warnings };
}

/**
 * Pairs of straight walls lying over one another along a stretch: parallel, their bodies overlapping
 * across and along. A wall drawn twice, or copied in place, has its ends in the same corners as the
 * other's: none of the checks on ends saw it, and the plan showed one wall where there were two.
 */
function lyingOver(walls: readonly WallShape[]): [WallShape, WallShape][] {
  const out: [WallShape, WallShape][] = [];
  const straight = walls.filter((w) => parentOf(w.id) === w.id);
  straight.forEach((a, i) => {
    const [a0, a1] = faceOffsets(a);
    const len = wallLength(a);
    for (const b of straight.slice(i + 1)) {
      if (!parallel(a, b)) continue;
      const same = dot(wallDirection(a), wallDirection(b)) > 0;
      const [b0, b1] = faceOffsets(b);
      const off = offsetOf(a, b.start);
      const [lo, hi] = same ? [off + b0, off + b1] : [off - b1, off - b0];
      if (Math.min(a1, hi) - Math.max(a0, lo) <= POINT_TOLERANCE) continue;
      const s = [stationOf(a, b.start), stationOf(a, b.end)];
      if (Math.min(len, Math.max(...s)) - Math.max(0, Math.min(...s)) > POINT_TOLERANCE) out.push([a, b]);
    }
  });
  return out;
}

/**
 * Pairs whose reference lines cross inside both walls, with no end of either inside the other's
 * band (that would be a T or a corner). The through wall is chosen by goesThrough. `joint`: a
 * segment's ends that are joints of its own arc. Those are not wall ends: one inside the other wall's
 * band does not make it a T or a corner, and a crossing on one is still a crossing (found once, on
 * the first of the two segments).
 */
function findCrossings(walls: readonly WallShape[], joint: (w: WallShape) => Joints): Crossing[] {
  const crossings: Crossing[] = [];
  const realEnds = (w: WallShape) => {
    const j = joint(w);
    return [...(j.start ? [] : [w.start]), ...(j.end ? [] : [w.end])];
  };
  walls.forEach((a, i) => {
    walls.slice(i + 1).forEach((b) => {
      if (parallel(a, b) || parentOf(a.id) === parentOf(b.id)) return;
      const point = intersectLines(a.start, wallDirection(a), b.start, wallDirection(b));
      if (point === null || !interior(a, point, joint(a)) || !interior(b, point, joint(b))) return;
      if (realEnds(a).some((p) => withinBand(b, p)) || realEnds(b).some((p) => withinBand(a, p))) return;
      const aThrough = goesThrough(a, b);
      const crossing = { throughId: aThrough ? a.id : b.id, cutId: aThrough ? b.id : a.id, point };
      const same = (c: Crossing) =>
        distance(c.point, point) <= POINT_TOLERANCE && parentOf(c.throughId) === parentOf(crossing.throughId) && parentOf(c.cutId) === parentOf(crossing.cutId);
      if (!crossings.some(same)) crossings.push(crossing);
    });
  });
  return crossings;
}

/**
 * Whether `a` goes through `b` where one must (X, butt L): the thicker core does. Summed from the
 * layers, not subtracted from offsets: walls of one type on different reference lines must tie
 * exactly. Cores within POINT_TOLERANCE tie, and the lower id goes through.
 */
export function goesThrough(a: WallShape, b: WallShape): boolean {
  const coreA = coreThickness(a);
  const coreB = coreThickness(b);
  return Math.abs(coreA - coreB) <= POINT_TOLERANCE ? a.id < b.id : coreA > coreB;
}

const coreThickness = (w: WallShape): number =>
  w.layers.slice(w.coreLayers[0], w.coreLayers[1] + 1).reduce((sum, l) => sum + l.thickness, 0);

/** Inside the wall's length, away from its ends; up to an end that is a joint of its arc, which is not one. */
const interior = (w: WallShape, p: ReturnType<typeof endPoint>, joint: Joints = {}): boolean => {
  const s = stationOf(w, p);
  return (joint.start ? s >= 0 : s > POINT_TOLERANCE) && (joint.end ? s <= wallLength(w) : s < wallLength(w) - POINT_TOLERANCE);
};

/** Inside the wall's rectangle, ends included, with tolerance. */
function withinBand(w: WallShape, p: ReturnType<typeof endPoint>): boolean {
  const [o0, o1] = faceOffsets(w);
  const f = offsetOf(w, p);
  const s = stationOf(w, p);
  return f >= o0 - POINT_TOLERANCE && f <= o1 + POINT_TOLERANCE && s >= -POINT_TOLERANCE && s <= wallLength(w) + POINT_TOLERANCE;
}

/** Groups ends that lie within POINT_TOLERANCE of each other, transitively. */
function clusterEnds(ends: readonly EndRef[], at: (r: EndRef) => ReturnType<typeof endPoint>): EndRef[][] {
  const parent = ends.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      if (ends[i]!.wallId === ends[j]!.wallId) continue;
      if (distance(at(ends[i]!), at(ends[j]!)) <= POINT_TOLERANCE) parent[root(j)] = root(i);
    }
  }
  const groups = new Map<number, EndRef[]>();
  ends.forEach((r, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), r]));
  return [...groups.values()];
}

/** The ends of a segment that join the next ones of its arc: the normal of the radial plane there. */
interface Joints {
  readonly start?: Point2;
  readonly end?: Point2;
}

/** `joint`: at an end that joins the next segment of its arc, the band goes on up to the radial plane. */
function insideBand(host: WallShape, p: ReturnType<typeof endPoint>, joint: Joints = {}): boolean {
  const [o0, o1] = faceOffsets(host);
  const f = offsetOf(host, p);
  const s = stationOf(host, p);
  const afterStart = joint.start ? dot(sub(p, host.start), joint.start) >= 0 : s > POINT_TOLERANCE;
  const beforeEnd = joint.end ? dot(sub(p, host.end), joint.end) <= 0 : s < wallLength(host) - POINT_TOLERANCE;
  return f >= o0 - POINT_TOLERANCE && f <= o1 + POINT_TOLERANCE && afterStart && beforeEnd;
}

function parallel(a: WallShape, b: WallShape): boolean {
  const da = wallDirection(a);
  const db = wallDirection(b);
  const angle = (Math.atan2(Math.abs(cross(da, db)), Math.abs(dot(da, db))) * 180) / Math.PI;
  return angle < COLLINEAR_ANGLE;
}
