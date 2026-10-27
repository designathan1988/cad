// The load table (quadro de cargas, docs/plano-de-escopo.md phase 13): the electric points by circuit,
// each circuit's load, current, breaker, wire section and voltage drop along its way from the panel
// through the conduits (network.ts). The values used are NBR 5410's as usually tabled, to be confirmed
// in the edition in force: the least sections (1,5 mm² for lighting, 2,5 mm² for the rest), the current
// a copper wire with PVC insulation carries in conduit in a wall (method B1, two loaded conductors), and
// a drop of at most 4 % in a final circuit. A point with no circuit of its own goes in its kind's and
// level's: lighting (IL), general sockets (TUG), each shower its own (TUE). With the rooms (the geometry),
// a circuit serving a wet room or the outside asks for a 30 mA residual-current device (NBR 5410
// 5.1.3.2.2, to confirm); the circuits are spread over the two phases of a 127/220 V supply, the 127 V
// ones each on the lighter phase, the 220 V ones across both. Pure.

import type { Doc } from '../../app/document';
import type { DerivedGeometry } from '../../app/geometry';
import { insideRing } from '../room/derive';
import { fromSources, type Network, networksOf } from './network';
import { type MepPoint, POINT_KINDS, pointLoad, systemIn } from './schema';

/** Breakers' rated currents (A). */
export const BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125] as const;
/** Copper, PVC, method B1, 2 loaded conductors: section (mm²) and the current it carries (A). */
export const AMPACITY: readonly (readonly [number, number])[] = [
  [1.5, 17.5],
  [2.5, 24],
  [4, 32],
  [6, 41],
  [10, 57],
  [16, 76],
  [25, 101],
  [35, 125],
];
/** Copper's resistivity at its working temperature (Ω·mm²/m) and the most drop allowed in a final circuit (%). */
export const RESISTIVITY = 0.0178;
export const MAX_DROP = 4;

export type CircuitKind = 'lighting' | 'tug' | 'tue';

export interface Circuit {
  readonly name: string;
  readonly kind: CircuitKind;
  readonly points: readonly MepPoint[];
  /** VA, V, A. */
  readonly power: number;
  readonly voltage: number;
  readonly current: number;
  /** The breaker (A) and the wire section (mm²); null when no breaker or wire in the tables is enough. */
  readonly breaker: number | null;
  readonly section: number | null;
  /** The way from the panel to its farthest point (m), and the drop there (%); null when it is not connected. */
  readonly length: number | null;
  readonly drop: number | null;
  /** Why it asks for a 30 mA residual-current device (a wet room's use, or 'outside'); null when it does not, or the rooms are not known. */
  readonly dr: string | null;
  /** The phase it is on: A, B, or both (a 220 V circuit). */
  readonly phase: 'A' | 'B' | 'AB';
}

export interface LoadTable {
  readonly circuits: readonly Circuit[];
  readonly total: number;
  /** Points with a load that no conduit reaches from a panel. */
  readonly unreached: readonly MepPoint[];
  readonly hasPanel: boolean;
  /** VA on each phase, and how far apart they are (% of the heavier). */
  readonly phases: { readonly a: number; readonly b: number; readonly imbalance: number };
  /** The probable demand of the whole (VA): its loads under the utility's demand factors. */
  readonly demand: Demand;
}

/**
 * The probable demand (CELG D CT 04/18, section 10, D = a + b + …; the same residential bands as Eletropaulo's):
 * a, lighting and general-purpose outlets, band by band (table 2, residences); b, the electric showers by
 * their number (table 3); the other dedicated outlets whole (no table for an unknown appliance). VA.
 */
export interface Demand {
  readonly general: { readonly load: number; readonly demand: number };
  readonly showers: { readonly count: number; readonly load: number; readonly factor: number; readonly demand: number };
  readonly others: { readonly load: number; readonly demand: number };
  readonly total: number;
}

