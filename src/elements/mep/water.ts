// Water at the points (docs/plano-de-escopo.md phase 13: "pressões nos pontos") and the sewer's falls.
// Water: from the tank (or the heater) down the pipes (network.ts) to each outlet; the static head is
// the tank's height over the outlet's; the probable flow in each stretch is NBR 5626's 0,3·√ΣP (L/s,
// P the relative weights of the outlets it feeds); the friction is Hazen-Williams' with C = 140 (PVC)
// taking the pipe's diameter as its bore, plus 20 % for the fittings; the dynamic pressure is the head
// less the losses. NBR 5626 asks at least 10 kPa at an outlet in use and at most 400 kPa standing
// (values to confirm in the edition in force). Sewer: each sloping stretch's fall towards the way out,
// at least 2 % up to 75 mm and 1 % from 100 mm (NBR 8160, to confirm). Pure.

import type { Doc } from '../../app/document';
import { fromSources, type Network, networksOf, pathTo, sourcesOf } from './network';
import { FIXTURES, type MepPoint, pointLoad, POINT_KINDS } from './schema';

export const MIN_DYNAMIC = 10;
export const MAX_STATIC = 400;
/** kPa per metre of water. */
const KPA_PER_M = 9.80665;
const HAZEN_C = 140;
const FITTINGS = 1.2;

export interface OutletPressure {
  readonly point: MepPoint;
  /** Metres of water above it, the losses on its way, and the pressures (kPa); null when no pipe reaches it from a source. */
  readonly head: number | null;
  readonly loss: number | null;
  readonly staticKpa: number | null;
  readonly dynamicKpa: number | null;
  readonly flow: number | null;
  readonly ok: boolean;
}

/** Hazen-Williams' loss (m per m) for a flow (m³/s) in a bore (m). */
export const hazenWilliams = (q: number, d: number, c = HAZEN_C): number => (10.67 * q ** 1.852) / (c ** 1.852 * d ** 4.87);

/** NBR 5626's probable flow (L/s) for a sum of relative weights. */
export const probableFlow = (weights: number): number => 0.3 * Math.sqrt(Math.max(0, weights));

/** The pressures at the outlets of a water group ('coldWater' or 'hotWater'). */
export function pressures(doc: Doc, group: 'coldWater' | 'hotWater'): OutletPressure[] {
  const net = networksOf(doc).get(group);
  if (!net) return [];
  const outlets = net.points.filter((p) => !POINT_KINDS[p.kind].source);
  const sources = sourcesOf(net);
  if (sources.length === 0) return outlets.map((point) => ({ point, head: null, loss: null, staticKpa: null, dynamicKpa: null, flow: null, ok: false }));
  const { via } = fromSources(net, sources);
  // The weight each edge carries: the outlets downstream of it.
  const carried = new Map<number, number>();
  const paths = new Map<string, number[]>();
  for (const o of outlets) {
    const node = net.pointNode.get(o.id)!;
    if (!via.has(node)) continue;
    const path = pathTo(net, via, node);
    paths.set(o.id, path);
    for (const k of path) carried.set(k, (carried.get(k) ?? 0) + pointLoad(o).weight);
  }
  const sourceOf = (path: readonly number[], start: number): number => {
    let n = start;
    for (const k of path) {
      const e = net.edges[k]!;
      n = e.a === n ? e.b : e.a;
    }
    return n;
  };
  return outlets.map((point): OutletPressure => {
    const node = net.pointNode.get(point.id)!;
    const path = paths.get(point.id);
    if (!path) return { point, head: null, loss: null, staticKpa: null, dynamicKpa: null, flow: null, ok: false };
    const src = net.nodes[sourceOf(path, node)]!;
    const head = src.z - net.nodes[node]!.z;
    let loss = 0;
    for (const k of path) {
      const e = net.edges[k]!;
      const q = probableFlow(carried.get(k) ?? 0) / 1000;
      loss += hazenWilliams(q, e.diameter) * e.length * FITTINGS;
    }
    const staticKpa = head * KPA_PER_M;
    const dynamicKpa = (head - loss) * KPA_PER_M;
    return { point, head, loss, staticKpa, dynamicKpa, flow: probableFlow(pointLoad(point).weight), ok: dynamicKpa >= MIN_DYNAMIC && staticKpa <= MAX_STATIC };
  });
}

export interface SewerStretch {
  readonly runId: string;
  /** Its fall towards the way out (%), and the least asked for its diameter. */
  readonly slope: number;
  readonly least: number;
  readonly length: number;
  readonly diameter: number;
  readonly ok: boolean;
  /** The fixtures' contribution units it carries (those up it), and the least diameter they ask (m); 0 and null with none. */
  readonly uhc: number;
  readonly needed: number | null;
  readonly sized: boolean;
}

