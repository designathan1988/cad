// The services' networks (docs/plano-de-escopo.md, phase 13: "conexões automáticas"): for each group of
// disciplines that join (the power panel feeds the lights), a graph of the runs' vertices and the
// points. Vertices at the same place (2 cm) are one node; a run's end on another run's segment splits
// it there (a tee); a point joins the nearest run vertex standing over or under it (5 cm in plan),
// by a vertical drop: the run comes down to the socket in the wall. Heights are absolute. Shortest
// ways from the sources (a panel, a tank, a heater, the sewer's way out) give each point's path. Pure.

import type { Doc } from '../../app/document';
import { GROUP_OF, type MepPoint, type MepRun, POINT_KINDS, systemIn } from './schema';

export interface NetNode {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The point at it, if one is. */
  readonly pointId?: string;
}

export interface NetEdge {
  readonly a: number;
  readonly b: number;
  readonly length: number;
  /** The run it is part of (none: a point's drop to its run) and that run's diameter. */
  readonly runId?: string;
  readonly diameter: number;
}

export interface Network {
  readonly group: string;
  readonly nodes: readonly NetNode[];
  readonly edges: readonly NetEdge[];
  /** Node index by point id. */
  readonly pointNode: ReadonlyMap<string, number>;
  readonly points: readonly MepPoint[];
  readonly runs: readonly MepRun[];
}

/** How near two vertices are to be one node, and a point to its run (in plan). */
const SAME = 0.02;
export const REACH = 0.05;

const groupOf = (doc: Doc, systemId: string, fallback: string): string => {
  const s = systemIn(doc, systemId);
  return s ? GROUP_OF[s.discipline] : fallback;
};

/** Every group's network. */
export function networksOf(doc: Doc): Map<string, Network> {
  const elevation = new Map(doc.levels.map((l) => [l.id, l.elevation]));
  const byGroup = new Map<string, { points: MepPoint[]; runs: MepRun[] }>();
  const bucket = (g: string) => byGroup.get(g) ?? (byGroup.set(g, { points: [], runs: [] }), byGroup.get(g)!);
  for (const p of doc.mepPoints) bucket(groupOf(doc, p.systemId, GROUP_OF[POINT_KINDS[p.kind].discipline])).points.push(p);
  for (const r of doc.mepRuns) bucket(groupOf(doc, r.systemId, 'electric')).runs.push(r);
  const out = new Map<string, Network>();
  for (const [group, { points, runs }] of byGroup) out.set(group, build(group, points, runs, (id) => elevation.get(id) ?? 0));
  return out;
}

function build(group: string, points: readonly MepPoint[], runs: readonly MepRun[], elevationOf: (levelId: string) => number): Network {
  const nodes: NetNode[] = [];
  const find = (x: number, y: number, z: number): number => {
    const i = nodes.findIndex((n) => Math.abs(n.x - x) <= SAME && Math.abs(n.y - y) <= SAME && Math.abs(n.z - z) <= SAME);
    if (i >= 0) return i;
    nodes.push({ x, y, z });
    return nodes.length - 1;
  };
  // The runs' vertices, absolute; their segments.
  const paths = runs.map((r) => r.points.map((v) => ({ x: v.x, y: v.y, z: v.z + elevationOf(r.levelId) })));
  const segs: { run: MepRun; a: number; b: number }[] = [];
  paths.forEach((path, k) => {
    for (let i = 1; i < path.length; i++) segs.push({ run: runs[k]!, a: find(path[i - 1]!.x, path[i - 1]!.y, path[i - 1]!.z), b: find(path[i]!.x, path[i]!.y, path[i]!.z) });
  });
  // A run's end on another's segment: that segment split there (a tee).
  const ends = paths.flatMap((p) => [p[0]!, p[p.length - 1]!]);
  const edges: NetEdge[] = [];
  const dist = (i: number, j: number) => Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y, nodes[i]!.z - nodes[j]!.z);
  for (const s of segs) {
    const A = nodes[s.a]!;
    const B = nodes[s.b]!;
    const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
    const splits: { t: number; node: number }[] = [];
    if (len2 > 0)
      for (const e of ends) {
        const t = ((e.x - A.x) * d.x + (e.y - A.y) * d.y + (e.z - A.z) * d.z) / len2;
        if (t <= 0.001 || t >= 0.999) continue;
        if (Math.hypot(A.x + d.x * t - e.x, A.y + d.y * t - e.y, A.z + d.z * t - e.z) <= SAME) splits.push({ t, node: find(e.x, e.y, e.z) });
      }
    const chain = [s.a, ...splits.sort((p, q) => p.t - q.t).map((x) => x.node), s.b];
    for (let i = 1; i < chain.length; i++) if (chain[i] !== chain[i - 1]) edges.push({ a: chain[i - 1]!, b: chain[i]!, length: dist(chain[i - 1]!, chain[i]!), runId: s.run.id, diameter: s.run.diameter });
  }
  // The points: a node each, joined to the nearest vertex over or under it.
  const vertexCount = nodes.length;
  const pointNode = new Map<string, number>();
  for (const p of points) {
    const z = p.height + elevationOf(p.levelId);
    const own = nodes.findIndex((n, i) => i < vertexCount && Math.abs(n.x - p.at.x) <= SAME && Math.abs(n.y - p.at.y) <= SAME && Math.abs(n.z - z) <= SAME);
    if (own >= 0) {
      nodes[own] = { ...nodes[own]!, pointId: p.id };
      pointNode.set(p.id, own);
      continue;
    }
    nodes.push({ x: p.at.x, y: p.at.y, z, pointId: p.id });
    const i = nodes.length - 1;
    pointNode.set(p.id, i);
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < vertexCount; j++) {
      const n = nodes[j]!;
      if (Math.hypot(n.x - p.at.x, n.y - p.at.y) > REACH) continue;
      const dd = dist(i, j);
      if (dd < bestD) (bestD = dd), (best = j);
    }
    if (best >= 0) {
      const diameter = edges.find((e) => e.a === best || e.b === best)?.diameter ?? 0.02;
      edges.push({ a: best, b: i, length: bestD, diameter });
    }
  }
  return { group, nodes, edges, pointNode, points, runs };
}

