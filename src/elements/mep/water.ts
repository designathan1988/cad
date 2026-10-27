// Water at the points (docs/plano-de-escopo.md phase 13: "pressões nos pontos") and the sewer's falls.
// Water: from the tank down the pipes (network.ts) to each outlet, the hot through the heater; the static head is
// the tank's height over the outlet's; the probable flow in each stretch is NBR 5626's 0,3·√ΣP (L/s,
// P the relative weights of the outlets it feeds); the friction is Hazen-Williams' with C = 140 (PVC)
// taking the pipe's diameter as its bore, plus each fitting the water passes on its way as its equivalent
// length (NBR 5626:1998 table A.3, smooth pipe: an elbow where it turns, a tee straight through or out of
// its side); the dynamic pressure is the head
// less the losses. NBR 5626 asks at least 10 kPa at an outlet in use and at most 400 kPa standing
// (values to confirm in the edition in force). Sewer: each sloping stretch's fall towards the way out,
// at least 2 % up to 75 mm and 1 % from 100 mm (NBR 8160, to confirm); its stacks and vent pipes, the
// upright pipes, sized by NBR 8160 (1999) tables 6 and 2 and their open ends over the roof; each trap's
// distance to its vent (table 1) and the vent branches (table 8). Pure.

import type { Doc } from '../../app/document';
import { fromSources, type Network, networksOf, pathTo, REACH, sourcesOf } from './network';
import { FIXTURES, type MepPoint, pointLoad, POINT_KINDS } from './schema';
import { insideRing } from '../room/derive';

export const MIN_DYNAMIC = 10;
export const MAX_STATIC = 400;
/** kPa per metre of water. */
const KPA_PER_M = 9.80665;
const HAZEN_C = 140;

/**
 * NBR 5626:1998 table A.3, smooth pipe (plastic, copper): each fitting's equivalent length (m) by nominal
 * diameter (mm): elbow 90°, elbow 45°, tee straight through, tee out of its side.
 */
export const EQUIVALENT: readonly (readonly [number, number, number, number, number])[] = [
  [15, 1.1, 0.4, 0.7, 2.3],
  [20, 1.2, 0.5, 0.8, 2.4],
  [25, 1.5, 0.7, 0.9, 3.1],
  [32, 2.0, 1.0, 1.5, 4.6],
  [40, 3.2, 1.0, 2.2, 7.3],
  [50, 3.4, 1.3, 2.3, 7.6],
  [65, 3.7, 1.7, 2.4, 7.8],
  [80, 3.9, 1.8, 2.5, 8.0],
  [100, 4.3, 1.9, 2.6, 8.3],
  [125, 4.9, 2.4, 3.3, 10.0],
  [150, 5.4, 2.6, 3.8, 11.1],
];
export type PassKind = 'elbow90' | 'elbow45' | 'teeStraight' | 'teeSide';
/** A fitting's equivalent length (m) at a diameter (m): the table's row for it, else the next larger. */
export function equivalentLength(kind: PassKind, diameter: number): number {
  const mm = diameter * 1000;
  const row = EQUIVALENT.find((r) => r[0] >= mm - 0.5) ?? EQUIVALENT[EQUIVALENT.length - 1]!;
  return row[kind === 'elbow90' ? 1 : kind === 'elbow45' ? 2 : kind === 'teeStraight' ? 3 : 4];
}

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

interface Demand {
  readonly node: number;
  readonly weight: number;
}

