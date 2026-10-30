// Walls at one point beyond one L, T, X or node (§7.6): two or more crossings at one point, an end on
// a crossing, or an end inside an L's corner or a node. Discovery sees each pair alone: three walls
// crossing at one point each cut the others, and an end on a crossing abutted one of the two walls and
// lay over the other. Here they become one junction, every wall passing the point two arms and every
// end one (footprint.ts gives each its sector, sectors.ts).

import { add, distance, dot, type Point2, scale, sub } from '../../../model/vector';
import { endPoint, faceOffsets, offsetOf, wallDirection } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import { parentOf } from '../geometry/arc';
import type { EndRef } from '../schema';
import type { Abutment, Corner, Crossing, JoinNode, Junction } from './types';

/** How near points must be to be one junction: a quarter of the thinnest wall there. */
const hubOf = (ws: readonly WallShape[]): number => Math.min(...ws.map((w) => w.thickness)) / 4;

/** Within the wall's band, an eighth of its thickness clear of both faces. */
function wellInside(w: WallShape, p: Point2): boolean {
  const [o0, o1] = faceOffsets(w);
  const f = offsetOf(w, p);
  const margin = w.thickness / 8;
  return f > o0 + margin && f < o1 - margin;
}

/** Where p falls on the wall's reference line. */
export function onLine(w: WallShape, p: Point2): Point2 {
  const d = wallDirection(w);
  return add(w.start, scale(d, dot(sub(p, w.start), d)));
}