/** NBR 8160 (1999) table 5: a branch's nominal diameter (m) and the most UHC it takes. */
export const BRANCH_UHC: readonly (readonly [number, number])[] = [
  [0.04, 3],
  [0.05, 6],
  [0.075, 20],
  [0.1, 160],
];
/**
 * NBR 8160 (1999) table 7: a sub-collector's or the building drain's nominal diameter (m) and the most UHC
 * it takes at a least fall of 0.5, 1, 2 and 4 % (none: not allowed at that fall). Up to DN 200, as reproduced.
 */
export const COLLECTOR_UHC: readonly (readonly [number, readonly (number | null)[]])[] = [
  [0.1, [null, 180, 216, 250]],
  [0.15, [null, 700, 840, 1000]],
  [0.2, [1400, 1600, 1920, 2300]],
];
const FALLS = [0.5, 1, 2, 4];

/** The most UHC a pipe of a diameter takes at a fall: as a branch (table 5), from DN 100 the more of that and a collector (table 7). */
export function mostUhc(d: number, slope: number): number {
  const branch = BRANCH_UHC.find(([dn]) => Math.abs(dn - d) < 1e-6)?.[1] ?? 0;
  const col = FALLS.reduce((k, f, i) => (slope >= f - 1e-6 ? i : k), -1);
  const collector = col < 0 ? 0 : (COLLECTOR_UHC.find(([dn]) => Math.abs(dn - d) < 1e-6)?.[1][col] ?? 0);
  return Math.max(branch, collector ?? 0);
}

/** The least nominal diameter for so many UHC at a fall, never under the largest fixture's branch; null past the tables. */
export function neededDiameter(uhc: number, slope: number, least: number): number | null {
  for (const d of [0.04, 0.05, 0.075, 0.1, 0.15, 0.2]) if (d >= least - 1e-9 && mostUhc(d, slope) >= uhc) return d;
  return null;
}

/** The least fall (%) for a sewer pipe's diameter. */
export const leastFall = (d: number): number => (d <= 0.075 + 1e-9 ? 2 : 1);

/** Each sloping stretch of the sewer (and of the rain), its fall towards its way out; drains no pipe takes away. */
export function sewerFalls(doc: Doc, group: 'sewer' | 'rain' = 'sewer'): { stretches: SewerStretch[]; unreached: MepPoint[]; hasOutlet: boolean; unsized: MepPoint[] } {
  const net: Network | undefined = networksOf(doc).get(group);
  if (!net) return { stretches: [], unreached: [], hasOutlet: false, unsized: [] };
  const sources = sourcesOf(net);
  const { dist, via } = fromSources(net, sources);
  // Each fixture's units and branch on every edge of its way out.
  const units = new Map<number, number>();
  const branch = new Map<number, number>();
  for (const p of net.points) {
    const f = p.fixture ? FIXTURES[p.fixture] : null;
    const node = net.pointNode.get(p.id);
    if (!f || node === undefined || !dist.has(node)) continue;
    for (const k of pathTo(net, via, node)) {
      units.set(k, (units.get(k) ?? 0) + f.uhc);
      branch.set(k, Math.max(branch.get(k) ?? 0, f.dn));
    }
  }
  const stretches: SewerStretch[] = [];
  for (const [k, e] of net.edges.entries()) {
    if (!e.runId) continue;
    const a = net.nodes[e.a]!;
    const b = net.nodes[e.b]!;
    const plan = Math.hypot(a.x - b.x, a.y - b.y);
    if (plan < 0.05) continue;
    // Down is the end nearer the way out; with none, the lower end.
    const [up, down] = sources.length > 0 && dist.has(e.a) && dist.has(e.b) ? (dist.get(e.a)! >= dist.get(e.b)! ? [a, b] : [b, a]) : a.z >= b.z ? [a, b] : [b, a];
    const slope = ((up.z - down.z) / plan) * 100;
    const least = leastFall(e.diameter);
    const uhc = units.get(k) ?? 0;
    const needed = uhc > 0 ? neededDiameter(uhc, slope, branch.get(k) ?? 0) : null;
    stretches.push({ runId: e.runId, slope, least, length: plan, diameter: e.diameter, ok: slope >= least - 1e-6, uhc, needed, sized: needed === null ? uhc === 0 : e.diameter >= needed - 1e-6 });
  }
  const unreached = net.points.filter((p) => !POINT_KINDS[p.kind].source && !dist.has(net.pointNode.get(p.id)!));
  // The sewer's drains that say no fixture: their units are not counted.
  const unsized = group === 'sewer' ? net.points.filter((p) => !POINT_KINDS[p.kind].source && !p.fixture) : [];
  return { stretches, unreached, hasOutlet: sources.length > 0, unsized };
}
