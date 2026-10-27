// Automatic routing of a system's network on a level: each of its points that no pipe or conduit reaches
// from a source is joined to the nearest place the network already reaches (a source, a run's vertex,
// a point it reaches), the nearest first, by an orthogonal path in plan (along x, then along y: as
// pipes and conduits run, square to the walls), at the run's height (mep-ui.ts runVertices: under the
// ceiling, falling for sewer and rain, dropping to each point). Walls are crossed (a run in the ceiling
// passes over them); obstacles, slopes of the ceiling and the shortest tree are not sought.

import type { Point2 } from '../core/vector';
import { distance } from '../core/vector';
import { newId } from '../core/id';
import type { Doc } from './document';
import { fromSources, networksOf, sourcesOf } from '../elements/mep/network';
import { GROUP_OF, MEP_RUN_PREFIX, type MepRun, POINT_KINDS, RUN_DEFAULTS, systemIn } from '../elements/mep/schema';
import { runVertices } from './mep-ui';

/** The runs that join the system's points no run reaches on the level; none when there is no source. */
export function autoRoute(doc: Doc, systemId: string, levelId: string): MepRun[] {
  const sys = systemIn(doc, systemId);
  if (!sys) return [];
  const group = GROUP_OF[sys.discipline];
  const net = networksOf(doc).get(group);
  const points = doc.mepPoints.filter((p) => p.levelId === levelId && p.systemId === systemId);
  const sources = points.filter((p) => POINT_KINDS[p.kind].source);
  // What the network reaches from its sources already.
  const reached = new Set<string>();
  const anchors: Point2[] = [];
  if (net) {
    const { via } = fromSources(net, sourcesOf(net));
    const ok = (node: number | undefined) => node !== undefined && (via.has(node) || sourcesOf(net).includes(node));
    for (const p of net.points) if (ok(net.pointNode.get(p.id))) reached.add(p.id);
    // The network's nodes are at their height over the ground: this level's are between its floor and the next.
    const level = doc.levels.find((l) => l.id === levelId);
    const lo = level?.elevation ?? 0;
    const hi = lo + (level?.height ?? 2.8);
    net.nodes.forEach((n, i) => {
      if (n.z >= lo - 0.5 && n.z <= hi + 1e-6 && ok(i)) anchors.push({ x: n.x, y: n.y });
    });
  }
  for (const s of sources) {
    reached.add(s.id);
    anchors.push(s.at);
  }
  if (anchors.length === 0) return [];
  const left = points.filter((p) => !reached.has(p.id));
  const d = RUN_DEFAULTS[sys.discipline];
  const out: MepRun[] = [];
  let working = doc;
  while (left.length > 0) {
    // The point nearest to what is reached, and where it is reached from.
    let best = -1;
    let from: Point2 = anchors[0]!;
    let bestD = Infinity;
    left.forEach((p, i) => {
      for (const a of anchors) {
        const dd = Math.abs(p.at.x - a.x) + Math.abs(p.at.y - a.y);
        if (dd < bestD) (bestD = dd), (best = i), (from = a);
      }
    });
    const p = left.splice(best, 1)[0]!;
    // Along x, then along y; a straight line when they share either.
    const corner = { x: p.at.x, y: from.y };
    const plan = [from, corner, p.at].filter((q, i, all) => i === 0 || distance(q, all[i - 1]!) > 1e-6);
    if (plan.length < 2) continue;
    const run: MepRun = { id: newId(MEP_RUN_PREFIX), levelId, points: runVertices(working, levelId, systemId, plan), systemId, kind: d.kind, diameter: d.diameter };
    out.push(run);
    working = { ...working, mepRuns: [...working.mepRuns, run] };
    anchors.push(p.at, corner);
  }
  return out;
}