/** A network's water from its sources to some demands: each demand's way, the source it ends at, and the losses along a way (m). */
function flowOver(net: Network, demands: readonly Demand[]) {
  const { via } = fromSources(net, sourcesOf(net));
  // The weight each edge carries: the demands downstream of it.
  const carried = new Map<number, number>();
  const paths = new Map<number, number[]>();
  for (const d of demands) {
    if (!via.has(d.node)) continue;
    const path = pathTo(net, via, d.node);
    paths.set(d.node, path);
    for (const k of path) carried.set(k, (carried.get(k) ?? 0) + d.weight);
  }
  const sourceOf = (path: readonly number[], start: number): number => {
    let n = start;
    for (const k of path) {
      const e = net.edges[k]!;
      n = e.a === n ? e.b : e.a;
    }
    return n;
  };
  // How many pieces meet at each node (a fitting is where two or more do).
  const degree = new Map<number, number>();
  for (const e of net.edges) if (e.length > 1e-9) for (const n of [e.a, e.b]) degree.set(n, (degree.get(n) ?? 0) + 1);
  // The way out of a node along an edge, a unit vector.
  const away = (k: number, node: number) => {
    const e = net.edges[k]!;
    const a = net.nodes[node]!;
    const b = net.nodes[e.a === node ? e.b : e.a]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l, z: (b.z - a.z) / l };
  };
  // The fitting the water passes at a node between two edges of its way: turning, an elbow; through a
  // junction, a tee straight through or out of its side; straight on with nothing else there, none.
  const passAt = (node: number, k1: number, k2: number): PassKind | null => {
    const u = away(k1, node);
    const w = away(k2, node);
    const turn = 180 - (Math.acos(Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y + u.z * w.z))) * 180) / Math.PI;
    if ((degree.get(node) ?? 0) >= 3) return turn < 22.5 ? 'teeStraight' : 'teeSide';
    return turn >= 67.5 ? 'elbow90' : turn >= 22.5 ? 'elbow45' : null;
  };
  // The friction along a way, each edge's with the fittings at its end toward the outlet (from the outlet's
  // node up to the source, as pathTo gives it).
  const lossOf = (path: readonly number[], start: number): number => {
    let n = start;
    let t = 0;
    path.forEach((k, i) => {
      const e = net.edges[k]!;
      const j = hazenWilliams(probableFlow(carried.get(k) ?? 0) / 1000, e.diameter);
      let length = e.length;
      const next = e.a === n ? e.b : e.a;
      const k2 = path[i + 1];
      if (k2 !== undefined) {
        const pass = passAt(next, k, k2);
        if (pass) length += equivalentLength(pass, e.diameter);
      }
      t += j * length;
      n = next;
    });
    return t;
  };
  return { paths, sourceOf, lossOf };
}

const outletsOf = (net: Network) => net.points.filter((p) => !POINT_KINDS[p.kind].source);
const demandsOf = (net: Network): Demand[] => outletsOf(net).map((o) => ({ node: net.pointNode.get(o.id)!, weight: pointLoad(o).weight }));

/** The cold network's node a heater takes its water from: the nearest over or under it (5 cm in plan); null with none. */
function inletOf(cold: Network, at: { x: number; y: number; z: number }): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  cold.nodes.forEach((n, j) => {
    if (Math.hypot(n.x - at.x, n.y - at.y) > REACH) return;
    const d = Math.hypot(n.x - at.x, n.y - at.y, n.z - at.z);
    if (d < bestD) (best = j), (bestD = d);
  });
  return best;
}

/**
 * The pressures at the outlets of a water group ('coldWater' or 'hotWater'). A heater a cold pipe reaches
 * takes the cold water's head: the hot outlets' head is from the tank that feeds it, and their losses
 * those of the cold way to the heater (carrying the hot outlets' weights too) and of the hot way after it.
 * A heater no cold pipe reaches is taken as the hot water's own source, its height the head.
 */