/** Table 2, residences: each kW band's factor, 0–1, 1–2 … 9–10 kW, and over 10 kW. */
export const GENERAL_BANDS: readonly number[] = [0.86, 0.75, 0.66, 0.59, 0.52, 0.45, 0.4, 0.35, 0.31, 0.27];
export const GENERAL_OVER = 0.24;

/** Lighting and general-purpose outlets' demand (VA) for a load (VA): each kW at its band's factor. */
export function generalDemand(load: number): number {
  const kw = load / 1000;
  let d = 0;
  GENERAL_BANDS.forEach((f, i) => (d += Math.max(0, Math.min(kw, i + 1) - i) * f));
  return (d + Math.max(0, kw - GENERAL_BANDS.length) * GENERAL_OVER) * 1000;
}

/** Table 3, electric showers: the factor for so many (1, 2 … 9, then by ranges; 23 % over 65). */
export function showerFactor(n: number): number {
  const first = [1, 0.68, 0.56, 0.48, 0.43, 0.39, 0.36, 0.33, 0.31];
  if (n <= 0) return 0;
  if (n <= first.length) return first[n - 1]!;
  const ranges: readonly (readonly [number, number])[] = [
    [11, 0.3],
    [15, 0.29],
    [20, 0.28],
    [25, 0.27],
    [40, 0.26],
    [55, 0.25],
    [65, 0.24],
  ];
  return ranges.find(([upTo]) => n <= upTo)?.[1] ?? 0.23;
}

function demandOf(points: readonly MepPoint[]): Demand {
  const load = (ps: readonly MepPoint[]) => ps.reduce((s, p) => s + pointLoad(p).power, 0);
  const general = points.filter((p) => kindOf(p) !== 'tue');
  const showers = points.filter((p) => p.kind === 'shower');
  const others = points.filter((p) => kindOf(p) === 'tue' && p.kind !== 'shower');
  const g = { load: load(general), demand: generalDemand(load(general)) };
  const factor = showerFactor(showers.length);
  const s = { count: showers.length, load: load(showers), factor, demand: load(showers) * factor };
  const o = { load: load(others), demand: load(others) };
  return { general: g, showers: s, others: o, total: g.demand + s.demand + o.demand };
}

/** The room uses NBR 5410 asks a residual-current device for (with a shower or a bath, kitchens, service areas, garages). */
export const DR_USES: readonly string[] = ['bathroom', 'kitchen', 'service', 'garage'];

/** Where a point is: the use of the room it is in, 'outside' in none, null without the geometry. */
function placeOf(g: DerivedGeometry | undefined, p: MepPoint): string | null {
  if (!g) return null;
  const room = [...g.rooms.values()].find((r) => r.room.levelId === p.levelId && r.enclosed && insideRing(r.outline, p.at));
  return room ? (room.room.use ?? 'other') : 'outside';
}

/** The circuits over two phases: the heaviest 127 V ones first, each on the lighter phase; a 220 V one on both, half on each. */
export function balance(circuits: readonly { power: number; voltage: number }[]): { phases: ('A' | 'B' | 'AB')[]; a: number; b: number } {
  let a = 0;
  let b = 0;
  const phases: ('A' | 'B' | 'AB')[] = circuits.map(() => 'A');
  circuits.forEach((c, i) => {
    if (c.voltage >= 200) {
      phases[i] = 'AB';
      a += c.power / 2;
      b += c.power / 2;
    }
  });
  const single = circuits.map((c, i) => ({ c, i })).filter((x) => x.c.voltage < 200).sort((x, y) => y.c.power - x.c.power || x.i - y.i);
  for (const { c, i } of single) {
    if (a <= b) {
      phases[i] = 'A';
      a += c.power;
    } else {
      phases[i] = 'B';
      b += c.power;
    }
  }
  return { phases, a, b };
}

const kindOf = (p: MepPoint): CircuitKind => (p.kind === 'shower' ? 'tue' : POINT_KINDS[p.kind].discipline === 'lighting' ? 'lighting' : 'tug');