export function gatherJunctions(
  byId: ReadonlyMap<string, WallShape>,
  graph: { corners: readonly Corner[]; nodes: readonly JoinNode[]; crossings: readonly Crossing[]; abutments: readonly Abutment[] },
  inside: (host: WallShape, p: Point2) => boolean,
): Junction[] {
  const straight = (id: string) => parentOf(id) === id;
  const at = (r: EndRef) => endPoint(byId.get(r.wallId)!, r.end);
  const junctions: Junction[] = [];
  const takenAbutments = new Set<Abutment>();

  // Crossings at one point, by union of points less than a wall's thickness apart: three walls drawn by
  // hand cross a few centimetres apart, and each X cut alone against the others left finish stubs and
  // core outlines inside the one block of core they make.
  const crossings = graph.crossings.filter((c) => straight(c.throughId) && straight(c.cutId));
  const parent = crossings.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  const wallsOf = (c: Crossing) => [byId.get(c.throughId)!, byId.get(c.cutId)!];
  for (let i = 0; i < crossings.length; i++) {
    for (let j = i + 1; j < crossings.length; j++) {
      const a = crossings[i]!;
      const b = crossings[j]!;
      const ws = [...wallsOf(a), ...wallsOf(b)];
      if (distance(a.point, b.point) <= Math.max(...ws.map((w) => w.thickness))) parent[root(j)] = root(i);
    }
  }
  const byRoot = new Map<number, Crossing[]>();
  crossings.forEach((c, i) => byRoot.set(root(i), [...(byRoot.get(root(i)) ?? []), c]));
  const centre = (cs: readonly Crossing[]) => scale(cs.reduce((s, c) => add(s, c.point), { x: 0, y: 0 }), 1 / cs.length);
  const passingOf = (cs: readonly Crossing[]) => [...new Set(cs.flatMap((c) => [c.throughId, c.cutId]))];
  // One junction where the points nearly coincide, or where its point is inside every wall passing it,
  // each arm then covering its sector from there; farther apart, each X on its own.
  const groups = [...byRoot.values()].flatMap((cs) => {
    const point = centre(cs);
    const shapes = passingOf(cs).map((id) => byId.get(id)!);
    const one = cs.every((c) => distance(c.point, point) <= hubOf(shapes)) || shapes.every((w) => wellInside(w, point));
    return one ? [cs] : cs.map((c) => [c]);
  });

  for (const group of groups) {
    const point = centre(group);
    const passing = passingOf(group);
    const shapes = passing.map((id) => byId.get(id)!);
    const hub = hubOf(shapes);
    // An end on the point, or inside two of the walls passing it.
    const inHub = (p: Point2) => distance(p, point) <= hub || shapes.filter((w) => inside(w, p)).length >= 2;
    const abutments = graph.abutments.filter((x) => straight(x.abutting.wallId) && !takenAbutments.has(x) && inHub(at(x.abutting)));
    const corners = graph.corners.filter((x) => x.ends.every((r) => straight(r.wallId)) && inHub(x.node));
    const nodes = graph.nodes.filter((x) => x.ends.every((r) => straight(r.wallId)) && inHub(x.point));
    if (group.length < 2 && abutments.length === 0 && corners.length === 0 && nodes.length === 0) continue;
    abutments.forEach((x) => takenAbutments.add(x));
    junctions.push({
      point,
      passing,
      ends: [...abutments.map((x) => x.abutting), ...corners.flatMap((x) => x.ends), ...nodes.flatMap((x) => x.ends)],
      absorbs: { corners, nodes, crossings: group, abutments },
    });
  }

  // An end inside an L's corner, or inside two walls of a node: one more arm there (two such ends into
  // one corner, two more arms).
  const around = new Map<Corner | JoinNode, { point: Point2; ends: EndRef[]; abutments: Abutment[] }>();
  const used = new Set<Corner | JoinNode>(junctions.flatMap((j) => [...j.absorbs.corners, ...j.absorbs.nodes]));
  const absorbed = (c: Corner | JoinNode) => used.has(c);
  for (const x of graph.abutments) {
    if (takenAbutments.has(x) || !straight(x.abutting.wallId)) continue;
    const p = at(x.abutting);
    const into = (ends: readonly EndRef[], q: Point2) =>
      ends.every((r) => straight(r.wallId)) &&
      ends.filter((r) => inside(byId.get(r.wallId)!, p)).length >= 2 &&
      distance(p, q) <= Math.max(...ends.map((r) => byId.get(r.wallId)!.thickness));
    const host: Corner | JoinNode | undefined =
      graph.corners.find((c) => !absorbed(c) && into(c.ends, c.node)) ?? graph.nodes.find((nd) => !absorbed(nd) && into(nd.ends, nd.point));
    if (!host) continue;
    takenAbutments.add(x);
    const entry = around.get(host) ?? { point: 'node' in host ? host.node : host.point, ends: [...host.ends], abutments: [] };
    entry.ends.push(x.abutting);
    entry.abutments.push(x);
    around.set(host, entry);
  }
  for (const [host, entry] of around) {
    const corners: Corner[] = 'node' in host ? [host] : [];
    const nodes: JoinNode[] = 'node' in host ? [] : [host];
    junctions.push({ point: entry.point, passing: [], ends: entry.ends, absorbs: { corners, nodes, crossings: [], abutments: entry.abutments } });
    used.add(host);
  }

  // Ends meeting at one point inside another wall that goes on there (two walls coming to one point of
  // a wall from one side): left as their own L, its tip ran through that wall and out of its far face.
  // That wall passes whole; the ends meet one another outside its face.
  for (const x of [...graph.corners, ...graph.nodes]) {
    if (used.has(x) || !x.ends.every((r) => straight(r.wallId))) continue;
    const point = 'node' in x ? x.node : x.point;
    const mine = new Set(x.ends.map((r) => r.wallId));
    const wall = [...byId.values()].find((w) => straight(w.id) && !mine.has(w.id) && wellInside(w, point) && awayFromEnds(w, point));
    if (!wall) continue;
    used.add(x);
    const abutments = graph.abutments.filter((a) => !takenAbutments.has(a) && a.hostId === wall.id && x.ends.some((r) => r.wallId === a.abutting.wallId && r.end === a.abutting.end));
    abutments.forEach((a) => takenAbutments.add(a));
    const corners: Corner[] = 'node' in x ? [x] : [];
    const nodes: JoinNode[] = 'node' in x ? [] : [x];
    junctions.push({ point, passing: [wall.id], ends: x.ends, absorbs: { corners, nodes, crossings: [], abutments }, onWall: true });
  }
  return junctions;
}

/** Along the wall, clear of its two ends by its thickness: where it goes on both ways. */
function awayFromEnds(w: WallShape, p: Point2): boolean {
  const d = wallDirection(w);
  const s = dot(sub(p, w.start), d);
  return s > w.thickness && s < dot(sub(w.end, w.start), d) - w.thickness;
}