export function pressures(doc: Doc, group: 'coldWater' | 'hotWater'): OutletPressure[] {
  const nets = networksOf(doc);
  const net = nets.get(group);
  if (!net) return [];
  const outlets = outletsOf(net);
  if (sourcesOf(net).length === 0) return outlets.map((point) => ({ point, head: null, loss: null, staticKpa: null, dynamicKpa: null, flow: null, ok: false }));
  const hot = nets.get('hotWater');
  const cold = nets.get('coldWater');
  // Each heater's draw on the cold network: the weights of the hot outlets it feeds, at its inlet.
  const hotFlow = hot ? flowOver(hot, demandsOf(hot)) : null;
  const feeds: Demand[] = [];
  const inlet = new Map<number, number>();
  if (hot && hotFlow && cold)
    for (const h of hot.points.filter((p) => POINT_KINDS[p.kind].source)) {
      const hn = hot.pointNode.get(h.id)!;
      const c = inletOf(cold, hot.nodes[hn]!);
      if (c === null) continue;
      const weight = outletsOf(hot).reduce((t, o) => {
        const on = hot.pointNode.get(o.id)!;
        const path = hotFlow.paths.get(on);
        return path && hotFlow.sourceOf(path, on) === hn ? t + pointLoad(o).weight : t;
      }, 0);
      feeds.push({ node: c, weight });
      inlet.set(hn, c);
    }
  const coldFlow = cold ? flowOver(cold, [...demandsOf(cold), ...feeds]) : null;
  const flow = group === 'hotWater' ? hotFlow! : coldFlow!;
  return outlets.map((point): OutletPressure => {
    const node = net.pointNode.get(point.id)!;
    const path = flow.paths.get(node);
    if (!path) return { point, head: null, loss: null, staticKpa: null, dynamicKpa: null, flow: null, ok: false };
    const src = flow.sourceOf(path, node);
    let top = net.nodes[src]!.z;
    let loss = flow.lossOf(path, node);
    const c = group === 'hotWater' ? inlet.get(src) : undefined;
    const coldPath = c === undefined ? undefined : coldFlow?.paths.get(c);
    if (cold && coldFlow && c !== undefined && coldPath) {
      top = cold.nodes[coldFlow.sourceOf(coldPath, c)]!.z;
      loss += coldFlow.lossOf(coldPath, c);
    }
    const head = top - net.nodes[node]!.z;
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
  /** The rain's design flow it carries (L/min, NBR 10844: I·A/60 of the drains up it); 0 in the sewer. */
  readonly flow: number;
  readonly needed: number | null;
  readonly sized: boolean;
}

/**
 * NBR 10844 (1989) table 4, n = 0.011 (plastic, fibre cement, steel): a horizontal rain conductor's inner
 * diameter (m) and its flow (L/min) at a fall of 0.5, 1, 2 and 4 %, the water at 2/3 of the diameter.
 */
export const RAIN_CAPACITY: readonly (readonly [number, readonly number[]])[] = [
  [0.05, [32, 45, 64, 90]],
  [0.075, [95, 133, 188, 267]],
  [0.1, [204, 287, 405, 575]],
  [0.125, [370, 521, 735, 1040]],
  [0.15, [602, 847, 1190, 1690]],
  [0.2, [1300, 1820, 2570, 3650]],
  [0.25, [2350, 3310, 4660, 6620]],
  [0.3, [3820, 5380, 7590, 10800]],
];
/** NBR 10844: 150 mm/h may be taken for a building of up to 100 m² in plan (5.1.4); the least fall of a horizontal conductor (5.7.1). */
export const DEFAULT_RAIN = 150;
export const RAIN_LEAST_FALL = 0.5;

/** A rain conductor's flow (L/min) at a fall: the table's at the largest of its falls the stretch reaches; 0 under 0.5 %. */
export function rainCapacity(d: number, slope: number): number {
  const col = FALLS.reduce((k, f, i) => (slope >= f - 1e-6 ? i : k), -1);
  return col < 0 ? 0 : (RAIN_CAPACITY.find(([dn]) => Math.abs(dn - d) < 1e-6)?.[1][col] ?? 0);
}

/** The least diameter of the table for a flow (L/min) at a fall; null past it. */
export function rainDiameter(q: number, slope: number): number | null {
  return RAIN_CAPACITY.find(([d]) => rainCapacity(d, slope) >= q - 1e-9)?.[0] ?? null;
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
 * it takes at a least fall of 0.5, 1, 2 and 4 % (none: not allowed at that fall).
 */
export const COLLECTOR_UHC: readonly (readonly [number, readonly (number | null)[]])[] = [
  [0.1, [null, 180, 216, 250]],
  [0.15, [null, 700, 840, 1000]],
  [0.2, [1400, 1600, 1920, 2300]],
  [0.25, [2500, 2900, 3500, 4200]],
  [0.3, [3900, 4600, 5600, 6700]],
  [0.4, [7000, 8300, 10000, 12000]],
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
  for (const d of [0.04, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]) if (d >= least - 1e-9 && mostUhc(d, slope) >= uhc) return d;
  return null;
}

/** Each fixture's units and branch diameter on every edge of its way out: the UHC an edge carries and its largest branch. */
function fixtureLoads(net: Network, dist: ReadonlyMap<number, number>, via: ReadonlyMap<number, number>): { units: Map<number, number>; branch: Map<number, number> } {
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
  return { units, branch };
}

/** The least fall (%) for a sewer pipe's diameter. */
export const leastFall = (d: number): number => (d <= 0.075 + 1e-9 ? 2 : 1);

/**
 * Each sloping stretch of the sewer (and of the rain), its fall towards its way out; drains no pipe takes
 * away. The sewer's units and diameters by NBR 8160; the rain's flow (I·A/60 of the drains up it, I the
 * project's design rain) and diameter by NBR 10844, its least fall 0.5 %.
 */
export function sewerFalls(doc: Doc, group: 'sewer' | 'rain' = 'sewer'): { stretches: SewerStretch[]; unreached: MepPoint[]; hasOutlet: boolean; unsized: MepPoint[] } {
  const net: Network | undefined = networksOf(doc).get(group);
  if (!net) return { stretches: [], unreached: [], hasOutlet: false, unsized: [] };
  const sources = sourcesOf(net);
  const { dist, via } = fromSources(net, sources);
  const { units, branch } = fixtureLoads(net, dist, via);
  // Each rain drain's flow on every edge of its way out.
  const intensity = doc.simulation?.rain ?? DEFAULT_RAIN;
  const flows = new Map<number, number>();
  if (group === 'rain')
    for (const p of net.points) {
      const node = net.pointNode.get(p.id);
      if (!p.area || node === undefined || !dist.has(node)) continue;
      for (const k of pathTo(net, via, node)) flows.set(k, (flows.get(k) ?? 0) + (intensity * p.area) / 60);
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
    const least = group === 'rain' ? RAIN_LEAST_FALL : leastFall(e.diameter);
    const uhc = units.get(k) ?? 0;
    const flow = flows.get(k) ?? 0;
    const load = group === 'rain' ? flow : uhc;
    const needed = load <= 0 ? null : group === 'rain' ? rainDiameter(flow, slope) : neededDiameter(uhc, slope, branch.get(k) ?? 0);
    stretches.push({ runId: e.runId, slope, least, length: plan, diameter: e.diameter, ok: slope >= least - 1e-6, uhc, flow, needed, sized: needed === null ? load === 0 : e.diameter >= needed - 1e-6 });
  }
  const unreached = net.points.filter((p) => !POINT_KINDS[p.kind].source && !dist.has(net.pointNode.get(p.id)!));
  // The sewer's drains that say no fixture, the rain's no area: what they take is not counted.
  const unsized = net.points.filter((p) => !POINT_KINDS[p.kind].source && p.kind !== 'ventTerminal' && (group === 'sewer' ? !p.fixture : !p.area));
  return { stretches, unreached, hasOutlet: sources.length > 0, unsized };
}

/**
 * NBR 8160 (1999) table 6: a stack's nominal diameter (m) and the most UHC it takes in a building of up to
 * three storeys, and of more.
 */
export const STACK_UHC: readonly (readonly [number, number, number])[] = [
  [0.04, 4, 8],
  [0.05, 10, 24],
  [0.075, 30, 70],
  [0.1, 240, 500],
  [0.15, 960, 1900],
  [0.2, 2200, 3600],
  [0.25, 3800, 5600],
  [0.3, 6000, 8400],
];

/** The least stack diameter for so many UHC in a building of so many storeys, never under its largest branch; null past the table. */
export function stackDiameter(uhc: number, storeys: number, least: number): number | null {
  return STACK_UHC.find(([d, low, high]) => d >= least - 1e-9 && (storeys <= 3 ? low : high) >= uhc - 1e-9)?.[0] ?? null;
}

/** The vent pipes' diameters of table 2 (m). */
const VENT_DN = [0.04, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3];
/**
 * NBR 8160 (1999) table 2: the stack's or branch's nominal diameter (m), its UHC, and the longest vent column
 * (m) each vent diameter of VENT_DN allows (null: not that one).
 */
export const VENT_COLUMN: readonly (readonly [number, number, readonly (number | null)[]])[] = [
  [0.04, 8, [46]],
  [0.04, 10, [30]],
  [0.05, 12, [23, 61]],
  [0.05, 20, [15, 46]],
  [0.075, 10, [13, 46, 317]],
  [0.075, 21, [10, 33, 247]],
  [0.075, 53, [8, 29, 207]],
  [0.075, 102, [8, 26, 189]],
  [0.1, 43, [null, 11, 76, 299]],
  [0.1, 140, [null, 8, 61, 229]],
  [0.1, 320, [null, 7, 52, 195]],
  [0.1, 530, [null, 6, 46, 177]],
  [0.15, 500, [null, null, 10, 40, 305]],
  [0.15, 1100, [null, null, 8, 31, 238]],
  [0.15, 2000, [null, null, 7, 26, 201]],
  [0.15, 2900, [null, null, 6, 23, 183]],
  [0.2, 1800, [null, null, null, 10, 73, 286]],
  [0.2, 3400, [null, null, null, 7, 57, 219]],
  [0.2, 5600, [null, null, null, 6, 49, 186]],
  [0.2, 7600, [null, null, null, 5, 43, 171]],
  [0.25, 4000, [null, null, null, null, 24, 94, 293]],
  [0.25, 7200, [null, null, null, null, 18, 73, 225]],
  [0.25, 11000, [null, null, null, null, 16, 60, 192]],
  [0.25, 15000, [null, null, null, null, 14, 55, 174]],
  [0.3, 7300, [null, null, null, null, 9, 37, 116, 287]],
  [0.3, 13000, [null, null, null, null, 7, 29, 90, 219]],
  [0.3, 20000, [null, null, null, null, 6, 24, 76, 186]],
  [0.3, 26000, [null, null, null, null, 5, 22, 70, 152]],
];

/** The least vent column diameter for the pipe it vents (its diameter, its UHC) and its length (m); null past table 2. */
export function ventDiameter(vented: number, uhc: number, length: number): number | null {
  const row = VENT_COLUMN.find(([d, u]) => Math.abs(d - vented) < 1e-6 && u >= uhc - 1e-9);
  if (!row) return null;
  const i = row[2].findIndex((l) => l !== null && l >= length - 1e-9);
  return i < 0 ? null : VENT_DN[i]!;
}

/** NBR 8160 4.3.6 b): a vent's open end at least this far over the roof (2 m on a roof slab used for more; not known here). */
export const VENT_ABOVE = 0.3;

/** NBR 8160 (1999) table 1: a trap's discharge branch nominal diameter (m) and how far (m) at most it is from the vent that serves it. */
export const TRAP_TO_VENT: readonly (readonly [number, number])[] = [
  [0.04, 1.0],
  [0.05, 1.2],
  [0.075, 1.8],
  [0.1, 2.4],
];
/** The farthest a trap of a branch diameter may be from its vent; a branch past the table takes its last row. */
export const trapReach = (dn: number): number => (TRAP_TO_VENT.find(([d]) => d >= dn - 1e-9) ?? TRAP_TO_VENT[TRAP_TO_VENT.length - 1]!)[1];

/**
 * NBR 8160 (1999) table 8: a vent branch's nominal diameter (m) for the group of fixtures it vents, by their
 * UHC, with a toilet among them (up to 17: DN 50; 18 to 60: DN 75) or not (up to 12: DN 40; 13 to 18: DN 50;
 * 19 to 36: DN 75); null past the table.
 */
export function ventBranchDiameter(uhc: number, toilet: boolean): number | null {
  if (toilet) return uhc <= 17 ? 0.05 : uhc <= 60 ? 0.075 : null;
  return uhc <= 12 ? 0.04 : uhc <= 18 ? 0.05 : uhc <= 36 ? 0.075 : null;
}

/** A fixture's trap and the vent that serves it: the nearest upright pipe open to the air, along the pipes. */
export interface TrapVent {
  readonly point: MepPoint;
  /** Its discharge branch's diameter (table 3, m), and how far along the pipes its vent is (m; null: none reached). */
  readonly dn: number;
  readonly distance: number | null;
  readonly most: number;
  /** The index in `stacks` of the pipe that vents it; null with none. */
  readonly vent: number | null;
  readonly ok: boolean;
}

/** Roofs as their sloped faces: each a plan polygon and its height over a point of it (absolute, m). */
export type RoofFaces = { readonly faces: readonly { readonly polygon: readonly { x: number; y: number }[]; readonly z: (p: { x: number; y: number }) => number }[] };

/** What covers a plan point: the highest roof face over it or, under none, the top level's ceiling (absolute, m). */
export function coverAt(doc: Doc, roofs: readonly RoofFaces[], at: { x: number; y: number }): number {
  const covers = roofs.flatMap((r) => r.faces.filter((f) => insideRing(f.polygon, at)).map((f) => f.z(at)));
  return covers.length > 0 ? Math.max(...covers) : Math.max(0, ...doc.levels.map((l) => l.elevation + l.height));
}

export interface Stack {
  /** A stack (tubo de queda) carries the fixtures' sewage down; a vent (tubo ventilador) carries none, only air. */
  readonly kind: 'stack' | 'vent';
  readonly runIds: readonly string[];
  readonly at: { readonly x: number; readonly y: number };
  /** Absolute heights of its foot and its open end (m), and its length. */
  readonly bottom: number;
  readonly top: number;
  readonly length: number;
  readonly diameter: number;
  /** A stack's UHC at its foot; a vent's, those of the pipe it vents (at its foot); and that pipe's diameter. */
  readonly uhc: number;
  readonly vented: number;
  /** The least diameter: a stack's by table 6 (not under its largest branch), a vent's by table 2; null past them or with nothing to size. */
  readonly needed: number | null;
  readonly sized: boolean;
  /** The roof over it (or, with none, the top level's ceiling) and how far its open end stands over it (m). */
  readonly cover: number;
  readonly above: number;
  readonly through: boolean;
  /**
   * A vent's group (table 8): the fixtures whose traps it is the nearest vent of, their UHC and whether a
   * toilet is among them, and the vent branch diameter they ask; null for a stack or a vent with none.
   */
  readonly group: { readonly uhc: number; readonly toilet: boolean; readonly needed: number | null } | null;
}

/**
 * The sewer's upright pipes (a run's vertical stretches at one place, 1 m or more of them together): each a
 * stack when it carries fixtures, sized by NBR 8160 table 6 for the building's storeys, or a vent, sized by
 * table 2 for the pipe at its foot and its length; each with its open end over the roof (4.3.5 and 4.3.6:
 * 0.30 m at least). `vented`: false when the sewer has fixtures and no stack or vent reaches over the roof
 * (4.3.11 asks one even of a one-storey building). Roof faces give the cover; without one over it, the top
 * level's ceiling.
 */
export function sewerStacks(doc: Doc, roofs: readonly RoofFaces[]): { stacks: Stack[]; vented: boolean; fixtures: number; traps: TrapVent[] } {
  const net = networksOf(doc).get('sewer');
  if (!net) return { stacks: [], vented: true, fixtures: 0, traps: [] };
  const { dist, via } = fromSources(net, sourcesOf(net));
  const { units, branch } = fixtureLoads(net, dist, via);
  const fixtures = net.points.filter((p) => p.fixture).length;
  // The vertical stretches of runs, joined where they meet into one pipe each.
  const vertical = net.edges.map((e, k) => ({ e, k })).filter(({ e }) => {
    const a = net.nodes[e.a]!;
    const b = net.nodes[e.b]!;
    return e.runId !== undefined && Math.hypot(a.x - b.x, a.y - b.y) < REACH && Math.abs(a.z - b.z) > 0.01;
  });
  const parent = new Map<number, number>();
  const root = (n: number): number => {
    let r = n;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const { e } of vertical) {
    if (!parent.has(e.a)) parent.set(e.a, e.a);
    if (!parent.has(e.b)) parent.set(e.b, e.b);
    parent.set(root(e.a), root(e.b));
  }
  const chains = new Map<number, typeof vertical>();
  for (const v of vertical) chains.set(root(v.e.a), [...(chains.get(root(v.e.a)) ?? []), v]);
  const storeys = doc.levels.length;
  const found: { stack: Omit<Stack, 'group'>; nodes: readonly number[] }[] = [];
  for (const chain of chains.values()) {
    const nodes = [...new Set(chain.flatMap(({ e }) => [e.a, e.b]))];
    const zs = nodes.map((n) => net.nodes[n]!.z);
    const bottom = Math.min(...zs);
    const top = Math.max(...zs);
    if (top - bottom < 1 - 1e-9) continue;
    const foot = nodes[zs.indexOf(bottom)]!;
    const crown = nodes[zs.indexOf(top)]!;
    const at = { x: net.nodes[crown]!.x, y: net.nodes[crown]!.y };
    const carried = Math.max(0, ...chain.map(({ k }) => units.get(k) ?? 0));
    const diameter = Math.max(...chain.map(({ e }) => e.diameter));
    const length = chain.reduce((t, { e }) => t + e.length, 0);
    const inChain = new Set(chain.map(({ k }) => k));
    // What the vent stands on: the pipes at its foot that are not it.
    const below = net.edges.map((e, k) => ({ e, k })).filter(({ e, k }) => !inChain.has(k) && (e.a === foot || e.b === foot));
    const kind = carried > 0 ? 'stack' : 'vent';
    const uhc = kind === 'stack' ? carried : Math.max(0, ...below.map(({ k }) => units.get(k) ?? 0));
    const vented = kind === 'stack' ? diameter : Math.max(0, ...below.map(({ e }) => e.diameter));
    const least = Math.max(0, ...chain.map(({ k }) => branch.get(k) ?? 0));
    const needed = uhc <= 0 ? null : kind === 'stack' ? stackDiameter(uhc, storeys, least) : ventDiameter(vented, uhc, length);
    const cover = coverAt(doc, roofs, at);
    found.push({
      stack: {
        kind,
        runIds: [...new Set(chain.map(({ e }) => e.runId!))],
        at,
        bottom,
        top,
        length,
        diameter,
        uhc,
        vented,
        needed,
        sized: needed === null ? uhc <= 0 : diameter >= needed - 1e-6,
        cover,
        above: top - cover,
        through: top - cover >= VENT_ABOVE - 1e-6,
      },
      nodes,
    });
  }
  found.sort((a, b) => a.stack.at.x - b.stack.at.x || a.stack.at.y - b.stack.at.y);
  // Each trap's vent (table 1): the nearest along the pipes of the vent pipes and the stacks out over the
  // roof (a stack open to the air vents what joins it), measured from the fixture's point.
  const reach = found.map((f) => (f.stack.kind === 'vent' || f.stack.through ? fromSources(net, f.nodes).dist : null));
  const traps: TrapVent[] = [];
  for (const p of net.points) {
    const f = p.fixture ? FIXTURES[p.fixture] : null;
    const node = net.pointNode.get(p.id);
    if (!f || node === undefined) continue;
    let vent: number | null = null;
    let distance: number | null = null;
    reach.forEach((d, i) => {
      const x = d?.get(node);
      if (x !== undefined && (distance === null || x < distance - 1e-9)) (distance = x), (vent = i);
    });
    const most = trapReach(f.dn);
    traps.push({ point: p, dn: f.dn, distance, most, vent, ok: distance !== null && distance <= most + 1e-6 });
  }
  // A vent's group (table 8): the fixtures it is the nearest vent of; its diameter not under that branch's.
  const stacks: Stack[] = found.map(({ stack }, i) => {
    const mine = traps.filter((x) => x.vent === i);
    if (stack.kind !== 'vent' || mine.length === 0) return { ...stack, group: null };
    const uhc = mine.reduce((t, x) => t + FIXTURES[x.point.fixture!].uhc, 0);
    const toilet = mine.some((x) => x.point.fixture === 'toilet');
    const branchNeeded = ventBranchDiameter(uhc, toilet);
    const sized = stack.sized && branchNeeded !== null && stack.diameter >= branchNeeded - 1e-6;
    return { ...stack, sized, group: { uhc, toilet, needed: branchNeeded } };
  });
  return { stacks, vented: fixtures === 0 || stacks.some((s) => s.through), fixtures, traps };
}