/** A circuit's name when a point gives none: its kind and level's number, a shower its own. */
function autoName(doc: Doc, p: MepPoint, showers: Map<string, number>): string {
  const order = [...doc.levels].sort((a, b) => a.elevation - b.elevation).findIndex((l) => l.id === p.levelId) + 1;
  const k = kindOf(p);
  if (k === 'tue') {
    if (!showers.has(p.id)) showers.set(p.id, showers.size + 1);
    return `TUE${showers.get(p.id)}`;
  }
  return `${k === 'lighting' ? 'IL' : 'TUG'}${order}`;
}

/** The breaker and the section for a current: the least breaker over it, the least wire that carries the breaker's current. */
export function protect(current: number, kind: CircuitKind): { breaker: number | null; section: number | null } {
  const breaker = BREAKERS.find((b) => b >= current - 1e-9) ?? null;
  if (breaker === null) return { breaker: null, section: null };
  const least = kind === 'lighting' ? 1.5 : 2.5;
  const section = AMPACITY.find(([s, iz]) => s >= least && iz >= breaker)?.[0] ?? null;
  return { breaker, section };
}

/** The drop (%) along a length (m) of a two-wire circuit carrying a current at a voltage over a section. */
export const voltageDrop = (length: number, current: number, section: number, voltage: number): number => ((2 * RESISTIVITY * length * current) / section / voltage) * 100;

export function loadTable(doc: Doc, g?: DerivedGeometry): LoadTable {
  const electric = doc.mepPoints.filter((p) => {
    const d = systemIn(doc, p.systemId)?.discipline ?? POINT_KINDS[p.kind].discipline;
    return (d === 'power' || d === 'lighting') && pointLoad(p).power > 0;
  });
  const net: Network | undefined = networksOf(doc).get('electric');
  const panels = net ? net.points.filter((p) => p.kind === 'panel').map((p) => net.pointNode.get(p.id)!) : [];
  const reach = net && panels.length > 0 ? fromSources(net, panels).dist : new Map<number, number>();
  const showers = new Map<string, number>();
  const groups = new Map<string, MepPoint[]>();
  for (const p of electric) {
    const name = p.circuit?.trim() || autoName(doc, p, showers);
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(p);
  }
  const unreached: MepPoint[] = [];
  const circuits = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([name, points]): Circuit => {
      const power = points.reduce((s, p) => s + pointLoad(p).power, 0);
      const voltage = Math.max(...points.map((p) => pointLoad(p).voltage));
      const current = power / voltage;
      const kind: CircuitKind = points.some((p) => kindOf(p) === 'tue') ? 'tue' : points.every((p) => kindOf(p) === 'lighting') ? 'lighting' : 'tug';
      const { breaker, section } = protect(current, kind);
      const lengths = points.map((p) => (net ? reach.get(net.pointNode.get(p.id)!) : undefined));
      points.forEach((p, i) => lengths[i] === undefined && unreached.push(p));
      const known = lengths.filter((x): x is number => x !== undefined);
      const length = known.length === points.length && known.length > 0 ? Math.max(...known) : null;
      const drop = length !== null && section !== null ? voltageDrop(length, current, section, voltage) : null;
      const places = points.map((x) => placeOf(g, x));
      const dr = places.find((x) => x === 'outside') ?? places.find((x) => x !== null && DR_USES.includes(x)) ?? null;
      return { name, kind, points, power, voltage, current, breaker, section, length, drop, dr, phase: 'A' as const };
    });
  const { phases, a, b } = balance(circuits);
  const placed = circuits.map((c, i) => ({ ...c, phase: phases[i]! }));
  const heavier = Math.max(a, b);
  return {
    circuits: placed,
    total: circuits.reduce((s, c) => s + c.power, 0),
    unreached,
    hasPanel: panels.length > 0,
    phases: { a, b, imbalance: heavier > 0 ? ((heavier - Math.min(a, b)) / heavier) * 100 : 0 },
    demand: demandOf(electric),
  };
}
