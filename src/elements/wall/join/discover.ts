// Finds which wall ends meet (corners) and which ends stop against another wall (abutments).
// Pure and deterministic: walls are always visited in ascending id order.

import { COLLINEAR_ANGLE, MIN_WALL_LENGTH, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, cross, distance, dot, intersectLines, scale } from '../../../core/vector';
import { endPoint, faceOffsets, offsetOf, stationOf, wallDirection, wallLength } from '../geometry/offset';
import type { EndRef, WallEnd } from '../schema';
import type { WallShape } from '../geometry/shape';
import type { Corner, Crossing, JoinGraph, JoinWarning } from './types';

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
  const clusters = clusterEnds(ends, at);

  const corners: Corner[] = [];
  const free: EndRef[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) free.push(cluster[0]!);
    else if (cluster.length === 2) {
      const ends = [cluster[0]!, cluster[1]!] as const;
      corners.push({ ends, node: scale(add(at(ends[0]), at(ends[1])), 0.5) });
    } else warnings.push({ kind: 'complexJoin', walls: cluster.map((r) => r.wallId) });
  }

  let abutments: { abutting: EndRef; hostId: string }[] = [];
  for (const ref of free) {
    const wall = byId.get(ref.wallId)!;
    const p = at(ref);
    for (const host of valid) {
      if (host.id === wall.id || !insideBand(host, p)) continue;
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
  return { corners, abutments, crossings: findCrossings(valid), warnings };
}

/**
 * Pairs whose reference lines cross inside both walls, with no end of either inside the other's
 * band (that would be a T or a corner). The through wall is chosen by goesThrough.
 */
function findCrossings(walls: readonly WallShape[]): Crossing[] {
  const crossings: Crossing[] = [];
  walls.forEach((a, i) => {
    walls.slice(i + 1).forEach((b) => {
      if (parallel(a, b)) return;
      const point = intersectLines(a.start, wallDirection(a), b.start, wallDirection(b));
      if (point === null || !interior(a, point) || !interior(b, point)) return;
      if ([a.start, a.end].some((p) => withinBand(b, p)) || [b.start, b.end].some((p) => withinBand(a, p))) return;
      const aThrough = goesThrough(a, b);
      crossings.push({ throughId: aThrough ? a.id : b.id, cutId: aThrough ? b.id : a.id, point });
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

const interior = (w: WallShape, p: ReturnType<typeof endPoint>): boolean => {
  const s = stationOf(w, p);
  return s > POINT_TOLERANCE && s < wallLength(w) - POINT_TOLERANCE;
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

function insideBand(host: WallShape, p: ReturnType<typeof endPoint>): boolean {
  const [o0, o1] = faceOffsets(host);
  const f = offsetOf(host, p);
  const s = stationOf(host, p);
  return (
    f >= o0 - POINT_TOLERANCE &&
    f <= o1 + POINT_TOLERANCE &&
    s > POINT_TOLERANCE &&
    s < wallLength(host) - POINT_TOLERANCE
  );
}

function parallel(a: WallShape, b: WallShape): boolean {
  const da = wallDirection(a);
  const db = wallDirection(b);
  const angle = (Math.atan2(Math.abs(cross(da, db)), Math.abs(dot(da, db))) * 180) / Math.PI;
  return angle < COLLINEAR_ANGLE;
}
