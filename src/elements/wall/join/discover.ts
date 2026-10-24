// Finds which wall ends meet (corners) and which ends stop against another wall (abutments).
// Pure and deterministic: walls are always visited in ascending id order.

import { COLLINEAR_ANGLE, MIN_WALL_LENGTH, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, cross, distance, dot, intersectLines, scale } from '../../../core/vector';
import { endPoint, faceOffsets, offsetOf, stationOf, wallDirection, wallLength } from '../geometry/offset';
import type { EndRef, Wall, WallEnd } from '../schema';
import type { Corner, JoinGraph, JoinWarning } from './types';

const ENDS: readonly WallEnd[] = ['start', 'end'];

export function deriveJoins(walls: readonly Wall[]): JoinGraph {
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
  return { corners, abutments, warnings };
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

function insideBand(host: Wall, p: ReturnType<typeof endPoint>): boolean {
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

function parallel(a: Wall, b: Wall): boolean {
  const da = wallDirection(a);
  const db = wallDirection(b);
  const angle = (Math.atan2(Math.abs(cross(da, db)), Math.abs(dot(da, db))) * 180) / Math.PI;
  return angle < COLLINEAR_ANGLE;
}