/** The shortest way from the sources to every node: its distance and the edge it comes by (−1 at a source, unreached absent). */
export function fromSources(net: Network, sources: readonly number[]): { dist: Map<number, number>; via: Map<number, number> } {
  const adj = new Map<number, number[]>();
  net.edges.forEach((e, k) => {
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(k);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(k);
  });
  const dist = new Map<number, number>();
  const via = new Map<number, number>();
  const open = new Set<number>();
  for (const s of sources) {
    dist.set(s, 0);
    via.set(s, -1);
    open.add(s);
  }
  while (open.size > 0) {
    let u = -1;
    for (const n of open) if (u < 0 || dist.get(n)! < dist.get(u)!) u = n;
    open.delete(u);
    for (const k of adj.get(u) ?? []) {
      const e = net.edges[k]!;
      const v = e.a === u ? e.b : e.a;
      const d = dist.get(u)! + e.length;
      if (d < (dist.get(v) ?? Infinity) - 1e-12) {
        dist.set(v, d);
        via.set(v, k);
        open.add(v);
      }
    }
  }
  return { dist, via };
}

/** The edges from a node back to its source, nearest first. */
export function pathTo(net: Network, via: ReadonlyMap<number, number>, node: number): number[] {
  const out: number[] = [];
  let n = node;
  for (let guard = 0; guard < net.edges.length + 1; guard++) {
    const k = via.get(n);
    if (k === undefined || k < 0) break;
    out.push(k);
    const e = net.edges[k]!;
    n = e.a === n ? e.b : e.a;
  }
  return out;
}

/** The source nodes of a network: its points of a kind that feeds the rest. */
export const sourcesOf = (net: Network): number[] => net.points.filter((p) => POINT_KINDS[p.kind].source).map((p) => net.pointNode.get(p.id)!);

export type FittingKind = 'elbow90' | 'elbow45' | 'tee' | 'cross';

export interface Fitting {
  readonly group: string;
  readonly kind: FittingKind;
  /** m: the largest of the pipes it joins. */
  readonly diameter: number;
  readonly count: number;
}

/**
 * The fittings the networks need, from their geometry: where two pieces meet turning, an elbow (90°
 * from a turn of 67.5° on, else 45°, adopted); three, a tee; four or more, a cross. A point's drop
 * counts as a piece (the branch to a socket off a passing conduit is a tee). Counted by group and
 * diameter; a point at a run's end needs none.
 */
export function fittingsOf(doc: Doc): Fitting[] {
  const counts = new Map<string, Fitting>();
  const add = (group: string, kind: FittingKind, diameter: number) => {
    const key = `${group}|${kind}|${diameter}`;
    const f = counts.get(key);
    counts.set(key, { group, kind, diameter, count: (f?.count ?? 0) + 1 });
  };
  for (const net of networksOf(doc).values()) {
    const at = new Map<number, number[]>();
    net.edges.forEach((e, k) => {
      if (e.length < 1e-9) return;
      (at.get(e.a) ?? at.set(e.a, []).get(e.a)!).push(k);
      (at.get(e.b) ?? at.set(e.b, []).get(e.b)!).push(k);
    });
    for (const [node, ks] of at) {
      if (ks.length < 2) continue;
      const diameter = Math.max(...ks.map((k) => net.edges[k]!.diameter));
      if (ks.length >= 4) add(net.group, 'cross', diameter);
      else if (ks.length === 3) add(net.group, 'tee', diameter);
      else {
        const n = net.nodes[node]!;
        const dir = (k: number) => {
          const e = net.edges[k]!;
          const o = net.nodes[e.a === node ? e.b : e.a]!;
          const v = { x: o.x - n.x, y: o.y - n.y, z: o.z - n.z };
          const l = Math.hypot(v.x, v.y, v.z);
          return { x: v.x / l, y: v.y / l, z: v.z / l };
        };
        const u = dir(ks[0]!);
        const w = dir(ks[1]!);
        // Straight on: the two ways out are opposite. The turn is how far they are from that.
        const turn = 180 - (Math.acos(Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y + u.z * w.z))) * 180) / Math.PI;
        if (turn >= 67.5) add(net.group, 'elbow90', diameter);
        else if (turn >= 22.5) add(net.group, 'elbow45', diameter);
      }
    }
  }
  return [...counts.values()].sort((a, b) => a.group.localeCompare(b.group) || a.kind.localeCompare(b.kind) || a.diameter - b.diameter);
}
